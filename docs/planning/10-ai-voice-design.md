# 10 — AI Safety, Bangla Voice Pipeline & Action Contracts

**Last Updated:** 2026-11-22  
**Epistemic Legend:** `[Official requirement]` | `[Verified technical fact]` | `[Recommendation]` | `[Assumption]` | `[Unknown]` | `[Unverified]`

---

## 1. End-to-End Safe Execution Pipeline

Every voice or text AI command follows this **strict 9-step deterministic pipeline**:

```text
1. Audio Capture (Browser MediaRecorder, max 30s, webm/ogg/mp4)
   -> OR Direct Bangla/English Text Input (always available fallback)
2. Bangla ASR (Replaceable SpeechToTextProvider: Groq Whisper Large V3 Turbo -> Deepgram Nova-3 fallback)
3. Editable Transcript UI (Landlord can fix misheard names/numbers before submitting)
4. Model Intent Extraction (Pinned OpenRouter model, strict JSON schema, temperature = 0)
5. Zod Schema Validation (Rejects malformed JSON, negative amounts, missing required fields)
6. Deterministic Entity Resolution (Backend queries landlord's DB to match tenant/unit/property)
   - If 0 matches -> Ask user to pick or clarify
   - If >1 matches (e.g., two tenants named "Rahim") -> Return disambiguation options; NEVER guess
7. Explicit Confirmation Card (Shows exact resolved tenant, unit, BDT amount, month, SMS text)
8. Deterministic Backend Operation (Idempotent SQL RPC or confirmed AppLink SMS call)
9. Append-Only Audit Log (Links voice_action_id -> executed_record_id -> audit_logs)
```

### Non-Negotiable AI Safety Rules
- **Never** allow an LLM to generate or execute SQL or write directly to Supabase `[Recommendation]`.
- **Never** let an LLM calculate outstanding balances, totals, or net income — always query PostgreSQL `[Recommendation]`.
- **Never** execute ambiguous entity matches automatically `[Recommendation]`.
- **Never** invent missing payment amounts, dates, or payment methods `[Recommendation]`.
- **Never** dispatch an AppLink SMS without an explicit user confirmation click `[Recommendation]`.

---

## 2. Replaceable Bangla ASR Interface

```ts
export interface SpeechToTextProvider {
  readonly name: string;
  transcribe(input: {
    audio: ArrayBuffer;
    mimeType: string;
    languageHint?: "bn" | "en";
    promptHint?: string; // e.g., domain terms: "bKash, Nagad, flat, rent, taka, baki"
  }): Promise<{
    transcript: string;
    durationMs?: number;
    provider: string;
  }>;
}
```

- **MVP Implementation:** `GroqWhisperProvider` using `whisper-large-v3-turbo` with `language: "bn"` and a domain prompt hint for Bangladeshi rental vocabulary (`"ভাড়া, ফ্ল্যাট, বিকাশ, নগদ, বাকি, টাকা, গ্যাস, পানি"`) `[Recommendation]`.
- **Fallback Implementation:** `DeepgramNova3Provider` (`model=nova-3&language=bn`) `[Verified technical fact — Deepgram Nova-3 supports bn, accessed 2026-11-22]`.

---

## 3. Structured Action Contracts (8 Core Actions)

All monetary amounts extracted by the LLM are validated in whole BDT (or up to 2 decimals) and converted deterministically to `amount_paisa = Math.round(amountBdt * 100)` on the server.

### 1. `record_rent_payment` (Write — Confirmation Required)
- **Required Fields:** `amount_bdt` (> 0), at least one of `tenant_name_query` or `unit_code_query`.
- **Optional Fields:** `billing_month` (`YYYY-MM`, defaults to oldest open obligation if omitted — shown explicitly on confirmation card), `payment_method` (`cash|bkash|nagad|bank|other`, default `cash` shown for edit), `reference_no`, `notes`.
- **Entity Resolution:** Resolve active tenancy by `unit_code` and/or fuzzy match on `tenant.full_name` scoped to `landlord_id`.
- **Permission:** Authenticated landlord owning the tenancy.
- **Backend Operation:** `record_payment_atomic` RPC with `idempotency_key`.
- **Error States:** `ENTITY_NOT_FOUND`, `ENTITY_AMBIGUOUS`, `NO_OPEN_OBLIGATION`, `INVALID_AMOUNT`.

### 2. `record_expense` (Write — Confirmation Required)
- **Required Fields:** `amount_bdt` (> 0), `category_query` (e.g., plumber/utility/repair), `description`.
- **Optional Fields:** `property_name_query`, `unit_code_query`, `incurred_on` (default today in `Asia/Dhaka`).
- **Entity Resolution:** Match property (auto-select if landlord has only 1 property), match expense category (fallback to `"General Maintenance"` shown on card).
- **Backend Operation:** Insert into `expenses` with `idempotency_key` + `audit_logs`.
- **Error States:** `PROPERTY_AMBIGUOUS`, `INVALID_AMOUNT`.

### 3. `get_outstanding_rent` (Read-Only — No Confirmation Needed)
- **Required Fields:** None.
- **Optional Fields:** `tenant_name_query`, `unit_code_query`, `property_name_query`, `billing_month`.
- **Backend Operation:** Query `v_obligation_balances` where `outstanding_paisa > 0`.
- **Error States:** `ENTITY_NOT_FOUND`.

### 4. `get_monthly_collection` (Read-Only — No Confirmation Needed)
- **Required Fields:** None.
- **Optional Fields:** `billing_month` (default current month in `Asia/Dhaka`), `property_name_query`.
- **Backend Operation:** Query `v_dashboard_summary` for expected vs. collected vs. outstanding totals.

### 5. `get_payment_history` (Read-Only — No Confirmation Needed)
- **Required Fields:** At least one of `tenant_name_query` or `unit_code_query`.
- **Optional Fields:** `limit` (default 10, max 50).
- **Backend Operation:** Query `payments` + `payment_allocations` ordered by `paid_at DESC`.

### 6. `create_maintenance_request` (Write — Confirmation Required)
- **Required Fields:** `title`, `description`.
- **Optional Fields:** `unit_code_query`, `property_name_query`, `priority` (`low|medium|high|urgent`, default `medium`).
- **Backend Operation:** Insert into `maintenance_requests` + `audit_logs`.

### 7. `prepare_rent_reminder` (External SMS — Strict Confirmation Required)
- **Required Fields:** At least one of `tenant_name_query` or `unit_code_query`.
- **Optional Fields:** `billing_month`, `language` (`bn|en`).
- **Entity Resolution:** Resolve tenant, verify `phone_e164`, check if number is Banglalink (`+88019...` or `+88014...`), fetch exact DB-computed `outstanding_paisa`.
- **Confirmation:** Displays exact recipient phone, exact SMS text, and operator compatibility warning if non-Banglalink.
- **Backend Operation:** Only after explicit confirmation click -> calls AppLink SMS via fixed-IP relay with `idempotency_key`.
- **Error States:** `NO_OUTSTANDING_BALANCE`, `NON_BANGLALINK_NUMBER`, `MISSING_PHONE`, `APPLINK_ERROR`.

### 8. `get_property_summary` (Read-Only — No Confirmation Needed)
- **Required Fields:** None.
- **Optional Fields:** `property_name_query`.
- **Backend Operation:** Query `v_dashboard_summary` for occupancy, total rent, expenses, net result, and open maintenance.
