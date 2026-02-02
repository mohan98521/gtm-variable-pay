
# Fix Reports Page Filters - Context-Aware Filter Display

## Problem
The global search bar and "Farmer" (Sales Function) filter on the Reports page are always visible but only work for certain tabs:
- **Works**: Employee Master, Incentive Audit
- **Doesn't work**: Compensation Snapshot, My Deals, My Closing ARR

This creates confusion as users expect the filters to work on all tabs.

## Solution
Make the global filter card **context-aware** - only show it on tabs where it actually functions. The "My Deals" and "My Closing ARR" tabs already have their own month filters built-in.

---

## Implementation

### Update `src/pages/Reports.tsx`

1. **Track the active tab** using state
2. **Conditionally render the filter card** only for tabs where it works
3. Show the filter card only when on:
   - `employees` (Employee Master)
   - `audit` (Incentive Audit)

### Code Changes

**Add active tab state:**
```typescript
const [activeTab, setActiveTab] = useState("employees");
```

**Update Tabs component to track active tab:**
```typescript
<Tabs 
  defaultValue="employees" 
  value={activeTab}
  onValueChange={setActiveTab}
  className="space-y-4"
>
```

**Conditionally render the filter card:**
```typescript
{/* Filters - Only show for Employee Master and Incentive Audit */}
{(activeTab === "employees" || activeTab === "audit") && (
  <Card>
    <CardContent className="pt-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={salesFunctionFilter} onValueChange={setSalesFunctionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by Sales Function" />
          </SelectTrigger>
          <SelectContent>
            {SALES_FUNCTIONS.map((sf) => (
              <SelectItem key={sf} value={sf}>{sf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </CardContent>
  </Card>
)}
```

---

## Summary

| Change | Description |
|--------|-------------|
| Add `activeTab` state | Track which tab is currently selected |
| Update `<Tabs>` component | Add `value` and `onValueChange` props to track state |
| Wrap filter card in conditional | Only render filters for `employees` and `audit` tabs |

## Expected Outcome
- **Employee Master tab**: Shows search + sales function filter ✅
- **Compensation Snapshot tab**: No filters shown (data comes from user_targets, no filtering logic) ✅
- **Incentive Audit tab**: Shows search + sales function filter ✅
- **My Deals tab**: No global filters (uses its own month filter) ✅
- **My Closing ARR tab**: No global filters (uses its own month filter) ✅

This removes user confusion by only showing filters when they actually work.
