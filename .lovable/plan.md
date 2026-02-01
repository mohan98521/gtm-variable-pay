

## Fix Employee ID Linkage Between Profiles and Employees

### Problem Summary

| Metric | Value |
|--------|-------|
| Total profiles | 12 |
| Profiles with employee_id | 0 |
| Profiles matchable by email | 11 |
| Unmatched profile | 1 (mohankumar98521@gmail.com - admin, not in employees table) |

The `profiles.employee_id` column is NULL for all users, which breaks the connection between authenticated users and their performance data in the `deals` and `closing_arr_actuals` tables.

---

### Solution Overview

1. **One-time data migration** - Update all existing profiles with their matching employee_id from the employees table
2. **Database trigger enhancement** - Modify the `handle_new_user` trigger to automatically populate employee_id when new profiles are created
3. **Edge function update** - Ensure the `create-employee-account` function also updates the profile with employee_id if the profile was created by the trigger

---

### Implementation Steps

#### Step 1: One-Time Data Migration

Run a SQL migration to update all existing profiles where a matching employee exists:

```sql
-- Update existing profiles with employee_id from employees table
UPDATE profiles p
SET employee_id = e.employee_id
FROM employees e
WHERE LOWER(p.email) = LOWER(e.email)
  AND p.employee_id IS NULL;
```

**Expected Result:** 11 profiles updated with their employee_id

---

#### Step 2: Enhance the `handle_new_user` Trigger

Modify the existing trigger function to lookup the employee_id when a new profile is created:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  emp_id text;
BEGIN
  -- Look up employee_id from employees table by email
  SELECT employee_id INTO emp_id
  FROM public.employees
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, employee_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    emp_id  -- Will be NULL if no matching employee found
  );
  RETURN NEW;
END;
$function$;
```

---

#### Step 3: Update Edge Function (Optional Enhancement)

The `create-employee-account` edge function already handles this correctly in the case where it creates the profile (lines 150-157). However, when the trigger creates the profile first, the employee_id is not set.

Update the edge function to also update existing profiles with the employee_id:

**Current behavior (line 165-167):**
```typescript
} else {
  console.log('Profile already exists for user:', newUserId);
}
```

**Updated behavior:**
```typescript
} else {
  // Profile exists but may not have employee_id, update it
  const { error: updateProfileError } = await supabaseAdmin
    .from('profiles')
    .update({ employee_id: employee_id })
    .eq('id', newUserId);

  if (updateProfileError) {
    console.error('Failed to update profile employee_id:', updateProfileError.message);
  } else {
    console.log('Updated profile with employee_id for user:', newUserId);
  }
}
```

---

### Data Flow After Fix

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    NEW USER REGISTRATION                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│          auth.users INSERT triggers handle_new_user()               │
│                                                                      │
│   1. Lookup employee_id from employees table by email                │
│   2. Insert into profiles with employee_id populated                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    profiles table                                    │
│                                                                      │
│   id (auth.users.id) ──── employee_id (from employees table)        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Data Queries Now Work                             │
│                                                                      │
│   profiles.employee_id = deals.sales_rep_employee_id                 │
│   profiles.employee_id = closing_arr_actuals.sales_rep_employee_id   │
│   profiles.employee_id = performance_targets.employee_id             │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Files to Modify

| File | Changes |
|------|---------|
| Database migration | Update existing profiles + enhance trigger |
| `supabase/functions/create-employee-account/index.ts` | Update existing profiles with employee_id |

---

### Technical Details

**Migration SQL (combined):**

```sql
-- Step 1: Update existing profiles with employee_id
UPDATE profiles p
SET employee_id = e.employee_id
FROM employees e
WHERE LOWER(p.email) = LOWER(e.email)
  AND p.employee_id IS NULL;

-- Step 2: Replace the handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  emp_id text;
BEGIN
  -- Look up employee_id from employees table by email
  SELECT employee_id INTO emp_id
  FROM public.employees
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, employee_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    emp_id
  );
  RETURN NEW;
END;
$function$;
```

---

### Verification

After implementation, this query should show all profiles with their employee_id populated:

```sql
SELECT p.email, p.employee_id, e.full_name
FROM profiles p
LEFT JOIN employees e ON p.employee_id = e.employee_id
ORDER BY p.email;
```

---

### Summary

| Step | Action | Impact |
|------|--------|--------|
| 1 | Run data migration | 11 existing profiles get employee_id |
| 2 | Update trigger function | Future signups auto-populate employee_id |
| 3 | Update edge function | Handles edge case where profile created by trigger |

After this fix, the Dashboard and Incentive Audit will correctly display real actuals from the deals and closing_arr_actuals tables.

