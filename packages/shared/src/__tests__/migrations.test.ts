import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(process.cwd(), "../../supabase/migrations");

const schemaSql = readFileSync(resolve(MIGRATIONS_DIR, "20261122000001_initial_schema.sql"), "utf8");
const viewsSql = readFileSync(resolve(MIGRATIONS_DIR, "20261122000002_views_and_rpcs.sql"), "utf8");
const rlsSql = readFileSync(resolve(MIGRATIONS_DIR, "20261122000003_rls_policies.sql"), "utf8");
const hardeningSql = readFileSync(resolve(MIGRATIONS_DIR, "20261124000004_security_hardening.sql"), "utf8");

describe("SQL Migration Safety & Financial Invariants", () => {
  it("never uses floating point types (FLOAT, REAL, DOUBLE PRECISION) anywhere in schema", () => {
    expect(schemaSql).not.toMatch(/\b(FLOAT|REAL|DOUBLE\s+PRECISION|NUMERIC)\b/i);
  });

  it("enables Row Level Security on 100% of created public tables", () => {
    const createdTables = [...schemaSql.matchAll(/CREATE TABLE public\.([a-z_]+)/g)].map((m) => m[1]);
    expect(createdTables.length).toBe(19);

    for (const table of createdTables) {
      expect(rlsSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it("enforces security_invoker = true on all database views", () => {
    const createdViews = [...viewsSql.matchAll(/CREATE OR REPLACE VIEW public\.([a-z_]+)/g)];
    expect(createdViews.length).toBeGreaterThanOrEqual(2);
    const invokerMatches = [...viewsSql.matchAll(/WITH \(security_invoker = true\)/g)];
    expect(invokerMatches.length).toBe(createdViews.length);
  });

  it("enforces append-only RLS (no UPDATE or DELETE policy) on payments and audit_logs", () => {
    expect(rlsSql).not.toMatch(/FOR (UPDATE|DELETE|ALL) ON public\.payments\b/i);
    expect(rlsSql).not.toMatch(/ON public\.payments[\s\S]{0,60}FOR (UPDATE|DELETE|ALL)/i);
    expect(rlsSql).not.toMatch(/ON public\.audit_logs[\s\S]{0,60}FOR (UPDATE|DELETE|ALL)/i);
    expect(rlsSql).not.toMatch(/ON public\.payment_allocations[\s\S]{0,60}FOR (UPDATE|DELETE|ALL)/i);
  });

  it("enforces single active tenancy per unit via partial unique index", () => {
    expect(schemaSql).toContain("CREATE UNIQUE INDEX uq_tenancies_one_active_per_unit");
    expect(schemaSql).toContain("WHERE status = 'active'");
  });

  it("enforces cross-tenant composite foreign keys, immutability triggers, fixed search_path, and row locks in migration 004", () => {
    expect(hardeningSql).not.toMatch(/\b(FLOAT|REAL|DOUBLE\s+PRECISION|NUMERIC)\b/i);
    expect(hardeningSql).toContain("FOREIGN KEY (unit_id, landlord_id) REFERENCES public.units(id, landlord_id)");
    expect(hardeningSql).toContain("FOREIGN KEY (obligation_id, landlord_id) REFERENCES public.rent_obligations(id, landlord_id)");
    expect(hardeningSql).toContain("actor_user_id = auth.uid()");
    expect(hardeningSql).toContain("trg_expenses_immutability");
    expect(hardeningSql).toContain("trg_rent_obligations_immutability");
    expect(hardeningSql).toContain("trg_notifications_immutability");
    expect(hardeningSql).toContain("SET search_path = public");
    expect(hardeningSql).toContain("FOR UPDATE");
  });
});
