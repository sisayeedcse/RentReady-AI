# 19 — Risk Register & Mitigations

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

| ID | Risk | Severity | Likelihood | Mitigation Strategy |
| :---: | :--- | :---: | :---: | :--- |
| **R1** | **AppLink `E1303` IP Block on Cloudflare Workers** | Critical | Certain (if direct) | Route all AppLink calls through `services/applink-relay` on a fixed-IPv4 VPS ($4/mo DO/Hetzner or OCI Free) and whitelist that IP in Week 1 `[Verified technical fact]`. |
| **R2** | **AppLink Application / IP Approval Delay** | Critical | High | Register on `user.applink.com.bd` and submit app + static IP provisioning **immediately** before writing UI code; never wait until submission week `[Recommendation]`. |
| **R3** | **AppLink Banglalink-Only Subscriber Limit** | High | Certain | Design MVP demo around Banglalink test numbers; display clear UI notice + 1-click Copy Receipt fallback for non-Banglalink numbers; add multi-operator BD SMS gateway in Release C `[Verified technical fact]`. |
| **R4** | **OpenRouter 50 RPD Free Cap Stalls OpenCode** | High | Certain (at $0) | Do one-time $10 OpenRouter credit load to unlock 1,000 RPD on `:free` models; keep OpenCode prompts tightly scoped; pin fallback `:free` models `[Verified technical fact]`. |
| **R5** | **OpenRouter `:free` Model Rotation / Upstream 429** | High | High | Never hardcode a single model without a config-driven fallback; pin primary + secondary `:free` IDs in `opencode.json` and Worker env; move paying pilot users to low-cost paid models in Release C `[Recommendation]`. |
| **R6** | **Missing AppQuest Delegate Booklet v0.0.3** | High | Active | Request booklet from user immediately; do not invent deadlines or judging weights; re-audit `02-appquest-requirements.md` upon receipt `[Official requirement]`. |
| **R7** | **Bangla/Banglish ASR Mishears Names or Numbers** | High | Medium | Always display an **editable transcript** + **direct text input fallback** + **Confirmation Card** before any write; pass domain prompt hints to Groq Whisper Turbo `[Recommendation]`. |
| **R8** | **Financial Balance Drift or Duplicate Payments** | Critical | Low (with guardrails) | Integer `paisa` columns (`BIGINT`), PostgreSQL atomic RPCs, `UNIQUE(landlord_id, idempotency_key)`, immutable reversals (no hard deletes), automated financial unit/integration tests `[Recommendation]`. |
| **R9** | **Supabase Free Tier 7-Day Inactivity Pause** | High | Medium | Monitor daily during AppQuest judging; upgrade to **Supabase Pro ($25/mo)** with daily backups before Release C pilot `[Verified technical fact]`. |
| **R10** | **Two Autonomous Agents Conflicting on Repo** | Med | Medium | Strict single-writer rule: never run Antigravity and OpenCode concurrently on the repo; require clean `git commit` checkpoints between handoffs `[Recommendation]`. |
| **R11** | **Voice UX Rejection by Real Landlords** | Med | Medium | Ensure the standard touch/tap UI is fast and complete on its own; validate voice vs. tap preference during the 5–10 landlord pilot `[Recommendation]`. |
