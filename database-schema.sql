-- =====================================================
-- ROTACLOCK CONSOLIDATED DATABASE SCHEMA
-- =====================================================
-- This is the single source of truth for the database schema
-- Based on current production database structure
-- Last Updated: 2025-01-10

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CORE ORGANIZATION TABLES
-- =====================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Pakistan',
    postal_code VARCHAR(20),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    subscription_status VARCHAR(20) DEFAULT 'trial',
    subscription_plan VARCHAR(20) DEFAULT 'basic',
    trial_start_date TIMESTAMPTZ DEFAULT NOW(),
    trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
    currency VARCHAR(3) DEFAULT 'PKR',
    language VARCHAR(10) DEFAULT 'en',
    max_employees INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EMPLOYEE MANAGEMENT
-- =====================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    employee_code VARCHAR(64) UNIQUE,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    password_hash TEXT,
    role VARCHAR(32) DEFAULT 'agent',
    department VARCHAR(120),
    job_position VARCHAR(120),
    hire_date DATE,
    manager_id UUID REFERENCES employees(id),
    team_id UUID,
    -- New extended fields
    address TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    notes TEXT,
    location_id UUID,
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    hourly_rate NUMERIC,
    max_hours_per_week INTEGER DEFAULT 40,
    last_login_at TIMESTAMPTZ,
    is_online BOOLEAN DEFAULT false,
    last_online TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, employee_code),
    UNIQUE(tenant_id, email)
);

-- Locations table (tenant-scoped)
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

-- Manager-to-location mapping
CREATE TABLE IF NOT EXISTS manager_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    manager_id UUID NOT NULL REFERENCES employees(id),
    location_id UUID NOT NULL REFERENCES locations(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, manager_id, location_id)
);

-- =====================================================
-- TEAM AND PROJECT MANAGEMENT
-- =====================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    department VARCHAR(120),
    team_lead_id UUID REFERENCES employees(id),
    description TEXT,
    project_id UUID,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, name)
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, name)
);

-- =====================================================
-- SHIFT MANAGEMENT
-- =====================================================

-- Shift templates table
CREATE TABLE IF NOT EXISTS shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    department VARCHAR(120),
    required_staff INTEGER DEFAULT 1,
    hourly_rate NUMERIC,
    color VARCHAR(32) DEFAULT '#3B82F6',
    break_duration INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, name)
);

-- Rotas table (weekly schedules)
CREATE TABLE IF NOT EXISTS rotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    week_start_date DATE NOT NULL,
    status VARCHAR(32) DEFAULT 'draft',
    created_by UUID REFERENCES employees(id),
    published_by UUID REFERENCES employees(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, name),
    UNIQUE(tenant_id, week_start_date)
);

-- Shift assignments table
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    template_id UUID REFERENCES shift_templates(id),
    rota_id UUID REFERENCES rotas(id),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    override_name VARCHAR(255),
    override_start_time TIME,
    override_end_time TIME,
    override_color VARCHAR(32),
    status VARCHAR(32) DEFAULT 'assigned',
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    assigned_by UUID REFERENCES employees(id),
    notes TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id),
    UNIQUE(tenant_id, employee_id, date)
);

-- =====================================================
-- TIME TRACKING
-- =====================================================

-- Time entries table (main time tracking)
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    shift_assignment_id UUID REFERENCES shift_assignments(id),
    assignment_id UUID REFERENCES shift_assignments(id),
    date DATE,
    clock_in TIMESTAMPTZ,
    clock_out TIMESTAMPTZ,
    break_start TIMESTAMPTZ,
    break_end TIMESTAMPTZ,
    total_hours NUMERIC,
    break_hours NUMERIC DEFAULT 0,
    status VARCHAR(24) DEFAULT 'in-progress',
    notes TEXT,
    location_lat NUMERIC,
    location_lng NUMERIC,
    entry_type VARCHAR(50),
    timestamp TIMESTAMPTZ,
    location_data JSONB,
    device_info JSONB,
    
    -- Approval fields
    approval_status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    admin_notes TEXT,
    approved_hours NUMERIC,
    approved_rate NUMERIC,
    total_pay NUMERIC,
    
    -- Performance tracking
    total_calls_taken INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    shift_remarks TEXT,
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id)
);

-- Legacy shift logs table (for backward compatibility)
CREATE TABLE IF NOT EXISTS shift_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    shift_assignment_id UUID REFERENCES shift_assignments(id),
    clock_in_time TIMESTAMPTZ NOT NULL,
    clock_out_time TIMESTAMPTZ,
    total_shift_hours NUMERIC,
    break_time_used NUMERIC DEFAULT 0,
    max_break_allowed NUMERIC DEFAULT 1.0,
    is_late BOOLEAN DEFAULT false,
    is_no_show BOOLEAN DEFAULT false,
    late_minutes INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    total_calls_taken INTEGER DEFAULT 0,
    leads_generated INTEGER DEFAULT 0,
    shift_remarks TEXT,
    performance_rating INTEGER CHECK (performance_rating BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id)
);

-- Break logs table
CREATE TABLE IF NOT EXISTS break_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_log_id UUID REFERENCES shift_logs(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    break_start_time TIMESTAMPTZ NOT NULL,
    break_end_time TIMESTAMPTZ,
    break_duration NUMERIC,
    break_type VARCHAR(20) DEFAULT 'lunch',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS AND COMMUNICATION
-- =====================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    user_id UUID NOT NULL REFERENCES employees(id),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    action_url TEXT,
    related_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rota notifications table
CREATE TABLE IF NOT EXISTS rota_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    rota_id UUID NOT NULL REFERENCES rotas(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, rota_id, employee_id, notification_type)
);

-- =====================================================
-- LEAVE MANAGEMENT
-- =====================================================

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    type VARCHAR(40) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested NUMERIC NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PAYROLL MANAGEMENT
-- =====================================================

-- Payroll periods table
CREATE TABLE IF NOT EXISTS payroll_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, start_date, end_date)
);

-- Payroll records table
CREATE TABLE IF NOT EXISTS payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    organization_id UUID REFERENCES organizations(id),
    payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    employee_email VARCHAR(255),
    base_salary NUMERIC DEFAULT 0,
    hours_worked NUMERIC DEFAULT 0,
    hourly_pay NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    overtime_pay NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    deductions_amount NUMERIC DEFAULT 0,
    gross_pay NUMERIC DEFAULT 0,
    net_pay NUMERIC DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'pending',
    payment_date DATE,
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, payroll_period_id, employee_id)
);

-- Payroll bonuses table
CREATE TABLE IF NOT EXISTS payroll_bonuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    payroll_record_id UUID REFERENCES payroll_records(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    bonus_type VARCHAR(50) NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll deductions table
CREATE TABLE IF NOT EXISTS payroll_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    payroll_record_id UUID REFERENCES payroll_records(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    deduction_type VARCHAR(50) NOT NULL,
    amount NUMERIC NOT NULL,
    reason TEXT,
    approved_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PERFORMANCE AND QUALITY
-- =====================================================

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID REFERENCES employees(id),
    date DATE NOT NULL,
    calls_handled INTEGER DEFAULT 0,
    avg_handle_time INTEGER DEFAULT 0,
    customer_satisfaction NUMERIC,
    first_call_resolution_rate NUMERIC,
    total_break_time INTEGER DEFAULT 0,
    total_work_time INTEGER DEFAULT 0,
    productivity_score NUMERIC,
    quality_score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, employee_id, date)
);

-- Quality scores table
CREATE TABLE IF NOT EXISTS quality_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    evaluator_id UUID REFERENCES employees(id),
    score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 100),
    criteria JSONB,
    feedback TEXT,
    evaluation_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TEAM MANAGEMENT
-- =====================================================

-- Team assignments table
CREATE TABLE IF NOT EXISTS team_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    assigned_date DATE NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    is_active BOOLEAN DEFAULT true,
    assigned_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, team_id, employee_id, assigned_date)
);

-- Team requests table
CREATE TABLE IF NOT EXISTS team_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    message TEXT,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team reports table
CREATE TABLE IF NOT EXISTS team_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    team_id UUID NOT NULL REFERENCES teams(id),
    report_type VARCHAR(50) NOT NULL,
    report_data JSONB NOT NULL,
    generated_by UUID REFERENCES employees(id),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL
);

-- =====================================================
-- SHIFT SWAPS AND REQUESTS
-- =====================================================

-- Shift swaps table
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    requester_id UUID NOT NULL REFERENCES employees(id),
    target_id UUID NOT NULL REFERENCES employees(id),
    original_shift_id UUID NOT NULL REFERENCES shift_assignments(id),
    requested_shift_id UUID NOT NULL REFERENCES shift_assignments(id),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ONBOARDING SYSTEM
-- =====================================================

-- Onboarding templates table
CREATE TABLE IF NOT EXISTS onboarding_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding processes table
CREATE TABLE IF NOT EXISTS onboarding_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    template_id UUID REFERENCES onboarding_templates(id),
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id)
);

-- Onboarding steps table
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    process_id UUID NOT NULL REFERENCES onboarding_processes(id),
    step_name VARCHAR(255) NOT NULL,
    step_description TEXT,
    step_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, id)
);

-- Step completions table
CREATE TABLE IF NOT EXISTS step_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    step_id UUID NOT NULL REFERENCES onboarding_steps(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Onboarding documents table
CREATE TABLE IF NOT EXISTS onboarding_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    document_type VARCHAR(100) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_url TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES employees(id)
);

-- Onboarding feedback table
CREATE TABLE IF NOT EXISTS onboarding_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    feedback_type VARCHAR(50) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT AND VERIFICATION
-- =====================================================

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    user_id UUID REFERENCES employees(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin audit logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    admin_id UUID NOT NULL REFERENCES employees(id),
    target_user_id UUID REFERENCES employees(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification logs table
CREATE TABLE IF NOT EXISTS verification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    verification_type VARCHAR(50) NOT NULL,
    verification_data JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift verifications table
CREATE TABLE IF NOT EXISTS shift_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    shift_id UUID NOT NULL REFERENCES shift_assignments(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    verification_type VARCHAR(20) NOT NULL,
    verification_image TEXT,
    location_data JSONB,
    device_info JSONB,
    verification_status VARCHAR(20) DEFAULT 'verified',
    verified_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ADDITIONAL TABLES
-- =====================================================

-- Employee availability table
CREATE TABLE IF NOT EXISTS employee_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME,
    end_time TIME,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee salaries table
CREATE TABLE IF NOT EXISTS employee_salaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    salary_type VARCHAR(50) NOT NULL,
    amount NUMERIC NOT NULL,
    effective_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Training assignments table
CREATE TABLE IF NOT EXISTS training_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    training_name VARCHAR(255) NOT NULL,
    training_type VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    assigned_date DATE NOT NULL,
    due_date DATE,
    completed_date DATE,
    score NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance summary table
CREATE TABLE IF NOT EXISTS attendance_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    date DATE NOT NULL,
    total_hours NUMERIC DEFAULT 0,
    break_hours NUMERIC DEFAULT 0,
    overtime_hours NUMERIC DEFAULT 0,
    status VARCHAR(20) DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, employee_id, date)
);

-- Manager projects table
CREATE TABLE IF NOT EXISTS manager_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    manager_id UUID NOT NULL REFERENCES employees(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, manager_id, project_id)
);

-- Manager teams table
CREATE TABLE IF NOT EXISTS manager_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    manager_id UUID NOT NULL REFERENCES employees(id),
    team_id UUID NOT NULL REFERENCES teams(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, manager_id, team_id)
);

-- Organization admins table
CREATE TABLE IF NOT EXISTS organization_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES employees(id),
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Tenant isolation constraints
    UNIQUE(tenant_id, name)
);

-- Role assignments table
CREATE TABLE IF NOT EXISTS role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    assigned_by UUID REFERENCES employees(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true
);

-- Time entry approvals table
CREATE TABLE IF NOT EXISTS time_entry_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(80) NOT NULL,
    time_entry_id UUID NOT NULL REFERENCES time_entries(id),
    employee_id UUID NOT NULL REFERENCES employees(id),
    approver_id UUID REFERENCES employees(id),
    status VARCHAR(20) DEFAULT 'pending',
    decision_notes TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- VIEWS
-- =====================================================

-- Draft shift assignments view
CREATE OR REPLACE VIEW draft_shift_assignments AS
SELECT 
    sa.*,
    e.first_name,
    e.last_name,
    e.employee_code,
    st.name as template_name,
    st.start_time as template_start_time,
    st.end_time as template_end_time
FROM shift_assignments sa
JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
WHERE sa.is_published = false;

-- Published shift assignments view
CREATE OR REPLACE VIEW published_shift_assignments AS
SELECT 
    sa.*,
    e.first_name,
    e.last_name,
    e.employee_code,
    st.name as template_name,
    st.start_time as template_start_time,
    st.end_time as template_end_time
FROM shift_assignments sa
JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
WHERE sa.is_published = true;

-- Shifts view (combined shift assignments)
CREATE OR REPLACE VIEW shifts AS
SELECT 
    sa.id,
    sa.tenant_id,
    sa.employee_id,
    sa.template_id,
    sa.date,
    COALESCE(sa.start_time, st.start_time) as start_time,
    COALESCE(sa.end_time, st.end_time) as end_time,
    COALESCE(sa.override_name, st.name) as name,
    COALESCE(sa.override_color, st.color) as color,
    sa.status,
    sa.is_published,
    e.first_name,
    e.last_name,
    e.employee_code
FROM shift_assignments sa
JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_tenant ON organizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_team ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_role ON employees(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_active ON employees(tenant_id, is_active);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_tenant ON teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_teams_lead ON teams(team_lead_id);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);

-- Shift templates indexes
CREATE INDEX IF NOT EXISTS idx_shift_templates_tenant ON shift_templates(tenant_id);

-- Rotas indexes
CREATE INDEX IF NOT EXISTS idx_rotas_tenant ON rotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rotas_tenant_status ON rotas(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_rotas_tenant_week ON rotas(tenant_id, week_start_date);

-- Shift assignments indexes
CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant ON shift_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant_date ON shift_assignments(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_tenant_published ON shift_assignments(tenant_id, is_published);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_rota ON shift_assignments(rota_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_published ON shift_assignments(is_published);

-- Time entries indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant ON time_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_emp ON time_entries(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_status ON time_entries(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_time_entries_tenant_approval ON time_entries(tenant_id, approval_status);
CREATE INDEX IF NOT EXISTS idx_time_entries_approval_status ON time_entries(approval_status);
CREATE INDEX IF NOT EXISTS idx_time_entries_approved_by ON time_entries(approved_by);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_employee ON notifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(is_read);

-- Leave requests indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);

-- Payroll indexes
CREATE INDEX IF NOT EXISTS idx_payroll_periods_tenant ON payroll_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_tenant ON payroll_records(tenant_id);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant ON performance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_employee ON performance_metrics(employee_id);

-- Team assignments indexes
CREATE INDEX IF NOT EXISTS idx_team_assignments_tenant ON team_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_assignments_team ON team_assignments(team_id);

-- Shift swaps indexes
CREATE INDEX IF NOT EXISTS idx_shift_swaps_tenant ON shift_swaps(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Admin audit logs indexes
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_tenant ON admin_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get current tenant context
CREATE OR REPLACE FUNCTION current_tenant()
RETURNS VARCHAR(80) AS $$
BEGIN
    -- This function should be implemented based on your tenant resolution logic
    -- For now, returning a placeholder
    RETURN 'default-tenant';
END;
$$ LANGUAGE plpgsql;

-- Function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS VOID AS $$
BEGIN
    -- This function should be implemented to refresh materialized views or stats
    -- For now, it's a placeholder
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN 
        SELECT t.table_name 
        FROM information_schema.tables t
        JOIN information_schema.columns c ON t.table_name = c.table_name
        WHERE t.table_schema = 'public' 
        AND c.column_name = 'updated_at'
        AND t.table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %I;
            CREATE TRIGGER update_%s_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name, table_name, table_name);
    END LOOP;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE organizations IS 'Main organization/tenant table';
COMMENT ON TABLE employees IS 'Employee/user management table';
COMMENT ON TABLE teams IS 'Team management table';
COMMENT ON TABLE projects IS 'Project management table';
COMMENT ON TABLE shift_templates IS 'Reusable shift templates';
COMMENT ON TABLE rotas IS 'Weekly schedule/rota management';
COMMENT ON TABLE shift_assignments IS 'Individual shift assignments';
COMMENT ON TABLE time_entries IS 'Main time tracking table';
COMMENT ON TABLE shift_logs IS 'Legacy time tracking table (for backward compatibility)';
COMMENT ON TABLE notifications IS 'System notifications';
COMMENT ON TABLE leave_requests IS 'Leave request management';
COMMENT ON TABLE payroll_records IS 'Payroll calculation records';
COMMENT ON TABLE performance_metrics IS 'Employee performance tracking';
COMMENT ON TABLE audit_logs IS 'System audit trail';
COMMENT ON TABLE admin_audit_logs IS 'Admin action audit trail';

-- =====================================================
-- END OF SCHEMA
-- =====================================================
