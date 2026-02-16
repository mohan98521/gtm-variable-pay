

## Executive Summary Dashboard

### Overview
A new page at `/executive` providing CIO, CFO, and Sales Heads with a real-time, data-dense overview of compensation spend, quota attainment, and sales force distribution. Built on top of existing data from `monthly_payouts`, `performance_targets`, `employees`, and `user_targets` tables -- no schema changes needed.

---

### Page Structure

```text
+-----------------------------------------------------------------------+
| Executive Compensation Overview     [FY Dropdown] [USD/Local Toggle]  |
+===============================+=======================================+
| Total Variable     | Global Quota  | Payout vs   | Active            |
| Payout (YTD)       | Attainment    | Budget      | Payees            |
| $2.4M  +12% YoY   | 87% (radial)  | 92% bar     | 47                |
+===============================+=======================================+
|  Payout & Attainment Trend (Bar+Line)  |  Attainment Distribution    |
|  Monthly: bars=payout, line=avg att%   |  Histogram: <50 50-80 etc   |
+========================================+=============================+
|  Payout by Sales Function (Donut)      |  Top 5 Performers Table     |
|  Hunters, Farmers, SEs, Heads...       |  Name, Role, Payout, Att%   |
+========================================+=============================+
```

---

### Data Hook: `useExecutiveDashboard.ts`

Single hook that fetches all data for the page in parallel:

**Query 1 -- Current Year Payouts:** `monthly_payouts` filtered to selected FY. Groups by employee, month, and payout_type to compute:
- Total variable payout (YTD) using `classifyPayoutType` from `payoutTypes.ts`
- Monthly payout totals for the trend chart
- Distinct active payees count

**Query 2 -- Prior Year Payouts:** Same query for FY-1, used only for YoY percentage change on the north star card.

**Query 3 -- Employees:** `employees` table for `sales_function`, `full_name`, `region`, `employee_role`, `ote_usd` (budget proxy), `tvp_usd`.

**Query 4 -- Performance Targets + Actuals:** Join `performance_targets` (target_value_usd) with aggregated deal actuals per employee to compute attainment percentages. Uses the same metric aggregation logic already in `useCurrentUserCompensation.ts` but across all employees.

**Computed Fields:**
- **Global Quota Attainment:** Weighted average of individual attainment percentages (weighted by target size)
- **Payout vs Budget:** Sum of all payouts / Sum of all `tvp_usd` for active employees
- **Attainment Distribution:** Bucket each employee's attainment into <50%, 50-80%, 80-100%, 100-120%, >120%
- **Top 5 Performers:** Sorted by total payout descending, limited to 5

---

### New Files

| File | Purpose |
|------|---------|
| `src/pages/ExecutiveDashboard.tsx` | Main page component with header, FY dropdown, currency toggle, and four sections |
| `src/hooks/useExecutiveDashboard.ts` | Data fetching hook with all queries and computed metrics |
| `src/components/executive/NorthStarCards.tsx` | 4 top-row metric cards (total payout, radial attainment, budget progress bar, active payees) |
| `src/components/executive/PayoutTrendChart.tsx` | Dual-axis composed chart -- bars for monthly payout, line for avg attainment % |
| `src/components/executive/AttainmentDistribution.tsx` | Histogram bar chart with color-coded buckets |
| `src/components/executive/PayoutByFunction.tsx` | Donut/pie chart by sales function |
| `src/components/executive/TopPerformers.tsx` | Compact leaderboard table with rank, name, role/region, payout, attainment % |

---

### Modified Files

| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/executive` with `ProtectedRoute permissionKey="page:executive_dashboard"` |
| `src/components/layout/AppSidebar.tsx` | Add "Executive" nav item with `PieChart` icon, gated by `page:executive_dashboard` permission |
| `src/lib/permissions.ts` | Add `"page:executive_dashboard"` to the `PermissionKey` type and `PERMISSION_DEFINITIONS` array |

---

### Permission Integration

- New permission key: `page:executive_dashboard` (category: "page", label: "Executive Dashboard")
- Added to `PERMISSION_DEFINITIONS` so it automatically appears in the Permissions matrix UI
- Database migration: Insert default permission rows for all existing roles (default `is_allowed = false` except for `admin` and `executive` roles which get `true`)
- The existing `auto_generate_role_permissions` trigger handles future roles automatically

---

### Visual Design Specifications

- **Color palette:** Qota Deep Navy (`--qota-navy`) for primary text/headers, Teal (`--qota-teal`) for accent highlights and positive metrics
- **North Star Cards:** Clean white cards with subtle `border` and `shadow-sm`. Large `text-3xl font-bold` numbers. YoY trend uses `TrendingUp`/`TrendingDown` icons in success/destructive colors
- **Radial Progress (Quota Attainment):** Built with Recharts `RadialBarChart` -- single ring, teal fill, centered percentage text
- **Budget Progress Bar:** Reuses the existing `Progress` component with a percentage label
- **Charts:** All use `ChartContainer` from `src/components/ui/chart.tsx` for consistent theming
- **Histogram colors:** Red (`hsl(0 72% 51%)`) for <50%, warning amber for 50-80%, muted for 80-100%, teal for 100-120%, deep teal for >120%
- **Donut chart:** Uses chart color variables (`--chart-1` through `--chart-5`)
- **Top 5 table:** Compact shadcn `Table` with rank badges, avatar initials circle, and right-aligned currency values
- **Loading states:** `Skeleton` loaders matching each card/chart dimensions
- **Inter font, strict alignment, no decorative elements** -- fintech aesthetic

---

### Technical Details

**Database Migration (1 statement):**
```sql
INSERT INTO role_permissions (role, permission_key, is_allowed)
SELECT r.name, 'page:executive_dashboard', 
  CASE WHEN r.name IN ('admin', 'executive') THEN true ELSE false END
FROM roles r
ON CONFLICT DO NOTHING;
```

**Recharts Components Used:**
- `ComposedChart` with `Bar` + `Line` for the trend chart (dual Y-axes via `YAxis yAxisId`)
- `BarChart` for histogram
- `PieChart` with `Pie innerRadius` for donut
- `RadialBarChart` for the quota attainment circle

**Currency Toggle Logic:**
- State: `currencyMode: 'usd' | 'local'`
- When `usd`: use `calculated_amount_usd` from payouts
- When `local`: use `calculated_amount_local` (with mixed currencies, show a warning badge that local mode aggregates across currencies)
- Default: USD (executive view is primarily USD-denominated)

**FY Dropdown:** Reuses `useFiscalYear` context already available globally.

