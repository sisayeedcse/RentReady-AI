# 09 — PostgreSQL & Supabase Database Schema Design

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. Accounting & Data Modeling Rules

1. **Monetary Precision:** Every monetary column uses `BIGINT` storing **paisa** (`1 BDT = 100 paisa`, suffix `_paisa`). Example: `12,500.00 BDT` = `1250000`. Never use `FLOAT`, `REAL`, or `DOUBLE PRECISION` `[Recommendation]`.
2. **No Hard Deletes on Financial Records:** `payments`, `payment_allocations`, `rent_obligations`, `deposits`, and `expenses` are **never deleted**. Mistakes are corrected via explicit reversal rows (`is_reversal = true`, `reversal_of_id`) and logged in `audit_logs` `[Recommendation]`.
3. **No Paid/Unpaid Boolean as Source of Truth:** Obligation status (`unpaid`, `partial`, `paid`, `overpaid`, `void`) is derived deterministically from `SUM(payment_allocations.amount_paisa)` vs. `rent_obligations.amount_due_paisa` `[Recommendation]`.
4. **Strict Landlord Isolation (RLS):** Every table carries `landlord_id UUID NOT NULL REFERENCES profiles(id)` (directly on every table to make RLS policies O(1) without expensive multi-table joins) `[Recommendation]`.
5. **Identifiers & Time:** UUIDv4/UUIDv7 primary keys; `created_at` / `updated_at` in `TIMESTAMPTZ` (UTC); billing periods stored as `billing_month DATE` normalized to the 1st of the month (e.g., `2026-11-01`) `[Recommendation]`.

---

## 2. Justified Tables (MVP Core vs. Deferred)

### Included in Release A Migrations (16 Tables)
1. `profiles` — 1:1 with `auth.users(id)`. Fields: `id`, `full_name`, `phone_e164`, `preferred_lang ('bn'|'en')`, `created_at`.
2. `properties` — `id`, `landlord_id`, `name`, `address`, `city`, `notes`, `is_archived`, `created_at`.
3. `buildings` — `id`, `landlord_id`, `property_id`, `name` (auto-created default `"Main Building"` for simple MVP UX).
4. `floors` — `id`, `landlord_id`, `building_id`, `floor_number`, `label` (optional in MVP UI).
5. `units` — `id`, `landlord_id`, `property_id`, `building_id`, `floor_id (nullable)`, `unit_code` (e.g., `"3B"`), `size_sqft`, `default_rent_paisa`, `status ('vacant'|'occupied'|'maintenance')`, `UNIQUE(building_id, unit_code)`.
6. `tenants` — `id`, `landlord_id`, `full_name`, `phone_e164`, `email`, `notes`, `is_active`, `created_at`. *(No raw NID images in MVP to minimize PII liability.)*
7. `tenancies` — `id`, `landlord_id`, `unit_id`, `tenant_id`, `start_date`, `end_date (nullable)`, `monthly_rent_paisa`, `rent_due_day (1..28)`, `status ('active'|'ended')`. Partial unique index: `UNIQUE(unit_id) WHERE status = 'active'` prevents double-booking a unit!
8. `rent_obligations` — `id`, `landlord_id`, `tenancy_id`, `unit_id`, `tenant_id`, `billing_month DATE`, `base_rent_paisa`, `utility_charges_paisa DEFAULT 0`, `amount_due_paisa GENERATED ALWAYS AS (base_rent_paisa + utility_charges_paisa) STORED`, `due_date DATE`, `status ('open'|'void')`, `UNIQUE(tenancy_id, billing_month) WHERE status = 'open'`.
9. `payments` — `id`, `landlord_id`, `tenancy_id`, `tenant_id`, `amount_paisa CHECK (amount_paisa <> 0)`, `payment_method ('cash'|'bkash'|'nagad'|'bank'|'other')`, `payment_type ('rent'|'advance'|'deposit'|'refund')`, `paid_at TIMESTAMPTZ`, `reference_no`, `notes`, `is_reversal BOOLEAN DEFAULT false`, `reversal_of_payment_id UUID REFERENCES payments(id)`, `idempotency_key TEXT`, `UNIQUE(landlord_id, idempotency_key)`.
10. `payment_allocations` — `id`, `landlord_id`, `payment_id REFERENCES payments(id)`, `obligation_id REFERENCES rent_obligations(id)`, `amount_paisa BIGINT NOT NULL` (positive for payment, negative for reversal).
11. `deposits` — `id`, `landlord_id`, `tenancy_id`, `tenant_id`, `amount_paisa`, `held_paisa`, `status ('held'|'partially_refunded'|'refunded'|'forfeited')`, `received_at`, `notes`. *(Table created in A; full UI in B.)*
12. `expense_categories` — `id`, `landlord_id (nullable for system defaults)`, `name_en`, `name_bn`.
13. `expenses` — `id`, `landlord_id`, `property_id`, `unit_id (nullable)`, `maintenance_request_id (nullable)`, `category_id`, `amount_paisa CHECK (amount_paisa > 0)`, `incurred_on DATE`, `description`, `is_void BOOLEAN DEFAULT false`, `idempotency_key TEXT`, `UNIQUE(landlord_id, idempotency_key)`.
14. `maintenance_requests` — `id`, `landlord_id`, `property_id`, `unit_id (nullable)`, `tenant_id (nullable)`, `title`, `description`, `priority ('low'|'medium'|'high'|'urgent')`, `status ('open'|'in_progress'|'resolved'|'closed')`, `created_at`, `resolved_at`.
15. `voice_sessions` & `voice_actions` —
    - `voice_sessions`: `id`, `landlord_id`, `asr_provider`, `raw_transcript`, `edited_transcript`, `audio_duration_ms`, `created_at`.
    - `voice_actions`: `id`, `landlord_id`, `session_id`, `intent_name`, `extracted_payload JSONB`, `resolved_entities JSONB`, `status ('proposed'|'needs_clarification'|'confirmed'|'executed'|'rejected'|'failed')`, `executed_record_id UUID`, `idempotency_key TEXT`, `created_at`, `confirmed_at`.
16. `notifications`, `notification_logs`, `audit_logs` —
    - `notifications`: `id`, `landlord_id`, `tenant_id`, `channel ('applink_sms')`, `template_type ('rent_reminder'|'payment_receipt')`, `recipient_phone_e164`, `message_body`, `status ('pending_confirmation'|'queued'|'sent'|'failed')`, `idempotency_key TEXT`, `UNIQUE(landlord_id, idempotency_key)`.
    - `notification_logs`: `id`, `landlord_id`, `notification_id`, `provider ('applink')`, `provider_request_id`, `provider_status_code`, `provider_status_detail`, `http_status`, `created_at`. *(Never store AppLink `password` in logs!)*
    - `audit_logs`: `id`, `landlord_id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `source ('ui'|'voice'|'system')`, `before_data JSONB`, `after_data JSONB`, `created_at`. *(Append-only via RLS: INSERT + SELECT only, no UPDATE/DELETE.)*

### Deferred Tables (Not Created Until Release C/D)
- `staff_memberships` (Release C — caretaker RBAC).
- `subscriptions` (Release D — SaaS billing).
- `leases` (Release C — formal PDF lease metadata).
- `maintenance_updates` (Release B — threaded maintenance comments).

---

## 3. Core Database Views & Atomic RPCs

- **View `v_obligation_balances`:** Computes `allocated_paisa = COALESCE(SUM(pa.amount_paisa), 0)` and `outstanding_paisa = o.amount_due_paisa - allocated_paisa` for every open obligation.
- **View `v_dashboard_summary`:** Aggregates per `landlord_id` and `billing_month`: total units, occupied units, expected rent, collected rent, outstanding rent, total expenses, net operating result (`collected - expenses`), overdue count, open maintenance count.
- **RPC `record_payment_atomic(...)`:** Runs inside a PostgreSQL transaction: checks `idempotency_key`, inserts `payments`, inserts FIFO or explicit `payment_allocations` (never over-allocating a paid obligation; excess recorded as unallocated advance), and inserts `audit_logs`.
- **RPC `reverse_payment_atomic(payment_id, reason)`:** Verifies payment isn't already reversed, inserts negative counter-payment (`is_reversal = true`, `reversal_of_payment_id`), inserts negative `payment_allocations`, and logs to `audit_logs`.

---

## 4. Row Level Security (RLS) & Index Strategy

- Enable RLS on **100% of public tables**: `ALTER TABLE <tbl> ENABLE ROW LEVEL SECURITY;`.
- Standard Landlord Policy:
  ```sql
  CREATE POLICY "landlord_isolation" ON properties
    FOR ALL
    USING (landlord_id = auth.uid())
    WITH CHECK (landlord_id = auth.uid());
  ```
- Immutable Audit & Ledger Guards:
  - On `audit_logs` and `notification_logs`: allow `SELECT` and `INSERT` only (no `UPDATE` or `DELETE` policy).
  - On `payments` and `payment_allocations`: allow `SELECT` and `INSERT` only (mutations happen via reversal rows).
- **Mandatory Indexes:**
  - `(landlord_id)` on every table.
  - `(landlord_id, billing_month)` on `rent_obligations`.
  - `(landlord_id, tenant_id, paid_at DESC)` on `payments`.
  - `(obligation_id)` on `payment_allocations`.
  - `(landlord_id, status)` on `maintenance_requests` and `tenancies`.
