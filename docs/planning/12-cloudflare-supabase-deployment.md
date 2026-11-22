# 12 — Cloudflare, Supabase & Fixed-IP Relay Deployment Plan

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Environments

| Environment | Database | Frontend + API | AppLink Relay | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | Local Supabase CLI (`supabase start`) | Vite Dev + `wrangler dev` | Local stub or local relay (NEVER hit live AppLink in unit tests) | Fast offline development & automated tests |
| **Staging / Hackathon Demo** | Supabase Free Project *(keep active daily during judging!)* | Cloudflare Workers (Static Assets + Hono) | Fixed-IP VPS / OCI Free VM (whitelisted in AppLink) | AppQuest 2.0 demo & live URL |
| **Production Pilot (Release C)** | **Supabase Pro ($25/mo)** *(no 7-day pause + daily backups)* | Cloudflare Workers (Free or $5/mo Paid) | Hardened Fixed-IP VPS ($4–$4.50/mo) with TLS | 5–10 real landlords |

---

## 2. Cloudflare Workers Static Assets Configuration

- Cloudflare officially recommends **Workers with Static Assets** (`wrangler.jsonc` with `"assets": { "directory": "../web/dist", "not_found_handling": "single-page-application" }`) over legacy Cloudflare Pages for all new full-stack apps `[Verified technical fact, accessed 2026-11-22]`.
- **Advantages for RentReady AI:**
  - Single deployment (`wrangler deploy`) publishes both the React SPA and the `/api/*` Hono backend under one origin — **eliminating CORS headaches and preflight latency** `[Recommendation]`.
  - Free tier allows 100,000 requests/day and unlimited static asset bandwidth `[Verified technical fact]`.

---

## 3. Supabase Configuration & Migration Workflow

1. **Schema-as-Code:** Every table, index, view, RPC, and RLS policy lives in `supabase/migrations/*.sql`. Never make manual ad-hoc edits in the Supabase dashboard without capturing a migration `[Recommendation]`.
2. **Local Parity:** Run `supabase db reset` locally to verify migrations + `seed.sql` cleanly from scratch before pushing to staging `[Recommendation]`.
3. **Inactivity Pause Mitigation (Hackathon Only):** Supabase Free projects pause after 7 days of inactivity `[Verified technical fact]`. During AppQuest 2.0 judging, ensure normal health checks or periodic judge/team visits keep the project active; upgrade to **Supabase Pro** before onboarding any real landlord `[Recommendation]`.
4. **Backup & Restore Testing:** On Supabase Free, run scheduled `pg_dump` exports locally before major demos. On Supabase Pro (Release C), rely on daily automated backups and perform one documented test restore into a staging project before pilot launch `[Recommendation]`.

---

## 4. Secrets Inventory (Never Committed to Git)

| Secret Name | Stored In | Never Exposed To |
| :--- | :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Frontend `.env` (public by design, protected by RLS) | N/A |
| `SUPABASE_JWT_SECRET` (or JWKS) | Cloudflare Worker Secrets (`wrangler secret put`) | Browser / Git |
| `SUPABASE_SERVICE_ROLE_KEY` | **NOT USED in user-facing Worker routes**; only for controlled admin/test scripts | Browser / Git / Worker runtime |
| `OPENROUTER_API_KEY` | Cloudflare Worker Secrets | Browser / Git |
| `GROQ_API_KEY` (and optional `DEEPGRAM_API_KEY`) | Cloudflare Worker Secrets | Browser / Git |
| `APPLINK_RELAY_URL`, `RELAY_SHARED_SECRET` | Cloudflare Worker Secrets + Relay `.env` | Browser / Git |
| `APPLINK_APP_ID`, `APPLINK_PASSWORD` | Fixed-IP Relay `.env` (systemd/Docker secret) | Browser / Git / Logs |
| `SENTRY_DSN` | Frontend + Worker env | Git (keep in env vars) |

---

## 5. Manual User Provisioning Steps (Before Deployment)

Because autonomous agents must never create provider accounts or approve external services on the user's behalf:
1. Create a **Supabase** account and staging project.
2. Create a **Cloudflare** account and run `npx wrangler login`.
3. Create an **OpenRouter** account, generate an API key, and optionally add a one-time $10 credit to unlock 1,000 RPD on `:free` models.
4. Create a **Groq** account and generate a free API key for Whisper Large V3 Turbo.
5. Provision a **Fixed-IP VPS** (DigitalOcean $4/mo, Hetzner ~$4.50/mo, or OCI Always Free) and note its public static IPv4.
6. Register on **`user.applink.com.bd`** with a Banglalink SIM, provision your RentReady AI application with the SMS API, submit the VPS static IPv4 for whitelisting, and retrieve `applicationId` + `password` `[Official requirement]`.
