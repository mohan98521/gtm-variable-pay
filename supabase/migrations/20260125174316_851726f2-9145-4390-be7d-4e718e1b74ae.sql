-- Remove year suffix from plan names (trailing 4-digit year with optional preceding space)
UPDATE comp_plans SET name = TRIM(REGEXP_REPLACE(name, '\s*\d{4}$', ''));