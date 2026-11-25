import {
  bdtToPaisa,
  isBanglalinkPrefix,
  requiresConfirmation,
  UuidSchema,
  VoiceActionPayloadSchema
} from "@rentready/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { EnvBindings } from "../app.js";
import {
  createRateLimiter,
  escapeIlikePattern,
  logSecurityEvent,
  mapSafeDbError,
  runWithPgrst201Fallback,
  validateAudioUpload
} from "../lib/security.js";
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
import { GeminiAudioAsrProvider } from "../modules/voice/asr.js";
import {
  DEFAULT_GEMINI_MODEL,
  extractVoiceIntent,
  IntentProviderRateLimitError
} from "../modules/voice/extractor.js";
import {
  type PropertyCandidate,
  resolvePropertyEntity,
  resolveTenancyEntity,
  type TenancyCandidate
} from "../modules/voice/resolver.js";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB cap

export interface VoiceRouteOptions {
  voiceRateLimitMax?: number;
}

export function createVoiceRoutes(
  options: VoiceRouteOptions = {}
): Hono<{ Bindings: EnvBindings; Variables: AuthVariables }> {
  const r = new Hono<{ Bindings: EnvBindings; Variables: AuthVariables }>();
  r.use("*", requireAuth);

  const transcribeLimiter = createRateLimiter({
    bucketName: "voice_transcribe",
    maxRequests: options.voiceRateLimitMax ?? 20,
    windowMs: 15 * 60_000,
    keyBy: "user_or_ip"
  });

  const interpretLimiter = createRateLimiter({
    bucketName: "voice_interpret",
    maxRequests: options.voiceRateLimitMax ?? 30,
    windowMs: 15 * 60_000,
    keyBy: "user_or_ip"
  });

  const confirmLimiter = createRateLimiter({
    bucketName: "voice_confirm",
    maxRequests: options.voiceRateLimitMax ?? 30,
    windowMs: 15 * 60_000,
    keyBy: "user_or_ip"
  });

  // Step 1-2: Audio -> Replaceable ASR (Google Gemini Native Audio) -> Text-only session
  r.post("/transcribe", transcribeLimiter, async (c) => {
    const geminiKey = c.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return c.json({ error: "Voice transcription service is not configured on server" }, 503);
    }

    const contentLength = c.req.header("content-length");
    if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES + 256 * 1024) {
      return c.json({ error: "Audio payload exceeds maximum 5 MB limit" }, 413);
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

    const audioBuffer = await file.arrayBuffer();
    const audioValidation = validateAudioUpload(file.type, audioBuffer);
    if (!audioValidation.ok) {
      logSecurityEvent("warn", "invalid_audio_upload_rejected", {
        request_id: c.var.requestId,
        declared_mime: file.type || "none",
        size: file.size
      });
      return c.json({ error: audioValidation.error }, 400);
    }

    const provider = new GeminiAudioAsrProvider(
      geminiKey,
      c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
    );
    let result: Awaited<ReturnType<GeminiAudioAsrProvider["transcribe"]>>;
    try {
      result = await provider.transcribe({
        audio: audioBuffer,
        filename: "voice.audio",
        mimeType: audioValidation.normalizedMimeType,
        languageHint: "bn"
      });
    } catch (err) {
      logSecurityEvent("warn", "asr_transcription_failed", {
        request_id: c.var.requestId,
        reason: err instanceof Error ? err.message : "unknown"
      });
      return c.json({ error: "Audio transcription failed. Please try again or type your entry." }, 502);
    }

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

    if (error) {
      const mapped = mapSafeDbError(error, "create_voice_session", c.var.requestId);
      return c.json({ error: mapped.message }, mapped.status);
    }
    return c.json({
      session_id: session.id,
      transcript: result.transcript,
      provider: result.provider
    });
  });

  // Step 3-6: Editable Transcript -> Pinned Gemini JSON Extraction -> Zod -> Deterministic Resolution
  // NEVER writes to financial ledger or sends SMS!
  r.post("/interpret", interpretLimiter, async (c) => {
    const body = z
      .object({
        transcript: z.string().trim().min(2).max(600),
        session_id: UuidSchema.optional()
      })
      .safeParse(await c.req.json().catch(() => null));

    if (!body.success) {
      return c.json({ error: "Invalid transcript payload", details: z.flattenError(body.error) }, 400);
    }

    const geminiKey = c.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return c.json({ error: "AI assistant service is not configured on server" }, 503);
    }

    const supabase = c.var.supabase;
    let sessionId = body.data.session_id;
    if (sessionId) {
      const { data: updatedSession } = await supabase
        .from("voice_sessions")
        .update({ edited_transcript: body.data.transcript })
        .eq("id", sessionId)
        .select("id")
        .maybeSingle();
      if (!updatedSession) {
        sessionId = undefined;
      }
    }
    if (!sessionId) {
      const { data: created, error: sessErr } = await supabase
        .from("voice_sessions")
        .insert({
          landlord_id: c.var.userId,
          asr_provider: "text_fallback",
          raw_transcript: body.data.transcript,
          edited_transcript: body.data.transcript
        })
        .select("id")
        .single();
      if (sessErr || !created) {
        const mapped = mapSafeDbError(sessErr, "create_text_voice_session", c.var.requestId);
        return c.json({ error: mapped.message }, mapped.status);
      }
      sessionId = created.id;
    }

    let extracted: { payload: import("@rentready/shared").VoiceActionPayload; modelUsed: string };
    try {
      extracted = await extractVoiceIntent({
        transcript: body.data.transcript,
        apiKey: geminiKey,
        model: c.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
      });
    } catch (err) {
      if (err instanceof IntentProviderRateLimitError) {
        return c.json({ error: "AI assistant is temporarily rate-limited. Please retry in a few seconds." }, 429);
      }
      logSecurityEvent("warn", "intent_extraction_failed", {
        request_id: c.var.requestId,
        reason: err instanceof Error ? err.message : "unknown"
      });
      return c.json({ error: "Could not analyze voice command right now. Please try again." }, 502);
    }
    const { payload, modelUsed } = extracted;

    // Fetch landlord's active tenancies and properties for deterministic resolution
    const [tenanciesRes, propertiesRes] = await Promise.all([
      runWithPgrst201Fallback(
        () =>
          supabase
            .from("tenancies")
            .select("id, tenant_id, unit_id, monthly_rent_paisa, tenants(full_name, phone_e164), units(unit_code, property_id, properties(name))")
            .eq("status", "active"),
        () =>
          supabase
            .from("tenancies")
            .select(
              "id, tenant_id, unit_id, monthly_rent_paisa, tenants!fk_tenancies_tenant_landlord(full_name, phone_e164), units!fk_tenancies_unit_landlord(unit_code, property_id, properties!fk_units_property_landlord(name))"
            )
            .eq("status", "active")
      ),
      supabase.from("properties").select("id, name").eq("is_archived", false)
    ]);

    if (tenanciesRes.error) {
      const mapped = mapSafeDbError(tenanciesRes.error, "voice_list_tenancies", c.var.requestId);
      return c.json({ error: mapped.message }, mapped.status);
    }
    if (propertiesRes.error) {
      const mapped = mapSafeDbError(propertiesRes.error, "voice_list_properties", c.var.requestId);
      return c.json({ error: mapped.message }, mapped.status);
    }

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
        if (payload.unit_code_query) {
          q = q.ilike("unit_code", escapeIlikePattern(payload.unit_code_query));
        }
        if (payload.tenant_name_query) {
          q = q.ilike("tenant_name", `%${escapeIlikePattern(payload.tenant_name_query)}%`);
        }
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

    if (actErr) {
      const mapped = mapSafeDbError(actErr, "create_voice_action", c.var.requestId);
      return c.json({ error: mapped.message }, mapped.status);
    }

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
  r.post("/actions/:id/confirm", confirmLimiter, async (c) => {
    const actionIdParsed = UuidSchema.safeParse(c.req.param("id"));
    if (!actionIdParsed.success) {
      return c.json({ error: "Invalid voice action ID" }, 400);
    }

    const body = z
      .object({
        idempotency_key: z
          .string()
          .trim()
          .min(8)
          .max(128)
          .regex(/^[A-Za-z0-9._:-]+$/),
        selected_tenancy_id: UuidSchema.optional(),
        selected_property_id: UuidSchema.optional(),
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
      .eq("id", actionIdParsed.data)
      .single();
    if (fetchErr || !actionRow) return c.json({ error: "Voice action not found" }, 404);

    if (actionRow.status === "executed") {
      return c.json({
        status: "executed",
        idempotent_replay: true,
        executed_record_id: actionRow.executed_record_id
      });
    }

    if (actionRow.status !== "proposed" && actionRow.status !== "needs_clarification") {
      logSecurityEvent("warn", "voice_action_invalid_state_confirm", {
        request_id: c.var.requestId,
        action_id: actionRow.id,
        current_status: actionRow.status
      });
      return c.json({ error: "This voice action has already been cancelled, failed, or is in progress." }, 409);
    }

    const payload = VoiceActionPayloadSchema.parse(actionRow.extracted_payload);
    const resolved = (actionRow.resolved_entities ?? {}) as Record<string, unknown>;
    const resolutionObj = resolved.resolution as
      | { status?: string; candidates?: Array<{ tenancy_id?: string; property_id?: string; tenant_id?: string; tenant_name?: string; tenant_phone?: string; unit_code?: string }> }
      | undefined;
    const candidates = resolutionObj?.candidates ?? [];

    // Resolve and strictly validate entity selection BEFORE claiming
    let targetTenancy: TenancyCandidate | undefined;
    let targetPropertyId: string | undefined;

    if (payload.intent === "record_rent_payment" || payload.intent === "prepare_rent_reminder") {
      if (actionRow.status === "proposed") {
        targetTenancy = resolved.tenancy as TenancyCandidate | undefined;
      } else {
        if (!body.data.selected_tenancy_id) {
          return c.json({ error: "Tenancy clarification required before confirming" }, 400);
        }
        const matchedCandidate = candidates.find((cand) => cand.tenancy_id === body.data.selected_tenancy_id);
        if (!matchedCandidate) {
          logSecurityEvent("warn", "voice_entity_tampering_blocked", {
            request_id: c.var.requestId,
            action_id: actionRow.id,
            field: "selected_tenancy_id"
          });
          return c.json({ error: "Selected tenancy does not match allowed clarification candidates" }, 400);
        }
        targetTenancy = matchedCandidate as unknown as TenancyCandidate;
      }
      if (!targetTenancy?.tenancy_id) {
        return c.json({ error: "Tenancy clarification required before confirming" }, 400);
      }
    }

    if (payload.intent === "record_expense" || payload.intent === "create_maintenance_request") {
      if (actionRow.status === "proposed") {
        targetPropertyId = (resolved.property as PropertyCandidate | undefined)?.property_id;
      } else {
        if (!body.data.selected_property_id) {
          return c.json({ error: "Property clarification required before confirming" }, 400);
        }
        const matchedProp = candidates.find((cand) => cand.property_id === body.data.selected_property_id);
        if (!matchedProp) {
          logSecurityEvent("warn", "voice_entity_tampering_blocked", {
            request_id: c.var.requestId,
            action_id: actionRow.id,
            field: "selected_property_id"
          });
          return c.json({ error: "Selected property does not match allowed clarification candidates" }, 400);
        }
        targetPropertyId = matchedProp.property_id;
      }
      if (!targetPropertyId) {
        return c.json({ error: "Property clarification required before confirming" }, 400);
      }
    }

    // Atomically claim the voice action to prevent concurrent double execution
    const { data: claimed } = await supabase
      .from("voice_actions")
      .update({
        status: "confirmed",
        idempotency_key: body.data.idempotency_key,
        confirmed_at: new Date().toISOString()
      })
      .eq("id", actionRow.id)
      .in("status", ["proposed", "needs_clarification"])
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return c.json({ error: "Voice action is already being processed or has been finalized." }, 409);
    }

    if (payload.intent === "record_rent_payment" && targetTenancy) {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("record_payment_atomic", {
        p_tenancy_id: targetTenancy.tenancy_id,
        p_amount_paisa: bdtToPaisa(payload.amount_bdt),
        p_payment_method: payload.payment_method,
        p_idempotency_key: body.data.idempotency_key,
        p_reference_no: payload.reference_no ?? null,
        p_notes: payload.notes ?? "Recorded via Bangla Voice Copilot",
        p_source: "voice"
      });
      if (rpcErr) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        const mapped = mapSafeDbError(rpcErr, "voice_confirm_payment", c.var.requestId);
        return c.json({ error: mapped.message }, mapped.status);
      }

      const paymentId = (rpcRes as { payment_id?: string } | null)?.payment_id ?? null;
      await supabase
        .from("voice_actions")
        .update({ status: "executed", executed_record_id: paymentId })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: rpcRes });
    }

    if (payload.intent === "record_expense" && targetPropertyId) {
      let exp: Record<string, unknown> | null = null;
      const { data: existingExp } = await supabase
        .from("expenses")
        .select("*")
        .eq("idempotency_key", body.data.idempotency_key)
        .maybeSingle();

      if (existingExp) {
        exp = existingExp;
      } else {
        const { data: createdExp, error: expErr } = await supabase
          .from("expenses")
          .insert({
            landlord_id: c.var.userId,
            property_id: targetPropertyId,
            category_name: payload.category_query,
            amount_paisa: bdtToPaisa(payload.amount_bdt),
            incurred_on: payload.incurred_on ?? getCurrentDhakaDate(),
            description: payload.description,
            idempotency_key: body.data.idempotency_key
          })
          .select()
          .single();
        if (expErr) {
          await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
          const mapped = mapSafeDbError(expErr, "voice_confirm_expense", c.var.requestId);
          return c.json({ error: mapped.message }, mapped.status);
        }
        exp = createdExp;

        await supabase.from("audit_logs").insert({
          landlord_id: c.var.userId,
          actor_user_id: c.var.userId,
          entity_type: "expense",
          entity_id: createdExp.id,
          action: "record_expense",
          source: "voice",
          after_data: createdExp
        });
      }

      await supabase
        .from("voice_actions")
        .update({ status: "executed", executed_record_id: exp ? String(exp.id) : null })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: exp });
    }

    if (payload.intent === "create_maintenance_request" && targetPropertyId) {
      const { data: reqRow, error: mErr } = await supabase
        .from("maintenance_requests")
        .insert({
          landlord_id: c.var.userId,
          property_id: targetPropertyId,
          title: payload.title,
          description: payload.description,
          priority: payload.priority
        })
        .select()
        .single();
      if (mErr) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        const mapped = mapSafeDbError(mErr, "voice_confirm_maintenance", c.var.requestId);
        return c.json({ error: mapped.message }, mapped.status);
      }

      await supabase.from("audit_logs").insert({
        landlord_id: c.var.userId,
        actor_user_id: c.var.userId,
        entity_type: "maintenance_request",
        entity_id: reqRow.id,
        action: "create_maintenance_request",
        source: "voice",
        after_data: reqRow
      });

      await supabase
        .from("voice_actions")
        .update({ status: "executed", executed_record_id: reqRow.id })
        .eq("id", actionRow.id);

      return c.json({ status: "executed", result: reqRow });
    }

    if (payload.intent === "prepare_rent_reminder" && targetTenancy) {
      const relayUrl = c.env.APPLINK_RELAY_URL;
      const relaySecret = c.env.RELAY_SHARED_SECRET;
      if (!relayUrl || !relaySecret) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        return c.json({ error: "AppLink fixed-IP relay is not configured on server" }, 503);
      }

      // Always verify tenant phone authoritatively from DB
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id, full_name, phone_e164")
        .eq("id", targetTenancy.tenant_id)
        .single();
      if (!tenantRow) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        return c.json({ error: "Tenant not found" }, 404);
      }

      const smsText = body.data.edited_message ?? String(resolved.sms_preview ?? "").trim();
      if (smsText.length < 5) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        return c.json({ error: "SMS message body is empty or too short" }, 400);
      }

      const { data: existingNotif } = await runWithPgrst201Fallback(
        () =>
          supabase
            .from("notifications")
            .select("*, notification_logs(*)")
            .eq("idempotency_key", body.data.idempotency_key)
            .maybeSingle(),
        () =>
          supabase
            .from("notifications")
            .select("*, notification_logs!fk_notification_logs_notification_landlord(*)")
            .eq("idempotency_key", body.data.idempotency_key)
            .maybeSingle()
      );
      if (existingNotif) {
        await supabase
          .from("voice_actions")
          .update({ status: "executed", executed_record_id: existingNotif.id })
          .eq("id", actionRow.id);
        return c.json({ status: "executed", idempotent_replay: true, notification: existingNotif });
      }

      const { data: notif, error: nErr } = await supabase
        .from("notifications")
        .insert({
          landlord_id: c.var.userId,
          tenant_id: tenantRow.id,
          channel: "applink_sms",
          template_type: "rent_reminder",
          recipient_phone_e164: tenantRow.phone_e164,
          message_body: smsText,
          status: "queued",
          idempotency_key: body.data.idempotency_key
        })
        .select()
        .single();
      if (nErr) {
        await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
        const mapped = mapSafeDbError(nErr, "voice_queue_sms", c.var.requestId);
        return c.json({ error: mapped.message }, mapped.status);
      }

      const relayRes = await dispatchApplinkSmsViaRelay({
        relayUrl,
        sharedSecret: relaySecret,
        phoneE164: tenantRow.phone_e164,
        message: smsText,
        allowInsecureHttpRelay: c.env.ALLOW_INSECURE_LOCAL_RELAY === "true"
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
      await supabase.from("audit_logs").insert({
        landlord_id: c.var.userId,
        actor_user_id: c.var.userId,
        entity_type: "notification",
        entity_id: notif.id,
        action: "send_sms",
        source: "voice",
        after_data: {
          template_type: "rent_reminder",
          status: finalStatus,
          provider_status_code: relayRes.statusCode,
          request_id: relayRes.requestId
        }
      });

      await supabase
        .from("voice_actions")
        .update({
          status: relayRes.ok ? "executed" : "failed",
          executed_record_id: notif.id
        })
        .eq("id", actionRow.id);

      return c.json(
        { status: relayRes.ok ? "executed" : "failed", provider: relayRes },
        relayRes.ok ? 200 : 502
      );
    }

    await supabase.from("voice_actions").update({ status: "failed" }).eq("id", actionRow.id);
    return c.json({ error: `Unsupported confirmation intent: ${payload.intent}` }, 400);
  });

  r.post("/actions/:id/reject", async (c) => {
    const actionIdParsed = UuidSchema.safeParse(c.req.param("id"));
    if (!actionIdParsed.success) {
      return c.json({ error: "Invalid voice action ID" }, 400);
    }

    const { data, error } = await c.var.supabase
      .from("voice_actions")
      .update({ status: "rejected" })
      .eq("id", actionIdParsed.data)
      .in("status", ["proposed", "needs_clarification"])
      .select()
      .maybeSingle();

    if (error) {
      const mapped = mapSafeDbError(error, "reject_voice_action", c.var.requestId);
      return c.json({ error: mapped.message }, mapped.status);
    }
    if (!data) {
      return c.json({ error: "Voice action not found or already finalized" }, 409);
    }
    return c.json({ data });
  });

  return r;
}
