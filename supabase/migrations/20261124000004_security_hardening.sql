-- RentReady AI — Migration 004: Security, Cross-Tenant Integrity & Concurrency Hardening
-- Addresses:
-- 1. Cross-tenant FK reference injection & cross-tenant DoS via composite (id, landlord_id) FKs + RLS WITH CHECK.
-- 2. audit_logs actor_user_id = auth.uid() enforcement.
-- 3. Immutable financial history triggers on expenses, rent_obligations, and notifications.
-- 4. Fixed search_path = public on all PL/pgSQL functions (prevents search_path hijacking).
-- 5. Row-level locking (FOR UPDATE) & parameter validation in record_payment_atomic and reverse_payment_atomic.

-- 1. Composite UNIQUE (id, landlord_id) keys on parent tables to support tenant-scoped composite FKs
ALTER TABLE public.properties ADD CONSTRAINT uq_properties_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.buildings ADD CONSTRAINT uq_buildings_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.floors ADD CONSTRAINT uq_floors_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.units ADD CONSTRAINT uq_units_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.tenants ADD CONSTRAINT uq_tenants_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.tenancies ADD CONSTRAINT uq_tenancies_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.rent_obligations ADD CONSTRAINT uq_rent_obligations_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.payments ADD CONSTRAINT uq_payments_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.maintenance_requests ADD CONSTRAINT uq_maintenance_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.voice_sessions ADD CONSTRAINT uq_voice_sessions_id_landlord UNIQUE (id, landlord_id);
ALTER TABLE public.notifications ADD CONSTRAINT uq_notifications_id_landlord UNIQUE (id, landlord_id);

-- 2. Tenant-scoped composite foreign keys on all NOT NULL (and RESTRICT nullable) parent references
ALTER TABLE public.buildings
  ADD CONSTRAINT fk_buildings_property_landlord
  FOREIGN KEY (property_id, landlord_id) REFERENCES public.properties(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.floors
  ADD CONSTRAINT fk_floors_building_landlord
  FOREIGN KEY (building_id, landlord_id) REFERENCES public.buildings(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.units
  ADD CONSTRAINT fk_units_property_landlord
  FOREIGN KEY (property_id, landlord_id) REFERENCES public.properties(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_units_building_landlord
  FOREIGN KEY (building_id, landlord_id) REFERENCES public.buildings(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.tenancies
  ADD CONSTRAINT fk_tenancies_unit_landlord
  FOREIGN KEY (unit_id, landlord_id) REFERENCES public.units(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_tenancies_tenant_landlord
  FOREIGN KEY (tenant_id, landlord_id) REFERENCES public.tenants(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.rent_obligations
  ADD CONSTRAINT fk_obligations_tenancy_landlord
  FOREIGN KEY (tenancy_id, landlord_id) REFERENCES public.tenancies(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_obligations_unit_landlord
  FOREIGN KEY (unit_id, landlord_id) REFERENCES public.units(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_obligations_tenant_landlord
  FOREIGN KEY (tenant_id, landlord_id) REFERENCES public.tenants(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.payments
  ADD CONSTRAINT fk_payments_tenancy_landlord
  FOREIGN KEY (tenancy_id, landlord_id) REFERENCES public.tenancies(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_payments_tenant_landlord
  FOREIGN KEY (tenant_id, landlord_id) REFERENCES public.tenants(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_payments_reversal_landlord
  FOREIGN KEY (reversal_of_payment_id, landlord_id) REFERENCES public.payments(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.payment_allocations
  ADD CONSTRAINT fk_allocations_payment_landlord
  FOREIGN KEY (payment_id, landlord_id) REFERENCES public.payments(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_allocations_obligation_landlord
  FOREIGN KEY (obligation_id, landlord_id) REFERENCES public.rent_obligations(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.deposits
  ADD CONSTRAINT fk_deposits_tenancy_landlord
  FOREIGN KEY (tenancy_id, landlord_id) REFERENCES public.tenancies(id, landlord_id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_deposits_tenant_landlord
  FOREIGN KEY (tenant_id, landlord_id) REFERENCES public.tenants(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT fk_maintenance_property_landlord
  FOREIGN KEY (property_id, landlord_id) REFERENCES public.properties(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.expenses
  ADD CONSTRAINT fk_expenses_property_landlord
  FOREIGN KEY (property_id, landlord_id) REFERENCES public.properties(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.voice_actions
  ADD CONSTRAINT fk_voice_actions_session_landlord
  FOREIGN KEY (session_id, landlord_id) REFERENCES public.voice_sessions(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_tenant_landlord
  FOREIGN KEY (tenant_id, landlord_id) REFERENCES public.tenants(id, landlord_id) ON DELETE RESTRICT;

ALTER TABLE public.notification_logs
  ADD CONSTRAINT fk_notification_logs_notification_landlord
  FOREIGN KEY (notification_id, landlord_id) REFERENCES public.notifications(id, landlord_id) ON DELETE RESTRICT;

-- 3. Tighten RLS policies for nullable parent references & audit_logs.actor_user_id
DROP POLICY IF EXISTS "audit_logs_insert_own" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  FOR INSERT WITH CHECK (landlord_id = auth.uid() AND actor_user_id = auth.uid());

DROP POLICY IF EXISTS "units_landlord_all" ON public.units;
CREATE POLICY "units_landlord_all" ON public.units
  FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (
    landlord_id = auth.uid()
    AND (floor_id IS NULL OR EXISTS (
      SELECT 1 FROM public.floors f WHERE f.id = floor_id AND f.landlord_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "maintenance_requests_landlord_all" ON public.maintenance_requests;
CREATE POLICY "maintenance_requests_landlord_all" ON public.maintenance_requests
  FOR ALL
  USING (landlord_id = auth.uid())
  WITH CHECK (
    landlord_id = auth.uid()
    AND (unit_id IS NULL OR EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = unit_id AND u.landlord_id = auth.uid()
    ))
    AND (tenant_id IS NULL OR EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.landlord_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT
  WITH CHECK (
    landlord_id = auth.uid()
    AND (unit_id IS NULL OR EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = unit_id AND u.landlord_id = auth.uid()
    ))
    AND (maintenance_request_id IS NULL OR EXISTS (
      SELECT 1 FROM public.maintenance_requests m WHERE m.id = maintenance_request_id AND m.landlord_id = auth.uid()
    ))
    AND (category_id IS NULL OR EXISTS (
      SELECT 1 FROM public.expense_categories c WHERE c.id = category_id AND (c.landlord_id IS NULL OR c.landlord_id = auth.uid())
    ))
  );

-- 4. Harden search_path on set_updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 5. Immutability triggers for financial & notification records
CREATE OR REPLACE FUNCTION public.guard_expense_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.landlord_id <> OLD.landlord_id
     OR NEW.property_id <> OLD.property_id
     OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
     OR NEW.amount_paisa <> OLD.amount_paisa
     OR NEW.incurred_on <> OLD.incurred_on
     OR NEW.idempotency_key <> OLD.idempotency_key THEN
    RAISE EXCEPTION 'Confirmed expense financial fields are immutable; void and re-record instead';
  END IF;

  IF OLD.is_void = TRUE AND NEW.is_void = FALSE THEN
    RAISE EXCEPTION 'Voided expense cannot be un-voided';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_expenses_immutability ON public.expenses;
CREATE TRIGGER trg_expenses_immutability
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.guard_expense_immutability();

CREATE OR REPLACE FUNCTION public.guard_obligation_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_allocated BIGINT;
BEGIN
  IF NEW.landlord_id <> OLD.landlord_id
     OR NEW.tenancy_id <> OLD.tenancy_id
     OR NEW.unit_id <> OLD.unit_id
     OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.billing_month <> OLD.billing_month THEN
    RAISE EXCEPTION 'Rent obligation identity fields are immutable';
  END IF;

  IF NEW.base_rent_paisa <> OLD.base_rent_paisa
     OR NEW.utility_charges_paisa <> OLD.utility_charges_paisa
     OR NEW.status <> OLD.status THEN
    SELECT COALESCE(SUM(amount_paisa), 0) INTO v_allocated
    FROM public.payment_allocations
    WHERE obligation_id = OLD.id;

    IF v_allocated > 0 THEN
      RAISE EXCEPTION 'Cannot modify or void an obligation with active payment allocations';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rent_obligations_immutability ON public.rent_obligations;
CREATE TRIGGER trg_rent_obligations_immutability
  BEFORE UPDATE ON public.rent_obligations
  FOR EACH ROW EXECUTE FUNCTION public.guard_obligation_immutability();

CREATE OR REPLACE FUNCTION public.guard_notification_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.landlord_id <> OLD.landlord_id
     OR NEW.tenant_id <> OLD.tenant_id
     OR NEW.recipient_phone_e164 <> OLD.recipient_phone_e164
     OR NEW.message_body <> OLD.message_body
     OR NEW.idempotency_key <> OLD.idempotency_key THEN
    RAISE EXCEPTION 'Notification recipient and message body are immutable after creation';
  END IF;

  IF OLD.status IN ('sent', 'failed') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Finalized notification status cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_immutability ON public.notifications;
CREATE TRIGGER trg_notifications_immutability
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_immutability();

-- 6. Harden RPCs with fixed search_path, row-level locking, and strict input bounds
CREATE OR REPLACE FUNCTION public.generate_monthly_obligations(p_billing_month DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_landlord_id UUID := auth.uid();
  v_month_start DATE := date_trunc('month', p_billing_month)::DATE;
  v_inserted INTEGER := 0;
BEGIN
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_billing_month IS NULL THEN
    RAISE EXCEPTION 'billing_month is required';
  END IF;

  INSERT INTO public.rent_obligations (
    landlord_id,
    tenancy_id,
    unit_id,
    tenant_id,
    billing_month,
    base_rent_paisa,
    utility_charges_paisa,
    due_date,
    status
  )
  SELECT
    t.landlord_id,
    t.id,
    t.unit_id,
    t.tenant_id,
    v_month_start,
    t.monthly_rent_paisa,
    0,
    (v_month_start + (t.rent_due_day - 1) * INTERVAL '1 day')::DATE,
    'open'
  FROM public.tenancies t
  WHERE t.landlord_id = v_landlord_id
    AND t.status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.rent_obligations ro
      WHERE ro.tenancy_id = t.id
        AND ro.billing_month = v_month_start
        AND ro.status = 'open'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_atomic(
  p_tenancy_id UUID,
  p_amount_paisa BIGINT,
  p_payment_method TEXT,
  p_idempotency_key TEXT,
  p_obligation_id UUID DEFAULT NULL,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'ui'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_landlord_id UUID := auth.uid();
  v_existing public.payments%ROWTYPE;
  v_tenancy public.tenancies%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_remaining BIGINT := p_amount_paisa;
  v_alloc BIGINT;
  v_obl RECORD;
BEGIN
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount_paisa IS NULL OR p_amount_paisa <= 0 OR p_amount_paisa > 10000000000 THEN
    RAISE EXCEPTION 'amount_paisa must be between 1 and 10000000000';
  END IF;

  IF p_source IS NULL OR p_source NOT IN ('ui', 'voice') THEN
    RAISE EXCEPTION 'Invalid payment source';
  END IF;

  -- Lock tenancy row to serialize concurrent payment allocations for this tenancy
  SELECT * INTO v_tenancy
  FROM public.tenancies
  WHERE id = p_tenancy_id AND landlord_id = v_landlord_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found or access denied';
  END IF;

  -- Idempotency check (after row lock to prevent duplicate race)
  SELECT * INTO v_existing
  FROM public.payments
  WHERE landlord_id = v_landlord_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'idempotent_replay', TRUE,
      'payment_id', v_existing.id,
      'amount_paisa', v_existing.amount_paisa
    );
  END IF;

  -- Validate targeted obligation belongs to this tenancy if supplied
  IF p_obligation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.rent_obligations
      WHERE id = p_obligation_id
        AND tenancy_id = v_tenancy.id
        AND landlord_id = v_landlord_id
        AND status = 'open'
    ) THEN
      RAISE EXCEPTION 'Target obligation not found for this tenancy';
    END IF;
  END IF;

  INSERT INTO public.payments (
    landlord_id,
    tenancy_id,
    tenant_id,
    amount_paisa,
    payment_method,
    payment_type,
    reference_no,
    notes,
    is_reversal,
    idempotency_key
  )
  VALUES (
    v_landlord_id,
    v_tenancy.id,
    v_tenancy.tenant_id,
    p_amount_paisa,
    p_payment_method,
    'rent',
    p_reference_no,
    p_notes,
    FALSE,
    p_idempotency_key
  )
  RETURNING * INTO v_payment;

  -- Allocate to targeted obligation first (if supplied), then oldest open obligations FIFO
  FOR v_obl IN
    SELECT obligation_id, outstanding_paisa
    FROM public.v_obligation_balances
    WHERE landlord_id = v_landlord_id
      AND tenancy_id = v_tenancy.id
      AND obligation_status = 'open'
      AND outstanding_paisa > 0
      AND (p_obligation_id IS NULL OR obligation_id = p_obligation_id)
    ORDER BY billing_month ASC
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_alloc := LEAST(v_remaining, v_obl.outstanding_paisa);
    IF v_alloc > 0 THEN
      INSERT INTO public.payment_allocations (
        landlord_id,
        payment_id,
        obligation_id,
        amount_paisa
      )
      VALUES (
        v_landlord_id,
        v_payment.id,
        v_obl.obligation_id,
        v_alloc
      );
      v_remaining := v_remaining - v_alloc;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs (
    landlord_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    source,
    after_data
  )
  VALUES (
    v_landlord_id,
    v_landlord_id,
    'payment',
    v_payment.id,
    'record_payment',
    p_source,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'tenancy_id', v_tenancy.id,
      'amount_paisa', p_amount_paisa,
      'allocated_paisa', p_amount_paisa - v_remaining,
      'unallocated_advance_paisa', v_remaining,
      'payment_method', p_payment_method
    )
  );

  RETURN jsonb_build_object(
    'idempotent_replay', FALSE,
    'payment_id', v_payment.id,
    'amount_paisa', v_payment.amount_paisa,
    'allocated_paisa', p_amount_paisa - v_remaining,
    'unallocated_advance_paisa', v_remaining
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_payment_atomic(
  p_payment_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_landlord_id UUID := auth.uid();
  v_existing public.payments%ROWTYPE;
  v_orig public.payments%ROWTYPE;
  v_rev public.payments%ROWTYPE;
BEGIN
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_reason IS NULL OR char_length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Reversal reason must be at least 3 characters';
  END IF;

  -- Lock original payment row to serialize concurrent reversal attempts
  SELECT * INTO v_orig
  FROM public.payments
  WHERE id = p_payment_id AND landlord_id = v_landlord_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original payment not found or access denied';
  END IF;

  -- Idempotency check
  SELECT * INTO v_existing
  FROM public.payments
  WHERE landlord_id = v_landlord_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'idempotent_replay', TRUE,
      'reversal_payment_id', v_existing.id,
      'reversed_payment_id', v_existing.reversal_of_payment_id
    );
  END IF;

  IF v_orig.is_reversal THEN
    RAISE EXCEPTION 'Cannot reverse a reversal row';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payments WHERE reversal_of_payment_id = v_orig.id
  ) THEN
    RAISE EXCEPTION 'Payment has already been reversed';
  END IF;

  INSERT INTO public.payments (
    landlord_id,
    tenancy_id,
    tenant_id,
    amount_paisa,
    payment_method,
    payment_type,
    notes,
    is_reversal,
    reversal_of_payment_id,
    idempotency_key
  )
  VALUES (
    v_landlord_id,
    v_orig.tenancy_id,
    v_orig.tenant_id,
    -v_orig.amount_paisa,
    v_orig.payment_method,
    v_orig.payment_type,
    'REVERSAL: ' || trim(p_reason),
    TRUE,
    v_orig.id,
    p_idempotency_key
  )
  RETURNING * INTO v_rev;

  INSERT INTO public.payment_allocations (
    landlord_id,
    payment_id,
    obligation_id,
    amount_paisa
  )
  SELECT
    v_landlord_id,
    v_rev.id,
    pa.obligation_id,
    -pa.amount_paisa
  FROM public.payment_allocations pa
  WHERE pa.payment_id = v_orig.id
    AND pa.landlord_id = v_landlord_id;

  INSERT INTO public.audit_logs (
    landlord_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    source,
    before_data,
    after_data
  )
  VALUES (
    v_landlord_id,
    v_landlord_id,
    'payment',
    v_rev.id,
    'reverse_payment',
    'ui',
    jsonb_build_object('original_payment_id', v_orig.id, 'amount_paisa', v_orig.amount_paisa),
    jsonb_build_object('reversal_payment_id', v_rev.id, 'amount_paisa', v_rev.amount_paisa, 'reason', trim(p_reason))
  );

  RETURN jsonb_build_object(
    'idempotent_replay', FALSE,
    'reversal_payment_id', v_rev.id,
    'reversed_payment_id', v_orig.id,
    'amount_paisa', v_rev.amount_paisa
  );
END;
$$;
