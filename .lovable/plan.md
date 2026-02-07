

# Plan: Restructure Admin Page into Organized Sections

## Problem

The Admin page currently packs **8 tabs** into a single flat tab bar, making it crowded, hard to scan, and overwhelming -- especially on smaller screens where the tabs wrap or overflow.

## Proposed Structure

Group the 8 tabs into **4 logical sections** using a vertical sidebar navigation on the left side of the Admin page (within the main content area, not the app sidebar). Each section contains related sub-items.

```text
+-----------------------------------------------------------+
|  Administration                                            |
|  Manage compensation plans and employee accounts           |
+-------------------+---------------------------------------+
|                   |                                       |
| COMPENSATION      |   [Selected section content           |
|  > Plans          |    renders here]                      |
|  > Perf. Targets  |                                       |
|                   |                                       |
| PEOPLE            |                                       |
|  > Employees      |                                       |
|  > Role Mgmt      |                                       |
|  > Bulk Upload    |                                       |
|                   |                                       |
| FINANCE           |                                       |
|  > Exchange Rates |                                       |
|  > Payout Runs    |                                       |
|                   |                                       |
| SYSTEM (admin)    |                                       |
|  > Permissions    |                                       |
|                   |                                       |
+-------------------+---------------------------------------+
```

### Section Grouping

| Section | Icon | Items | Rationale |
|---------|------|-------|-----------|
| **Compensation** | Layers | Compensation Plans, Performance Targets | Both relate to designing and configuring how people are paid |
| **People** | Users | Employee Accounts, Role Management, Bulk Upload | All about managing users, their access, and onboarding data |
| **Finance** | DollarSign | Exchange Rates, Payout Runs | Financial operations -- currency management and payout execution |
| **System** | Settings | Permissions | Admin-only system configuration (only visible to admins) |

### UI Pattern

Instead of a horizontal TabsList, use a **card-based left sidebar with grouped links**:
- Left panel (~220px wide) with section headers and clickable items
- The active item is highlighted with the primary/accent color
- Section headers are uppercase, small, muted text (similar to sidebar group labels)
- Each item shows its icon + name
- Right panel renders the selected section's content (same components as today)
- On mobile, the section nav stacks above the content

### Permission Logic (unchanged)

- Each item still respects its existing permission check (`canAccessTab`, `isAdmin`)
- Sections with zero visible items are hidden entirely
- Default selection: first visible item across all sections

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Admin.tsx` | Replace `TabsList`/`TabsTrigger` pattern with section-based sidebar navigation using state management. Keep all existing `TabsContent` components and their logic intact. Restructure layout to two-column with section nav on left. |

No new files needed -- this is purely a UI restructure within the existing Admin.tsx page. All child components (`EmployeeAccounts`, `PayoutRunManagement`, etc.) remain untouched.

## Technical Details

### Layout Change
- Replace the Radix `Tabs` component with a custom state-driven section navigator
- Use `useState` to track the active section/item (e.g., `"plans"`, `"accounts"`, etc.)
- Render the corresponding component based on the active item value
- Use a responsive grid: `grid grid-cols-[220px_1fr]` on desktop, single column on mobile

### Section Data Structure
Define a configuration array that groups items:
```text
sections = [
  { id: "compensation", label: "Compensation", icon: Layers,
    items: [
      { id: "plans", label: "Compensation Plans", icon: Layers, permission: "tab:comp_plans" },
      { id: "performance-targets", label: "Performance Targets", icon: Target, permission: "tab:performance_targets" }
    ]
  },
  { id: "people", label: "People", icon: Users,
    items: [
      { id: "accounts", label: "Employee Accounts", icon: UserCog, permission: "tab:employee_accounts" },
      { id: "roles", label: "Role Management", icon: Shield, permission: "tab:role_management" },
      { id: "bulk-upload", label: "Bulk Upload", icon: Upload, permission: "tab:bulk_upload" }
    ]
  },
  { id: "finance", label: "Finance", icon: DollarSign,
    items: [
      { id: "exchange-rates", label: "Exchange Rates", icon: DollarSign, check: "isAdmin||tab:bulk_upload" },
      { id: "payout-runs", label: "Payout Runs", icon: Calculator, check: "isAdmin||tab:bulk_upload" }
    ]
  },
  { id: "system", label: "System", icon: Settings,
    items: [
      { id: "permissions", label: "Permissions", icon: Lock, check: "isAdmin" }
    ]
  }
]
```

### Styling
- Section nav card has a light border, rounded corners, and subtle background
- Active item gets `bg-primary/10 text-primary font-medium` styling
- Hover effect on items: `hover:bg-muted`
- Section headers: `text-xs uppercase tracking-wider text-muted-foreground font-semibold`
- Consistent with the existing Azentio corporate aesthetic (deep navy accents)

### Mobile Responsiveness
- Below `lg` breakpoint, the section nav becomes a horizontal scrollable pill bar or a dropdown selector at the top
- Content renders below in full width

