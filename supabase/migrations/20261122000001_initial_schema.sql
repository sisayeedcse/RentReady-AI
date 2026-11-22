-- RentReady AI — Migration 001: Core Schema
-- Non-negotiable invariants:
-- 1. All money stored in BIGINT *_paisa (1 BDT = 100 paisa). ZERO floats.
-- 2. Every tenant-owned table carries landlord_id UUID NOT NULL REFERENCES profiles(id).
-- 3. No hard deletes on financial records; corrections use explicit reversal rows + audit_logs.
-- 4. No raw tenant NID images or raw voice audio stored.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. Profiles (1:1 with auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone_e164 TEXT,
  preferred_lang TEXT NOT NULL DEFAULT 'bn' CHECK (preferred_lang IN ('bn', 'en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile row when a new Supabase Auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1), 'Landlord')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  address TEXT NOT NULL CHECK (char_length(trim(address)) > 0),
  city TEXT NOT NULL DEFAULT 'Dhaka',
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_landlord ON public.properties(landlord_id);
CREATE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Buildings (auto-created default "Main Building" for simple MVP UX)
CREATE TABLE public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  name TEXT NOT NULL DEFAULT 'Main Building',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_buildings_landlord ON public.buildings(landlord_id);
CREATE INDEX idx_buildings_property ON public.buildings(property_id);

-- 4. Floors (optional in MVP UI)
CREATE TABLE public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  floor_number INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, floor_number)
);

CREATE INDEX idx_floors_landlord ON public.floors(landlord_id);

-- 5. Units
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  floor_id UUID REFERENCES public.floors(id) ON DELETE SET NULL,
  unit_code TEXT NOT NULL CHECK (char_length(trim(unit_code)) > 0),
  floor_label TEXT,
  size_sqft INTEGER CHECK (size_sqft IS NULL OR size_sqft > 0),
  default_rent_paisa BIGINT NOT NULL CHECK (default_rent_paisa > 0),
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (building_id, unit_code)
);

CREATE INDEX idx_units_landlord ON public.units(landlord_id);
CREATE INDEX idx_units_property ON public.units(property_id);
CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Tenants (minimized PII: no NID photos/numbers)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) > 0),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^\+8801[3-9][0-9]{8}$'),
  email TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_landlord ON public.tenants(landlord_id);
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. Tenancies (only 1 active tenancy per unit enforced by partial unique index)
CREATE TABLE public.tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE,
  monthly_rent_paisa BIGINT NOT NULL CHECK (monthly_rent_paisa > 0),
  rent_due_day INTEGER NOT NULL DEFAULT 5 CHECK (rent_due_day BETWEEN 1 AND 28),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX uq_tenancies_one_active_per_unit
  ON public.tenancies(unit_id)
  WHERE status = 'active';

CREATE INDEX idx_tenancies_landlord_status ON public.tenancies(landlord_id, status);
CREATE TRIGGER trg_tenancies_updated_at
  BEFORE UPDATE ON public.tenancies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Rent Obligations (monthly billing records)
CREATE TABLE public.rent_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  billing_month DATE NOT NULL CHECK (EXTRACT(DAY FROM billing_month) = 1),
  base_rent_paisa BIGINT NOT NULL CHECK (base_rent_paisa > 0),
  utility_charges_paisa BIGINT NOT NULL DEFAULT 0 CHECK (utility_charges_paisa >= 0),
  amount_due_paisa BIGINT GENERATED ALWAYS AS (base_rent_paisa + utility_charges_paisa) STORED,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'void')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_rent_obligations_open_per_month
  ON public.rent_obligations(tenancy_id, billing_month)
  WHERE status = 'open';

CREATE INDEX idx_rent_obligations_landlord_month
  ON public.rent_obligations(landlord_id, billing_month);

CREATE TRIGGER trg_rent_obligations_updated_at
  BEFORE UPDATE ON public.rent_obligations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Payments (immutable ledger; reversals create counter-rows)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa <> 0),
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bkash', 'nagad', 'bank', 'other')),
  payment_type TEXT NOT NULL DEFAULT 'rent' CHECK (payment_type IN ('rent', 'advance', 'deposit', 'refund')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_no TEXT,
  notes TEXT,
  is_reversal BOOLEAN NOT NULL DEFAULT FALSE,
  reversal_of_payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT,
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) >= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landlord_id, idempotency_key),
  CHECK (
    (is_reversal = FALSE AND amount_paisa > 0 AND reversal_of_payment_id IS NULL)
    OR
    (is_reversal = TRUE AND amount_paisa < 0 AND reversal_of_payment_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uq_payments_single_reversal
  ON public.payments(reversal_of_payment_id)
  WHERE reversal_of_payment_id IS NOT NULL;

CREATE INDEX idx_payments_landlord_tenant_paid
  ON public.payments(landlord_id, tenant_id, paid_at DESC);

-- 10. Payment Allocations (links payments to specific rent_obligations)
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  obligation_id UUID NOT NULL REFERENCES public.rent_obligations(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa <> 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_allocations_obligation ON public.payment_allocations(obligation_id);
CREATE INDEX idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_landlord ON public.payment_allocations(landlord_id);

-- 11. Security Deposits (schema ready in Release A; full UI in Release B)
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tenancy_id UUID NOT NULL REFERENCES public.tenancies(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  held_paisa BIGINT NOT NULL CHECK (held_paisa >= 0),
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'partially_refunded', 'refunded', 'forfeited')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deposits_landlord ON public.deposits(landlord_id);

-- 12. Expense Categories (system defaults have landlord_id IS NULL)
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.expense_categories (id, landlord_id, name_en, name_bn) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'Utilities (Gas/Water/Electricity)', 'ইউটিলিটি বিল (গ্যাস/পানি/বিদ্যুৎ)'),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Plumbing & Electrical Repair', 'প্লাম্বিং ও ইলেকট্রিক্যাল মেরামত'),
  ('10000000-0000-0000-0000-000000000003', NULL, 'Caretaker & Security', 'কেয়ারটেকার ও নিরাপত্তা'),
  ('10000000-0000-0000-0000-000000000004', NULL, 'General Maintenance', 'সাধারণ রক্ষণাবেক্ষণ'),
  ('10000000-0000-0000-0000-000000000005', NULL, 'Holding Tax & Legal', 'হোল্ডিং ট্যাক্স ও আইনি খরচ')
ON CONFLICT (id) DO NOTHING;

-- 13. Maintenance Requests
CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) >= 2),
  description TEXT NOT NULL CHECK (char_length(trim(description)) >= 2),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_maintenance_landlord_status ON public.maintenance_requests(landlord_id, status);
CREATE TRIGGER trg_maintenance_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 14. Expenses (immutable; corrections use is_void = true + audit_logs)
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  maintenance_request_id UUID REFERENCES public.maintenance_requests(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'General Maintenance',
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa > 0),
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL CHECK (char_length(trim(description)) > 0),
  is_void BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) >= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landlord_id, idempotency_key)
);

CREATE INDEX idx_expenses_landlord_date ON public.expenses(landlord_id, incurred_on DESC);

-- 15. Voice Sessions & Voice Actions (text transcripts only — zero raw audio stored)
CREATE TABLE public.voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  asr_provider TEXT NOT NULL DEFAULT 'text_fallback',
  raw_transcript TEXT NOT NULL,
  edited_transcript TEXT,
  audio_duration_ms INTEGER CHECK (audio_duration_ms IS NULL OR audio_duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_sessions_landlord ON public.voice_sessions(landlord_id, created_at DESC);

CREATE TABLE public.voice_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  session_id UUID NOT NULL REFERENCES public.voice_sessions(id) ON DELETE RESTRICT,
  intent_name TEXT NOT NULL,
  extracted_payload JSONB NOT NULL,
  resolved_entities JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (
    status IN ('proposed', 'needs_clarification', 'confirmed', 'executed', 'rejected', 'failed')
  ),
  executed_record_id UUID,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_voice_actions_landlord ON public.voice_actions(landlord_id, created_at DESC);

-- 16. Notifications & AppLink Notification Logs
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  channel TEXT NOT NULL DEFAULT 'applink_sms' CHECK (channel IN ('applink_sms')),
  template_type TEXT NOT NULL CHECK (template_type IN ('rent_reminder', 'payment_receipt')),
  recipient_phone_e164 TEXT NOT NULL CHECK (recipient_phone_e164 ~ '^\+8801[3-9][0-9]{8}$'),
  message_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (
    status IN ('pending_confirmation', 'queued', 'sent', 'failed')
  ),
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) >= 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (landlord_id, idempotency_key)
);

CREATE INDEX idx_notifications_landlord ON public.notifications(landlord_id, created_at DESC);

CREATE TABLE public.notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'applink',
  provider_request_id TEXT,
  provider_status_code TEXT NOT NULL,
  provider_status_detail TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_landlord ON public.notification_logs(landlord_id, created_at DESC);

-- 17. Append-Only Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ui' CHECK (source IN ('ui', 'voice', 'system')),
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_landlord ON public.audit_logs(landlord_id, created_at DESC);
