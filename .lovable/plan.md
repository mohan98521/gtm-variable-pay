

## Modify Deal Team SPIFF Allocation Dialog

### Changes Required

Two modifications to `src/components/admin/DealTeamSpiffManager.tsx`:

### 1. Replace Auto-Populated Team Members with Manual Search-and-Add

**Current behavior**: The allocation dialog automatically extracts team members from the deal's participant fields and displays them all as rows.

**New behavior**: Start with an empty table. The admin uses a searchable employee dropdown (using the existing `SearchableSelect` component) to add team members one by one. Each added member gets a role selector, amount input, and notes field -- plus a remove button.

**Implementation details**:
- Import `SearchableSelect` and `useProfiles` hook
- Remove the `useMemo` that auto-extracts `teamMembers` from deal fields (lines 385-395)
- Replace with a `useState<TeamMember[]>` initialized from `existingAllocations` (matching back to profiles for names)
- Add a row at the top of the table with a `SearchableSelect` for employee search and an "Add" button
- Already-added employees are filtered out of the dropdown options
- Each row gets a remove button (Trash2 icon) to delete a member before saving

### 2. Include Sales Head in Eligible Roles

**Current behavior**: `TEAM_PARTICIPANT_ROLES` array (line 44-52) excludes `sales_head`. The "no members" message also says "excluding Sales Rep & Sales Head".

**New behavior**: Add `sales_head_employee_id` / `sales_head_name` with label "Sales Head" to `TEAM_PARTICIPANT_ROLES`. Update the empty-state message to say "excluding Sales Rep" only.

Note: Since we're switching to manual search-and-add, the `TEAM_PARTICIPANT_ROLES` constant is no longer used for auto-populating members. However, it can still be kept for reference or removed entirely. The key change is that **any employee** (including Sales Head) can be searched and added manually, so the exclusion list becomes irrelevant for the add flow. The `exclude_roles` config in the database only applies if we want to filter the dropdown -- but since the CSO decides who gets the SPIFF, we'll allow all employees to be selectable.

### Technical Details

**File**: `src/components/admin/DealTeamSpiffManager.tsx`

| Section | Change |
|---|---|
| Imports | Add `SearchableSelect`, `useProfiles`, `Trash2` icon, `Plus` icon |
| `TEAM_PARTICIPANT_ROLES` | Add `sales_head` entry (kept for reference but not used for auto-population) |
| `AllocationDialog` component | Replace auto-extract logic with manual add via `SearchableSelect` |
| Empty state message (line 441) | Update text to reflect new UX |
| Team member rows | Add remove button per row; role becomes a text input or badge based on selection |

**No database changes needed** -- the `deal_team_spiff_allocations` table already stores arbitrary `employee_id` values, so any employee can be allocated regardless of their deal role.
