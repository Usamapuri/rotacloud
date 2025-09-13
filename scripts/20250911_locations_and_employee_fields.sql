-- Migration: add locations, manager_locations and extended employee fields
-- Tenant isolation is enforced via tenant_id columns and composite uniques

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Optional cleanup of legacy project-manager/team-lead artifacts (safe-drop)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_reports') THEN
    EXECUTE 'DROP TABLE IF EXISTS team_reports CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_requests') THEN
    EXECUTE 'DROP TABLE IF EXISTS team_requests CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_assignments') THEN
    EXECUTE 'DROP TABLE IF EXISTS team_assignments CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manager_teams') THEN
    EXECUTE 'DROP TABLE IF EXISTS manager_teams CASCADE';
  END IF;
END$$;

-- 1) Locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(80) NOT NULL,
  organization_id UUID,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, id),
  UNIQUE(tenant_id, name)
);

-- 1b) Tenant settings for approvals and pay periods
CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id VARCHAR(80) PRIMARY KEY,
  allow_manager_approvals BOOLEAN DEFAULT false,
  pay_period_type VARCHAR(20) DEFAULT 'weekly', -- weekly | biweekly | custom
  custom_period_days INTEGER,
  week_start_day INTEGER DEFAULT 1, -- 1=Monday
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1c) Pay periods registry (locking)
CREATE TABLE IF NOT EXISTS pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(80) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open | locked
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, start_date, end_date)
);

-- 2) Mapping managers to locations they manage
CREATE TABLE IF NOT EXISTS manager_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(80) NOT NULL,
  manager_id UUID NOT NULL REFERENCES employees(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tenant_id, manager_id, location_id)
);

-- 3) Extend employees with address/emergency/notes and location_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'address'
  ) THEN
    ALTER TABLE employees ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'emergency_contact'
  ) THEN
    ALTER TABLE employees ADD COLUMN emergency_contact TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'emergency_phone'
  ) THEN
    ALTER TABLE employees ADD COLUMN emergency_phone TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'notes'
  ) THEN
    ALTER TABLE employees ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'employees' AND column_name = 'location_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN location_id UUID;
  END IF;
END$$;

-- Optional: add FK after column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'employees_location_id_fkey'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_location_id_fkey
      FOREIGN KEY (location_id) REFERENCES locations(id);
  END IF;
END$$;

COMMIT;

-- Optional cleanup: drop legacy tables if present and no longer used
DO $$
BEGIN
  IF to_regclass('public.project_managers') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.project_managers';
  END IF;
  IF to_regclass('public.team_leads') IS NOT NULL THEN
    EXECUTE 'DROP TABLE public.team_leads';
  END IF;
END$$;


