
## Fix: Seed Sales Functions Data and Move to People Section

### Problem
The `sales_functions` database table was never created -- the previous migration did not apply. The table shows "No sales functions configured" because it doesn't exist yet. Additionally, you want Sales Functions moved from the System section to the People section.

### Changes

**1. Create and seed the `sales_functions` table (database migration)**

Create the table with columns: `id`, `name`, `display_order`, `is_active`, `created_at`, plus RLS policies, and seed it with these 18 functions:

1. Farmer
2. Hunter
3. CSM
4. Channel Sales
5. Sales Engineering
6. Sales Head - Farmer
7. Sales Head - Hunter
8. Farmer - Retain
9. IMAL Product SE
10. Insurance Product SE
11. APAC Regional SE
12. MEA Regional SE
13. Sales Engineering - Head
14. Team Lead
15. Team Lead - Farmer
16. Team Lead - Hunter
17. Overlay
18. Executive

Also seed the `tab:sales_functions` permission for existing roles.

**2. Move Sales Functions to People section (`src/pages/Admin.tsx`)**

Move the nav item `{ id: "sales-functions", label: "Sales Functions", icon: Briefcase }` from the **System** section to the **People** section.

### Technical Details

**Files modified:**
- `src/pages/Admin.tsx` -- move the sales-functions nav item from `system.items` to `people.items`

**Database migration:**
- CREATE TABLE `sales_functions` with RLS policies
- INSERT 18 seed rows
- INSERT `tab:sales_functions` permission for all existing roles
