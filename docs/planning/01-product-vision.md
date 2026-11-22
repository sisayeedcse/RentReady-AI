# 01 — Product Vision: RentReady AI

**Document Status:** Research & Planning Baseline  
**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Executive Summary

**RentReady AI** is a Bangla-first, AI-assisted rental property operations SaaS designed for individual and small residential landlords in Bangladesh (typically managing 2–20 units across one or more buildings) `[Recommendation]`.

It addresses the daily administrative friction of landlords who currently track rent, partial payments, utility bills, advances, security deposits, expenses, and maintenance using paper notebooks (*khata*), spreadsheets, phone calls, and unstructured messaging apps `[Assumption]`.

## 2. Core Differentiation Hypothesis

> **Hypothesis:** A small Bangladeshi landlord can log and query real property operations using natural conversational Bangla (including Bangla-English code-switched *"Banglish"*) voice commands, while a deterministic PostgreSQL financial ledger guarantees accounting accuracy and **Banglalink AppLink** delivers verified SMS reminders and payment receipts `[Assumption]`.

### Honest Challenge to the Hypothesis
- RentReady AI is **not** the first rental management app in Bangladesh. Products such as **Baario**, **NibashPlus**, **KRTaker**, **Bariwala ERP**, and **BharaKhata** already exist and cover core rent tracking, reminders, or payment workflows `[Verified technical fact — sources: https://baario.com, https://nibash.plus, https://krtaker.com, accessed 2026-11-22]`.
- Voice-first operation is a **hypothesis**, not a proven market winner. Small landlords may prefer tapping 3 buttons on a fast Bangla mobile UI in quiet or public settings, and noisy environments or dialect variations can degrade voice UX `[Recommendation]`.
- Therefore, RentReady AI must be **usable and fast via standard touch/text UI first**, with Bangla voice acting as a high-leverage accelerator that always shows an editable transcript and requires explicit user confirmation before mutating financial records `[Recommendation]`.

## 3. Target Customer Segments

| Segment | Profile | Unit Count | Current Workflow (Hypothesis) | Primary Pain Points (Hypothesis) |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (MVP & Pilot)** | Resident individual residential landlords in Dhaka, Chattogram, Sylhet, and district towns | 2–20 units (1–2 buildings) | Paper *khata*, WhatsApp/SMS, bKash screenshot galleries `[Assumption]` | Tracking partial payments, calculating exact dues across months, remembering utility/service charges, chasing late rent politely |
| **Secondary (Release C/D)** | Family-managed multi-building owners & caretakers (*darowan*/managers) | 10–40 units | Shared notebook + phone calls `[Assumption]` | Lack of caretaker accountability, no audit trail for cash collected on landlord's behalf |
| **Tertiary (Post-MVP)** | Non-Resident Bangladeshi (NRB) property owners | 2–15 units | Relative or caretaker manages locally `[Assumption]` | Low visibility into actual collections, expenses, and maintenance proofs |

## 4. Product Principles

1. **Deterministic Ledger First, AI Second:** The LLM never writes directly to the database and never computes balances. All financial calculations live in PostgreSQL / deterministic backend code using integer minor units (paisa, `1 BDT = 100 paisa`) `[Recommendation]`.
2. **Human-in-the-Loop Safety:** Every voice or AI-proposed state change (payment, expense, maintenance, SMS) requires explicit user confirmation `[Recommendation]`.
3. **Bangla-First, Code-Switch Ready:** UI supports clean Bangla and English toggle; voice pipeline handles natural Bangladeshi Bangla mixed with English words (e.g., *"Flat 3B er Rahim bhai 12000 taka bKash korse, 3000 baki"*).
4. **Honest Telco Integration:** AppLink SMS/OTP is integrated server-side with real provider responses, while transparently handling AppLink's Banglalink-only subscriber scope `[Verified technical fact — source: https://dev.applink.com.bd/docs, accessed 2026-11-22]`.
5. **Commercial Credibility Over Hackathon Flash:** Built as a modular monolith that can graduate cleanly from AppQuest 2.0 to a 5–10 landlord pilot without a rewrite `[Recommendation]`.

## 5. Success Criteria by Phase

- **AppQuest 2.0 Submission (Release A):** Complete, reliable end-to-end demo of Bangla voice -> editable transcript -> structured extraction -> confirmation -> ledger update -> real AppLink SMS receipt/reminder, backed by automated tests and an 8-page English proposal `[Official requirement — verify exact rubric against Delegate Booklet v0.0.3 when provided]`.
- **Small Landlord Pilot (Release C):** 5–10 real landlords using RentReady AI for at least 2 full monthly rent cycles with zero ledger discrepancies and measurable time saved `[Recommendation]`.
- **Commercial Readiness (Release D):** Validated willingness-to-pay (BDT/month), multi-operator SMS routing for non-Banglalink tenants, and automated database backups `[Recommendation]`.
