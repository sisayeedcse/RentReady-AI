-- RentReady AI — Migration 002: Deterministic Financial Views & Atomic Ledger RPCs
-- All views use security_invoker = true so caller RLS ALWAYS applies.
-- All RPCs run as SECURITY INVOKER so auth.uid() and RLS strictly enforce landlord isolation.

-- 1. Derived Obligation Balances View (NEVER a paid/unpaid boolean)
CREATE OR REPLACE VIEW public.v_obligation_balances
WITH (security_invoker = true) AS
SELECT
  o.id AS obligation_id,
  o.landlord_id,
  o.tenancy_id,
  o.unit_id,
  u.unit_code,
  u.property_id,
  p.name AS property_name,
  o.tenant_id,
  t.full_name AS tenant_name,
  t.phone_e164 AS tenant_phone,
  o.billing_month,
  o.base_rent_paisa,
  o.utility_charges_paisa,
  o.amount_due_paisa,
  o.due_date,
  o.status AS obligation_status,
  COALESCE(SUM(pa.amount_paisa), 0)::BIGINT AS allocated_paisa,
  (o.amount_due_paisa - COALESCE(SUM(pa.amount_paisa), 0))::BIGINT AS outstanding_paisa,
  CASE
    WHEN o.status = 'void' THEN 'void'
    WHEN COALESCE(SUM(pa.amount_paisa), 0) <= 0 THEN 'unpaid'
    WHEN COALESCE(SUM(pa.amount_paisa), 0) < o.amount_due_paisa THEN 'partial'
    WHEN COALESCE(SUM(pa.amount_paisa), 0) = o.amount_due_paisa THEN 'paid'
    ELSE 'overpaid'
  END AS derived_status
FROM public.rent_obligations o
JOIN public.units u ON u.id = o.unit_id
JOIN public.properties p ON p.id = u.property_id
JOIN public.tenants t ON t.id = o.tenant_id
LEFT JOIN public.payment_allocations pa ON pa.obligation_id = o.id
GROUP BY
  o.id, u.unit_code, u.property_id, p.name, t.full_name, t.phone_e164;

-- 2. Monthly Dashboard Summary View (100% DB-calculated)
CREATE OR REPLACE VIEW public.v_dashboard_summary
WITH (security_invoker = true) AS
WITH dhaka_month AS (
  SELECT date_trunc('month', NOW() AT TIME ZONE 'Asia/Dhaka')::DATE AS current_billing_month
),
unit_stats AS (
  SELECT
    landlord_id,
    COUNT(*)::INTEGER AS total_units,
    COUNT(*) FILTER (WHERE status = 'occupied')::INTEGER AS occupied_units
  FROM public.units
  GROUP BY landlord_id
),
prop_stats AS (
  SELECT
    landlord_id,
    COUNT(*) FILTER (WHERE is_archived = FALSE)::INTEGER AS total_properties
  FROM public.properties
  GROUP BY landlord_id
),
obl_stats AS (
  SELECT
    ob.landlord_id,
    COALESCE(SUM(ob.amount_due_paisa) FILTER (WHERE ob.billing_month = dm.current_billing_month AND ob.obligation_status = 'open'), 0)::BIGINT AS expected_rent_paisa,
    COALESCE(SUM(ob.allocated_paisa) FILTER (WHERE ob.billing_month = dm.current_billing_month AND ob.obligation_status = 'open'), 0)::BIGINT AS collected_rent_paisa,
    COALESCE(SUM(GREATEST(ob.outstanding_paisa, 0)) FILTER (WHERE ob.obligation_status = 'open'), 0)::BIGINT AS total_outstanding_paisa,
    COUNT(*) FILTER (WHERE ob.obligation_status = 'open' AND ob.outstanding_paisa > 0 AND ob.due_date < (NOW() AT TIME ZONE 'Asia/Dhaka')::DATE)::INTEGER AS overdue_obligations_count
  FROM public.v_obligation_balances ob
  CROSS JOIN dhaka_month dm
  GROUP BY ob.landlord_id
),
exp_stats AS (
  SELECT
    e.landlord_id,
    COALESCE(SUM(e.amount_paisa) FILTER (WHERE date_trunc('month', e.incurred_on)::DATE = dm.current_billing_month AND e.is_void = FALSE), 0)::BIGINT AS monthly_expenses_paisa
  FROM public.expenses e
  CROSS JOIN dhaka_month dm
  GROUP BY e.landlord_id
),
maint_stats AS (
  SELECT
    landlord_id,
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::INTEGER AS open_maintenance_count
  FROM public.maintenance_requests
  GROUP BY landlord_id
)
SELECT
  pr.id AS landlord_id,
  dm.current_billing_month,
  COALESCE(ps.total_properties, 0) AS total_properties,
  COALESCE(us.total_units, 0) AS total_units,
  COALESCE(us.occupied_units, 0) AS occupied_units,
  COALESCE(os.expected_rent_paisa, 0) AS expected_rent_paisa,
  COALESCE(os.collected_rent_paisa, 0) AS collected_rent_paisa,
  COALESCE(os.total_outstanding_paisa, 0) AS total_outstanding_paisa,
  COALESCE(es.monthly_expenses_paisa, 0) AS monthly_expenses_paisa,
  (COALESCE(os.collected_rent_paisa, 0) - COALESCE(es.monthly_expenses_paisa, 0))::BIGINT AS net_operating_result_paisa,
  COALESCE(os.overdue_obligations_count, 0) AS overdue_obligations_count,
  COALESCE(ms.open_maintenance_count, 0) AS open_maintenance_count
FROM public.profiles pr
CROSS JOIN dhaka_month dm
LEFT JOIN prop_stats ps ON ps.landlord_id = pr.id
LEFT JOIN unit_stats us ON us.landlord_id = pr.id
LEFT JOIN obl_stats os ON os.landlord_id = pr.id
LEFT JOIN exp_stats es ON es.landlord_id = pr.id
LEFT JOIN maint_stats ms ON ms.landlord_id = pr.id;

-- 3. Idempotent Monthly Obligation Generator RPC
CREATE OR REPLACE FUNCTION public.generate_monthly_obligations(p_billing_month DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_landlord_id UUID := auth.uid();
  v_month_start DATE := date_trunc('month', p_billing_month)::DATE;
  v_inserted INTEGER := 0;
BEGIN
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
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

-- 4. Atomic Idempotent Payment Recording RPC (FIFO or Targeted Allocation)
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

  IF p_amount_paisa IS NULL OR p_amount_paisa <= 0 THEN
    RAISE EXCEPTION 'amount_paisa must be positive';
  END IF;

  -- Idempotency check
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

  -- Verify tenancy ownership
  SELECT * INTO v_tenancy
  FROM public.tenancies
  WHERE id = p_tenancy_id AND landlord_id = v_landlord_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found or access denied';
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

  -- Audit log
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

-- 5. Atomic Immutable Payment Reversal RPC (Never Hard-Deletes Payments)
CREATE OR REPLACE FUNCTION public.reverse_payment_atomic(
  p_payment_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
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

  SELECT * INTO v_orig
  FROM public.payments
  WHERE id = p_payment_id AND landlord_id = v_landlord_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original payment not found or access denied';
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

  -- Create exact negative counter-allocations to restore obligation balances
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
    jsonb_build_object('reversal_payment_id', v_rev.id, 'amount_paisa', v_rev.amount_paisa, 'reason', p_reason)
  );

  RETURN jsonb_build_object(
    'idempotent_replay', FALSE,
    'reversal_payment_id', v_rev.id,
    'reversed_payment_id', v_orig.id,
    'amount_paisa', v_rev.amount_paisa
  );
END;
$$;
