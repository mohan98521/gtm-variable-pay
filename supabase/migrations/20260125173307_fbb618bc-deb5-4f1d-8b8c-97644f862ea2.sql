-- Add effective_year column to comp_plans table
ALTER TABLE comp_plans 
ADD COLUMN effective_year INTEGER NOT NULL DEFAULT 2026;

-- Create index for faster year-based filtering
CREATE INDEX idx_comp_plans_effective_year ON comp_plans(effective_year);

-- Add unique constraint: same plan name cannot exist twice in the same year
ALTER TABLE comp_plans 
ADD CONSTRAINT unique_plan_name_per_year UNIQUE (name, effective_year);