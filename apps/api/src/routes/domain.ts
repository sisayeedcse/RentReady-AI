import {
  CreateExpenseRequestSchema,
  CreateMaintenanceSchema,
  CreatePropertySchema,
  CreateTenancySchema,
  CreateTenantSchema,
  CreateUnitSchema,
  isBanglalinkPrefix,
  normalizeBdPhone,
  RecordPaymentRequestSchema,
  ReversePaymentRequestSchema,
  SendSmsRequestSchema
} from "@rentready/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { EnvBindings } from "../app.js";
import {
  type AuthVariables,
  getCurrentDhakaBillingMonth,
  requireAuth
} from "../lib/supabase.js";
import { dispatchApplinkSmsViaRelay } from "../modules/notifications/applink.js";

export function createDomainRoutes(): Hono<{ Bindings: EnvBindings; Variables: AuthVariables }> {
  const r = new Hono<{ Bindings: EnvBindings; Variables: AuthVariables }>();
  r.use("*", requireAuth);

  // 1. Dashboard Summary (100% DB-computed)
  r.get("/dashboard", async (c) => {
    const supabase = c.var.supabase;
    const [summaryRes, overdueRes, paymentsRes, maintRes] = await Promise.all([
      supabase.from("v_dashboard_summary").select("*").maybeSingle(),
      supabase
        .from("v_obligation_balances")
        .select("*")
        .eq("obligation_status", "open")
        .gt("outstanding_paisa", 0)
        .order("due_date", { ascending: true })
        .limit(10),
      supabase
        .from("payments")
        .select("id, amount_paisa, payment_method, paid_at, is_reversal, notes, tenant_id, tenants(full_name)")
        .order("paid_at", { ascending: false })
        .limit(10),
      supabase
        .from("maintenance_requests")
        .select("id, title, priority, status, created_at, units(unit_code)")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(10)
    ]);

    if (summaryRes.error) return c.json({ error: summaryRes.error.message }, 500);

    return c.json({
      summary: summaryRes.data,
      overdue_obligations: overdueRes.data ?? [],
      recent_payments: paymentsRes.data ?? [],
      open_maintenance: maintRes.data ?? []
    });
  });

  // 2. Properties
  r.get("/properties", async (c) => {
    const { data, error } = await c.var.supabase
      .from("properties")
      .select("*, buildings(id, name)")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/properties", async (c) => {
    const parsed = CreatePropertySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid property payload", details: parsed.error.flatten() }, 400);

    const supabase = c.var.supabase;
    const { data: prop, error } = await supabase
      .from("properties")
      .insert({ ...parsed.data, landlord_id: c.var.userId })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);

    // Auto-create default "Main Building" for streamlined MVP UX
    const { data: bldg } = await supabase
      .from("buildings")
      .insert({ landlord_id: c.var.userId, property_id: prop.id, name: "Main Building" })
      .select()
      .single();

    return c.json({ data: { ...prop, default_building_id: bldg?.id ?? null } }, 201);
  });

  // 3. Units
  r.get("/units", async (c) => {
    const propertyId = c.req.query("property_id");
    let query = c.var.supabase
      .from("units")
      .select("*, properties(name)")
      .order("unit_code", { ascending: true });
    if (propertyId) query = query.eq("property_id", propertyId);

    const { data, error } = await query;
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/units", async (c) => {
    const parsed = CreateUnitSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid unit payload", details: parsed.error.flatten() }, 400);

    const supabase = c.var.supabase;
    const { data: bldg } = await supabase
      .from("buildings")
      .select("id")
      .eq("property_id", parsed.data.property_id)
      .limit(1)
      .maybeSingle();

    let buildingId = bldg?.id;
    if (!buildingId) {
      const { data: createdBldg, error: bErr } = await supabase
        .from("buildings")
        .insert({ landlord_id: c.var.userId, property_id: parsed.data.property_id, name: "Main Building" })
        .select("id")
        .single();
      if (bErr) return c.json({ error: bErr.message }, 400);
      buildingId = createdBldg.id;
    }

    const { data, error } = await supabase
      .from("units")
      .insert({
        landlord_id: c.var.userId,
        property_id: parsed.data.property_id,
        building_id: buildingId,
        unit_code: parsed.data.unit_code,
        floor_label: parsed.data.floor_label,
        size_sqft: parsed.data.size_sqft,
        default_rent_paisa: parsed.data.default_rent_paisa
      })
      .select()
      .single();

    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data }, 201);
  });

  // 4. Tenants
  r.get("/tenants", async (c) => {
    const { data, error } = await c.var.supabase
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({
      data: (data ?? []).map((t) => ({
        ...t,
        is_banglalink: isBanglalinkPrefix(t.phone_e164)
      }))
    });
  });

  r.post("/tenants", async (c) => {
    const parsed = CreateTenantSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid tenant payload", details: parsed.error.flatten() }, 400);

    let phoneE164: string;
    try {
      phoneE164 = normalizeBdPhone(parsed.data.phone);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid Bangladesh phone" }, 400);
    }

    const { data, error } = await c.var.supabase
      .from("tenants")
      .insert({
        landlord_id: c.var.userId,
        full_name: parsed.data.full_name,
        phone_e164: phoneE164,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null
      })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data: { ...data, is_banglalink: isBanglalinkPrefix(phoneE164) } }, 201);
  });

  // 5. Tenancies
  r.get("/tenancies", async (c) => {
    const { data, error } = await c.var.supabase
      .from("tenancies")
      .select("*, tenants(full_name, phone_e164), units(unit_code, property_id, properties(name))")
      .order("created_at", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/tenancies", async (c) => {
    const parsed = CreateTenancySchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid tenancy payload", details: parsed.error.flatten() }, 400);

    const supabase = c.var.supabase;
    const { data, error } = await supabase
      .from("tenancies")
      .insert({ ...parsed.data, landlord_id: c.var.userId, status: "active" })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);

    await supabase.from("units").update({ status: "occupied" }).eq("id", parsed.data.unit_id);
    return c.json({ data }, 201);
  });

  // 6. Rent Obligations
  r.get("/obligations", async (c) => {
    const { data, error } = await c.var.supabase
      .from("v_obligation_balances")
      .select("*")
      .order("billing_month", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/obligations/generate", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { billing_month?: string };
    const billingMonth = body.billing_month
      ? `${body.billing_month.slice(0, 7)}-01`
      : getCurrentDhakaBillingMonth();

    const { data, error } = await c.var.supabase.rpc("generate_monthly_obligations", {
      p_billing_month: billingMonth
    });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ billing_month: billingMonth, generated_count: data });
  });

  // 7. Payments & Immutable Reversals
  r.get("/payments", async (c) => {
    const { data, error } = await c.var.supabase
      .from("payments")
      .select("*, tenants(full_name, phone_e164), tenancies(units(unit_code))")
      .order("paid_at", { ascending: false })
      .limit(100);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/payments", async (c) => {
    const parsed = RecordPaymentRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid payment payload", details: parsed.error.flatten() }, 400);

    const { data, error } = await c.var.supabase.rpc("record_payment_atomic", {
      p_tenancy_id: parsed.data.tenancy_id,
      p_amount_paisa: parsed.data.amount_paisa,
      p_payment_method: parsed.data.payment_method,
      p_idempotency_key: parsed.data.idempotency_key,
      p_obligation_id: parsed.data.obligation_id ?? null,
      p_reference_no: parsed.data.reference_no ?? null,
      p_notes: parsed.data.notes ?? null,
      p_source: "ui"
    });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data }, 201);
  });

  r.post("/payments/:id/reverse", async (c) => {
    const paymentId = c.req.param("id");
    const parsed = ReversePaymentRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid reversal payload", details: parsed.error.flatten() }, 400);

    const { data, error } = await c.var.supabase.rpc("reverse_payment_atomic", {
      p_payment_id: paymentId,
      p_reason: parsed.data.reason,
      p_idempotency_key: parsed.data.idempotency_key
    });
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data }, 201);
  });

  // 8. Expenses
  r.get("/expenses", async (c) => {
    const { data, error } = await c.var.supabase
      .from("expenses")
      .select("*, properties(name), units(unit_code)")
      .eq("is_void", false)
      .order("incurred_on", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/expenses", async (c) => {
    const parsed = CreateExpenseRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid expense payload", details: parsed.error.flatten() }, 400);

    const supabase = c.var.supabase;
    const { data: existing } = await supabase
      .from("expenses")
      .select("*")
      .eq("idempotency_key", parsed.data.idempotency_key)
      .maybeSingle();
    if (existing) return c.json({ data: existing, idempotent_replay: true }, 200);

    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...parsed.data, landlord_id: c.var.userId })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);

    await supabase.from("audit_logs").insert({
      landlord_id: c.var.userId,
      actor_user_id: c.var.userId,
      entity_type: "expense",
      entity_id: data.id,
      action: "record_expense",
      source: "ui",
      after_data: data
    });

    return c.json({ data }, 201);
  });

  // 9. Maintenance Requests
  r.get("/maintenance", async (c) => {
    const { data, error } = await c.var.supabase
      .from("maintenance_requests")
      .select("*, properties(name), units(unit_code), tenants(full_name)")
      .order("created_at", { ascending: false });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/maintenance", async (c) => {
    const parsed = CreateMaintenanceSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid maintenance payload", details: parsed.error.flatten() }, 400);

    const { data, error } = await c.var.supabase
      .from("maintenance_requests")
      .insert({ ...parsed.data, landlord_id: c.var.userId })
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data }, 201);
  });

  r.patch("/maintenance/:id", async (c) => {
    const body = z
      .object({ status: z.enum(["open", "in_progress", "resolved", "closed"]) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Invalid status" }, 400);

    const { data, error } = await c.var.supabase
      .from("maintenance_requests")
      .update({
        status: body.data.status,
        resolved_at: body.data.status === "resolved" ? new Date().toISOString() : null
      })
      .eq("id", c.req.param("id"))
      .select()
      .single();
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ data });
  });

  // 10. Confirmed Banglalink AppLink SMS Dispatch & Notification Logs
  r.get("/notifications", async (c) => {
    const { data, error } = await c.var.supabase
      .from("notifications")
      .select("*, tenants(full_name), notification_logs(*)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  r.post("/notifications/send", async (c) => {
    const parsed = SendSmsRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "SMS requires confirmed: true and valid idempotency_key", details: parsed.error.flatten() }, 400);
    }

    const relayUrl = c.env.APPLINK_RELAY_URL;
    const relaySecret = c.env.RELAY_SHARED_SECRET;
    if (!relayUrl || !relaySecret) {
      return c.json({ error: "AppLink fixed-IP relay is not configured on server" }, 503);
    }

    const supabase = c.var.supabase;
    const { data: existing } = await supabase
      .from("notifications")
      .select("*, notification_logs(*)")
      .eq("idempotency_key", parsed.data.idempotency_key)
      .maybeSingle();
    if (existing) {
      return c.json({ data: existing, idempotent_replay: true }, 200);
    }

    const { data: tenant, error: tErr } = await supabase
      .from("tenants")
      .select("id, full_name, phone_e164")
      .eq("id", parsed.data.tenant_id)
      .single();
    if (tErr || !tenant) return c.json({ error: "Tenant not found" }, 404);

    const { data: notif, error: nErr } = await supabase
      .from("notifications")
      .insert({
        landlord_id: c.var.userId,
        tenant_id: tenant.id,
        channel: "applink_sms",
        template_type: parsed.data.template_type,
        recipient_phone_e164: tenant.phone_e164,
        message_body: parsed.data.message_body,
        status: "queued",
        idempotency_key: parsed.data.idempotency_key
      })
      .select()
      .single();
    if (nErr) return c.json({ error: nErr.message }, 400);

    const relayRes = await dispatchApplinkSmsViaRelay({
      relayUrl,
      sharedSecret: relaySecret,
      phoneE164: tenant.phone_e164,
      message: parsed.data.message_body
    });

    const finalStatus = relayRes.ok ? "sent" : "failed";
    await supabase.from("notifications").update({ status: finalStatus }).eq("id", notif.id);

    const { data: logRow } = await supabase
      .from("notification_logs")
      .insert({
        landlord_id: c.var.userId,
        notification_id: notif.id,
        provider: "applink",
        provider_request_id: relayRes.requestId,
        provider_status_code: relayRes.statusCode,
        provider_status_detail: relayRes.statusDetail,
        http_status: relayRes.httpStatus
      })
      .select()
      .single();

    return c.json(
      {
        ok: relayRes.ok,
        notification: { ...notif, status: finalStatus },
        provider_log: logRow,
        is_banglalink_prefix: isBanglalinkPrefix(tenant.phone_e164)
      },
      relayRes.ok ? 200 : 502
    );
  });

  // 11. Audit Logs (append-only)
  r.get("/audit-logs", async (c) => {
    const { data, error } = await c.var.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data });
  });

  return r;
}
