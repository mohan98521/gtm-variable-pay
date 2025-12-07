-- Add new role values to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gtm_ops';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'finance';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'executive';