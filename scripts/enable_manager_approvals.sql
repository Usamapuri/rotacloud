-- Enable manager approvals for all existing tenants
-- This script ensures that manager approvals are enabled by default

BEGIN;

-- Insert default tenant settings for all existing organizations that don't have settings
INSERT INTO tenant_settings (tenant_id, allow_manager_approvals, pay_period_type, week_start_day)
SELECT 
    o.tenant_id,
    true, -- Enable manager approvals by default
    'weekly',
    1 -- Monday
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_settings ts WHERE ts.tenant_id = o.tenant_id
);

-- Update existing tenant settings to enable manager approvals if not already enabled
UPDATE tenant_settings 
SET allow_manager_approvals = true, updated_at = NOW()
WHERE allow_manager_approvals = false;

COMMIT;

-- Verify the changes
SELECT 
    o.name as organization_name,
    o.tenant_id,
    ts.allow_manager_approvals,
    ts.pay_period_type,
    ts.week_start_day
FROM organizations o
LEFT JOIN tenant_settings ts ON o.tenant_id = ts.tenant_id
ORDER BY o.created_at;
