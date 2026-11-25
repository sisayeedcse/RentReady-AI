-- RentReady AI — Migration 005: Drop Redundant Single-Column Foreign Keys
-- Fixes PostgREST PGRST201 ("Could not embed because more than one relationship was found")
-- introduced when Migration 004 added composite (col, landlord_id) foreign keys alongside
-- Migration 001's single-column foreign keys.
--
-- Security invariant preserved:
-- Every dropped single-column FK is strictly subsumed by its Migration 004 composite
-- FOREIGN KEY (<col>, landlord_id) REFERENCES public.<parent>(id, landlord_id) ON DELETE RESTRICT.

-- 1. buildings
ALTER TABLE public.buildings
  DROP CONSTRAINT IF EXISTS buildings_property_id_fkey;

-- 2. floors
ALTER TABLE public.floors
  DROP CONSTRAINT IF EXISTS floors_building_id_fkey;

-- 3. units
ALTER TABLE public.units
  DROP CONSTRAINT IF EXISTS units_property_id_fkey,
  DROP CONSTRAINT IF EXISTS units_building_id_fkey;

-- 4. tenancies
ALTER TABLE public.tenancies
  DROP CONSTRAINT IF EXISTS tenancies_unit_id_fkey,
  DROP CONSTRAINT IF EXISTS tenancies_tenant_id_fkey;

-- 5. rent_obligations
ALTER TABLE public.rent_obligations
  DROP CONSTRAINT IF EXISTS rent_obligations_tenancy_id_fkey,
  DROP CONSTRAINT IF EXISTS rent_obligations_unit_id_fkey,
  DROP CONSTRAINT IF EXISTS rent_obligations_tenant_id_fkey;

-- 6. payments
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_tenancy_id_fkey,
  DROP CONSTRAINT IF EXISTS payments_tenant_id_fkey,
  DROP CONSTRAINT IF EXISTS payments_reversal_of_payment_id_fkey;

-- 7. payment_allocations
ALTER TABLE public.payment_allocations
  DROP CONSTRAINT IF EXISTS payment_allocations_payment_id_fkey,
  DROP CONSTRAINT IF EXISTS payment_allocations_obligation_id_fkey;

-- 8. deposits
ALTER TABLE public.deposits
  DROP CONSTRAINT IF EXISTS deposits_tenancy_id_fkey,
  DROP CONSTRAINT IF EXISTS deposits_tenant_id_fkey;

-- 9. maintenance_requests
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_property_id_fkey;

-- 10. expenses
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_property_id_fkey;

-- 11. voice_actions
ALTER TABLE public.voice_actions
  DROP CONSTRAINT IF EXISTS voice_actions_session_id_fkey;

-- 12. notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_tenant_id_fkey;

-- 13. notification_logs
ALTER TABLE public.notification_logs
  DROP CONSTRAINT IF EXISTS notification_logs_notification_id_fkey;

-- Immediately refresh PostgREST schema cache so embedded selects resolve unambiguously
NOTIFY pgrst, 'reload schema';
