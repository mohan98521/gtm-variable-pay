
CREATE TABLE public.sales_functions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_functions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sales_functions" ON public.sales_functions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert sales_functions" ON public.sales_functions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sales_functions" ON public.sales_functions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sales_functions" ON public.sales_functions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.sales_functions (name, display_order) VALUES
  ('Farmer', 1), ('Hunter', 2), ('CSM', 3), ('Channel Sales', 4),
  ('Sales Engineering', 5), ('Sales Head - Farmer', 6), ('Sales Head - Hunter', 7),
  ('Farmer - Retain', 8), ('IMAL Product SE', 9), ('Insurance Product SE', 10),
  ('APAC Regional SE', 11), ('MEA Regional SE', 12), ('Sales Engineering - Head', 13),
  ('Team Lead', 14), ('Team Lead - Farmer', 15), ('Team Lead - Hunter', 16),
  ('Overlay', 17), ('Executive', 18);

INSERT INTO public.role_permissions (role, permission_key, is_allowed)
SELECT r.name, 'tab:sales_functions', (r.name = 'admin')
FROM public.roles r
ON CONFLICT (role, permission_key) DO NOTHING;
