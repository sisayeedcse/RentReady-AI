# 04 — Complete Product Feature Catalogue

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

**Release Key:**
- **A** = AppQuest 2.0 MVP (Hackathon Submission)
- **B** = Finalist & Production Readiness
- **C** = Small Customer Pilot (5–10 Landlords)
- **D** = Commercial Expansion

---

## 1. Authentication & Access Control

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Email + Password Registration & Login/Logout | High | Low | Supabase Auth | Low | **A** |
| Password Reset & Session Handling | High | Low | Supabase Auth | Low | **A** |
| Landlord Profile (Name, Phone, Preferred Language) | High | Low | `profiles` table | Low | **A** |
| Phone Verification via AppLink OTP (Banglalink numbers) | Med | Med | AppLink OTP API + static IP | Banglalink-only limit | **B** |
| Email Verification | High | Low | Supabase Auth SMTP | Low | **B** |
| Account Recovery & Account Deletion (Soft/Hard) | High | Med | Auth + Cascade/Retention policy | Legal/audit retention conflict | **B** |
| Multi-Landlord Isolation (Tenant-per-Landlord RLS) | Critical | Med | Supabase RLS | Cross-tenant data leak | **A** |
| Staff / Caretaker Roles & Permissions | Med | High | `staff_memberships` + RLS | Permission escalation | **C** |
| Multi-Factor Authentication (MFA / TOTP) | Med | Med | Supabase Auth MFA | Low | **C** |

---

## 2. Property Management

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Properties & Buildings CRUD | High | Low | `properties`, `buildings` | Low | **A** |
| Floors & Units CRUD (Unit No, Rent, Occupancy) | High | Low | `floors`, `units` | Low | **A** |
| Search & Filter (Occupied / Vacant / Overdue) | High | Low | Indexed queries | Low | **A** |
| Property Address & Unit Size (sq ft) | Med | Low | Schema fields | Low | **A** |
| Occupancy History | Med | Low | Derived from `tenancies` | Low | **B** |
| Property / Unit Photographs | Low | Med | Supabase Storage + upload limits | Storage abuse / MIME spoofing | **B** |

---

## 3. Tenant Management

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Tenant Profiles (Name, Phone, Optional Email, Notes) | High | Low | `tenants` | Avoid storing raw NID images in MVP `[Recommendation]` | **A** |
| Unit Assignment & Tenancy Dates (Move-in / Move-out) | High | Med | `tenancies` (overlap constraint) | Overlapping active tenancies on same unit | **A** |
| Historical Rent Amount per Tenancy | High | Low | `tenancies` / `rent_schedules` | Editing old rent corrupts past dues | **A** |
| Tenant Payment History & Outstanding Balance | Critical | Med | Ledger queries | Balance drift if not DB-computed | **A** |
| Tenant History per Unit | Med | Low | `tenancies` | Low | **B** |
| Tenant Self-Service Portal | Med | High | Separate Auth/RLS role | High scope creep | **D** |

---

## 4. Finance & Accounting Ledger

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Monthly Rent Schedules & Rent Obligations | Critical | Med | `rent_schedules`, `rent_obligations` | Duplicate obligation generation | **A** |
| Full & Partial Payments (Integer Minor Units: Paisa) | Critical | High | `payments`, `payment_allocations` | Floating point rounding errors (FORBIDDEN) | **A** |
| Accurate Outstanding Balance (DB-Computed) | Critical | Med | SQL Views / RPC | Stale cached balances | **A** |
| Payment Methods (Cash, bKash, Nagad, Bank) | High | Low | Enum / lookup | Low | **A** |
| Security Deposits & Advance Rent Tracking | High | Med | `deposits` / advance ledger | Mixing deposit with rent revenue | **B** *(Schema in A, full UI in B)* |
| Expenses & Categories (Utility, Repair, Staff, Tax) | High | Low | `expenses`, `expense_categories` | Low | **A** |
| Utility Bills Attached to Obligations / Expenses | Med | Med | Line items or expense link | Complex split-meter billing | **B** |
| Immutable Reversals & Corrections + Audit Trail | Critical | Med | `reversal_of_payment_id`, `audit_logs` | Deleting confirmed financial rows (FORBIDDEN) | **A** |
| Payment Receipts (In-App + AppLink SMS) | Critical | Med | AppLink SMS API | Sending without confirmation | **A** |
| Monthly Financial Reports & CSV/PDF Export | High | Med | Aggregation queries | Low | **B** |

---

## 5. AI & Bangla Voice Operations

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Microphone Audio Recording (Browser MediaRecorder) | High | Med | HTTPS + mobile mic permissions | iOS Safari MIME type quirks | **A** |
| Bangla / Banglish Speech-to-Text (Replaceable ASR) | Critical | Med | Groq Whisper / Deepgram interface | Accent/noise transcription errors | **A** |
| Editable Transcript + Direct Text Input Fallback | Critical | Low | UI form | Must never trap user in voice-only | **A** |
| Structured Intent & Entity Extraction (JSON + Zod) | Critical | High | OpenRouter pinned model | Hallucinated amounts or wrong tenant | **A** |
| Deterministic Tenant/Unit Matching & Clarification | Critical | Med | Backend fuzzy/exact resolver | Ambiguous names ("Rahim" in 2 flats) | **A** |
| Explicit Confirmation Card Before Any Write/SMS | Critical | Low | UI modal + idempotency key | Accidental financial mutation | **A** |
| Supported Voice Actions (8 Core Contracts) | Critical | High | Backend deterministic handlers | Scope creep beyond 8 actions | **A** |
| Conversation / Voice Action History | Med | Low | `voice_sessions`, `voice_actions` | Low | **A** |
| Optional Bangla Voice Response (TTS) | Low | Med | Browser TTS / Bangla TTS API | Latency & extra cost | **C** |

---

## 6. AppLink Telco Integration

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| AppLink SMS Rent Reminder (Confirmed) | Critical | High | AppLink SMS API + Static IP relay | `E1303` IP block; Banglalink-only | **A** |
| AppLink SMS Payment Receipt (Confirmed) | Critical | High | AppLink SMS API + Static IP relay | Duplicate sends without idempotency | **A** |
| Provider Response Logging & Retry Safety | Critical | Med | `notifications`, `notification_logs` | HTTP 200 with `E1313`/`E1303` body | **A** |
| AppLink OTP Phone Verification | Med | Med | AppLink OTP API | Banglalink-only users | **B** |
| Scheduled Rent Reminders (Cloudflare Cron) | Med | Med | Cron Trigger + opt-in | Unwanted spam if misconfigured | **B** |
| Multi-Operator SMS Fallback (GP/Robi/Airtel) | High | Med | BTRC-compliant BD SMS gateway | Required for real commercial pilot | **C** |
| AppLink Subscription / CaaS / USSD | Low | High | Telco billing approval | Unnecessary for landlord SaaS MVP | **D** |

---

## 7. Maintenance & Dashboard

| Feature | Value | Complexity | Dependencies | Risk | Release |
| :--- | :---: | :---: | :--- | :--- | :---: |
| Maintenance Request Creation, Priority, Status | High | Low | `maintenance_requests` | Low | **A** |
| Maintenance Updates & Expense Linking | Med | Low | `maintenance_updates`, `expenses` | Low | **B** |
| Dashboard KPIs (Properties, Units, Occupancy, Expected/Collected/Outstanding Rent, Expenses, Net Result) | Critical | Med | DB-calculated SQL views | Mismatched totals if computed in JS | **A** |
| Recent Payments, Overdue Tenants, Open Maintenance | High | Low | Indexed DB queries | Low | **A** |
