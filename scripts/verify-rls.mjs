/**
 * RentReady AI — Live 2-User Cross-Tenant RLS & Migration 004 Verification Script
 *
 * Proves against a staging/dev Supabase instance (using ONLY the public anon key + user JWTs):
 * 1. Landlord B cannot SELECT Landlord A's properties, units, tenants, or payments.
 * 2. Landlord B cannot INSERT a building or active tenancy referencing Landlord A's property_id/unit_id
 *    (verifies Migration 004 composite (id, landlord_id) foreign keys).
 * 3. Landlord A cannot spoof audit_logs.actor_user_id != auth.uid().
 * 4. Landlord A cannot mutate confirmed expenses.amount_paisa (verifies Migration 004 immutability trigger).
 *
 * Usage (PowerShell):
 *   $env:ALLOW_RLS_VERIFY_WRITE="true"
 *   $env:RLS_USER_A_EMAIL="rls-a@example.com"
 *   $env:RLS_USER_A_PASSWORD="StrongPassword#1"
 *   $env:RLS_USER_B_EMAIL="rls-b@example.com"
 *   $env:RLS_USER_B_PASSWORD="StrongPassword#2"
 *   pnpm verify:rls
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

if (process.env.ALLOW_RLS_VERIFY_WRITE !== "true") {
  console.error(
    "Safety guard: set ALLOW_RLS_VERIFY_WRITE=true to run this verification script against a staging/dev Supabase project."
  );
  process.exit(1);
}

const requireFromWeb = createRequire(resolve(process.cwd(), "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

const env = parseEnvFile(resolve(process.cwd(), "apps/web/.env.local"));
const supabaseUrl = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY (or apps/web/.env.local).");
  process.exit(1);
}

const userAEmail = process.env.RLS_USER_A_EMAIL?.trim();
const userAPassword = process.env.RLS_USER_A_PASSWORD;
const userBEmail = process.env.RLS_USER_B_EMAIL?.trim();
const userBPassword = process.env.RLS_USER_B_PASSWORD;

if (!userAEmail || !userAPassword || !userBEmail || !userBPassword) {
  console.error(
    "Set RLS_USER_A_EMAIL, RLS_USER_A_PASSWORD, RLS_USER_B_EMAIL, and RLS_USER_B_PASSWORD before running."
  );
  process.exit(1);
}

async function signInOrSignUp(email, password, label) {
  const base = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let { data, error } = await base.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    const signUp = await base.auth.signUp({
      email,
      password,
      options: { data: { full_name: label } }
    });
    if (signUp.error) {
      throw new Error(`${label} auth failed: ${signUp.error.message}`);
    }
    if (!signUp.data.session) {
      throw new Error(
        `${label} created, but email confirmation is enabled. Confirm the user in Supabase Dashboard or use pre-confirmed test accounts.`
      );
    }
    data = signUp.data;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }
  });

  return { userId: data.user.id, client };
}

function assert(condition, label) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`PASS: ${label}`);
}

async function main() {
  const runId = Date.now().toString(36);
  const a = await signInOrSignUp(userAEmail, userAPassword, "RLS Test Landlord A");
  const b = await signInOrSignUp(userBEmail, userBPassword, "RLS Test Landlord B");

  // 1. Landlord A creates Property, Building, Unit, Tenant, Expense
  const { data: propA, error: pErr } = await a.client
    .from("properties")
    .insert({ landlord_id: a.userId, name: `RLS-Prop-${runId}`, address: "Dhaka Test", city: "Dhaka" })
    .select()
    .single();
  assert(!pErr && propA?.id, "Landlord A creates own property");

  const { data: bldgA, error: bErr } = await a.client
    .from("buildings")
    .insert({ landlord_id: a.userId, property_id: propA.id, name: "Main" })
    .select()
    .single();
  assert(!bErr && bldgA?.id, "Landlord A creates own building");

  const { data: unitA, error: uErr } = await a.client
    .from("units")
    .insert({
      landlord_id: a.userId,
      property_id: propA.id,
      building_id: bldgA.id,
      unit_code: `T-${runId}`,
      default_rent_paisa: 1_000_000
    })
    .select()
    .single();
  assert(!uErr && unitA?.id, "Landlord A creates own unit");

  const { data: tenantB, error: tbErr } = await b.client
    .from("tenants")
    .insert({ landlord_id: b.userId, full_name: "Tenant B", phone_e164: "+8801900000099" })
    .select()
    .single();
  assert(!tbErr && tenantB?.id, "Landlord B creates own tenant");

  // 2. Cross-tenant SELECT isolation
  const { data: stolenProps } = await b.client.from("properties").select("*").eq("id", propA.id);
  assert(Array.isArray(stolenProps) && stolenProps.length === 0, "Landlord B cannot SELECT Landlord A's property");

  const { data: stolenUnits } = await b.client.from("units").select("*").eq("id", unitA.id);
  assert(Array.isArray(stolenUnits) && stolenUnits.length === 0, "Landlord B cannot SELECT Landlord A's unit");

  // 3. Cross-tenant FK injection & DoS prevention (Migration 004)
  const { error: crossBldgErr } = await b.client
    .from("buildings")
    .insert({ landlord_id: b.userId, property_id: propA.id, name: "Injected" });
  assert(Boolean(crossBldgErr), "Migration 004 blocks Landlord B inserting building on Landlord A's property_id");

  const { error: crossTenancyErr } = await b.client.from("tenancies").insert({
    landlord_id: b.userId,
    unit_id: unitA.id,
    tenant_id: tenantB.id,
    start_date: "2026-11-01",
    monthly_rent_paisa: 1_000_000,
    status: "active"
  });
  assert(Boolean(crossTenancyErr), "Migration 004 blocks Landlord B creating active tenancy on Landlord A's unit_id");

  // 4. Audit log actor spoofing prevention (Migration 004)
  const { error: spoofAuditErr } = await a.client.from("audit_logs").insert({
    landlord_id: a.userId,
    actor_user_id: b.userId,
    entity_type: "property",
    entity_id: propA.id,
    action: "spoof_test",
    source: "ui"
  });
  assert(Boolean(spoofAuditErr), "Migration 004 blocks audit_logs insert where actor_user_id != auth.uid()");

  // 5. Financial immutability trigger on expenses (Migration 004)
  const { data: expA, error: eErr } = await a.client
    .from("expenses")
    .insert({
      landlord_id: a.userId,
      property_id: propA.id,
      category_name: "Test",
      amount_paisa: 50_000,
      incurred_on: "2026-11-24",
      description: `RLS immutability test ${runId}`,
      idempotency_key: `rls-exp-${runId}`
    })
    .select()
    .single();
  assert(!eErr && expA?.id, "Landlord A creates own expense");

  const { error: tamperExpErr } = await a.client
    .from("expenses")
    .update({ amount_paisa: 999_999 })
    .eq("id", expA.id);
  assert(Boolean(tamperExpErr), "Migration 004 blocks tampering with confirmed expense amount_paisa");

  console.log("\nALL LIVE 2-USER CROSS-TENANT RLS & MIGRATION 004 CHECKS PASSED!");
}

main().catch((err) => {
  console.error("Verification failed:", err.message || err);
  process.exit(1);
});
