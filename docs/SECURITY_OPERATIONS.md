# RentReady AI — Security Operations, Monitoring & Incident Response

**Last Updated:** 2026-11-24

---

## 1. Current Monitoring & Logging Posture (Honest Status)

| Control | Current Code Status | Operator Activation Required |
| :--- | :--- | :--- |
| **Structured JSON Security Logs** | Implemented in `apps/api` (`logSecurityEvent`) and `services/applink-relay` (`logRelayEvent`) with secret redaction and newline sanitization. | View in Cloudflare Workers Observability (`wrangler.jsonc` has `observability.enabled = true`) and `docker logs rentready-relay`. |
| **Append-Only Audit Trail** | Implemented in PostgreSQL (`audit_logs` table with `SELECT`/`INSERT` only RLS and `actor_user_id = auth.uid()`). | Review periodically in Supabase Dashboard or RentReady **SMS & Audit** view. |
| **Per-Isolate Rate Limiting** | Implemented in `apps/api` (general, voice, SMS) and `services/applink-relay`. | **Required for multi-POP scale:** Configure Cloudflare Dashboard WAF Rate Limiting rules on `/api/voice/*` and `/api/notifications/send`. |
| **External Error Tracking / Alerting** | **Not yet configured** (no live Sentry DSN or PagerDuty/email webhook active). | Configure Cloudflare Logpush / Alert notifications and/or Sentry with PII scrubbing before onboarding paying landlords. |
| **Automated Uptime Probes** | Health endpoints ready (`GET /api/health`, `GET /health` on relay, Docker `HEALTHCHECK`). | Configure an external uptime monitor (e.g., UptimeRobot / Cloudflare Health Checks) against both `/health` endpoints. |

---

## 2. Events Logged (Without Leaking Secrets or Raw Passwords)

- `auth_missing_bearer`, `auth_malformed_bearer`, `auth_invalid_session` (failed/invalid JWT checks)
- `cors_origin_rejected` (untrusted cross-origin preflight or mutating request)
- `rate_limit_exceeded` / `relay_rate_limited` (HTTP 429 violations)
- `invalid_audio_upload_rejected` (MIME/magic-byte failure on `/api/voice/transcribe`)
- `voice_action_invalid_state_confirm`, `voice_entity_tampering_blocked` (state-machine or candidate-list bypass attempts)
- `relay_auth_failed`, `relay_replay_rejected` (invalid HMAC, expired timestamp, or replayed request)
- `sms_dispatch_completed`, `applink_sms_dispatched` (sanitized statusCode & requestId only)
- `db_operation_failed`, `unhandled_api_error`, `relay_unhandled_error` (with `request_id` correlation)

---

## 3. Incident Response Procedure (Credential Compromise or Data Breach)

### Step 1: Contain Immediately (0–15 Minutes)
1. **If `GEMINI_API_KEY` is leaked:** Revoke immediately in Google AI Studio, generate a new key, and run `npx wrangler secret put GEMINI_API_KEY`.
2. **If `RELAY_SHARED_SECRET` is leaked:** Generate a fresh 32-byte hex secret (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), update `services/applink-relay/.env`, restart the Docker container, and run `npx wrangler secret put RELAY_SHARED_SECRET`.
3. **If `APPLINK_PASSWORD` is leaked:** Rotate the password in `user.applink.com.bd`, update `services/applink-relay/.env`, and restart the relay container.
4. **If a Landlord Account is Compromised:** Revoke the user's active sessions in Supabase Dashboard (**Authentication → Users**), force a password reset, and review `audit_logs`, `payments`, and `notifications` for unauthorized entries (use immutable reversals for any fraudulent payment entries; never hard-delete).
5. **If Database Access is Suspected:** Rotate Supabase database password and API keys in Supabase Project Settings, inspect Supabase Postgres & Auth logs, and verify all 19 tables still have RLS enabled.

### Step 2: Investigate & Preserve Evidence (15 Minutes – 4 Hours)
- Correlate `X-Request-Id` values across Cloudflare Workers logs, Supabase Postgres/Auth logs, `audit_logs`, and `docker logs rentready-relay`.
- Determine scope: which landlord accounts, tenant phone numbers, or financial records were accessed or modified.

### Step 3: Notify & Remediate (Bangladesh Legal Context)
- Under Bangladesh's **Personal Data Protection Act, 2026 (PDPA)** (Act No. 63 of 2026) and **Cyber Security Act, 2026**, assess whether a personal data breach poses significant harm to affected data subjects and follow applicable notification obligations to relevant authorities (e.g., BGD e-GOV CIRT / designated data protection authority once notified) and affected landlords/users. Consult qualified Bangladeshi legal counsel for formal breach notification timelines.
- Patch root cause, add regression security tests, and document a post-incident review.

---

## 4. Database Backup & Recovery Procedure

- **Staging / Free Tier:** Take manual `pg_dump` backups before schema upgrades or live demos. Note that Supabase Free pauses after 7 days of inactivity.
- **Production Pilot:** Upgrade to **Supabase Pro** for automated daily backups + Point-in-Time Recovery (PITR), and verify at least one test restore into a separate staging project before onboarding real landlords.
