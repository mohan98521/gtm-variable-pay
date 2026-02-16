

## Rebrand from "Azentio" to "Qota"

This plan covers renaming the product from "GTM Variable Comp | Azentio" to **Qota** across the entire codebase -- titles, logos, CSS tokens, component names, and color variable references.

### Pre-requisite

You will need to upload a **Qota logo image** (PNG or SVG) before implementation begins. This logo will replace `src/assets/azentio-logo.png`.

### Changes Overview

#### 1. Logo and Brand Image
- Replace `src/assets/azentio-logo.png` with the uploaded Qota logo
- Rename `src/components/AzentioLogo.tsx` to `src/components/QotaLogo.tsx`
- Update the component name, props interface, alt text, and import path inside the component

#### 2. Page Titles and Metadata (`index.html`)
- Title: "GTM Variable Comp | Azentio" becomes **"Qota | Variable Pay Management"**
- Meta description updated to reference Qota
- Author: "Azentio" becomes "Qota"
- OG and Twitter meta tags updated

#### 3. Sidebar and Footer Text (`src/components/layout/AppSidebar.tsx`)
- Import `QotaLogo` instead of `AzentioLogo`
- Footer text "GTM Variable Compensation" becomes **"Qota"** (or similar short label)

#### 4. Auth Page (`src/pages/Auth.tsx`)
- Import `QotaLogo` instead of `AzentioLogo`
- Email placeholder: `EmployeeID@azentio.com` becomes a generic `you@company.com`
- Heading: "Variable Pay Management" stays (product descriptor under Qota logo)

#### 5. CSS Design Tokens (`src/index.css`)
- Comment: "GTM Variable Comp - Azentio Corporate Design System" becomes "Qota Design System"
- Rename CSS custom properties:
  - `--azentio-navy` becomes `--qota-navy`
  - `--azentio-teal` becomes `--qota-teal`
- The color **values stay identical** -- only the variable names change

#### 6. Tailwind Config (`tailwind.config.ts`)
- Rename the `azentio` color group to `qota`:
  - `azentio.navy` becomes `qota.navy`
  - `azentio.teal` becomes `qota.teal`

#### 7. All Component References (17 files)
Every file referencing `azentio-navy` or `azentio-teal` in class names needs a find-and-replace:
- `hsl(var(--azentio-navy))` becomes `hsl(var(--qota-navy))`
- `hsl(var(--azentio-teal))` becomes `hsl(var(--qota-teal))`
- `text-[hsl(var(--azentio-...))]` becomes `text-[hsl(var(--qota-...))]`

Files affected:
- `src/pages/Reports.tsx`
- `src/pages/Admin.tsx`
- `src/pages/DataInputs.tsx`
- `src/pages/Dashboard.tsx`
- `src/components/reports/ManagementSummary.tsx`
- `src/components/reports/CurrencyBreakdown.tsx`
- `src/components/reports/AuditTrailExport.tsx`
- `src/components/reports/PayoutStatement.tsx`
- `src/components/reports/MyDealsReport.tsx`
- `src/components/reports/MyClosingARRReport.tsx`
- `src/components/reports/YearEndHoldbackTracker.tsx`
- `src/components/audit/AuditDashboard.tsx`
- `src/components/audit/AuditTimeline.tsx`
- `src/components/admin/BulkUpload.tsx`
- `src/components/admin/CurrencyManagement.tsx`
- `src/components/admin/PerformanceTargetsBulkUpload.tsx`
- `src/components/data-inputs/*BulkUpload.tsx` (if applicable)

#### 8. Project Memory
- Update the project knowledge/memory entries that reference "Azentio" to say "Qota"

### What does NOT change
- Color values (the navy and teal palette stays the same)
- Layout, functionality, and calculation logic -- purely cosmetic rename
- Database schema -- no tables reference "Azentio"

### Technical Details

The implementation is a systematic find-and-replace across the codebase:

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

No new dependencies are needed. The total change touches ~20 files with straightforward string replacements.

