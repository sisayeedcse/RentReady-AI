# 05 — AppQuest 2.0 MVP Scope & Scope Challenge

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Critical Scope Challenge (Honest Architecture Review)

The initial 20-item MVP list is **ambitious for an autonomous AI workflow running on free-tier rate-limited models**. Attempting to build every secondary screen and edge case simultaneously will burn OpenRouter daily quotas, inflate bug surface area, and jeopardize the mandatory **working AppLink integration** and **immutable financial ledger** `[Recommendation]`.

### Recommended Cuts / Tightening Within Release A
1. **Collapse Building/Floor Hierarchy UI for MVP:** Keep `properties`, `buildings`, `floors`, and `units` in the database schema so we never need a breaking migration later, **but** auto-create a default Building and allow optional Floor labels in the MVP UI so a landlord can add a property and 6 units in under 60 seconds `[Recommendation]`.
2. **Defer Deposits & Advance Rent Full Workflows to Release B:** Create the `deposits` table and `advance_balance` ledger support in the schema, **but** focus MVP UI on Monthly Obligations + Full/Partial Payments + Allocations + Expenses + Reversals `[Recommendation]`.
3. **Defer AppLink OTP & Cron Triggers to Release B:** AppQuest 2.0 requires at least one working AppLink API. Shipping **rock-solid, confirmed AppLink SMS Reminders and Payment Receipts** with real provider logs is far stronger than half-finished OTP + Cron `[Recommendation]`.
4. **No Photo Uploads in Release A:** Skip property/maintenance photo uploads until Release B to avoid Supabase Storage MIME/virus/size hardening overhead during hackathon crunch `[Recommendation]`.

---

## 2. Locked Release A (AppQuest 2.0 MVP) Scope

### Must-Have Functional Vertical Slices
1. **Auth & Isolation:** Supabase Email/Password login, logout, session refresh, landlord profile, strict Supabase RLS per landlord.
2. **Property & Unit Setup:** Create/edit properties and units (unit number, default monthly rent, occupancy status).
3. **Tenants & Tenancies:** Create tenants (name, phone with Banglalink indicator, notes), assign active tenancy to a unit, view tenancy history.
4. **Rent Obligations & Ledger:** Generate monthly rent obligations for active tenancies; record **full or partial payments** with explicit `payment_allocations` (in integer paisa); compute exact outstanding balance from DB; support **payment reversal** (never hard delete).
5. **Expenses & Maintenance:** Record property/unit expenses by category; create and update maintenance requests (open / in_progress / resolved).
6. **Bangla Voice + Text AI Copilot:**
   - Record audio in browser (`MediaRecorder`) -> upload to Worker -> replaceable ASR (`Groq Whisper Large V3 Turbo`) -> editable Bangla/Banglish transcript (plus direct text input fallback).
   - Structured intent extraction via pinned OpenRouter model -> strict Zod validation -> deterministic tenant/unit entity resolution (with disambiguation prompt if ambiguous).
   - Mandatory **Confirmation Card** before executing any write or SMS.
   - Support all 8 core action contracts (`record_rent_payment`, `record_expense`, `get_outstanding_rent`, `get_monthly_collection`, `get_payment_history`, `create_maintenance_request`, `prepare_rent_reminder`, `get_property_summary`).
7. **Working AppLink SMS Integration:**
   - Send confirmed SMS rent reminders and SMS payment receipts via fixed-IP relay to `https://api.applink.com.bd/sms/send`.
   - Enforce idempotency key, log raw sanitized provider `statusCode` (`S1000` vs error codes) and `requestId` in `notification_logs`.
   - Clearly inform the user if a tenant's phone number is non-Banglalink (cannot be routed via AppLink).
8. **Database-Backed Dashboard & Audit Log:**
   - Real-time DB-calculated KPIs: total units, occupancy %, expected rent, collected rent, outstanding rent, total expenses, net operating result.
   - Overdue tenants list, recent payments, open maintenance, and filterable audit log.
9. **Responsive Bangla/English UI:** Mobile-first web app (works cleanly on 375px phone screens and desktop).
10. **Quality & Deployment:** Unit + integration tests (Vitest), CI via GitHub Actions, live deployment on Cloudflare Workers (Static Assets + Hono API) + Supabase + Fixed-IP AppLink Relay.

---

## 3. Explicitly Postponed (Out of Scope for Release A)

- Property marketplace / rental listings.
- Automatic rent collection / bKash / Nagad / SSLCommerz payment gateways.
- Legal notice automation / PRCA compliance engine.
- AI rent price prediction.
- Native Android/iOS apps (mobile-first responsive web app covers mobile usage).
- AppLink USSD, CaaS, Subscription billing.
- Complex multi-agent AI orchestration.
- Tenant self-service portal and multi-staff caretaker RBAC (scheduled for Release C/D).

---

## 4. MVP Definition of Done (Acceptance Criteria)

- [ ] A new landlord can register, add 1 property with 3 units, add 2 tenants, generate a monthly rent obligation, and record a partial payment (e.g., 8,000 BDT against 12,000 BDT), seeing exactly 4,000 BDT outstanding everywhere.
- [ ] Reversing a payment restores the 12,000 BDT outstanding balance while preserving both the original payment and the reversal entry in the ledger and audit log.
- [ ] Speaking a Bangla/Banglish command produces an editable transcript, extracts a validated JSON action, resolves the exact tenant/unit, requires confirmation, executes deterministically, and logs an audit entry.
- [ ] Confirming an SMS receipt or reminder calls the real AppLink API via the static-IP relay, returns `S1000`, logs the `requestId`, and delivers a real SMS to a Banglalink handset.
- [ ] Cross-tenant RLS test proves Landlord A cannot read or mutate Landlord B's properties, tenants, payments, or notifications.
- [ ] All automated tests pass cleanly in CI (`npm test` / `pnpm test`).
