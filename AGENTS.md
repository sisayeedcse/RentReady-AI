# AGENTS.md — RentReady AI Engineering & Safety Rules

**Mandatory:** Every AI coding agent (OpenCode, Google Antigravity, or contributor) MUST read this file before starting any milestone.

**Project:** RentReady AI — AppQuest 2.0 (Inter-University Track, Team: **The Nerds**)  
**Submission Deadline:** 30 Nov 2026, 11:59 PM BST  
**Planning Docs:** `docs/planning/01-product-vision.md` through `docs/planning/21-source-register.md`

---

## 1. Repository Architecture (Modular Monolith)

Do **not** silently change the architecture or introduce microservices, Kubernetes, Next.js, or a second database.

```text
apps/web/              # React + TypeScript + Vite + Tailwind + shadcn/ui SPA
apps/api/              # Cloudflare Worker (Hono) + Workers Static Assets
packages/shared/       # Shared Zod schemas, action contracts, paisa <-> BDT helpers
services/applink-relay/# Minimal HMAC-authenticated fixed-IPv4 relay (DigitalOcean $4/mo VPS)
supabase/migrations/   # Sequential SQL migrations (schema, views, RPCs, RLS)
docs/planning/         # Authoritative planning & architecture specifications
```

---

## 2. Non-Negotiable Financial Ledger Invariants

1. **Integer Minor Units Only:** Store all money in PostgreSQL `BIGINT` columns named `*_paisa` (`1 BDT = 100 paisa`). **NEVER** use `FLOAT`, `REAL`, `DOUBLE PRECISION`, or JS floating-point math for money.
2. **No Paid/Unpaid Boolean as Source of Truth:** Outstanding balances and obligation statuses MUST be derived from `rent_obligations` minus `SUM(payment_allocations.amount_paisa)`.
3. **No Hard Deletes on Financial Records:** Never delete confirmed `payments`, `payment_allocations`, `rent_obligations`, `deposits`, or `expenses`. Corrections use explicit reversal rows (`is_reversal = true`, `reversal_of_payment_id`) + `audit_logs`.
4. **Idempotency Required:** Every mutating payment, expense, and notification endpoint MUST require and enforce a unique `idempotency_key` scoped to `landlord_id`.
5. **Timezone:** Store all timestamps as UTC `TIMESTAMPTZ`; compute billing months (`YYYY-MM-01`) and display dates in `Asia/Dhaka` (`UTC+06:00`).

---

## 3. Security & Supabase RLS Invariants

1. **100% RLS Coverage:** Every public table carries `landlord_id UUID NOT NULL REFERENCES profiles(id)` and has `ENABLE ROW LEVEL SECURITY` with `landlord_id = auth.uid()`.
2. **Never Use `service_role` in User Routes:** Always validate the caller's Supabase JWT in `apps/api` and forward that user JWT to Supabase so PostgreSQL RLS enforces tenant isolation.
3. **Never Commit or Log Secrets:** Never commit or print `SUPABASE_SERVICE_ROLE_KEY`, `APPLINK_PASSWORD`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, or `RELAY_SHARED_SECRET`.
4. **Data Minimization:** Do **not** store tenant NID numbers/photos or raw voice audio files (transcribe audio in-memory, store text transcript only).

---

## 4. AI & Bangla Voice Safety Rules

Required 9-step pipeline:
`Audio -> Replaceable ASR (Groq Whisper Turbo) -> Editable Transcript (+ Text Fallback) -> Pinned OpenRouter JSON Extraction -> Strict Zod Validation -> Deterministic DB Entity Resolution -> Explicit Confirmation Card -> Deterministic Backend RPC / AppLink SMS -> Audit Log`.

- **NEVER** let an LLM generate SQL or write directly to the database.
- **NEVER** let an LLM calculate financial balances.
- **NEVER** auto-execute ambiguous entity matches (e.g., two tenants named "Rahim" must return `needs_clarification`).
- **NEVER** send an AppLink SMS without explicit user confirmation.

---

## 5. Banglalink AppLink Integration Rules (Per `Applink-as-a-Skill`)

1. **Server-Side & Fixed-IP Only:** Never call AppLink from browser code or directly from Cloudflare Workers (Cloudflare Anycast IPs trigger `E1303`). Route exclusively through `services/applink-relay` with HMAC-SHA256 + timestamp ($\le 60\text{s}$) verification.
2. **Body Credentials:** AppLink uses HTTP `POST` (`Content-Type: application/json;charset=utf-8`) with `applicationId` and `password` in the JSON body. Never log `password`.
3. **CRITICAL — Parse `statusCode`, Never Trust `response.ok`:** AppLink frequently returns HTTP `200 OK` for logical failures. Success is ONLY `body.statusCode === "S1000"`. Handle `E1303` (unprovisioned IP) and `E1313` (auth failure) explicitly and log sanitized status codes + `requestId` in `notification_logs`.
4. **Operator & Test Data Compliance:** AppLink SMS serves Banglalink subscribers (`tel:+88019...` / `tel:+88014...`). Use **test data only** during the build phase (AppQuest 2.0 Booklet p. 17). Never send real AppLink SMS inside automated CI tests.

---

## 6. Agent Coordination & 50-RPD Budget Discipline

- **Single-Writer Rule:** Never run Antigravity and OpenCode editing the same repository simultaneously. Commit a clean Git checkpoint between handoffs.
- **OpenRouter \$0 Free Tier (50 RPD):** Keep OpenCode tasks small, specify exact target files, never edit unrelated files, and use pinned `:free` model IDs (never `openrouter/free` for critical code).
- **Zero Fake Verification:** Never claim a test passed unless the command actually ran and exited 0. Never skip tests to save tokens.
- **Mandatory Milestone Exit Report:** At the end of every milestone, report:
  1. Files changed
  2. Features implemented
  3. Commands run
  4. Tests passed / failed
  5. Security considerations
  6. Remaining issues
  7. Manual user actions
  8. Next recommended prompt — then **STOP**.
