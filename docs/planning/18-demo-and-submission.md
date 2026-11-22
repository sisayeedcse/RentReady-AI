# 18 — AppQuest 2.0 Demo Script, 8-Page Proposal & Pre-Submission Checklist

**Last Updated:** 2026-11-22  
**Verified Against:** `AppQuest 2.0 Delegate Booklet` (Pages 11, 12, 18)  
**Submission Deadline:** **30 Nov 2026, 11:59 PM BST** (Portal opens 24 Nov 2026; only latest submission counts) `[Official requirement]`  
**Team:** **The Nerds** (4 members, Inter-University Track)

---

## 1. Official 8-Page English Proposal PDF Structure (Booklet p. 11)

Every page maps **1-to-1** to the official booklet specification and maximizes the **45% Innovation + AppLink** + **40% Technical + Business** scorecard:

| Page | Official Required Section (Booklet p. 11) | RentReady AI Content Plan |
| :---: | :--- | :--- |
| **P1** | **Project name, brief description, team details** (members, track, university) | **RentReady AI** — Bangla-first, AI-assisted rental operations SaaS with verified financial ledger & AppLink SMS. Team **The Nerds** (4 members, Inter-University Track, University name), Declared Theme 4 / Category 11 (Agentic AI & Autonomous Systems, SDG 8 & 9). |
| **P2** | **Executive summary** | Concise 1-page synthesis of problem, Bangla voice-to-confirmed-ledger innovation, live AppLink SMS integration, zero-cost scalable architecture, and commercial pilot roadmap. |
| **P3** | **Problem statement** | Paper *khata* & messy bKash screenshot tracking for 2–20 unit Bangladeshi landlords: partial-payment errors, utility/service charge confusion, late-rent friction, lack of audit trail. Honest competitor gap table (Baario, NibashPlus, KRTaker). |
| **P4** | **Proposed solution** | Mobile-first Bangla/English operations app + 9-step human-in-the-loop Bangla/Banglish voice copilot (Groq Whisper ASR -> editable transcript -> Zod-validated intent -> Confirmation Card -> immutable PostgreSQL ledger -> instant AppLink SMS receipt/reminder). |
| **P5** | **Technical implementation** | Modular monolith diagram (React/Vite + Cloudflare Workers Static Assets/Hono + Supabase PostgreSQL/RLS + Oracle Always Free Static-IP Relay), integer `paisa` accounting, atomic RPCs & reversals, security/testing, **explicit AI & open-source tool disclosure** (Booklet p. 11, 15). |
| **P6** | **AppLink integration: APIs used and user flows** | Sequence diagram of confirmed SMS Payment Receipt & Rent Reminder flow (`POST https://api.applink.com.bd/sms/send`), fixed-IP relay architecture solving `E1303`, `statusCode: S1000` + `requestId` audit logging, test-data compliance, and Dec 6–16 Enhancement Sprint plan for AppLink OTP & live approval. |
| **P7** | **Revenue model, 6-month business plan, promotion and marketing plan** | Freemium BDT tiers (Free <=4 units, Standard 300–500 BDT/mo, Multi-building/NRB 1,000–1,500 BDT/mo), transparent USD/BDT unit economics (~61–98 BDT COGS at 100 landlords), 6-month execution plan (M1–2: 5–10 landlord Dhaka pilot; M3–4: multi-op SMS + caretaker RBAC; M5–6: paid conversion & landlord association/Facebook community marketing). |
| **P8** | **Blank Page Challenge** (5% scorecard — *"Anything that gives you an edge"*) | High-impact visual spread: (1) Live AppLink `S1000` JSON log + real SMS handset screenshot side-by-side with RentReady AI Confirmation Card, (2) Verified automated test results (partial payment + reversal + cross-tenant RLS), (3) QR code linking directly to live deployed URL & 2-min demo video. |

---

## 2. Official 2-Minute (120-Second) English Demo Video Script

*Official Rule: Up to 2 minutes, in English, showing your AppLink integration working (Booklet p. 11).*

| Time | Scene | Spoken Narration (English) | On-Screen Proof |
| :---: | :--- | :--- | :--- |
| **0:00–0:15** | Problem Hook | Small Bangladeshi landlords managing 2 to 20 flats still rely on paper *khatas* and messy bKash screenshots, causing partial-payment mistakes and awkward rent chases. Meet **RentReady AI**, built by Team **The Nerds**. | Clean mobile-first RentReady AI Dashboard (Bangla/English toggle). |
| **0:15–0:35** | Real Ledger Setup | Every taka is stored in an immutable PostgreSQL ledger using exact integer minor units — never a simple paid/unpaid toggle. Here, Flat 3B owes 12,000 BDT for November. | Unit 3B obligation: `12,000 BDT due`. |
| **0:35–1:05** | Bangla Voice -> Safe Confirmation | Instead of filling long forms, the landlord taps the mic and speaks naturally in Bangla: *"Flat 3B er Rahim bhai 8000 taka bKash korse."* Groq Whisper transcribes it into editable Bangla text, our AI extracts a Zod-validated action, and **never writes without explicit confirmation**. | Live mic recording -> editable Bangla transcript -> Confirmation Card (`Rahim, Unit 3B, 8,000 BDT, bKash, Remaining: 4,000 BDT`) -> Click **Confirm**. |
| **1:05–1:40** | **Live AppLink SMS Proof** | One tap dispatches a verified payment receipt via **Banglalink AppLink SMS** through our whitelisted static-IP relay. Here is the live AppLink `S1000` response and `requestId` in our audit log — and the real SMS arriving on the Banglalink test handset. | Click **Send Receipt** -> `notification_logs` (`statusCode: S1000`, `requestId`) -> Real Banglalink phone receiving the SMS! |
| **1:40–2:00** | Dashboard, Security & Vision | The dashboard instantly recalculates expected, collected, and 4,000 BDT outstanding rent, protected by Supabase Row Level Security and immutable reversals. Built for AppQuest 2.0, engineered to go live on AppLink. | Live KPI refresh + Audit Log + Closing card (Team The Nerds, GitHub, Live URL). |

---

## 3. Official Pre-Submission Checklist (Verbatim From Booklet p. 18)

### 01 / TEAM
- [x] 4 members (within 2–4), all 18+ (Team **The Nerds**)
- [x] Correct track (**Inter-University** — confirm all 4 members are current undergrads at the same BD university with student IDs ready)
- [ ] Team Lead named
- [x] Registered by 18 Nov (grace 20 Nov)
- [x] AppLink developer account created & approved

### 02 / BUILD
- [ ] Both approval emails sent to `support@applink.com.bd` (SP account approval **AND** App approval)
- [ ] At least one AppLink API (SMS) works end-to-end
- [ ] One theme and one category declared (Theme 4 / Category 11 recommended)
- [ ] Earlier code, ideas, or assets declared (if any)
- [ ] **Open-source libraries and AI tool use (Antigravity, OpenCode, OpenRouter, Groq) explicitly disclosed** in README & Proposal P5
- [ ] **Test data only** used during build phase (no unconsented real subscriber data)

### 03 / SUBMIT BY 30 NOV, 11:59 PM BST
- [ ] Submission form completed on official portal (opens 24 Nov)
- [ ] Proposal PDF: **8 core pages, in English** (P1–P8)
- [ ] GitHub repo link open & accessible to jury until end of finale
- [ ] Demo video: **<= 2 minutes, English**, clearly showing AppLink working
- [ ] Deployed URL added (optional, strongly encouraged)
- [ ] Submitted early (target: **30 Nov, 6:00 PM BST**)

### 04 / IF SHORTLISTED (5 DEC -> 16 DEC)
- [ ] Jury feedback applied to the **same project** (no project switching)
- [ ] App submitted for approval on AppLink using **live APIs (not only sandbox) by 16 Dec 2026**
- [ ] At least **2 members** confirmed to attend physical Grand Finale in person
- [ ] Live demo & pitch rehearsed; repo, URL, and video remain accessible
