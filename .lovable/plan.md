

## Restrict Team Metric Subordinate Matching to sales_rep_employee_id Only

### Problem
Currently, when calculating "Team New Software Booking ARR" for Team Leads, the system checks if a subordinate's employee_id matches **any** of the 9 participant role columns on a deal. This means a deal gets counted toward a Team Lead's team metric even if the subordinate is only tagged as a Sales Engineer or Solution Architect on that deal -- not the primary sales rep.

### Change
Restrict the subordinate deal matching to only check `sales_rep_employee_id`. A deal will only count toward the "Team" metric if a direct report is the **primary sales rep** on that deal.

### Files to Modify

**1. `src/lib/payoutEngine.ts` (line ~633-636)**
- The `.or()` filter currently builds a long string checking all 8 participant columns per subordinate
- Change to only check `sales_rep_employee_id.eq.{rid}` for each subordinate

**2. `src/hooks/useTeamCompensation.ts` (lines ~293-296)**
- Currently uses `PARTICIPANT_ROLES.some(role => subReportIds.includes(deal[role]))`
- Change to `subReportIds.includes(deal.sales_rep_employee_id)`

**3. `src/hooks/useCurrentUserCompensation.ts` (lines ~282-284)**
- Same pattern as above
- Change to `reportIds.includes(deal.sales_rep_employee_id)`

### Impact
- Only deals where a subordinate is the **sales rep** will be aggregated into the Team Lead's "Team New Software Booking ARR" metric
- Closing ARR subordinate matching (which uses `sales_rep_employee_id` and `sales_head_employee_id`) remains unchanged
- Individual employee metrics (non-team) remain unchanged -- they still check all participant roles for the employee's own deals
