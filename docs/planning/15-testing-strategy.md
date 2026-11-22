# 15 — Testing & QA Automation Strategy

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Core Testing Principles

1. **Zero Unverified Claims:** An agent may never claim a test passed unless the command actually ran and exited 0 `[Official requirement — User Control Rule]`.
2. **Never Skip Tests to Save Tokens:** Every milestone must add or update automated tests covering its new logic before creating a Git checkpoint `[Recommendation]`.
3. **Mock External Paid/Telco APIs in CI, Verify Live Once Manually:** Unit and CI integration tests must never send real AppLink SMS or burn OpenRouter/Groq quotas; live provider tests run in a controlled manual verification script `[Recommendation]`.

---

## 2. Test Pyramid & Tooling

| Layer | Tool | What It Verifies | Runs In CI? |
| :--- | :--- | :--- | :---: |
| **Static Type & Lint** | `tsc --noEmit`, ESLint | Strict TypeScript, zero `any` in financial/API code | Yes (every push) |
| **Unit Tests** | Vitest | Money helpers (`paisa` <-> BDT), Zod action contracts, fuzzy tenant/unit entity resolver, AppLink response parser (`S1000` vs `E1303`/`E1313` on HTTP 200), HMAC relay signing | Yes |
| **Database & RLS Integration Tests** | Vitest + Local Supabase CLI | `record_payment_atomic` partial payments & overpayments, `reverse_payment_atomic` ledger balance restoration, idempotency key deduplication, **Landlord A vs Landlord B RLS isolation** | Yes |
| **API Route Tests** | Vitest + Hono `app.request()` | Auth JWT enforcement, Zod 400 validation errors, rate limiting, voice confirmation flow | Yes |
| **E2E Smoke Tests (Release B)** | Playwright | Login -> Add Property/Unit/Tenant -> Record Partial Payment -> Voice Text Fallback -> Confirmation Modal -> Dashboard KPI update | Release B |

---

## 3. Mandatory Financial & Safety Test Cases (Release A)

1. **Partial Payment Accuracy:** Obligation = `12,000 BDT` (`1200000 paisa`). Payment 1 = `7,500 BDT`. Verify `outstanding_paisa === 450000`. Payment 2 = `4,500 BDT`. Verify `outstanding_paisa === 0` and status = `paid`.
2. **Idempotent Payment Retry:** Submit the same `idempotency_key` twice -> verify only 1 row in `payments` and balance is deducted once.
3. **Immutable Reversal:** Reverse Payment 1 (`7,500 BDT`) -> verify original payment row still exists, reversal row exists with `-750000 paisa`, `outstanding_paisa` increases by `750000`, and `audit_logs` records both events.
4. **Cross-Tenant RLS Leak Test:** Authenticated as Landlord B, attempt `SELECT`, `UPDATE`, `DELETE` on Landlord A's `properties`, `tenants`, `payments`, `notifications` -> verify 0 rows returned / permission denied.
5. **Voice Safety Gate:** Verify `POST /api/voice/interpret` NEVER writes to `payments`, `expenses`, or `notifications` until `POST /api/voice/actions/:id/confirm` is called.
6. **Ambiguous Entity Rejection:** Two tenants named `"Rahim"` in Units `2A` and `4B` -> voice command `"Rahim 5000 taka dise"` MUST return `status: "needs_clarification"` with both candidates, never auto-select one.
7. **AppLink Error-on-200 Handling:** Mock HTTP `200 OK` with `{ "statusCode": "E1303", "statusDetail": "IP not provisioned" }` -> verify notification is marked `failed` (not `sent`) and exact error is logged in `notification_logs`.
