-- Step 1: Update existing profiles with employee_id from employees table
UPDATE profiles p
SET employee_id = e.employee_id
FROM employees e
WHERE LOWER(p.email) = LOWER(e.email)
  AND p.employee_id IS NULL;

-- Step 2: Replace the handle_new_user trigger function to auto-populate employee_id
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