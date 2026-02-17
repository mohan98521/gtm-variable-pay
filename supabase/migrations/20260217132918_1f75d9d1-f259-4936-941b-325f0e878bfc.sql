
-- ============================================================
-- 1. payout_metric_details: restrict to admin/finance/gtm_ops + own data
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view payout metric details" ON public.payout_metric_details;
DROP POLICY IF EXISTS "Authenticated users can insert payout metric details" ON public.payout_metric_details;
DROP POLICY IF EXISTS "Authenticated users can delete payout metric details" ON public.payout_metric_details;

CREATE POLICY "pmd_manage" ON public.payout_metric_details
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "pmd_own_view" ON public.payout_metric_details
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ============================================================
-- 2. payout_deal_details: restrict to admin/finance/gtm_ops + own data
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view payout deal details" ON public.payout_deal_details;
DROP POLICY IF EXISTS "Authenticated users can insert payout deal details" ON public.payout_deal_details;
DROP POLICY IF EXISTS "Authenticated users can delete payout deal details" ON public.payout_deal_details;

CREATE POLICY "pdd_manage" ON public.payout_deal_details
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "pdd_own_view" ON public.payout_deal_details
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

-- ============================================================
-- 3. deal_team_spiff_allocations: restrict to admin/finance/gtm_ops + own view
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can delete deal team spiff allocations" ON public.deal_team_spiff_allocations;
DROP POLICY IF EXISTS "Authenticated users can insert deal team spiff allocations" ON public.deal_team_spiff_allocations;
DROP POLICY IF EXISTS "Authenticated users can read deal team spiff allocations" ON public.deal_team_spiff_allocations;
DROP POLICY IF EXISTS "Authenticated users can update deal team spiff allocations" ON public.deal_team_spiff_allocations;

CREATE POLICY "dtsa_manage" ON public.deal_team_spiff_allocations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "dtsa_view" ON public.deal_team_spiff_allocations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'executive') OR has_role(auth.uid(), 'sales_head'));

-- ============================================================
-- 4. deal_team_spiff_config: restrict UPDATE to admin/gtm_ops only
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can update deal team spiff config" ON public.deal_team_spiff_config;
DROP POLICY IF EXISTS "Authenticated users can read deal team spiff config" ON public.deal_team_spiff_config;

CREATE POLICY "dtsc_view" ON public.deal_team_spiff_config
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "dtsc_update" ON public.deal_team_spiff_config
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gtm_ops'));

-- ============================================================
-- 5. clawback_ledger: restrict INSERT/UPDATE to admin/finance/gtm_ops
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can insert clawback ledger" ON public.clawback_ledger;
DROP POLICY IF EXISTS "Authenticated users can update clawback ledger" ON public.clawback_ledger;
DROP POLICY IF EXISTS "Authenticated users can view clawback ledger" ON public.clawback_ledger;

CREATE POLICY "cl_manage" ON public.clawback_ledger
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'finance') OR has_role(auth.uid(), 'gtm_ops'));

CREATE POLICY "cl_own_view" ON public.clawback_ledger
  FOR SELECT TO authenticated
  USING (employee_id = auth.uid());
