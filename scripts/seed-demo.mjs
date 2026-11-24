import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const requireFromWeb = createRequire(resolve(process.cwd(), "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL?.trim();
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const DEMO_NAME = process.env.SEED_DEMO_NAME?.trim() || "Md. Kamal Hossain (Test Account)";

if (!DEMO_EMAIL || !DEMO_PASSWORD || DEMO_PASSWORD.length < 8) {
  console.error(
    "Set SEED_DEMO_EMAIL and SEED_DEMO_PASSWORD (min 8 chars) environment variables before running seed:demo."
  );
  process.exit(1);
}

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
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in apps/web/.env.local");
  process.exit(1);
}

const isLocalSupabase = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(supabaseUrl);
if (!isLocalSupabase && process.env.ALLOW_DEMO_SEED !== "true") {
  console.error(
    "Refusing to seed test data into a remote Supabase project without ALLOW_DEMO_SEED=true."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  // 1. Sign in or sign up demo landlord
  let { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  if (signInErr || !authData.session) {
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      options: { data: { full_name: DEMO_NAME } }
    });
    if (signUpErr) {
      console.error("Demo signup failed:", signUpErr.message);
      process.exit(1);
    }
    if (!signUpData.session) {
      console.error(
        "Demo account created, but email confirmation is enabled in Supabase Auth. " +
          "Disable 'Confirm email' in Supabase Dashboard -> Authentication -> Providers -> Email, then re-run."
      );
      process.exit(1);
    }
    authData = signUpData;
  }

  const userId = authData.user.id;
  const scoped = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } }
  });

  // 2. Check if demo property already exists
  const { data: existingProps } = await scoped
    .from("properties")
    .select("id, name")
    .eq("name", "Shanti Nibash");

  if (existingProps && existingProps.length > 0) {
    console.log("Demo account and Shanti Nibash test data already seeded!");
    console.log(`Email: ${DEMO_EMAIL}`);
    process.exit(0);
  }

  // 3. Create Property + Default Building
  const { data: prop, error: pErr } = await scoped
    .from("properties")
    .insert({
      landlord_id: userId,
      name: "Shanti Nibash",
      address: "House 14, Road 9/A, Dhanmondi",
      city: "Dhaka"
    })
    .select()
    .single();
  if (pErr) throw pErr;

  const { data: bldg, error: bErr } = await scoped
    .from("buildings")
    .insert({ landlord_id: userId, property_id: prop.id, name: "Main Building" })
    .select()
    .single();
  if (bErr) throw bErr;

  // 4. Create 3 Units
  const { data: units, error: uErr } = await scoped
    .from("units")
    .insert([
      {
        landlord_id: userId,
        property_id: prop.id,
        building_id: bldg.id,
        unit_code: "2A",
        floor_label: "2nd Floor",
        default_rent_paisa: 1_500_000,
        status: "occupied"
      },
      {
        landlord_id: userId,
        property_id: prop.id,
        building_id: bldg.id,
        unit_code: "3B",
        floor_label: "3rd Floor",
        default_rent_paisa: 1_200_000,
        status: "occupied"
      },
      {
        landlord_id: userId,
        property_id: prop.id,
        building_id: bldg.id,
        unit_code: "4A",
        floor_label: "4th Floor",
        default_rent_paisa: 1_400_000,
        status: "vacant"
      }
    ])
    .select();
  if (uErr) throw uErr;

  const unit2A = units.find((u) => u.unit_code === "2A");
  const unit3B = units.find((u) => u.unit_code === "3B");

  // 5. Create 2 Test Tenants (Banglalink test numbers per AppQuest Booklet p. 17)
  const { data: tenants, error: tErr } = await scoped
    .from("tenants")
    .insert([
      {
        landlord_id: userId,
        full_name: "Rahim Uddin",
        phone_e164: "+8801900000001",
        notes: "Test Banglalink tenant for AppQuest demo"
      },
      {
        landlord_id: userId,
        full_name: "Karim Hossain",
        phone_e164: "+8801900000002",
        notes: "Test Banglalink tenant for AppQuest demo"
      }
    ])
    .select();
  if (tErr) throw tErr;

  const rahim = tenants.find((t) => t.full_name === "Rahim Uddin");
  const karim = tenants.find((t) => t.full_name === "Karim Hossain");

  // 6. Create Active Tenancies
  const { data: tenancies, error: tnErr } = await scoped
    .from("tenancies")
    .insert([
      {
        landlord_id: userId,
        unit_id: unit3B.id,
        tenant_id: rahim.id,
        start_date: "2026-01-01",
        monthly_rent_paisa: 1_200_000,
        rent_due_day: 5,
        status: "active"
      },
      {
        landlord_id: userId,
        unit_id: unit2A.id,
        tenant_id: karim.id,
        start_date: "2026-03-01",
        monthly_rent_paisa: 1_500_000,
        rent_due_day: 5,
        status: "active"
      }
    ])
    .select();
  if (tnErr) throw tnErr;

  const rahimTenancy = tenancies.find((tn) => tn.tenant_id === rahim.id);

  // 7. Generate Monthly Obligations for current Dhaka month
  const nowDhaka = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const billingMonth = `${nowDhaka.getUTCFullYear()}-${String(nowDhaka.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const { error: genErr } = await scoped.rpc("generate_monthly_obligations", {
    p_billing_month: billingMonth
  });
  if (genErr) throw genErr;

  // 8. Record partial payment (৳8,000 bKash for Unit 3B -> leaves ৳4,000 outstanding)
  const { error: payErr } = await scoped.rpc("record_payment_atomic", {
    p_tenancy_id: rahimTenancy.id,
    p_amount_paisa: 800_000,
    p_payment_method: "bkash",
    p_idempotency_key: "demo-seed-pay-3b-8000",
    p_reference_no: "BKASH-DEMO-001",
    p_notes: "Initial partial rent payment (demo seed)",
    p_source: "ui"
  });
  if (payErr) throw payErr;

  // 9. Add 1 Expense & 1 Maintenance Request
  await scoped.from("expenses").insert({
    landlord_id: userId,
    property_id: prop.id,
    category_name: "Plumbing & Electrical Repair",
    amount_paisa: 150_000,
    incurred_on: billingMonth,
    description: "Water pump capacitor replacement",
    idempotency_key: "demo-seed-exp-pump-1500"
  });

  await scoped.from("maintenance_requests").insert({
    landlord_id: userId,
    property_id: prop.id,
    unit_id: unit3B.id,
    tenant_id: rahim.id,
    title: "Kitchen sink tap leaking",
    description: "Reported by Rahim Uddin in Flat 3B — plumber needed.",
    priority: "high",
    status: "open"
  });

  console.log("SUCCESS: Demo account created and realistic Bangladesh test data seeded!");
}

main().catch((err) => {
  console.error("Seed error:", err.message || err);
  process.exit(1);
});
