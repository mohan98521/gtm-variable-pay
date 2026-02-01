ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS product_specialist_head_employee_id text,
ADD COLUMN IF NOT EXISTS product_specialist_head_name text,
ADD COLUMN IF NOT EXISTS solution_manager_employee_id text,
ADD COLUMN IF NOT EXISTS solution_manager_name text,
ADD COLUMN IF NOT EXISTS solution_manager_head_employee_id text,
ADD COLUMN IF NOT EXISTS solution_manager_head_name text;