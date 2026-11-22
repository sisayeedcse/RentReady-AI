import {
  bdtToPaisa,
  isBanglalinkPrefix,
  requiresConfirmation,
  VoiceActionPayloadSchema
} from "@rentready/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { EnvBindings } from "../app.js";
import {
  type AuthVariables,
  getCurrentDhakaBillingMonth,
  getCurrentDhakaDate,
  requireAuth
} from "../lib/supabase.js";
import {
  buildRentReminderSms,
  dispatchApplinkSmsViaRelay
} from "../modules/notifications/applink.js";
import { GroqWhisperProvider } from "../modules/voice/asr.js";
import { DEFAULT_INTENT_MODEL, extractVoiceIntent } from "../modules/voice/extractor.js";
import {
  type PropertyCandidate,
  resolvePropertyEntity,
  resolveTenancyEntity,
  type TenancyCandidate
} from "../modules/voice/resolver.js";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB cap

export function createVoiceRoutes(): Hono<{ Bindings: EnvBindings; Variables: AuthVariables }> {
  const r = new Hono<{ Bindings: EnvBindings; Variables: AuthVariables }>();
  r.use("*", requireAuth);

  // Step 1-2: Audio -> Replaceable ASR (Groq Whisper Turbo) -> Text-only session
  r.post("/transcribe", async (c) => {
    const groqKey = c.env.GROQ_API_KEY;
    if (!groqKey) {
      return c.json({ error: "GROQ_API_KEY is not configured on server" }, 503);
    }

    const formData = await c.req.formData().catch(() => null);
    const rawFile = formData?.get("audio");
    if (!rawFile || typeof rawFile === "string") {
      return c.json({ error: "Missing 'audio' file in multipart form-data" }, 400);
    }
    const file = rawFile as File;
    if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return c.json({ error: "Audio file must be between 1 byte and 5 MB" }, 400);
    }

    const provider = new GroqWhisperProvider(groqKey);
    const audioBuffer = await file.arrayBuffer();
    const result = await provider.transcribe({
      audio: audioBuffer,
      filename: file.name || "voice.webm",
      mimeType: file.type || "audio/webm",
      languageHint: "bn"
    });

    const { data: session, error } = await c.var.supabase
      .from("voice_sessions")
      .insert({
        landlord_id: c.var.userId,
        asr_provider: result.provider,
        raw_transcript: result.transcript,
        audio_duration_ms: result.durationMs ?? null
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 500);
    return c.json({
      session_id: session.id,
      transcript: result.transcript,
      provider: result.provider
    });
  });

  // Step 3-6: Editable Transcript -> OpenRouter Pinned Extraction -> Zod -> Deterministic Resolution
  // NEVER writes to financial ledger or sends SMS!
  r.post("/interpret", async (c) => {
    const body = z
      .object({
        transcript: z.string().trim().min(2).max(600),
        session_id: z.string().uuid().optional()
      })
      .safeParse(await c.req.json().catch(() => null));

    if (!body.success) {
      return c.json({ error: "Invalid transcript payload", details: body.error.flatten() }, 400);
    }

    const openRouterKey = c.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return c.json({ error: "OPENROUTER_API_KEY is not configured on server" }, 503);
    }

    const supabase = c.var.supabase;
    let sessionId = body.data.session_id;
    if (sessionId) {
      await supabase
        .from("voice_sessions")
        .update({ edited_transcript: body.data.transcript })
        .eq("id", sessionId);
    } else {
      const { data: created } = await supabase
        .from("voice_sessions")
        .insert({
          landlord_id: c.var.userId,
          asr_provider: "text_fallback",
          raw_transcript: body.data.transcript,
          edited_transcript: body.data.transcript
        })
        .select("id")
        .single();
      sessionId = created?.id;
    }

    const { payload, modelUsed } = await extractVoiceIntent({
      transcript: body.data.transcript,
      apiKey: openRouterKey,
      model: c.env.OPENROUTER_INTENT_MODEL || DEFAULT_INTENT_MODEL
    });

    // Fetch landlord's active tenancies and properties for deterministic resolution
    const [tenanciesRes, propertiesRes] = await Promise.all([
      supabase
        .from("tenancies")
        .select("id, tenant_id, unit_id, monthly_rent_paisa, tenants(full_name, phone_e164), units(unit_code, property_id, properties(name))")
        .eq("status", "active"),
      supabase.from("properties").select("id, name").eq("is_archived", false)
    ]);

    const tenancies: TenancyCandidate[] = (tenanciesRes.data ?? []).map((row) => {
      const t = row.tenants as unknown as { full_name: string; phone_e164: string } | null;
      const u = row.units as unknown as {
        unit_code: string;
        property_id: string;
        properties: { name: string } | null;
      } | null;
      return {
        tenancy_id: row.id,
        tenant_id: row.tenant_id,
        tenant_name: t?.full_name ?? "Unknown",
        tenant_phone: t?.phone_e164 ?? "",
        unit_id: row.unit_id,
        unit_code: u?.unit_code ?? "",
        property_id: u?.property_id ?? "",
        property_name: u?.properties?.name ?? "",
        monthly_rent_paisa: row.monthly_rent_paisa
      };
    });

    const properties: PropertyCandidate[] = (propertiesRes.data ?? []).map((p) => ({
      property_id: p.id,
      name: p.name
    }));

    // Read-only intents execute deterministic DB queries immediately
    if (!requiresConfirmation(payload.intent)) {
      if (payload.intent === "unknown") {
        return c.json({ status: "unknown", intent: payload.intent, reason: payload.reason, model: modelUsed });
      }
      if (payload.intent === "get_property_summary" || payload.intent === "get_monthly_collection") {
        const { data: summary } = await supabase.from("v_dashboard_summary").select("*").maybeSingle();
        return c.json({ status: "answered", intent: payload.intent, data: summary, model: modelUsed });
      }
      if (payload.intent === "get_outstanding_rent") {
        let q = supabase.from("v_obligation_balances").select("*").eq("obligation_status", "open").gt("outstanding_paisa", 0);
        if (payload.unit_code_query) q = q.ilike("unit_code", payload.unit_code_query);
        if (payload.tenant_name_query) q = q.ilike("tenant_name", `%${payload.tenant_name_query}%`);
        const { data } = await q.order("due_date", { ascending: true });
        return c.json({ status: "answered", intent: payload.intent, data: data ?? [], model: modelUsed });
      }
      if (payload.intent === "get_payment_history") {
        const resolved = resolveTenancyEntity(tenancies, payload);
        if (resolved.status !== "resolved") {
          return c.json({ status: "needs_clarification", intent: payload.intent, resolution: resolved });
        }
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("tenancy_id", resolved.match.tenancy_id)
          .order("paid_at", { ascending: false })
          .limit(payload.limit);
        return c.json({ status: "answered", intent: payload.intent, tenant: resolved.match, data: data ?? [] });
      }
    }

    // Write / SMS intents: resolve entities and save as 'proposed' or 'needs_clarification'
    let resolvedEntities: Record<string, unknown> = {};
    let actionStatus: "proposed" | "needs_clarification" = "proposed";

    if (payload.intent === "record_rent_payment" || payload.intent === "prepare_rent_reminder") {
      const resolved = resolveTenancyEntity(tenancies, payload);
      if (resolved.status !== "resolved") {
        actionStatus = "needs_clarification";
        resolvedEntities = { resolution: resolved };
      } else {
        const { data: openObls } = await supabase
          .from("v_obligation_balances")
          .select("*")
          .eq("tenancy_id", resolved.match.tenancy_id)
          .eq("obligation_status", "open")
          .gt("outstanding_paisa", 0)
          .order("billing_month", { ascending: true });

        const totalOutstanding = (openObls ?? []).reduce(
          (sum, row) => sum + Number(row.outstanding_paisa ?? 0),
          0
        );

        const smsPreview =
          payload.intent === "prepare_rent_reminder"
            ? buildRentReminderSms({
                tenantName: resolved.match.tenant_name,
                unitCode: resolved.match.unit_code,
                outstandingPaisa: totalOutstanding,
                billingMonth: payload.billing_month ?? getCurrentDhakaBillingMonth().slice(0, 7),
                language: payload.language
              })
            : null;

        resolvedEntities = {
          tenancy: resolved.match,
          total_outstanding_paisa: totalOutstanding,
          is_banglalink: isBanglalinkPrefix(resolved.match.tenant_phone),
          sms_preview: smsPreview
        };
      }
    } else if (payload.intent === "record_expense" || payload.intent === "create_maintenance_request") {
      const resolvedProp = resolvePropertyEntity(properties, payload.property_name_query);
      if (resolvedProp.status !== "resolved") {
        actionStatus = "needs_clarification";
        resolvedEntities = { resolution: resolvedProp };
      } else {
        resolvedEntities = { property: resolvedProp.match };
      }
    }

    const { data: actionRow, error: actErr } = await supabase
      .from("voice_actions")
      .insert({
        landlord_id: c.var.userId,
        session_id: sessionId,
        intent_name: payload.intent,
        extracted_payload: payload,
        resolved_entities: resolvedEntities,
        status: actionStatus
      })
      .select()
      .single();

    if (actErr) return c.json({ error: actErr.message }, 500);

    return c.json({
      action_id: actionRow.id,
      status: actionStatus,
      requires_confirmation: true,
      intent: payload.intent,
      extracted_payload: payload,
      resolved_entities: resolvedEntities,
      model: modelUsed
    });
  });

  // Step 7-9: Explicit Human Confirmation -> Deterministic Backend Execution + Audit Log
  r.post("/actions/:id/confirm", async (c) => {
    const body = z
      .object({
        idempotency_key: z.string().trim().min(8).max(128),
        selected_tenancy_id: z.string().uuid().optional(),
        selected_property_id: z.string().uuid().optional(),
        edited_message: z.string().trim().min(5).max(480).optional()
      })
      .safeParse(await c.req.json().catch(() => null));

    if (!body.success) {
      return c.json({ error: "Confirmation requires a valid idempotency_key" }, 400);
    }

    const supabase = c.var.supabase;
    const { data: actionRow, error: fetchErr } = await supabase
      .from("voice_actions")
      .select("*")
      .eq("id", c.req.param("id"))
      .single();
    if (fetchErr || !actionRow) return c.json({ error: "Voice action not found" }, 404);
    if (actionRow.status === "executed") {
      return c.json({ status: "executed", idempotent_replay: true, executed_record_id: actionRow.executed_record_id });
    }

    const payload = VoiceActionPayloadSchema.parse(actionRow.extracted_payload);
    const resolved = (actionRow.resolved_entities ?? {}) as Record<string, unknown>;

    if (payload.intent === "record_rent_payment") {
      const tenancyObj = resolved.tenancy as TenancyCandidate | undefined;
      const tenancyId = body.data.selected_tenancy_id ?? tenancyObj?.tenancy_id;
      if (!tenancyId) return c.json({ error: "Tenancy clarification required before confirming" }, 400);

      const { data: rpcRes, error: rpcErr } = await supabase.rpc("record_payment_atomic", {
        p_tenancy_id: tenancyId,
        p_amount_paisa: bdtToPaisa(payload.amount_bdt),
        p_payment_method: payload.payment_method,
        p_idempotency_key: body.data.idempotency_key,
        p_reference_no: payload.reference_no ?? null,
        p_notes: payload.notes ?? "Recorded via Bangla Voice Copilot",
        p_source: "voice"
      });
      if (rpcErr) return c.json({ error: rpcErr.message }, 400);

      const paymentId = (rpcRes as { payment_id?: string } | null)?.payment_id ?? null;
      await supabase
        .from("voice_actions")
        .update({
          status: "executed",
          executed_record_id: paymentId,
          idempotency_key: body.data.idempotency_key,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: rpcRes });
    }

    if (payload.intent === "record_expense") {
      const propObj = resolved.property as PropertyCandidate | undefined;
      const propertyId = body.data.selected_property_id ?? propObj?.property_id;
      if (!propertyId) return c.json({ error: "Property clarification required before confirming" }, 400);

      const { data: exp, error: expErr } = await supabase
        .from("expenses")
        .insert({
          landlord_id: c.var.userId,
          property_id: propertyId,
          category_name: payload.category_query,
          amount_paisa: bdtToPaisa(payload.amount_bdt),
          incurred_on: payload.incurred_on ?? getCurrentDhakaDate(),
          description: payload.description,
          idempotency_key: body.data.idempotency_key
        })
        .select()
        .single();
      if (expErr) return c.json({ error: expErr.message }, 400);

      await supabase
        .from("voice_actions")
        .update({
          status: "executed",
          executed_record_id: exp.id,
          idempotency_key: body.data.idempotency_key,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: exp });
    }

    if (payload.intent === "create_maintenance_request") {
      const propObj = resolved.property as PropertyCandidate | undefined;
      const propertyId = body.data.selected_property_id ?? propObj?.property_id;
      if (!propertyId) return c.json({ error: "Property clarification required before confirming" }, 400);

      const { data: reqRow, error: mErr } = await supabase
        .from("maintenance_requests")
        .insert({
          landlord_id: c.var.userId,
          property_id: propertyId,
          title: payload.title,
          description: payload.description,
          priority: payload.priority
        })
        .select()
        .single();
      if (mErr) return c.json({ error: mErr.message }, 400);

      await supabase
        .from("voice_actions")
        .update({
          status: "executed",
          executed_record_id: reqRow.id,
          idempotency_key: body.data.idempotency_key,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: reqRow });
    }

    if (payload.intent === "prepare_rent_reminder") {
      const tenancyObj = resolved.tenancy as TenancyCandidate | undefined;
      if (!tenancyObj) return c.json({ error: "Tenancy clarification required before sending SMS" }, 400);

      const relayUrl = c.env.APPLINK_RELAY_URL;
      const relaySecret = c.env.RELAY_SHARED_SECRET;
      if (!relayUrl || !relaySecret) {
        return c.json({ error: "AppLink fixed-IP relay is not configured on server" }, 503);
      }

      const smsText = body.data.edited_message ?? String(resolved.sms_preview ?? "");
      if (!smsText) return c.json({ error: "SMS message body is empty" }, 400);

      const { data: notif, error: nErr } = await supabase
        .from("notifications")
        .insert({
          landlord_id: c.var.userId,
          tenant_id: tenancyObj.tenant_id,
          channel: "applink_sms",
          template_type: "rent_reminder",
          recipient_phone_e164: tenancyObj.tenant_phone,
          message_body: smsText,
          status: "queued",
          idempotency_key: body.data.idempotency_key
        })
        .select()
        .single();
      if (nErr) return c.json({ error: nErr.message }, 400);

      const relayRes = await dispatchApplinkSmsViaRelay({
        relayUrl,
        sharedSecret: relaySecret,
        phoneE164: tenancyObj.tenant_phone,
        message: smsText
      });

      const finalStatus = relayRes.ok ? "sent" : "failed";
      await supabase.from("notifications").update({ status: finalStatus }).eq("id", notif.id);
      await supabase.from("notification_logs").insert({
        landlord_id: c.var.userId,
        notification_id: notif.id,
        provider: "applink",
        provider_request_id: relayRes.requestId,
        provider_status_code: relayRes.statusCode,
        provider_status_detail: relayRes.statusDetail,
        http_status: relayRes.httpStatus
      });

      await supabase
        .from("voice_actions")
        .update({
          status: relayRes.ok ? "executed" : "failed",
          executed_record_id: notif.id,
          idempotency_key: body.data.idempotency_key,
          confirmed_at: new Date().toISOString()
        })
        .eq("id", actionRow.id);

      return c.json({ status: relayRes.ok ? "executed" : "failed", provider: relayRes }, relayRes.ok ? 200 : 502);
    }

    return c.json({ error: `Unsupported confirmation intent: ${payload.intent}` }, 400);
  });

  r.post("/actions/:id/reject", async (c) => {
    const { data, error } = await c.var.supabase
      .from("voice_actions")
      .update({ status: "rejected" })
      .eq("id", c.req.param("id"))
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });

  return r;
}
