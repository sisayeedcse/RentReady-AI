# RentReady AI — AppQuest 2.0 Official 8-Page Proposal (Markdown Source)

> **Instructions for Team: The Nerds:** Replace the `[FILL IN]` placeholders below (University name, 4 member names/emails, GitHub repo URL, Deployed URL, and Demo Video URL), then update `docs/submission/RentReady-AI-AppQuest-2.0-Proposal.html` and print to PDF (`Ctrl+P` → A4 → Margins: None → Background graphics: ON) to produce your exact **8-page English Proposal PDF** before **30 Nov 2026, 11:59 PM BST**.

---

## Page 1 — Project Overview & Team Details
- **Project Name:** RentReady AI
- **Tagline:** Bangla-First, AI-Assisted Rental Property Operations SaaS with a Verified Financial Ledger & Banglalink AppLink SMS
- **Brief Description:** RentReady AI helps small residential landlords in Bangladesh (2–20 units) manage properties, tenants, full/partial rent payments, expenses, and maintenance using natural Bangla/Banglish voice commands backed by an immutable PostgreSQL financial ledger and confirmed Banglalink AppLink SMS receipts and reminders.
- **Competition:** AppQuest 2.0 — The AppLink Innovation Hackathon (Bangladesh, 2026)
- **Track:** Inter-University Track
- **Team Name:** The Nerds (4 Members)
- **University:** `[FILL IN: Your University Name, Bangladesh]`
- **Declared Theme & Category:** Theme 4 — Frontier Technologies & Resilient Systems / Category 11: Agentic AI & Autonomous Systems (SDG 8: Decent Work & Economic Growth, SDG 9: Industry, Innovation & Infrastructure)
- **Team Roster:**
  1. `[FILL IN: Member 1 Name]` — Team Lead / Architecture, DigitalOcean Static-IP Relay & AppLink Integration (`[email]`)
  2. `[FILL IN: Member 2 Name]` — Backend, PostgreSQL Ledger & Supabase RLS (`[email]`)
  3. `[FILL IN: Member 3 Name]` — Frontend React/TypeScript & Bangla UX (`[email]`)
  4. `[FILL IN: Member 4 Name]` — Bangla Voice AI Pipeline, QA & Product Strategy (`[email]`)
- **Links:** GitHub: `[FILL IN]` | Live App: `[FILL IN]` | 2-Min Demo Video: `[FILL IN]`

---

## Page 2 — Executive Summary
Small residential landlords in Bangladesh managing 2 to 20 flats still run their rental operations on paper notebooks (*khata*), phone calls, and scattered bKash screenshots. Existing digital apps rely on tedious multi-screen forms or simple "Paid / Unpaid" toggles that break down the moment a tenant pays rent in partial installments, carries a balance forward, or disputes a payment.

**RentReady AI** solves this with three tightly integrated pillars:
1. **Safe Bangla/Banglish Voice-to-Ledger AI Copilot:** A landlord speaks naturally in Bangla or mixed Banglish (*"Flat 3B er Rahim bhai 8000 taka bKash korse"*). Audio is transcribed in-memory via Groq Whisper Large V3 Turbo, shown as an editable transcript, extracted into strict Zod-validated JSON via a pinned OpenRouter model, resolved deterministically against the landlord's database, and **gated behind an explicit human Confirmation Card** before any write occurs.
2. **Immutable, Integer-Precision Financial Ledger:** Built on Supabase PostgreSQL with `BIGINT *_paisa` minor units (`1 BDT = 100 paisa`), atomic FIFO payment allocations, immutable counter-row reversals (zero hard deletes), DB-computed outstanding balances, and 100% Row Level Security (`landlord_id = auth.uid()`).
3. **Production-Grade Banglalink AppLink SMS Integration:** Confirmed payment receipts and overdue rent reminders are dispatched via `POST https://api.applink.com.bd/sms/send` through an HMAC-SHA256 authenticated DigitalOcean Basic Static-IPv4 relay ($4/mo, cleanly solving the Cloudflare Anycast `E1303` IP-whitelisting blocker), with full `statusCode: S1000` and `requestId` audit logging.

Built as a zero-cost modular monolith (`pnpm` monorepo with 33/33 automated tests passing), RentReady AI is engineered not as a throwaway hackathon prototype, but to graduate directly into a 5–10 landlord pilot in Dhaka after the December Grand Finale.

---

## Page 3 — Problem Statement
Across Dhaka, Chattogram, Sylhet, and district towns, individual landlords owning 2–20 residential units face four recurring operational failures:
- **Partial Payment & Balance Chaos:** Tenants frequently pay rent in two installments or combine base rent with utility/service charges. Paper *khatas* and simple "Paid/Unpaid" checklists lose track of exact remaining dues, causing awkward landlord-tenant disputes.
- **High Friction of Traditional ERP Apps:** Many Bangladeshi landlords (often aged 45–70) abandon form-heavy property management apps within weeks and revert to paper notebooks.
- **Unverified Receipts & Awkward Chasing:** Cash and bKash payments rarely generate instant, timestamped SMS receipts; chasing late rent over phone calls creates social friction.
- **Lack of Financial Auditability:** Accidental edits or deletions corrupt historical rent records, making it impossible to know true net operating income after maintenance and utility expenses.

### Honest Market Gap Comparison (Verified Nov 2026)
| Competitor | Observed Strength | Gap Addressed by RentReady AI |
| :--- | :--- | :--- |
| **Baario** | Free mobile rent tracker, QR onboarding, reminders | No Bangla/Banglish voice-to-confirmed-ledger workflow observed |
| **NibashPlus** | Remote property & utility tracking for NRBs | Form-centric UX; no deterministic voice-to-ledger pipeline |
| **KRTaker** | Full ERP, bKash/Nagad, tax/PRCA, 24/7 AI chat | Enterprise/legal focus; not optimized for fast Bangla voice-to-ledger for small 2–20 unit landlords |

---

## Page 4 — Proposed Solution
RentReady AI pairs a **mobile-first Bangla/English operations app** with a **human-in-the-loop Bangla Voice Copilot**:
- **Zero-Friction Daily Workflow:** Tap the mic (or type directly in Bangla/English) → speak naturally → verify/edit transcript → review exact resolved tenant, unit, BDT amount, and remaining balance on a **Confirmation Card** → click **Confirm**.
- **Ambiguity Protection:** If two tenants share the name *"Rahim"* (Units 3B and 4A), the backend strictly returns `needs_clarification` and displays a radio-button Disambiguation Picker — **never guessing**.
- **8 Deterministic Voice Action Contracts:** `record_rent_payment`, `record_expense`, `get_outstanding_rent`, `get_monthly_collection`, `get_payment_history`, `create_maintenance_request`, `prepare_rent_reminder`, and `get_property_summary`.
- **1-Click Confirmed AppLink SMS:** Immediately after recording a partial or full payment — or from the Overdue Tenants dashboard — the landlord confirms a pre-filled Bangla/English SMS receipt or rent reminder sent via Banglalink AppLink.
- **100% DB-Computed Dashboard:** Expected rent, collected rent, total outstanding, monthly expenses, net operating result, occupancy %, and append-only audit logs are computed directly inside PostgreSQL views.

---

## Page 5 — Technical Implementation & AI Disclosure
### Modular Monolith Architecture
- **Frontend (`apps/web`):** React 19, TypeScript (strict), Vite 6, Tailwind CSS v4, Lucide icons, full Bangla (`bn`) / English (`en`) i18n with 100% key parity.
- **Edge API (`apps/api`):** Cloudflare Workers + Hono + **Workers Static Assets** (serving SPA + `/api/*` under one origin with security headers).
- **Database (`supabase/migrations/`):** 19 normalized PostgreSQL tables, `BIGINT *_paisa` integer money (zero floats), `security_invoker = true` views (`v_obligation_balances`, `v_dashboard_summary`), atomic `SECURITY INVOKER` RPCs (`record_payment_atomic`, `reverse_payment_atomic`, `generate_monthly_obligations`), and **100% RLS coverage** with append-only `payments` and `audit_logs`.
- **Fixed-IP Telco Relay (`services/applink-relay`):** Containerized Node 22 / Hono microservice deployed on a **DigitalOcean Basic Droplet ($4/mo)** with a whitelisted static IPv4, authenticated via constant-time HMAC-SHA256 + 60-second replay window.
- **AI & Bangla ASR:** Replaceable `SpeechToTextProvider` (`Groq Whisper Large V3 Turbo`, in-memory audio only — zero audio files stored) + pinned OpenRouter free model (`google/gemma-4-26b-a4b-it:free`) with strict Zod schema validation.
- **Automated Verification:** **33 / 33 Vitest unit & safety tests passing** across `packages/shared`, `services/applink-relay`, `apps/api`, and `apps/web`, plus GitHub Actions CI.

### Official AI Tools & Open-Source Disclosure (Booklet p. 11, 15, 18)
Team **The Nerds** explicitly discloses that **Google Antigravity** (research, architecture, implementation, verification) and **OpenCode** / **OpenRouter** open-weight models (`particle-ai/particle-1:free`, `google/gemma-4-26b-a4b-it:free`), **Groq Whisper Large V3 Turbo**, and open-source libraries (React, Hono, Zod, Tailwind CSS, Vitest, Supabase JS, `hSenidMobileCPaaS/Applink-as-a-Skill` contract guidance) were used in full compliance with their licenses. All build-phase testing uses **test data only**.

---

## Page 6 — Banglalink AppLink Integration: APIs & User Flows
### APIs Used
- **Release A (Current Working Integration):** **AppLink SMS MT API** (`POST https://api.applink.com.bd/sms/send`, `Content-Type: application/json;charset=utf-8`).
- **Release B (6–16 Dec Enhancement Sprint):** **AppLink OTP API** (`POST /otp/request`, `POST /otp/verify`) for Banglalink landlord phone verification + production live API approval by 16 Dec 2026.

### Engineering Around Real Telco Constraints
1. **Solving the Cloudflare Anycast `E1303` Blocker:** AppLink enforces strict source-IP whitelisting (returning `E1303` from unprovisioned IPs), while Cloudflare Workers use rotating Anycast egress IPs. RentReady AI routes all AppLink calls through our HMAC-authenticated **DigitalOcean Basic Static-IPv4 Relay** (`services/applink-relay`, $4/mo), keeping total hackathon infrastructure at **$4/mo (~500 BDT)** while guaranteeing a single whitelisted IPv4.
2. **Strict `statusCode === "S1000"` Contract:** Following `hSenidMobileCPaaS/Applink-as-a-Skill`, we never trust HTTP `200 OK` alone; we parse the JSON body, treat `E1303` / `E1313` as explicit failures, never log `password`, enforce `idempotency_key` deduplication, and record sanitized `statusCode` + `requestId` in `notification_logs`.
3. **Human Confirmation & Operator Honesty:** No SMS is ever sent without explicit landlord confirmation (`confirmed: true`). Non-Banglalink numbers trigger a clear advisory badge with a 1-click "Copy Receipt Text" fallback (with multi-operator BD SMS gateway planned for commercial pilot).

---

## Page 7 — Revenue Model, 6-Month Business Plan & Marketing Plan
### Freemium SaaS Revenue Model (BDT — Hypotheses to Validate in Pilot)
| Tier | Target Landlord | Proposed Price | Included Value |
| :--- | :--- | :---: | :--- |
| **Free (Starter)** | Up to 4 units | **0 BDT / mo** | Core ledger, dashboard, Banglalink AppLink SMS receipts, 20 Bangla voice commands/mo |
| **Landlord Pro** | 5–20 units | **350 BDT / mo** | Up to 25 units, 200 voice commands/mo, multi-operator SMS bundle, monthly PDF/CSV reports, deposit tracking |
| **Multi-Building / NRB** | 21+ units | **1,200 BDT / mo** | Unlimited units, caretaker sub-accounts with audit trail, annual tax/income summary |

- **Transparent Unit Economics:** At ~100 landlords (~1,000 units), total cloud + Supabase Pro + paid ASR/LLM + multi-op SMS cost is **~6,100–9,800 BDT/month (~61–98 BDT/landlord)**. Just **30 paying Landlord Pro subscribers** (10,500 BDT/mo) achieve infrastructure break-even with ~74% gross margin per paid user.

### 6-Month Post-Hackathon Execution & Marketing Plan
- **Months 1–2 (Dec 2026 – Jan 2027 — Enhancement Sprint & Pilot):** Complete live AppLink production approval by 16 Dec; onboard **5–10 real Dhaka landlords** (2–20 units) via university/family networks for a 60-day free pilot; validate Bangla voice accuracy and willingness-to-pay.
- **Months 3–4 (Feb – Mar 2027 — Pilot Hardening):** Upgrade to Supabase Pro (daily automated backups), add BTRC-compliant multi-operator SMS fallback (GP/Robi/Airtel), launch Caretaker RBAC and deposit/utility tracking.
- **Months 5–6 (Apr – May 2027 — Commercial Launch & Growth):** Activate bKash/Nagad subscription billing; run targeted Bangla Facebook video demos in Dhaka/Chattogram homeowner groups; partner with local flat-owners' welfare associations (*Flat Malik Samity*) using a referral loop (1 month free per referred landlord).

---

## Page 8 — Blank Page Challenge (Verification & Proof Edge)
- **Live AppLink Proof:** `[INSERT: Side-by-side screenshot of RentReady AI notification_logs showing statusCode: S1000 + requestId AND real Banglalink handset SMS receipt]`
- **Automated Engineering Verification:** **33 / 33 Vitest tests passing** (Exact integer `paisa` math, 19/19 RLS table coverage, zero float columns, `security_invoker` views, append-only `payments`/`audit_logs`, ambiguous "Rahim" rejection, HTTP 200 `E1303`/`E1313` failure parsing, HMAC replay protection).
- **Ultra-Low-Cost Hackathon Architecture:** $4/mo (~500 BDT) total running cost during AppQuest 2.0 (Cloudflare Workers Free + Supabase Free + DigitalOcean $4/mo Static-IP Relay + Groq Whisper Free + OpenRouter Free + AppLink Developer Free).
- **Direct Jury Links:** GitHub Repository | Live Deployed URL | 2-Minute English Demo Video (`[INSERT QR CODES]`).
