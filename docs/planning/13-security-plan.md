# 13 — Security, Privacy & Production Readiness Plan

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Threat Model & Core Controls

| Threat | Mitigation in RentReady AI | Verification Method |
| :--- | :--- | :--- |
| **Cross-Landlord Data Leak (IDOR)** | Every table has `landlord_id` + PostgreSQL RLS (`landlord_id = auth.uid()`). Worker forwards user JWT to Supabase instead of using `service_role`. | Automated cross-tenant RLS integration test (Landlord A vs Landlord B) |
| **Prompt Injection / AI Financial Manipulation** | LLM never generates SQL, never writes directly to DB, never computes balances. Output validated by strict Zod schemas; entity resolution is deterministic; every write/SMS requires explicit human confirmation. | Unit tests with adversarial Bangla/English prompt injection strings |
| **Duplicate Payments or Duplicate SMS** | Mandatory client-generated `idempotency_key` enforced via `UNIQUE(landlord_id, idempotency_key)` on `payments`, `expenses`, `notifications`. | Integration test sending duplicate POST requests concurrently |
| **Secret Exposure (AppLink / OpenRouter / Groq / Supabase)** | Server-side only via `wrangler secret put` and Relay `.env`. Secret redaction in logger. Git pre-commit / CI secret scanning. | Automated CI check (`gitleaks` or regex scan) + manual bundle inspection |
| **SQL Injection & XSS** | Parameterized Supabase/PostgreSQL queries only; React auto-escaping; strict Content-Security-Policy (CSP) headers on Worker responses; Zod validation on all inputs and outputs. | Code review + security header test |
| **Abuse of Free AI / ASR / SMS Quotas** | Per-landlord rate limiting on `/api/voice/*` and `/api/notifications/*` (e.g., max 20 voice requests/hour, max 30 SMS/day in MVP), max audio upload size 5 MB (30 sec cap). | Automated rate-limit test |
| **CSRF** | API authenticates via `Authorization: Bearer <Supabase JWT>` header (not ambient cookies), neutralizing classic CSRF attacks; strict `Origin` check on mutating endpoints. | Integration test |
| **Open Proxy / SSRF on AppLink Relay** | Relay hardcodes `https://api.applink.com.bd` allowlist and verifies HMAC-SHA256 signature + 60-second timestamp window. | Unit test rejecting unsigned/expired/arbitrary-host requests |

---

## 2. Data Minimization & Privacy (Bangladesh Context)

- **Avoid Sensitive Identity Documents in MVP:** Do **not** collect or store National ID (NID) numbers, NID photographs, passport scans, or bank account credentials in Release A/B `[Recommendation]`.
- **Voice Audio Retention:** Audio blobs are forwarded in-memory to the ASR provider for transcription and **immediately discarded** — RentReady AI stores only the text transcript (`voice_sessions`), never raw audio recordings, minimizing storage cost and privacy risk `[Recommendation]`.
- **Account Deletion & Financial Retention:** Provide a clear "Export My Data (CSV/JSON)" and "Delete Account" workflow in Release B, with clear disclosure in Privacy Policy & Terms of Service before onboarding pilot landlords `[Recommendation]`.

---

## 3. Production Readiness Gate (Must Pass Before Release C Pilot)

Never claim production readiness without passing every check below `[Recommendation]`:
- [ ] 100% of tables have RLS enabled and verified by automated cross-tenant tests.
- [ ] Zero `service_role` usage in user-facing API handlers.
- [ ] Supabase upgraded to Pro (daily automated backups) + 1 verified test restore completed.
- [ ] Sentry error tracking active with PII scrubbing (`beforeSend` strips phone numbers/tokens).
- [ ] Fixed-IP AppLink Relay runs over HTTPS with automated restart (`systemd` / Docker) and health check monitoring.
- [ ] Published Privacy Policy and Terms of Service (Bangla + English summary) linked in footer/signup.
