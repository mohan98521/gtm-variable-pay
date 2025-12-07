-- Add admin role to mohankumar98521@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('2b655ec1-ca94-40db-9933-955c57a985da', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;