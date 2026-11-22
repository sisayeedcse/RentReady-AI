# 16 — Implementation Roadmap (8-Day AppQuest 2.0 Sprint + Enhancement Sprint)

**Last Updated:** 2026-11-22  
**Hard Deadline:** **30 Nov 2026, 11:59 PM BST** (8 days from today) `[Official requirement — Booklet p. 9]`  
**Team:** **The Nerds** (4 members, Inter-University Track)  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Release Mapping to AppQuest 2.0 Official Schedule

- **Release A — AppQuest 2.0 Submission MVP (22 Nov – 30 Nov 2026):** Complete, tested, deployed RentReady AI with immutable PostgreSQL ledger, Bangla voice-to-confirmed-action copilot, and working AppLink SMS integration + 8-page PDF + 2-minute English demo video.
- **Release B — Official Enhancement Sprint (6 Dec – 16 Dec 2026, if shortlisted on 5 Dec):** Apply jury feedback on the *same project*, move AppLink app to **production-ready live APIs (not only sandbox) submitted for approval by 16 Dec**, add AppLink OTP verification, Deposits UI, Monthly CSV/PDF export, and Playwright E2E tests.
- **Release C — Small Customer Pilot (Jan–Feb 2027):** 5–10 real landlords, Supabase Pro ($25/mo) + daily backups, multi-operator BD SMS gateway fallback, Caretaker RBAC.
- **Release D — Commercial Expansion (Q2 2027+):** Paid SaaS tiers (bKash/Nagad), Tenant portal, Bangla TTS.

---

## 2. Compressed 8-Day Release A Execution Plan (22 Nov – 30 Nov)

*Critical Discipline: Because OpenRouter is at **$0 (50 RPD)**, divide work cleanly across the 4-member team (**The Nerds**) and keep OpenCode milestones tight, surgical, and test-verified.* `[Recommendation]`

| Day / Date | Milestone | Concrete Deliverables | Verification Gate |
| :--- | :--- | :--- | :--- |
| **Day 1 (22 Nov — Today)** | **M0: Repo, `AGENTS.md` & Cloud/AppLink Setup** | Init Git repo, create `AGENTS.md` (including `Applink-as-a-Skill` rules), provision Oracle Cloud Always Free VM static IPv4, confirm AppLink App Approval (Email 2) + IP whitelist, create Supabase staging & Groq API key. | Static IPv4 live; `AGENTS.md` committed. |
| **Day 2 (23 Nov)** | **M1: Monorepo & CI Scaffold** | Scaffold `apps/web` (React+Vite+TS+Tailwind+shadcn), `apps/api` (Cloudflare Worker+Hono+Static Assets), `packages/shared`, `services/applink-relay`, GitHub Actions CI. | `pnpm typecheck`, `pnpm test`, `pnpm build` pass. |
| **Day 3 (24 Nov — Mentoring & Portal Open)** | **M2: Database Schema, Atomic Ledger RPCs & RLS** | Write `supabase/migrations/` (16 tables, `v_obligation_balances`, `v_dashboard_summary`, `record_payment_atomic`, `reverse_payment_atomic`, strict RLS) + `seed.sql`. **Book AppQuest mentoring session!** | `supabase db reset` clean; partial payment, reversal & cross-tenant RLS tests pass. |
| **Day 4 (25 Nov)** | **M3: Auth, Properties, Units, Tenants & Tenancies** | Supabase Auth UI (Bangla/English toggle), Properties/Units CRUD, Tenants/Tenancies assignment (single active tenancy constraint). | API & UI tests pass on mobile viewport (375px). |
| **Day 5 (26 Nov)** | **M4: Financial Ledger, Expenses, Maintenance & Dashboard** | Monthly obligation generation, Full/Partial payment recording (`paisa`), Payment reversal, Expenses, Maintenance requests, DB-backed Dashboard KPIs, Audit Log. | Ledger & idempotency tests pass. |
| **Day 6 (27 Nov)** | **M5: Live AppLink Relay & SMS Integration** | Deploy `services/applink-relay` to Oracle Free VM; wire Worker `/api/notifications/send` with HMAC auth, idempotency, `S1000` check, `notification_logs`, Confirmation Modal. | **1 real AppLink SMS delivered to Banglalink test phone** with `S1000` logged! |
| **Day 7 (28 Nov)** | **M6: Bangla Voice ASR + Safe AI Copilot** | Implement `GroqWhisperProvider`, browser `MediaRecorder`, editable transcript + text fallback, pinned OpenRouter JSON extractor, Zod validator, deterministic entity resolver, Confirmation Card for all 8 actions. | Safety gate tests + live Bangla/Banglish voice tests pass. |
| **Day 8 (29 Nov)** | **M7: Staging Deploy, Hardening & Demo Video** | Deploy to Cloudflare Workers Static Assets, verify live URL + Supabase + OCI Relay + Sentry + CSP headers. Record & edit **<= 2-minute English demo video** showing real AppLink SMS. | Full E2E smoke test on live URL; video <= 120s. |
| **Day 9 (30 Nov, before 6:00 PM BST — 6h buffer!)** | **M8: 8-Page Proposal PDF & Final Portal Submission** | Finalize 8-page English Proposal PDF (exact P1–P8 structure + AI tool disclosure), verify public GitHub repo & live URL, submit on official portal well before **11:59 PM BST**. | All Page 18 Pre-Submission Checklist boxes ticked. |

---

## 3. Suggested Role Split for Team: The Nerds (4 Members)

- **Member 1 (Team Lead / Architecture & AppLink):** Oracle Cloud VM relay, AppLink portal/approval/mentoring coordination, Cloudflare/Supabase deployment, Git checkpoint reviews.
- **Member 2 (Backend & Database):** Supabase migrations, PostgreSQL atomic ledger RPCs, RLS tests, Hono API routes.
- **Member 3 (Frontend & Bangla UX):** React/Vite/Tailwind/shadcn UI, Bangla/English i18n, mobile-first Dashboard, Voice Recorder & Confirmation Cards.
- **Member 4 (AI Pipeline, QA, Proposal & Video):** Groq Whisper ASR + OpenRouter Zod contracts, test suite, 8-page English Proposal PDF (P1–P8), 2-minute English Demo Video.

---

## 4. Mandatory Milestone Exit Report Format

At the end of every milestone, the active agent reports:
1. Files changed.
2. Features implemented.
3. Exact commands run.
4. Tests passed / failed (never fabricate).
5. Security considerations checked.
6. Remaining issues / blockers.
7. Manual user actions required.
8. Next recommended prompt — then **STOP** and wait for approval `[Official requirement — User Control Rule]`.
