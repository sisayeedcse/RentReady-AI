-- RentReady AI — Migration 003: 100% Row Level Security (RLS) Coverage
-- Every public table enforces strict landlord_id = auth.uid().
-- Financial ledger tables (payments, payment_allocations) and audit/notification logs
-- are APPEND-ONLY (SELECT + INSERT only; NO UPDATE or DELETE policies).

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles (self-owned)
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Standard landlord CRUD tables
CREATE POLICY "properties_landlord_all" ON public.properties
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "buildings_landlord_all" ON public.buildings
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "floors_landlord_all" ON public.floors
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "units_landlord_all" ON public.units
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "tenants_landlord_all" ON public.tenants
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "tenancies_landlord_all" ON public.tenancies
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "maintenance_requests_landlord_all" ON public.maintenance_requests
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "voice_sessions_landlord_all" ON public.voice_sessions
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "voice_actions_landlord_all" ON public.voice_actions
  FOR ALL USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "notifications_landlord_select" ON public.notifications
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "notifications_landlord_insert" ON public.notifications
  FOR INSERT WITH CHECK (landlord_id = auth.uid());
CREATE POLICY "notifications_landlord_update" ON public.notifications
  FOR UPDATE USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

-- Expense categories (read system defaults + own; write own only)
CREATE POLICY "expense_categories_select" ON public.expense_categories
  FOR SELECT USING (landlord_id IS NULL OR landlord_id = auth.uid());
CREATE POLICY "expense_categories_insert_own" ON public.expense_categories
  FOR INSERT WITH CHECK (landlord_id = auth.uid());

-- Financial tables: NO DELETE policies (soft void / immutable reversals only)
CREATE POLICY "rent_obligations_select" ON public.rent_obligations
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "rent_obligations_insert" ON public.rent_obligations
  FOR INSERT WITH CHECK (landlord_id = auth.uid());
CREATE POLICY "rent_obligations_update" ON public.rent_obligations
  FOR UPDATE USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "deposits_select" ON public.deposits
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "deposits_insert" ON public.deposits
  FOR INSERT WITH CHECK (landlord_id = auth.uid());
CREATE POLICY "deposits_update" ON public.deposits
  FOR UPDATE USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (landlord_id = auth.uid());
CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (landlord_id = auth.uid()) WITH CHECK (landlord_id = auth.uid());

-- Strictly APPEND-ONLY financial & audit tables (SELECT + INSERT only; ZERO UPDATE/DELETE)
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "payments_insert_own" ON public.payments
  FOR INSERT WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "payment_allocations_select_own" ON public.payment_allocations
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "payment_allocations_insert_own" ON public.payment_allocations
  FOR INSERT WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "notification_logs_select_own" ON public.notification_logs
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "notification_logs_insert_own" ON public.notification_logs
  FOR INSERT WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  FOR SELECT USING (landlord_id = auth.uid());
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs
  FOR INSERT WITH CHECK (landlord_id = auth.uid());
