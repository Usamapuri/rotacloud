-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    hire_date DATE,
    manager_id UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    hourly_rate DECIMAL(8,2),
    max_hours_per_week INTEGER DEFAULT 40,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    department VARCHAR(100),
    required_staff INTEGER DEFAULT 1,
    hourly_rate DECIMAL(8,2),
    color VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shift_assignments table
CREATE TABLE IF NOT EXISTS shift_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status VARCHAR(50) CHECK (status IN ('assigned', 'confirmed', 'completed', 'cancelled', 'swap-requested')) DEFAULT 'assigned',
    assigned_by UUID REFERENCES employees(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, shift_id, date)
);

-- Create time_entries table
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    shift_assignment_id UUID REFERENCES shift_assignments(id) ON DELETE SET NULL,
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    break_start TIMESTAMP WITH TIME ZONE,
    break_end TIMESTAMP WITH TIME ZONE,
    total_hours DECIMAL(5,2),
    status VARCHAR(50) CHECK (status IN ('in-progress', 'completed', 'break', 'overtime')) DEFAULT 'in-progress',
    notes TEXT,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shift_swaps table
CREATE TABLE IF NOT EXISTS shift_swaps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    original_shift_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    requested_shift_id UUID NOT NULL REFERENCES shift_assignments(id) ON DELETE CASCADE,
    status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')) DEFAULT 'pending',
    reason TEXT,
    admin_notes TEXT,
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type VARCHAR(50) CHECK (type IN ('vacation', 'sick', 'personal', 'bereavement', 'jury-duty', 'other')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_requested INTEGER NOT NULL,
    reason TEXT,
    status VARCHAR(50) CHECK (status IN ('pending', 'approved', 'denied', 'cancelled')) DEFAULT 'pending',
    approved_by UUID REFERENCES employees(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) CHECK (type IN ('info', 'success', 'warning', 'error', 'schedule', 'time', 'leave', 'swap')) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create company_holidays table
CREATE TABLE IF NOT EXISTS company_holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    type VARCHAR(50) CHECK (type IN ('holiday', 'company-event', 'maintenance')) DEFAULT 'holiday',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ONBOARDING TABLES (Enhanced)
-- =====================================================

-- Create onboarding_templates table
CREATE TABLE IF NOT EXISTS onboarding_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100) NOT NULL,
    total_estimated_time INTEGER DEFAULT 0, -- in minutes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES employees(id)
);

-- Create onboarding_steps table
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES onboarding_templates(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('documentation', 'training', 'setup', 'orientation', 'compliance')) NOT NULL,
    required BOOLEAN DEFAULT true,
    estimated_time INTEGER DEFAULT 0, -- in minutes
    step_order INTEGER NOT NULL,
    assigned_to VARCHAR(255),
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(template_id, step_order)
);

-- Create step_dependencies table
CREATE TABLE IF NOT EXISTS step_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    depends_on_step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(step_id, depends_on_step_id)
);

-- Create onboarding_documents table
CREATE TABLE IF NOT EXISTS onboarding_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('handbook', 'policy', 'form', 'training', 'certificate', 'contract')) NOT NULL,
    file_url TEXT,
    required BOOLEAN DEFAULT false,
    uploaded_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create step_documents junction table
CREATE TABLE IF NOT EXISTS step_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES onboarding_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(step_id, document_id)
);

-- Create onboarding_processes table
CREATE TABLE IF NOT EXISTS onboarding_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id),
    employee_name VARCHAR(255) NOT NULL,
    template_id UUID REFERENCES onboarding_templates(id),
    template_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    expected_completion_date DATE NOT NULL,
    actual_completion_date DATE,
    status VARCHAR(50) CHECK (status IN ('not-started', 'in-progress', 'completed', 'overdue', 'paused')) DEFAULT 'not-started',
    assigned_mentor UUID REFERENCES employees(id),
    notes TEXT,
    progress DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create step_completions table
CREATE TABLE IF NOT EXISTS step_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES onboarding_processes(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback TEXT,
    completed_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(process_id, step_id)
);

-- Create onboarding_feedback table
CREATE TABLE IF NOT EXISTS onboarding_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES onboarding_processes(id) ON DELETE CASCADE,
    step_id UUID REFERENCES onboarding_steps(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_type VARCHAR(50) CHECK (feedback_type IN ('step', 'overall', 'mentor')) NOT NULL,
    submitted_by UUID REFERENCES employees(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Employee indexes
CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON employees(employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);

-- Shift indexes
CREATE INDEX IF NOT EXISTS idx_shifts_department ON shifts(department);
CREATE INDEX IF NOT EXISTS idx_shifts_is_active ON shifts(is_active);
CREATE INDEX IF NOT EXISTS idx_shifts_created_by ON shifts(created_by);

-- Shift assignment indexes
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee_id ON shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift_id ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_date ON shift_assignments(date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_status ON shift_assignments(status);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee_date ON shift_assignments(employee_id, date);

-- Time entry indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_id ON time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_shift_assignment_id ON time_entries(shift_assignment_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_in ON time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, DATE(clock_in));

-- Shift swap indexes
CREATE INDEX IF NOT EXISTS idx_shift_swaps_requester_id ON shift_swaps(requester_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_target_id ON shift_swaps(target_id);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_status ON shift_swaps(status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_original_shift_id ON shift_swaps(original_shift_id);

-- Leave request indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_start_date ON leave_requests(start_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON leave_requests(type);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Holiday indexes
CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date);
CREATE INDEX IF NOT EXISTS idx_company_holidays_is_active ON company_holidays(is_active);

-- Onboarding indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_department ON onboarding_templates(department);
CREATE INDEX IF NOT EXISTS idx_onboarding_templates_is_active ON onboarding_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_onboarding_steps_template_id ON onboarding_steps(template_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_step_order ON onboarding_steps(template_id, step_order);

CREATE INDEX IF NOT EXISTS idx_onboarding_processes_employee_id ON onboarding_processes(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_processes_template_id ON onboarding_processes(template_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_processes_status ON onboarding_processes(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_processes_start_date ON onboarding_processes(start_date);

CREATE INDEX IF NOT EXISTS idx_step_completions_process_id ON step_completions(process_id);
CREATE INDEX IF NOT EXISTS idx_step_completions_step_id ON step_completions(step_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_process_id ON onboarding_feedback(process_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_feedback_step_id ON onboarding_feedback(step_id);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_assignments_updated_at BEFORE UPDATE ON shift_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_shift_swaps_updated_at BEFORE UPDATE ON shift_swaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_holidays_updated_at BEFORE UPDATE ON company_holidays FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_templates_updated_at BEFORE UPDATE ON onboarding_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_steps_updated_at BEFORE UPDATE ON onboarding_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_documents_updated_at BEFORE UPDATE ON onboarding_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_onboarding_processes_updated_at BEFORE UPDATE ON onboarding_processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_swaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_feedback ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Employees policies
CREATE POLICY "Users can view own employee data" ON employees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all employee data" ON employees FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);
CREATE POLICY "Admins can manage all employee data" ON employees FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Shifts policies
CREATE POLICY "Authenticated users can view shifts" ON shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage shifts" ON shifts FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Shift assignments policies
CREATE POLICY "Users can view own assignments" ON shift_assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Admins can view all assignments" ON shift_assignments FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);
CREATE POLICY "Admins can manage assignments" ON shift_assignments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Time entries policies
CREATE POLICY "Users can view own time entries" ON time_entries FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Users can manage own time entries" ON time_entries FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Admins can view all time entries" ON time_entries FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Shift swaps policies
CREATE POLICY "Users can view own swap requests" ON shift_swaps FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND (e.id = requester_id OR e.id = target_id)
    )
);
CREATE POLICY "Users can create swap requests" ON shift_swaps FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = requester_id
    )
);
CREATE POLICY "Admins can manage all swap requests" ON shift_swaps FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Leave requests policies
CREATE POLICY "Users can view own leave requests" ON leave_requests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Users can create leave requests" ON leave_requests FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Admins can view all leave requests" ON leave_requests FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);
CREATE POLICY "Admins can manage all leave requests" ON leave_requests FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Company holidays policies
CREATE POLICY "Authenticated users can view holidays" ON company_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage holidays" ON company_holidays FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- Onboarding policies (reusing existing structure)
CREATE POLICY "Authenticated users can view templates" ON onboarding_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage templates" ON onboarding_templates FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

CREATE POLICY "Authenticated users can view steps" ON onboarding_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage steps" ON onboarding_steps FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

CREATE POLICY "Authenticated users can view documents" ON onboarding_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage documents" ON onboarding_documents FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

CREATE POLICY "Users can view own processes" ON onboarding_processes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.id = employee_id
    )
);
CREATE POLICY "Admins can view all processes" ON onboarding_processes FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);
CREATE POLICY "Admins can manage processes" ON onboarding_processes FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

CREATE POLICY "Users can manage own completions" ON step_completions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        JOIN onboarding_processes p ON p.employee_id = e.id
        WHERE e.user_id = auth.uid() 
        AND p.id = process_id
    )
);
CREATE POLICY "Admins can manage all completions" ON step_completions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

CREATE POLICY "Users can submit own feedback" ON onboarding_feedback FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM employees e 
        JOIN onboarding_processes p ON p.employee_id = e.id
        WHERE e.user_id = auth.uid() 
        AND p.id = process_id
    )
);
CREATE POLICY "Users can view own feedback" ON onboarding_feedback FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        JOIN onboarding_processes p ON p.employee_id = e.id
        WHERE e.user_id = auth.uid() 
        AND p.id = process_id
    )
);
CREATE POLICY "Admins can view all feedback" ON onboarding_feedback FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM employees e 
        WHERE e.user_id = auth.uid() 
        AND e.position ILIKE '%admin%'
    )
);

-- =====================================================
-- FUNCTIONS FOR BUSINESS LOGIC
-- =====================================================

-- Function to calculate total hours worked
CREATE OR REPLACE FUNCTION calculate_total_hours(
    clock_in TIMESTAMP WITH TIME ZONE,
    clock_out TIMESTAMP WITH TIME ZONE,
    break_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    break_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_minutes INTEGER;
    break_minutes INTEGER := 0;
BEGIN
    IF clock_in IS NULL OR clock_out IS NULL THEN
        RETURN 0;
    END IF;
    
    total_minutes := EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60;
    
    IF break_start IS NOT NULL AND break_end IS NOT NULL THEN
        break_minutes := EXTRACT(EPOCH FROM (break_end - break_start)) / 60;
    END IF;
    
    RETURN ROUND((total_minutes - break_minutes) / 60.0, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to update time entry total hours
CREATE OR REPLACE FUNCTION update_time_entry_hours()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_hours := calculate_total_hours(
        NEW.clock_in,
        NEW.clock_out,
        NEW.break_start,
        NEW.break_end
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate total hours
CREATE TRIGGER update_time_entry_hours_trigger
    BEFORE INSERT OR UPDATE ON time_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_time_entry_hours();

-- Function to check if employee is clocked in
CREATE OR REPLACE FUNCTION is_employee_clocked_in(emp_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM time_entries 
        WHERE employee_id = emp_id 
        AND clock_in IS NOT NULL 
        AND clock_out IS NULL
        AND status = 'in-progress'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get employee's current shift
CREATE OR REPLACE FUNCTION get_employee_current_shift(emp_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT sa.id FROM shift_assignments sa
        WHERE sa.employee_id = emp_id
        AND sa.date = CURRENT_DATE
        AND sa.status IN ('assigned', 'confirmed')
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql; 