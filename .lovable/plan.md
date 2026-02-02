

# Fix: Backfill Existing Deals into Collections Table

## Root Cause Analysis

The **Pending Collections** screen is empty because:

| Issue | Details |
|-------|---------|
| Deals exist | 20 deals found in Jan/Feb 2026 |
| Trigger exists | `trigger_auto_create_deal_collection` is enabled |
| Collections empty | `deal_collections` table has 0 records |

**Why?** The deals were uploaded **before** the migration that created the `deal_collections` table and the auto-populate trigger. The trigger only fires on new INSERT/UPDATE operations - it does not retroactively process existing deals.

## Solution

Create a database migration that:

1. **Backfills all existing deals** into the `deal_collections` table
2. Uses the same logic as the trigger (booking month, TCV, milestone due date calculation)
3. Runs as a one-time data migration

## Database Migration

```sql
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
```

## Expected Outcome

After running this migration:
- All 20 existing deals will appear in **Pending Collections**
- Future deals will continue to auto-populate via the existing trigger
- No code changes required - only a database migration

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| New Migration | CREATE | Backfill existing deals into `deal_collections` table |

## Technical Details

The migration:
- Uses `NOT EXISTS` to prevent duplicates
- Has `ON CONFLICT DO NOTHING` as additional safety
- Calculates `first_milestone_due_date` as 180 days from end of booking month (matching trigger logic)
- Sets `is_collected = false` by default for all backfilled records

