-- Backfill existing deals into deal_collections
INSERT INTO public.deal_collections (
  deal_id,
  booking_month,
  project_id,
  customer_name,
  deal_value_usd,
  is_collected,
  first_milestone_due_date
)
SELECT 
  d.id,
  d.month_year,
  d.project_id,
  d.customer_name,
  COALESCE(d.tcv_usd, 0),
  false,
  (date_trunc('month', d.month_year) + interval '1 month' - interval '1 day' + interval '180 days')::date
FROM public.deals d
WHERE NOT EXISTS (
  SELECT 1 FROM public.deal_collections dc WHERE dc.deal_id = d.id
)
ON CONFLICT (deal_id) DO NOTHING;