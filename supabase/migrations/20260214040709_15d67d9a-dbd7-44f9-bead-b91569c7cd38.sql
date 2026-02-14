
-- 1. Create support_teams table
CREATE TABLE public.support_teams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_name text NOT NULL,
  team_role text NOT NULL,
  region text,
  bu text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create support_team_members table
CREATE TABLE public.support_team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.support_teams(id) ON DELETE CASCADE,
  employee_id text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add team_id columns to deals table
ALTER TABLE public.deals
  ADD COLUMN sales_engineering_team_id uuid REFERENCES public.support_teams(id),
  ADD COLUMN solution_manager_team_id uuid REFERENCES public.support_teams(id);

-- 4. Enable RLS on both tables
ALTER TABLE public.support_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;

-- 5. RLS for support_teams
CREATE POLICY "st_view" ON public.support_teams FOR SELECT USING (true);
CREATE POLICY "st_admin" ON public.support_teams FOR ALL USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "st_gtm" ON public.support_teams FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::text));

-- 6. RLS for support_team_members
CREATE POLICY "stm_view" ON public.support_team_members FOR SELECT USING (true);
CREATE POLICY "stm_admin" ON public.support_team_members FOR ALL USING (has_role(auth.uid(), 'admin'::text));
CREATE POLICY "stm_gtm" ON public.support_team_members FOR ALL USING (has_role(auth.uid(), 'gtm_ops'::text));

-- 7. Indexes for performance
CREATE INDEX idx_support_team_members_team_id ON public.support_team_members(team_id);
CREATE INDEX idx_support_team_members_employee_id ON public.support_team_members(employee_id);
CREATE INDEX idx_support_teams_role ON public.support_teams(team_role);
CREATE INDEX idx_deals_se_team_id ON public.deals(sales_engineering_team_id);
CREATE INDEX idx_deals_sm_team_id ON public.deals(solution_manager_team_id);
