

## Rebrand from "Azentio" to "Qota" -- Implementation Plan

The Qota logo has been uploaded. Here is the complete implementation plan covering all files.

### 1. Logo Asset
- Copy `user-uploads://image-88.png` to `src/assets/qota-logo.png`
- The old `src/assets/azentio-logo.png` remains (unused after refactor)

### 2. Logo Component
- Rename `src/components/AzentioLogo.tsx` content to create `src/components/QotaLogo.tsx`
- New component imports `qota-logo.png`, uses `QotaLogo` name, `QotaLogoProps` interface, alt text "Qota"

### 3. HTML Metadata (`index.html`)
- Title: "Qota | Variable Pay Management"
- Author: "Qota"
- OG title: "Qota | Variable Pay Management"
- Twitter site: "@Qota"

### 4. CSS Tokens (`src/index.css`)
- Comments: remove "Azentio" references, update to "Qota"
- `--azentio-navy` becomes `--qota-navy`
- `--azentio-teal` becomes `--qota-teal`

### 5. Tailwind Config (`tailwind.config.ts`)
- `azentio.navy` becomes `qota.navy`
- `azentio.teal` becomes `qota.teal`

### 6. Sidebar (`src/components/layout/AppSidebar.tsx`)
- Import `QotaLogo` instead of `AzentioLogo`
- Footer text "GTM Variable Compensation" becomes "Qota"

### 7. Auth Page (`src/pages/Auth.tsx`)
- Import `QotaLogo` instead of `AzentioLogo`
- Email placeholder: `EmployeeID@azentio.com` becomes `you@company.com`

### 8. Staff User Form (`src/components/admin/StaffUserFormDialog.tsx`)
- Remove `@azentio.com` email domain restriction from Zod validation
- Update placeholder from `name@azentio.com` to `name@company.com`

### 9. Edge Function (`supabase/functions/create-employee-account/index.ts`)
- Remove the `@azentio.com` domain check (lines 77-83) so any email domain is accepted
- This is important: without this change, creating employee accounts for non-azentio emails will fail

### 10. Component Color References (find-and-replace across ~13 files)
All occurrences of `azentio-navy` and `azentio-teal` in className strings become `qota-navy` and `qota-teal`. Files affected:

- `src/components/reports/AuditTrailExport.tsx`
- `src/components/reports/ManagementSummary.tsx`
- `src/components/reports/CurrencyBreakdown.tsx`
- `src/components/reports/PayoutStatement.tsx`
- `src/components/reports/MyDealsReport.tsx`
- `src/components/reports/MyClosingARRReport.tsx`
- `src/components/reports/YearEndHoldbackTracker.tsx`
- `src/components/audit/AuditDashboard.tsx`
- `src/components/audit/AuditTimeline.tsx`
- `src/components/admin/BulkUpload.tsx`
- `src/components/admin/ExchangeRateManagement.tsx`
- `src/components/admin/CurrencyManagement.tsx`
- `src/components/admin/PerformanceTargetsBulkUpload.tsx`
- `src/pages/Reports.tsx`
- `src/pages/Admin.tsx`
- `src/pages/DataInputs.tsx`
- `src/pages/Dashboard.tsx`

### What does NOT change
- Color values (navy #002D72 and teal #00A3AD stay identical)
- Layout, functionality, calculation logic
- Database schema

### Technical Details

| Find | Replace |
|---|---|
| `AzentioLogo` (component) | `QotaLogo` |
| `AzentioLogoProps` (interface) | `QotaLogoProps` |
| `azentio-logo.png` (asset) | `qota-logo.png` |
| `--azentio-navy` (CSS var) | `--qota-navy` |
| `--azentio-teal` (CSS var) | `--qota-teal` |
| `azentio.navy` (Tailwind) | `qota.navy` |
| `azentio.teal` (Tailwind) | `qota.teal` |
| `GTM Variable Comp` (text) | `Qota` |
| `Azentio` (brand text) | `Qota` |
| `@azentio.com` (email domain) | removed / generic |

Total: ~20 frontend files + 1 edge function. No new dependencies needed.

