# 07 — Technology Stack Evaluation & Decisions

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Stack Summary & Honest Critique

We evaluated the proposed default stack against alternatives, cost limits, and the **AppLink fixed-IP constraint**. The proposed stack is **strong and appropriate**, with **two critical adjustments**:
1. Use **Cloudflare Workers with Static Assets** (instead of legacy Cloudflare Pages) `[Verified technical fact — Cloudflare's current recommended path, accessed 2026-11-22]`.
2. Add a **minimal Fixed-IP AppLink Egress Relay** (e.g., Oracle Cloud Always Free VM or a $4–$4.50/mo VPS) because Cloudflare Workers cannot provide a static outbound IP on Free or Paid self-serve plans `[Verified technical fact]`.

---

## 2. Layer-by-Layer Architecture Decisions

### A. Frontend — React + TypeScript + Vite + Tailwind + shadcn/ui
- **Decision:** **Approve as proposed** `[Recommendation]`.
- **Libraries:** React 19, TypeScript (strict mode), Vite, Tailwind CSS, shadcn/ui, React Hook Form, Zod, TanStack Query, `i18next` (or lightweight Bangla/English dictionary).
- **Why NOT Next.js?**
  - RentReady AI is an authenticated SaaS dashboard, not a public SEO content site.
  - Deploying Next.js on Cloudflare requires OpenNext/adapter complexity, increases bundle size and Worker CPU time (risking the 10 ms Free Tier CPU limit), and slows down AI-assisted iteration `[Recommendation]`.
  - A static Vite SPA served via **Cloudflare Workers Static Assets** + a clean **Hono** API has zero SSR hydration bugs and minimal operational overhead `[Recommendation]`.

### B. API & Edge Hosting — Cloudflare Workers + Hono + Workers Static Assets
- **Decision:** **Approve with Workers Static Assets** `[Recommendation]`.
- **Verified Limits (2026-11-22):**
  - Free tier: 100,000 requests/day, 10 ms CPU time per invocation, $0 egress bandwidth (`https://developers.cloudflare.com/workers/platform/pricing/`, accessed 2026-11-22) `[Verified technical fact]`.
  - Paid tier ($5/mo): 10M requests/month, 30M CPU ms/month `[Verified technical fact]`.
- **Important Note on CPU Time:** Network I/O wait (waiting for Supabase, Groq ASR, OpenRouter, or AppLink Relay) does **not** count toward Cloudflare Worker CPU time — only JS execution counts. Still, keep audio uploads streamed/forwarded cleanly without heavy in-Worker audio transcoding `[Verified technical fact]` `[Recommendation]`.
- **Queues & Cron:** Skip Cloudflare Queues for MVP (unnecessary complexity). Defer Cron Triggers (automated monthly rent reminders) to Release B `[Recommendation]`.

### C. Database & Auth — Supabase (PostgreSQL + Auth + RLS + Storage)
- **Decision:** **Approve as primary source of truth** `[Recommendation]`.
- **Verified Limits (2026-11-22):**
  - Free tier: 2 projects, 500 MB DB, 50,000 MAU, 1 GB Storage, 5 GB egress, **pauses after 7 days of inactivity**, **no automated backups** `[Verified technical fact]`.
  - Pro tier ($25/mo): 8 GB DB, 100,000 MAU, 100 GB Storage, 250 GB egress, no inactivity pause, 7-day daily backups `[Verified technical fact]`.
- **Critical Production Rule:** Free tier is acceptable for **Release A (Hackathon)**, provided you keep it active during judging. **Release C (Real Landlord Pilot) MUST run on Supabase Pro ($25/mo)** for uptime and daily backups `[Recommendation]`.

### D. Speech-to-Text (Bangla ASR) — Replaceable Provider Interface
- **Decision:** Abstract behind `SpeechToTextProvider` interface.
  - **Primary (MVP):** **Groq Whisper Large V3 Turbo** — Free tier offers 20 RPM, 2,000 RPD, 7,200 audio seconds/hour, 28,800 audio seconds/day (8 hours/day), 25 MB max file, no credit card required; paid is $0.04/audio hour `[Verified technical fact, accessed 2026-11-22]`.
  - **Fallback #1:** **Deepgram Nova-3 (`language=bn`)** — Supports Bengali (`bn`), $200 non-expiring free credit, ~$0.35–$0.48/audio hour `[Verified technical fact, accessed 2026-11-22]`.
  - **Fallback #2:** **Azure AI Speech (`bn-BD`)** — 5 free hours/month on F0 tier `[Verified technical fact, accessed 2026-11-22]`.
- **Why NOT Browser Web Speech API?** Unreliable on iOS Safari and Firefox, weak on Bangla-English code-switching, and inconsistent across Android WebViews `[Verified technical fact]`.

### E. AI Intent Extraction — OpenRouter (Server-Side Only)
- **Decision:** Server-side OpenRouter client with pinned model IDs, strict JSON schema + Zod validation, 12-second timeout, bounded retry (max 1 retry on 429/5xx), and per-user rate limiting `[Recommendation]`.

### F. AppLink Fixed-IP Egress Relay (Mandatory Architecture Addition)
- **Decision:** Minimal stateless HTTP relay (e.g., 80-line Node.js/Hono or Caddy/Tinyproxy service with HMAC/shared-secret auth) deployed on a **static IPv4 host**:
  - Option 1 (Free if approved): **Oracle Cloud Always Free VM** (includes up to 2 static IPv4s, $0/mo; strict account verification) `[Verified technical fact]`.
  - Option 2 (Most reliable low-cost): **DigitalOcean Basic Droplet ($4/mo, ~500 BDT)** or **Hetzner Cloud (~$3.80–$4.50/mo, ~475–560 BDT)** with static IPv4 `[Verified technical fact]`.

### G. Monitoring & CI/CD
- **CI/CD:** GitHub Actions (free for public repos, 2,000 min/mo private).
- **Error Tracking:** Sentry Free Developer Plan (5,000 errors/month, 1 user — add `beforeSend` sampling and filter noise so quotas aren't exhausted) `[Verified technical fact]`.
- **Logs & Uptime:** Cloudflare Workers Logs + Supabase Logs + free uptime ping (e.g., UptimeRobot free tier for `/api/health`) `[Recommendation]`.
