# 02 — AppQuest 2.0 Official Requirements (Verified Against Delegate Booklet)

**Last Updated:** 2026-11-22  
**Primary Source:** `AppQuest 2.0 Delegate Booklet` (21 pages, supplied by user on 2026-11-22)  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Team & Track Assignment (Locked)

- **Team Name:** **The Nerds**
- **Team Size:** **4 members** `[Official requirement: 2–4 members; no solo entries — Booklet p. 5, 15]`
- **Track:** **Inter-University Track** `[Official requirement: all 4 members must be currently enrolled undergraduates at the same university in Bangladesh, aged 18+, residing in Bangladesh; valid student ID or enrolment letter may be requested at any stage — Booklet p. 5, 15]`
- **Declared Theme & Category (Recommended):**
  - **Option A (Recommended):** **Theme 4 — Frontier Technologies & Resilient Systems** → **Category 11: Agentic AI & Autonomous Systems (SDG 8, 9)** `[Recommendation — Booklet p. 8]`
  - **Option B:** **Theme 3 — Next-Gen Commerce & Industrial Automation** → **Category 08: FinTech & Next-Gen Commerce (SDG 1, 8, 10)**
  - *Official Note:* Themes and categories do **not** affect scoring; winners are chosen on overall score only `[Official requirement — Booklet p. 8, 15]`.

---

## 2. Official Timeline (All Times BST / UTC+6)

| Date | Milestone | Source |
| :--- | :--- | :--- |
| **9 Nov 2026** | Registrations open (both tracks) | Booklet p. 9 |
| **18 Nov 2026** | Registrations close (grace window until 20 Nov) | Booklet p. 9 |
| **19 Nov 2026** | Build phase officially starts | Booklet p. 9 |
| **20 Nov 2026** | Team lock-in (later changes require written approval) | Booklet p. 9 |
| **22 Nov 2026 (TODAY)** | **8 days remaining until submission deadline** | Local clock |
| **24 Nov 2026** | **Submissions open** on official portal + **Team mentoring starts** (24–30 Nov with AppLink & hSenid experts) | Booklet p. 9, 10 |
| **30 Nov 2026, 11:59 PM BST** | **HARD SUBMISSION DEADLINE** (Proposal PDF, GitHub link, Demo video, Portal form, optional Deployed URL) | Booklet p. 2, 9, 11 |
| **1 – 4 Dec 2026** | Round 1 Evaluations (eligibility screen + jury scoring within track) | Booklet p. 9, 12 |
| **5 Dec 2026** | **Shortlist Announcement** (Top 10 teams per track, 20 teams total) | Booklet p. 3, 9 |
| **6 – 16 Dec 2026** | **Enhancement Sprint** — Finalists apply jury feedback on the *same project* and must have a **production-ready AppLink app using live APIs (not only sandbox) submitted for approval by 16 Dec 2026** | Booklet p. 6, 9, 10, 15 |
| **Dec 2026** | **Physical Grand Finale** (1-day event, live demo + pitch + Q&A; at least **2 members** must attend in person at own expense) | Booklet p. 13, 16 |

---

## 3. Official Judging Scorecard (Applies to Both Rounds)

| Criterion | Weight | Strategic Implication for RentReady AI |
| :--- | :---: | :--- |
| **Innovation & Originality** | **25%** | Highlight Bangla/Banglish voice-to-confirmed-ledger AI copilot + deterministic human-in-the-loop safety `[Recommendation]` |
| **AppLink Integration** | **20%** | Show real, end-to-end AppLink SMS receipts & rent reminders (`S1000` + `requestId` + real handset SMS), plus clear roadmap to live OTP in Enhancement Sprint `[Recommendation]` |
| **Technical Implementation** | **20%** | Showcase clean modular monolith, integer-paisa PostgreSQL ledger with atomic RPCs & reversals, strict Supabase RLS, automated tests, and Fixed-IP Oracle Free relay `[Recommendation]` |
| **Business Viability** | **20%** | Present concrete 6-month Bangladesh go-to-market plan, pilot with 5–10 landlords, honest unit economics (BDT), and clear revenue model `[Recommendation]` |
| **Problem–Solution Fit & Impact** | **10%** | Contrast paper *khata* & partial-payment pain of small BD landlords against fast Bangla mobile-first workflow `[Recommendation]` |
| **Presentation & Blank Page** | **5%** | Nail the 2-minute English demo video and turn Page 8 (Blank Page Challenge) into a high-impact visual architecture + live proof showcase `[Recommendation]` |

> **Booklet Insight (p. 12):** *45% of your total score comes from Innovation & Originality (25%) and AppLink Integration (20%).*

---

## 4. Mandatory Submission Deliverables (Due 30 Nov, 11:59 PM BST)

1. **Part A — 8 Core Pages Proposal PDF (English)** `[Official requirement — Booklet p. 11]`:
   - **P1:** Project name, brief description, team details (members, track, university)
   - **P2:** Executive summary
   - **P3:** Problem statement
   - **P4:** Proposed solution
   - **P5:** Technical implementation
   - **P6:** AppLink integration: APIs used and user flows
   - **P7:** Revenue model, 6-month business plan, promotion and marketing plan
   - **P8:** **Blank Page Challenge** — anything that gives an edge (diagrams, images, video embeds, or traction)
2. **Part B — Build Evidence** `[Official requirement — Booklet p. 11]`:
   - **GitHub repository link**, accessible to the jury until the end of the finale.
   - **Demo video**, up to **2 minutes**, in **English**, showing the **AppLink integration working**.
   - **Submission form** completed on the official portal (opens 24 Nov; only latest entry before deadline counts).
   - **Deployed URL** (optional, explicitly encouraged — strongly recommended `[Recommendation]`).

---

## 5. Mandatory Compliance & Disqualification Rules

- **Two Approval Emails (Booklet p. 6–7):**
  - Email 1: SP Account approval (`Subject: AppQuest 2.0 | SP account approval | The Nerds` to `support@applink.com.bd`).
  - Email 2: App approval (`Subject: AppQuest 2.0 | App approval | The Nerds` to `support@applink.com.bd`).
  - *User Status:* User confirmed AppLink account is created & approved. **Action:** Double-check that **Email 2 (App approval)** and static IP whitelisting are also approved for the RentReady AI app!
- **AI Tools & Open-Source Disclosure (Booklet p. 11, 15, 18):** Open-source libraries, third-party services, and **AI coding tools (Google Antigravity, OpenCode, OpenRouter models) ARE explicitly allowed**, provided licences are respected and **usage is clearly disclosed** in the README/submission `[Official requirement]`.
- **Pre-Existing Work:** Work must be done during the hackathon; any earlier code, ideas, or assets must be declared `[Official requirement — Booklet p. 15]`.
- **Test Data Only:** Use test data during the build phase; real subscriber data may only be used with consent and in line with AppLink policies `[Official requirement — Booklet p. 17, 18]`.
- **IP Ownership:** Teams retain **100% ownership** of their project IP `[Official requirement — Booklet p. 17, 19]`.
- **Support Contact:** `support@applink.com.bd` | `dev.applink.com.bd/contact` | `+880 1959 97 93 76` (Booklet p. 7, 21).
