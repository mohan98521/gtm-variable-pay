

## UI/UX Audit: Broken and Inconsistent Patterns

After reviewing all pages, components, and layouts across the application, here are the issues found:

---

### Issue 1: Inconsistent Currency Formatting Functions (MAJOR)

**Problem**: There are at least 4 different currency formatting approaches used across the codebase:

- **Dashboard/MetricsTable/CommissionTable/TeamView**: Uses abbreviated format (`$1.2M`, `$45.5K`, `$800`)
- **DataInputs/DealsTable/ClosingARRTable**: Uses `Intl.NumberFormat` with full precision (`$1,200,000`)
- **Reports/IncentiveAudit**: Uses `toLocaleString()` inline (`$1,200,000`)
- **CurrencyBreakdown**: Has localization-aware formatting (Indian Lakhs for INR)

The same deal value could display as `$1.2M` on the Dashboard, `$1,200,000` on Data Inputs, and `$12,00,000` on Currency Breakdown. Users seeing different representations of the same number across pages will lose trust in the data.

**Fix**: Create a shared `formatCurrencyUSD(value, options?)` utility in `src/lib/utils.ts` that all components import. Support two modes: `abbreviated` (for cards/summaries) and `full` (for tables/exports). Apply INR-specific grouping only when displaying local currency values.

**Files**: `src/lib/utils.ts` (new utility), then update imports in ~12 components

---

### Issue 2: Summary Card Layout Inconsistency Between Pages (MODERATE)

**Problem**: The Dashboard, Data Inputs, and Team View all show summary cards but with different internal structures:

- **Dashboard** (5 cards): Uses `p-4` padding, icon in a `rounded-lg` div with `p-2`, horizontal layout with `gap-3`, text size `text-xl`
- **Data Inputs** (4 cards): Uses `pt-6` padding via CardContent, icon in a `rounded-md` div with `h-12 w-12`, horizontal layout with `gap-4`, text size `text-2xl`
- **Team View** (5 cards): Uses `pt-6` padding via CardContent, icon in a `rounded-md` div with `h-10 w-10`, horizontal layout with `gap-4`, text size `text-xl`, plus a sub-label

The visual weight, spacing, and icon sizes differ across pages, making the app feel inconsistent as users navigate.

**Fix**: Create a shared `MetricCard` component (one already exists at `src/components/dashboard/MetricCard.tsx` but is not used by all pages). Standardize the card pattern with consistent padding, icon size, and text sizing. Update Dashboard, Data Inputs, and Team View to use it.

**Files**: `src/components/dashboard/MetricCard.tsx`, `src/pages/Dashboard.tsx`, `src/pages/DataInputs.tsx`, `src/components/team/TeamSummaryCards.tsx`

---

### Issue 3: Table Header Styling Inconsistency (MODERATE)

**Problem**: Tables across the application use two completely different header styles:

- **Dashboard/TeamView tables**: `bg-muted/50` with default text color (light gray background, dark text)
- **Reports page tables**: `bg-[hsl(var(--azentio-navy))]` with `text-white` (dark navy background, white text)

This creates a jarring visual contrast when users switch between Dashboard and Reports. The Reports page uses hardcoded brand colors (`azentio-navy`, `azentio-teal`) while the rest of the app uses semantic tokens (`bg-muted`, `text-foreground`).

**Fix**: Standardize on one header style. Recommended: use the semantic `bg-muted/50` style for all data tables (consistent with the design system) and reserve the navy-branded style only for the Reports tab bar. Update Reports page tables to use `bg-muted/50` headers.

**Files**: `src/pages/Reports.tsx` (all `bg-[hsl(var(--azentio-navy))]` table headers)

---

### Issue 4: No Mobile Responsiveness for Sidebar Navigation (MAJOR)

**Problem**: The `AppSidebar` renders a fixed `w-64` sidebar with no mobile breakpoint handling. On mobile screens:
- The sidebar takes up the full width or overflows
- There is no hamburger menu, drawer, or collapsible mechanism
- The `AppLayout` uses `flex` with the sidebar always visible, so on small screens the main content gets squeezed
- The Admin page has its own mobile-responsive nav (horizontal pills on mobile), but the main app layout does not

**Fix**: Wrap the sidebar in a Sheet/Drawer component on mobile. Add a hamburger button to the header bar. Hide the sidebar on `< lg` breakpoints and show it in a slide-out drawer when toggled.

**Files**: `src/components/layout/AppLayout.tsx`, `src/components/layout/AppSidebar.tsx`

---

### Issue 5: Data Inputs Page Missing Access Control (MAJOR)

**Problem**: Looking at `App.tsx`, the `/data-inputs` route has NO access control:
```
<Route path="/data-inputs" element={<DataInputs />} />
```
Every other functional page is wrapped in `<ProtectedRoute>` with either `allowedRoles` or `permissionKey`, but Data Inputs is completely open. Any authenticated (or even unauthenticated) user can access deal-level financial data and modify records.

The sidebar does check `page:data_inputs` permission before showing the nav link, but direct URL access bypasses this entirely.

**Fix**: Wrap the Data Inputs route in a `ProtectedRoute` with `permissionKey="page:data_inputs"`.

**File**: `src/App.tsx`

---

### Issue 6: Dashboard Page Missing Access Control (MODERATE)

**Problem**: Similar to Issue 5, the `/dashboard` route has no `ProtectedRoute` wrapper:
```
<Route path="/dashboard" element={<Dashboard />} />
```
While the Dashboard gracefully handles missing compensation data by showing the StaffLandingPage, it still lacks authentication enforcement. An unauthenticated user could access `/dashboard` directly.

**Fix**: Wrap in `<ProtectedRoute permissionKey="page:dashboard">`.

**File**: `src/App.tsx`

---

### Issue 7: Reports Tab Bar Overflows on Smaller Screens (MODERATE)

**Problem**: The Reports page has up to 10 tab triggers in a single `TabsList`. While the list has `flex-wrap h-auto gap-1`, on medium screens (tablet), the tabs wrap into 2-3 rows creating a tall, cluttered header. On narrower screens, the individual tab triggers with icons + text become cramped.

Admin-only tabs (Mgmt Summary, Currency, Holdbacks, Audit Trail) conditionally render, so non-admin users see 6 tabs, but admin users see 10, which is excessive for a single horizontal bar.

**Fix**: Group tabs into two tiers: "Personal Reports" (Employee Master, Compensation, Incentive Audit, My Deals, My Closing ARR, Payout Statement) and "Management Reports" (Mgmt Summary, Currency, Holdbacks, Audit Trail). Use a secondary TabsList or a Select dropdown for the management section.

**File**: `src/pages/Reports.tsx`

---

### Issue 8: Empty State Patterns Are Inconsistent (MINOR)

**Problem**: Empty states across the app use different visual treatments:
- **DealsTable**: Icon + bold text + subtitle, centered
- **ClosingARRTable**: Plain text paragraph, centered
- **CommissionTable**: Renders a Card with only a header, no body
- **MonthlyPerformanceTable**: TableRow with `colSpan` centered text
- **TeamView**: Full-page centered with large icon, heading, and description

There is no shared empty state component. Some empty states guide the user ("Add your first deal"), while others just say "No data found."

**Fix**: Create a shared `EmptyState` component with standardized icon, heading, description, and optional action button. Apply across all tables and sections.

**Files**: New `src/components/ui/empty-state.tsx`, then update ~8 components

---

### Summary

| # | Issue | Severity | Category |
|---|---|---|---|
| 1 | Inconsistent currency formatting (4 patterns) | Major | Data Display |
| 2 | Summary card layout differences across pages | Moderate | Visual Consistency |
| 3 | Table header styling split (muted vs navy) | Moderate | Visual Consistency |
| 4 | No mobile sidebar responsive behavior | Major | Responsiveness |
| 5 | Data Inputs route missing ProtectedRoute | Major | Security/UX |
| 6 | Dashboard route missing ProtectedRoute | Moderate | Security/UX |
| 7 | Reports tab bar overflow on tablets | Moderate | Responsiveness |
| 8 | Empty state patterns inconsistent | Minor | Visual Consistency |

### Implementation Priority

1. **Issues 5 and 6** (Access Control) -- quick wins, critical for security
2. **Issue 4** (Mobile Sidebar) -- major UX gap
3. **Issue 1** (Currency Formatting) -- affects data trust
4. **Issues 2 and 3** (Card/Table Consistency) -- visual polish
5. **Issue 7** (Reports Tabs) -- tablet UX
6. **Issue 8** (Empty States) -- refinement

