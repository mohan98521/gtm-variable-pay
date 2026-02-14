
-- Purge all transactional/actuals data for fresh manual testing
-- TRUNCATE CASCADE on parent tables automatically clears child rows

TRUNCATE TABLE
  deal_variable_pay_attribution,
  clawback_ledger,
  deal_collections,
  deal_participants,
  monthly_payouts,
  payout_adjustments,
  payout_runs,
  deals,
  closing_arr_actuals,
  fnf_settlements,
  fnf_settlement_lines,
  deal_team_spiff_allocations,
  deal_audit_log,
  payout_audit_log
CASCADE;
