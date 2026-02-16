

## Redesign Admin Page: Spreadsheet-Style Horizontal Navigation

### Problem
The current Admin page uses a fixed left sidebar for section navigation that always occupies screen space, even when you're working on something else. As you go deeper into tabs, the navigation becomes cluttered and rigid.

### New Design

Replace the vertical sidebar navigation with a **two-tier horizontal navigation bar** inspired by spreadsheet headers:

```text
+-----------------------------------------------------------------------+
| Administration                                                         |
| Manage compensation plans and employee accounts                        |
+===============+==========+===========+==========+=====================+
| COMPENSATION  |  PEOPLE  |  FINANCE  |  SYSTEM  |   (section headers) |
+===============+==========+===========+==========+=====================+
| Comp Plans | Perf Targets |                        (sub-items as pills)|
+-----------------------------------------------------------------------+
|                                                                        |
|              [Full-width content area]                                 |
|                                                                        |
+-----------------------------------------------------------------------+
```

**Tier 1 (Section Headers):** Horizontal row of section tabs (Compensation, People, Finance, System) styled like spreadsheet sheet tabs at the bottom of Excel -- flat, clean, with the active one highlighted.

**Tier 2 (Sub-Items):** When a section is selected, its sub-items appear as a secondary row of pills/tabs below. Only the active section's sub-items are shown.

**Content Area:** The selected sub-item's content renders full-width below, using 100% of the available space (no sidebar stealing 240px).

### What Changes

**File: `src/pages/Admin.tsx`** -- Complete layout restructure:
- Remove the two-column grid layout (`grid-cols-[240px_1fr]`)
- Remove the Card-based vertical nav sidebar
- Remove the mobile horizontal pill scroller (replaced by the new design for all screen sizes)
- Add Tier 1: A row of section buttons styled like spreadsheet sheet-tabs
- Add Tier 2: A row of sub-item buttons/pills for the active section
- Track both `activeSection` (string) and `activeItem` (string) in state
- When a section is clicked, auto-select its first sub-item
- Content renders full-width below

### Mobile Behavior
- Tier 1 section tabs scroll horizontally if needed
- Tier 2 sub-item pills scroll horizontally if needed
- Content remains full-width

### Visual Style
- Section tabs: Bottom-border style (underline indicator), uppercase text, small icons
- Sub-item pills: Rounded pills with subtle background on active, muted text on inactive
- A thin border separates the nav area from the content
- Matches existing Qota design tokens (primary colors, Inter font, muted backgrounds)

### Technical Details

Only one file changes: **`src/pages/Admin.tsx`**

The section/item data structure (`sections`, `contentMap`, permission filtering) stays identical -- only the rendering JSX changes.

Key layout changes:
- Replace `grid grid-cols-1 lg:grid-cols-[240px_1fr]` with a single column stack
- Tier 1: `flex` row with `overflow-x-auto` for section buttons, styled with `border-b` and active state using `border-b-2 border-primary`
- Tier 2: `flex` row with `gap-2` for sub-item pills, using existing pill styling (`rounded-full`, `bg-primary/10`)
- Content: full-width `div` below, no `min-w-0` constraint needed
- Add `activeSection` state (defaults to first visible section ID)
- Clicking a section sets `activeSection` and auto-selects first item in that section
- Clicking a sub-item sets `activeItem` as before

No new components or dependencies are needed. No other files change.

