import { Pool, PoolClient } from 'pg'
import bcrypt from 'bcryptjs'

// Connection pool configuration for high concurrency and performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || (process.env.NODE_ENV === 'production' 
    ? 'postgresql://postgres:IImsWCOMgonNsYLXSDBUGsrpbGNbbsoZ@hopper.proxy.rlwy.net:48063/railway'
    : 'postgresql://postgres:QlUXSBsWFuwjhodaivUXTUXDuQhWigHL@metro.proxy.rlwy.net:36516/railway'),
  max: 20, // Increased for better concurrency
  min: 2, // Keep minimum connections ready
  idleTimeoutMillis: 30000, // Reduced idle timeout for better resource management
  connectionTimeoutMillis: 5000, // Faster connection timeout
  maxUses: 750, // Reduced to prevent connection staleness
  ssl: {
    rejectUnauthorized: false
  },
  // Statement timeout to prevent long-running queries
  statement_timeout: 30000, // 30 seconds
  // Query timeout
  query_timeout: 30000, // 30 seconds
})

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err)
  // Don't exit the process, just log the error
})

// Test the connection
pool.on('connect', () => {
  console.log('Connected to database')
})

export async function query(text: string, params?: any[]) {
  const start = Date.now()
  let client
  
  try {
    client = await pool.connect()
    const result = await client.query(text, params)
    const duration = Date.now() - start
    
    // Log slow queries (over 200ms) - increased threshold
    if (duration > 200) {
      console.log('Slow query:', { text, duration, rows: result.rowCount })
    }
    
    return result
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Optimized query function with prepared statements
export async function optimizedQuery(text: string, params?: any[], cacheKey?: string) {
  const start = Date.now()
  let client
  
  try {
    client = await pool.connect()
    
    // Use prepared statements for better performance
    const result = await client.query({
      text,
      values: params,
      name: cacheKey || 'query',
    })
    
    const duration = Date.now() - start
    
    // Log slow queries (over 150ms)
    if (duration > 150) {
      console.log('Slow optimized query:', { text, duration, rows: result.rowCount, cacheKey })
    }
    
    return result
  } catch (error) {
    console.error('Database optimized query error:', error)
    throw error
  } finally {
    if (client) {
      client.release()
    }
  }
}

// Helper function to execute a transaction
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// Close the pool when the application shuts down
process.on('SIGINT', () => {
  pool.end()
  process.exit(0)
})

// =====================================================
// CORE DATABASE TYPES
// =====================================================

export interface Employee {
  id: string
  user_id?: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  department?: string
  position?: string
  hire_date?: string
  manager_id?: string
  is_active: boolean
  hourly_rate?: number
  max_hours_per_week?: number
  password_hash?: string
  role?: 'admin' | 'team_lead' | 'project_manager' | 'agent' | 'sales_agent'
  team_id?: string | null
  created_at: string
  updated_at: string
  manager?: Employee
  direct_reports?: Employee[]
}

export interface Shift {
  id: string
  name: string
  description?: string
  start_time: string
  end_time: string
  department?: string
  required_staff: number
  hourly_rate?: number
  color: string
  is_active: boolean
  created_by?: string
  created_at: string
  updated_at: string
  created_by_employee?: Employee
}

export interface ShiftAssignment {
  id: string
  employee_id: string
  shift_id: string
  date: string
  start_time?: string
  end_time?: string
  status: 'assigned' | 'confirmed' | 'completed' | 'cancelled' | 'swap-requested'
  assigned_by?: string
  notes?: string
  created_at: string
  updated_at: string
  employee?: Employee
  shift?: Shift
  assigned_by_employee?: Employee
}

export interface TimeEntry {
  id: string
  employee_id: string
  shift_assignment_id?: string
  clock_in?: string
  clock_out?: string
  break_start?: string
  break_end?: string
  total_hours?: number
  status: 'in-progress' | 'completed' | 'break' | 'overtime'
  notes?: string
  location_lat?: number
  location_lng?: number
  created_at: string
  updated_at: string
  employee?: Employee
  shift_assignment?: ShiftAssignment
}

export interface ShiftSwap {
  id: string
  requester_id: string
  target_id: string
  original_shift_id: string
  requested_shift_id: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  reason?: string
  admin_notes?: string
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
  requester?: Employee
  target?: Employee
  original_shift?: ShiftAssignment
  requested_shift?: ShiftAssignment
  approved_by_employee?: Employee
}

export interface LeaveRequest {
  id: string
  employee_id: string
  type: 'vacation' | 'sick' | 'personal' | 'bereavement' | 'jury-duty' | 'other'
  start_date: string
  end_date: string
  days_requested: number
  reason?: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled'
  approved_by?: string
  approved_at?: string
  admin_notes?: string
  created_at: string
  updated_at: string
  employee?: Employee
  approved_by_employee?: Employee
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'schedule' | 'time' | 'leave' | 'swap'
  read: boolean
  action_url?: string
  created_at: string
}

export interface CompanyHoliday {
  id: string
  name: string
  date: string
  type: 'holiday' | 'company-event' | 'maintenance'
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// =====================================================
// ONBOARDING TYPES
// =====================================================

export interface OnboardingTemplate {
  id: string
  name: string
  description?: string
  department: string
  position: string
  total_estimated_time: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  created_by_employee?: Employee
  onboarding_steps?: OnboardingStep[]
}

export interface OnboardingStep {
  id: string
  template_id: string
  title: string
  description?: string
  category: "documentation" | "training" | "setup" | "orientation" | "compliance"
  required: boolean
  estimated_time: number
  step_order: number
  assigned_to?: string
  instructions?: string
  created_at: string
  updated_at: string
  template?: OnboardingTemplate
  step_dependencies?: StepDependency[]
  step_documents?: { onboarding_documents: OnboardingDocument }[]
}

export interface StepDependency {
  id: string
  step_id: string
  depends_on_step_id: string
  created_at: string
  depends_on_step?: OnboardingStep
}

export interface OnboardingDocument {
  id: string
  name: string
  type: "handbook" | "policy" | "form" | "training" | "certificate" | "contract"
  file_url?: string
  required: boolean
  uploaded_by?: string
  created_at: string
  updated_at: string
  uploaded_by_employee?: Employee
}

export interface OnboardingProcess {
  id: string
  employee_id?: string
  employee_name: string
  template_id?: string
  template_name: string
  start_date: string
  expected_completion_date: string
  actual_completion_date?: string
  status: "not-started" | "in-progress" | "completed" | "overdue" | "paused"
  assigned_mentor?: string
  notes?: string
  progress: number
  created_at: string
  updated_at: string
  employee?: Employee
  template?: OnboardingTemplate
  assigned_mentor_employee?: Employee
  step_completions?: StepCompletion[]
}

export interface StepCompletion {
  id: string
  process_id: string
  step_id: string
  completed_at: string
  feedback?: string
  completed_by?: string
  created_at: string
  process?: OnboardingProcess
  step?: OnboardingStep
  completed_by_employee?: Employee
}

export interface OnboardingFeedback {
  id: string
  process_id: string
  step_id?: string
  rating?: number
  feedback_text?: string
  feedback_type: "step" | "overall" | "mentor"
  submitted_by?: string
  created_at: string
  process?: OnboardingProcess
  step?: OnboardingStep
  submitted_by_employee?: Employee
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get the current authenticated user's employee record
 */
export async function getCurrentEmployee() {
  // For demo purposes, get the first employee from the database
  // In production, this would get the employee from the authenticated user
  const result = await query(`
    SELECT * FROM employees
    WHERE is_active = true
    ORDER BY created_at ASC
    LIMIT 1
  `)

  if (result.rows.length === 0) {
    // Fallback to mock employee if no employees exist
    return {
      id: '00000000-0000-0000-0000-000000000001',
      employee_code: 'EMP001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@company.com',
      department: 'Sales',
      position: 'Sales Representative',
      is_active: true,
      hourly_rate: 18.50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  return result.rows[0]
}

/**
 * Check if the current user is an admin
 */
export async function isAdmin() {
  const employee = await getCurrentEmployee()
  return employee?.position?.toLowerCase().includes('admin') || false
}

/**
 * Check if the current user is a manager
 */
export async function isManager() {
  const employee = await getCurrentEmployee()
  return employee?.position?.toLowerCase().includes('manager') || 
         employee?.position?.toLowerCase().includes('lead') || false
}

/**
 * Get employee by ID with related data
 */
export async function getEmployee(id: string) {
  const result = await query(`
    SELECT 
      e.*,
      m.first_name as manager_first_name,
      m.last_name as manager_last_name,
      m.email as manager_email
    FROM employees e
    LEFT JOIN employees m ON e.manager_id = m.id
    WHERE e.id = $1
  `, [id])

  if (result.rows.length === 0) {
    throw new Error('Employee not found')
  }

  return result.rows[0]
}

/**
 * Get all employees with optional filters
 */
export async function getEmployees(filters?: {
  department?: string
  is_active?: boolean
  position?: string
}) {
  let queryText = `
    SELECT 
      e.*,
      m.first_name as manager_first_name,
      m.last_name as manager_last_name,
      m.email as manager_email
    FROM employees e
    LEFT JOIN employees m ON e.manager_id = m.id
  `
  const params: any[] = []
  let paramIndex = 1

  if (filters?.department) {
    queryText += ` WHERE e.department = $${paramIndex}`
    params.push(filters.department)
    paramIndex++
  }
  if (filters?.is_active !== undefined) {
    queryText += filters?.department ? ` AND e.is_active = $${paramIndex}` : ` WHERE e.is_active = $${paramIndex}`
    params.push(filters.is_active)
    paramIndex++
  }
  if (filters?.position) {
    queryText += (filters?.department || filters?.is_active !== undefined) ? ` AND e.position = $${paramIndex}` : ` WHERE e.position = $${paramIndex}`
    params.push(filters.position)
  }

  queryText += ' ORDER BY e.first_name'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Create a new employee
 */
// Simple password hashing function (in production, use bcrypt or similar)
function hashPassword(password: string): string {
  try {
    const salt = bcrypt.genSaltSync(10)
    return bcrypt.hashSync(password, salt)
  } catch {
    return Buffer.from(password).toString('base64')
  }
}

// Verify password against hash
function verifyPassword(password: string, hash: string): boolean {
  if (!password || !hash) return false
  try {
    return bcrypt.compareSync(password, hash)
  } catch {
    // Fallback for legacy base64 hashes
    return Buffer.from(password).toString('base64') === hash
  }
}

// Authenticate employee by employee_code and password
export async function authenticateEmployee(employeeCode: string, password: string): Promise<Employee | null> {
  const result = await query(`
    SELECT e.*, o.name as organization_name, o.tenant_id, o.subscription_status, o.subscription_plan
    FROM employees e
    LEFT JOIN organizations o ON e.organization_id = o.id
    WHERE e.employee_code = $1 AND e.is_active = true
  `, [employeeCode])

  if (result.rows.length === 0) {
    return null
  }

  const employee = result.rows[0]

  if (!employee.password_hash) {
    return null
  }

  if (verifyPassword(password, employee.password_hash)) {
    return employee
  }

  return null
}

// Authenticate employee by email and password
export async function authenticateEmployeeByEmail(email: string, password: string): Promise<Employee | null> {
  const result = await query(`
    SELECT e.*, o.name as organization_name, o.tenant_id, o.subscription_status, o.subscription_plan
    FROM employees e
    LEFT JOIN organizations o ON e.organization_id = o.id
    WHERE e.email = $1 AND e.is_active = true
  `, [email])

  if (result.rows.length === 0) {
    return null
  }

  const employee = result.rows[0]
  
  if (!employee.password_hash) {
    return null
  }

  if (verifyPassword(password, employee.password_hash)) {
    return employee
  }

  return null
}

export async function createEmployee(employeeData: Omit<Employee, 'id' | 'created_at' | 'updated_at'> & { password?: string }) {
  console.log('createEmployee called with:', employeeData)
  
  const passwordHash = employeeData.password ? hashPassword(employeeData.password) : null
  console.log('Password hash generated:', passwordHash ? 'yes' : 'no')
  
  const result = await query(`
    INSERT INTO employees (
      employee_code, first_name, last_name, email, department, position, role,
      hire_date, manager_id, is_active, hourly_rate, max_hours_per_week, password_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *
  `, [
    employeeData.employee_code,
    employeeData.first_name,
    employeeData.last_name,
    employeeData.email,
    employeeData.department,
    employeeData.position,
    employeeData.role || 'agent',
    employeeData.hire_date,
    employeeData.manager_id,
    employeeData.is_active,
    employeeData.hourly_rate,
    employeeData.max_hours_per_week,
    passwordHash
  ])

  console.log('Employee created successfully:', result.rows[0])
  return result.rows[0]
}

/**
 * Update an employee
 */
export async function updateEmployee(id: string, employeeData: Partial<Employee>) {
  const fields = Object.keys(employeeData).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
  
  const result = await query(`
    UPDATE employees 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, ...fields.map(field => employeeData[field as keyof Employee])])

  if (result.rows.length === 0) {
    throw new Error('Employee not found')
  }

  return result.rows[0]
}

/**
 * Delete an employee
 */
export async function deleteEmployee(id: string) {
  const result = await query(`
    DELETE FROM employees 
    WHERE id = $1
    RETURNING id
  `, [id])

  if (result.rows.length === 0) {
    throw new Error('Employee not found')
  }

  return result.rows[0]
}

/**
 * Get shifts with optional filters
 */
export async function getShifts(filters?: {
  department?: string
  is_active?: boolean
}) {
  let queryText = 'SELECT * FROM shift_templates'
  const params: any[] = []
  let paramIndex = 1

  if (filters?.department) {
    queryText += ` WHERE department = $${paramIndex}`
    params.push(filters.department)
    paramIndex++
  }
  if (filters?.is_active !== undefined) {
    queryText += filters?.department ? ` AND is_active = $${paramIndex}` : ` WHERE is_active = $${paramIndex}`
    params.push(filters.is_active)
  }

  queryText += ' ORDER BY name'

  const result = await query(queryText, params)
  return result.rows
}

export async function getShift(id: string) {
  const result = await query(`
    SELECT s.*, 
           e.id as employee_id, 
           e.first_name, 
           e.last_name, 
           e.email
    FROM shift_templates s
    LEFT JOIN employees e ON s.created_by = e.id
    WHERE s.id = $1
  `, [id])
  
  return result.rows[0] || null
}

/**
 * Create a new shift
 */
export async function createShift(shiftData: Omit<Shift, 'id' | 'created_at' | 'updated_at'>) {
  const result = await query(`
    INSERT INTO shift_templates (
      name, description, start_time, end_time, department, 
      required_staff, hourly_rate, color, is_active, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    shiftData.name,
    shiftData.description,
    shiftData.start_time,
    shiftData.end_time,
    shiftData.department,
    shiftData.required_staff,
    shiftData.hourly_rate,
    shiftData.color,
    shiftData.is_active,
    shiftData.created_by
  ])

  return result.rows[0]
}

/**
 * Update a shift
 */
export async function updateShift(id: string, shiftData: Partial<Shift>) {
  const fields = Object.keys(shiftData).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
  
  const result = await query(`
    UPDATE shift_templates 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, ...fields.map(field => shiftData[field as keyof Shift])])

  if (result.rows.length === 0) {
    throw new Error('Shift not found')
  }

  return result.rows[0]
}

/**
 * Delete a shift
 */
export async function deleteShift(id: string) {
  const result = await query(`
    DELETE FROM shift_templates 
    WHERE id = $1
    RETURNING id
  `, [id])

  if (result.rows.length === 0) {
    throw new Error('Shift not found')
  }

  return result.rows[0]
}

/**
 * Get shift assignments for a specific date range
 */
export async function getShiftAssignments(filters: {
  start_date: string
  end_date: string
  employee_id?: string
  status?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      sa.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.email as employee_email,
      st.name as shift_name,
      st.start_time as shift_start_time,
      st.end_time as shift_end_time,
      aba.first_name as assigned_by_first_name,
      aba.last_name as assigned_by_last_name,
      aba.email as assigned_by_email
    FROM shift_assignments sa
    LEFT JOIN employees e ON sa.employee_id = e.id AND e.tenant_id = sa.tenant_id
    LEFT JOIN shift_templates st ON sa.template_id = st.id AND st.tenant_id = sa.tenant_id
    LEFT JOIN employees aba ON sa.assigned_by = aba.id AND aba.tenant_id = sa.tenant_id
    WHERE sa.date >= $1 AND sa.date <= $2
  `
  const params: any[] = [filters.start_date, filters.end_date]
  let paramIndex = 3

  if (filters.tenant_id) {
    queryText += ` AND sa.tenant_id = $${paramIndex}`
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters.employee_id) {
    // Check if the employee_id is a UUID or an employee code string
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.employee_id)

    if (isUuid) {
      // If it's a UUID, filter by sa.employee_id (which stores the UUID)
      queryText += ` AND sa.employee_id = $${paramIndex}`
    } else {
      // If it's an employee code string (like EMP001), filter by e.employee_code
      queryText += ` AND e.employee_code = $${paramIndex}`
    }
    params.push(filters.employee_id)
    paramIndex++
  }
  if (filters.status) {
    queryText += ` AND sa.status = $${paramIndex}`
    params.push(filters.status)
  }

  queryText += ' ORDER BY sa.date'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Create a shift assignment
 */
export async function createShiftAssignment(assignmentData: Omit<ShiftAssignment, 'id' | 'created_at' | 'updated_at'>) {
  const result = await query(`
    INSERT INTO shift_assignments (
      employee_id, template_id, date, start_time, end_time, 
      status, assigned_by, notes, is_published
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [
    assignmentData.employee_id,
    assignmentData.shift_id,
    assignmentData.date,
    assignmentData.start_time,
    assignmentData.end_time,
    assignmentData.status,
    assignmentData.assigned_by,
    assignmentData.notes,
    false // Always create as draft
  ])

  return result.rows[0]
}

/**
 * Get time entries for an employee
 */
export async function getTimeEntries(filters: {
  employee_id?: string
  start_date?: string
  end_date?: string
  status?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      te.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.email as employee_email
    FROM time_entries te
    LEFT JOIN employees e ON te.employee_id = e.id
  `
  const params: any[] = []
  let paramIndex = 1

  // Start WHERE when first condition appears; collect conditions
  const conditions: string[] = []

  if (filters.tenant_id) {
    conditions.push(`e.tenant_id = $${paramIndex}`)
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters.employee_id) {
    conditions.push(`te.employee_id = $${paramIndex}`)
    params.push(filters.employee_id)
    paramIndex++
  }
  if (filters.start_date) {
    conditions.push(`te.clock_in >= $${paramIndex}`)
    params.push(filters.start_date)
    paramIndex++
  }
  if (filters.end_date) {
    conditions.push(`te.clock_in <= $${paramIndex}`)
    params.push(filters.end_date)
    paramIndex++
  }
  if (filters.status) {
    conditions.push(`te.status = $${paramIndex}`)
    params.push(filters.status)
  }

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`
  }

  queryText += ' ORDER BY te.created_at DESC'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Create a time entry (clock in)
 */
export async function createTimeEntry(timeEntryData: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at'>) {
  const result = await query(`
    INSERT INTO time_entries (
      employee_id, shift_assignment_id, clock_in, status, 
      notes, location_lat, location_lng
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    timeEntryData.employee_id,
    timeEntryData.shift_assignment_id,
    timeEntryData.clock_in,
    timeEntryData.status,
    timeEntryData.notes,
    timeEntryData.location_lat,
    timeEntryData.location_lng
  ])

  return result.rows[0]
}

/**
 * Update a time entry (clock out, break, etc.)
 */
export async function updateTimeEntry(id: string, timeEntryData: Partial<TimeEntry>) {
  const fields = Object.keys(timeEntryData).filter(key => key !== 'id' && key !== 'created_at' && key !== 'updated_at')
  const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ')
  
  const result = await query(`
    UPDATE time_entries 
    SET ${setClause}, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, ...fields.map(field => timeEntryData[field as keyof TimeEntry])])

  if (result.rows.length === 0) {
    throw new Error('Time entry not found')
  }

  return result.rows[0]
}

/**
 * Check if an employee is currently clocked in
 */
export async function isEmployeeClockedIn(employeeId: string) {
  const result = await query(`
    SELECT id FROM time_entries 
    WHERE employee_id = $1 
    AND status = 'in-progress'
  `, [employeeId])

  return result.rows.length > 0
}

/**
 * Get current time entry for an employee
 */
export async function getCurrentTimeEntry(employeeId: string) {
  const result = await query(`
    SELECT 
      te.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.email as employee_email
    FROM time_entries te
    LEFT JOIN employees e ON te.employee_id = e.id
    WHERE te.employee_id = $1 
    AND te.status = 'in-progress'
    ORDER BY te.created_at DESC
    LIMIT 1
  `, [employeeId])

  return result.rows[0] || null
}

/**
 * Get attendance statistics for reports
 */
export async function getAttendanceStats(filters: {
  start_date: string
  end_date: string
  department?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      e.id,
      e.first_name,
      e.last_name,
      e.department,
      e.position,
      COUNT(te.id) as total_entries,
      COUNT(CASE WHEN te.status = 'completed' THEN 1 END) as completed_entries,
      SUM(te.total_hours) as total_hours,
      AVG(te.total_hours) as avg_hours_per_day,
      COUNT(CASE WHEN te.clock_in::time > '09:00:00' THEN 1 END) as late_clock_ins
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id 
      AND te.clock_in >= $1 
      AND te.clock_in <= $2
      AND (te.tenant_id = e.tenant_id)
    WHERE e.is_active = true
  `
  const params: any[] = [filters.start_date, filters.end_date]
  let paramIndex = 3

  if (filters.tenant_id) {
    queryText += ` AND e.tenant_id = $${paramIndex}`
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters.department) {
    queryText += ` AND e.department = $${paramIndex}`
    params.push(filters.department)
  }

  queryText += `
    GROUP BY e.id, e.first_name, e.last_name, e.department, e.position
    ORDER BY e.first_name
  `

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Get payroll statistics for reports
 */
export async function getPayrollStats(filters: {
  start_date: string
  end_date: string
  department?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      e.id,
      e.first_name,
      e.last_name,
      e.department,
      e.hourly_rate,
      SUM(te.total_hours) as total_hours,
      SUM(CASE WHEN te.total_hours > 8 THEN (te.total_hours - 8) * 1.5 * e.hourly_rate ELSE 0 END) as overtime_pay,
      SUM(CASE WHEN te.total_hours <= 8 THEN te.total_hours * e.hourly_rate ELSE 8 * e.hourly_rate END) as regular_pay,
      SUM(CASE WHEN te.total_hours <= 8 THEN te.total_hours * e.hourly_rate ELSE 8 * e.hourly_rate END) + 
      SUM(CASE WHEN te.total_hours > 8 THEN (te.total_hours - 8) * 1.5 * e.hourly_rate ELSE 0 END) as total_pay
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id 
      AND te.clock_in >= $1 
      AND te.clock_in <= $2
      AND te.status = 'completed'
      AND (te.tenant_id = e.tenant_id)
    WHERE e.is_active = true
  `
  const params: any[] = [filters.start_date, filters.end_date]
  let paramIndex = 3

  if (filters.tenant_id) {
    queryText += ` AND e.tenant_id = $${paramIndex}`
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters.department) {
    queryText += ` AND e.department = $${paramIndex}`
    params.push(filters.department)
  }

  queryText += `
    GROUP BY e.id, e.first_name, e.last_name, e.department, e.hourly_rate
    ORDER BY total_pay DESC
  `

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Get department statistics for reports
 */
export async function getDepartmentStats(filters: {
  start_date: string
  end_date: string
  tenant_id?: string
}) {
  const params: any[] = [filters.start_date, filters.end_date]
  let queryText = `
    SELECT 
      e.department,
      COUNT(DISTINCT e.id) as employee_count,
      SUM(te.total_hours) as total_hours,
      AVG(te.total_hours) as avg_hours_per_employee,
      SUM(CASE WHEN te.total_hours <= 8 THEN te.total_hours * e.hourly_rate ELSE 8 * e.hourly_rate END) +
      SUM(CASE WHEN te.total_hours > 8 THEN (te.total_hours - 8) * 1.5 * e.hourly_rate ELSE 0 END) as total_payroll
    FROM employees e
    LEFT JOIN time_entries te ON e.id = te.employee_id 
      AND te.clock_in >= $1 
      AND te.clock_in <= $2
      AND te.status = 'completed'
      AND (te.tenant_id = e.tenant_id)
    WHERE e.is_active = true
  `
  let paramIndex = 3

  if (filters.tenant_id) {
    queryText += ` AND e.tenant_id = $${paramIndex}`
    params.push(filters.tenant_id)
    paramIndex++
  }

  queryText += `
    GROUP BY e.department
    ORDER BY total_hours DESC
  `

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Get notifications for the current user
 */
export async function getNotifications(limit = 50) {
  // For demo purposes, return mock notifications
  return [
    {
      id: '1',
      user_id: 'demo-user',
      title: 'Welcome to RotaClock',
      message: 'Your account has been set up successfully',
      type: 'info',
      read: false,
      created_at: new Date().toISOString()
    }
  ]
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  await query(`
    UPDATE notifications 
    SET read = true 
    WHERE id = $1
  `, [notificationId])
}

/**
 * Create a new notification
 */
export async function createNotification(notification: Omit<Notification, 'id' | 'created_at'>) {
  const result = await query(`
    INSERT INTO notifications (user_id, title, message, type, read, action_url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    notification.user_id,
    notification.title,
    notification.message,
    notification.type,
    notification.read,
    notification.action_url
  ])

  return result.rows[0]
}

/**
 * Get leave requests with filters
 */
export async function getLeaveRequests(filters?: {
  employee_id?: string
  status?: string
  type?: string
  start_date?: string
  end_date?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      lr.*,
      e.first_name as employee_first_name,
      e.last_name as employee_last_name,
      e.email as employee_email,
      aba.first_name as approved_by_first_name,
      aba.last_name as approved_by_last_name,
      aba.email as approved_by_email
    FROM leave_requests lr
    LEFT JOIN employees e ON lr.employee_id = e.id
    LEFT JOIN employees aba ON lr.approved_by = aba.id
  `
  const params: any[] = []
  let paramIndex = 1

  // Add tenant filtering if provided
  if (filters?.tenant_id) {
    queryText += ` WHERE lr.tenant_id = $${paramIndex}`
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters?.employee_id) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filters.employee_id)
    const hasExistingConditions = filters?.tenant_id
    if (isUuid) {
      queryText += hasExistingConditions ? ` AND lr.employee_id = $${paramIndex}` : ` WHERE lr.employee_id = $${paramIndex}`
      params.push(filters.employee_id)
    } else {
      queryText += hasExistingConditions ? ` AND e.employee_code = $${paramIndex}` : ` WHERE e.employee_code = $${paramIndex}`
      params.push(filters.employee_id)
    }
    paramIndex++
  }
  if (filters?.status) {
    const hasExistingConditions = filters?.tenant_id || filters?.employee_id
    queryText += hasExistingConditions ? ` AND lr.status = $${paramIndex}` : ` WHERE lr.status = $${paramIndex}`
    params.push(filters.status)
    paramIndex++
  }
  if (filters?.type) {
    const hasExistingConditions = filters?.tenant_id || filters?.employee_id || filters?.status
    queryText += hasExistingConditions ? ` AND lr.type = $${paramIndex}` : ` WHERE lr.type = $${paramIndex}`
    params.push(filters.type)
    paramIndex++
  }
  if (filters?.start_date) {
    const hasExistingConditions = filters?.tenant_id || filters?.employee_id || filters?.status || filters?.type
    queryText += hasExistingConditions ? ` AND lr.start_date >= $${paramIndex}` : ` WHERE lr.start_date >= $${paramIndex}`
    params.push(filters.start_date)
    paramIndex++
  }
  if (filters?.end_date) {
    const hasExistingConditions = filters?.tenant_id || filters?.employee_id || filters?.status || filters?.type || filters?.start_date
    queryText += hasExistingConditions ? ` AND lr.end_date <= $${paramIndex}` : ` WHERE lr.end_date <= $${paramIndex}`
    params.push(filters.end_date)
  }

  queryText += ' ORDER BY lr.created_at DESC'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Create a leave request
 */
export async function createLeaveRequest(leaveData: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at' | 'status'>, tenantId?: string) {
  const result = await query(`
    INSERT INTO leave_requests (
      employee_id, type, start_date, end_date, days_requested, reason, status${tenantId ? ', tenant_id' : ''}
    ) VALUES ($1, $2, $3, $4, $5, $6, 'pending'${tenantId ? ', $7' : ''})
    RETURNING *
  `, [
    leaveData.employee_id,
    leaveData.type,
    leaveData.start_date,
    leaveData.end_date,
    leaveData.days_requested,
    leaveData.reason,
    ...(tenantId ? [tenantId] as any[] : [])
  ])

  return result.rows[0]
}

/**
 * Create a shift swap request
 */
export async function createShiftSwap(swapData: Omit<ShiftSwap, 'id' | 'created_at' | 'updated_at' | 'status'>, tenantId?: string) {
  const result = await query(`
    INSERT INTO shift_swaps (
      requester_id, target_id, original_shift_id, requested_shift_id, reason, status${tenantId ? ', tenant_id' : ''}
    ) VALUES ($1, $2, $3, $4, $5, 'pending'${tenantId ? ', $6' : ''})
    RETURNING *
  `, [
    swapData.requester_id,
    swapData.target_id,
    swapData.original_shift_id,
    swapData.requested_shift_id,
    swapData.reason,
    ...(tenantId ? [tenantId] as any[] : [])
  ])

  return result.rows[0]
}

/**
 * Get shift swap requests
 */
export async function getShiftSwaps(filters?: {
  requester_id?: string
  target_id?: string
  status?: string
  tenant_id?: string
}) {
  let queryText = `
    SELECT 
      ss.*,
      r.first_name as requester_first_name,
      r.last_name as requester_last_name,
      r.email as requester_email,
      t.first_name as target_first_name,
      t.last_name as target_last_name,
      t.email as target_email,
      aba.first_name as approved_by_first_name,
      aba.last_name as approved_by_last_name,
      aba.email as approved_by_email
    FROM shift_swaps ss
    LEFT JOIN employees r ON ss.requester_id = r.id
    LEFT JOIN employees t ON ss.target_id = t.id
    LEFT JOIN employees aba ON ss.approved_by = aba.id
  `
  const params: any[] = []
  const conditions: string[] = []
  let paramIndex = 1

  if (filters?.tenant_id) {
    conditions.push(`r.tenant_id = $${paramIndex}`)
    params.push(filters.tenant_id)
    paramIndex++
    conditions.push(`t.tenant_id = $${paramIndex}`)
    params.push(filters.tenant_id)
    paramIndex++
  }

  if (filters?.requester_id) {
    conditions.push(`ss.requester_id = $${paramIndex}`)
    params.push(filters.requester_id)
    paramIndex++
  }
  if (filters?.target_id) {
    conditions.push(`ss.target_id = $${paramIndex}`)
    params.push(filters.target_id)
    paramIndex++
  }
  if (filters?.status) {
    conditions.push(`ss.status = $${paramIndex}`)
    params.push(filters.status)
  }

  if (conditions.length > 0) {
    queryText += ` WHERE ${conditions.join(' AND ')}`
  }

  queryText += ' ORDER BY ss.created_at DESC'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Get company holidays
 */
export async function getCompanyHolidays(filters?: {
  start_date?: string
  end_date?: string
  is_active?: boolean
}) {
  let queryText = 'SELECT * FROM company_holidays'
  const params: any[] = []
  let paramIndex = 1

  if (filters?.start_date) {
    queryText += ` WHERE date >= $${paramIndex}`
    params.push(filters.start_date)
    paramIndex++
  }
  if (filters?.end_date) {
    queryText += filters?.start_date ? ` AND date <= $${paramIndex}` : ` WHERE date <= $${paramIndex}`
    params.push(filters.end_date)
    paramIndex++
  }
  if (filters?.is_active !== undefined) {
    queryText += (filters?.start_date || filters?.end_date) ? ` AND is_active = $${paramIndex}` : ` WHERE is_active = $${paramIndex}`
    params.push(filters.is_active)
  }

  queryText += ' ORDER BY date'

  const result = await query(queryText, params)
  return result.rows
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format time for display
 */
export function formatTime(time: string) {
  return new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

/**
 * Format date for display
 */
export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Calculate hours between two times
 */
export function calculateHours(startTime: string, endTime: string): number {
  const start = new Date(`2000-01-01T${startTime}`)
  const end = new Date(`2000-01-01T${endTime}`)
  const diffMs = end.getTime() - start.getTime()
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100
}

/**
 * Get status color for badges
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
    case 'confirmed':
    case 'completed':
      return 'default'
    case 'denied':
    case 'cancelled':
      return 'destructive'
    case 'pending':
    case 'assigned':
    case 'in-progress':
      return 'secondary'
    case 'overdue':
      return 'destructive'
    default:
      return 'outline'
  }
}

// =====================================================
// SHIFT LOGS AND ATTENDANCE TRACKING
// =====================================================

export interface ShiftLog {
  id: string
  employee_id: string
  shift_assignment_id?: string
  clock_in_time: string
  clock_out_time?: string
  total_shift_hours?: number
  break_time_used: number
  max_break_allowed: number
  is_late: boolean
  is_no_show: boolean
  late_minutes: number
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  employee?: Employee
  shift_assignment?: ShiftAssignment
}

export interface BreakLog {
  id: string
  shift_log_id: string
  employee_id: string
  break_start_time: string
  break_end_time?: string
  break_duration?: number
  break_type: 'lunch' | 'rest' | 'other'
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  shift_log?: ShiftLog
  employee?: Employee
}

export interface AttendanceSummary {
  id: string
  employee_id: string
  date: string
  total_shifts: number
  total_hours_worked: number
  total_break_time: number
  late_count: number
  no_show_count: number
  on_time_count: number
  created_at: string
  updated_at: string
  employee?: Employee
}

// Create shift logs tables
export async function createShiftLogsTables() {
  try {
    console.log('⚠️ Skipping creation of legacy shift_logs/break_logs tables; using time_entries instead.');
    return true;
  } catch (error) {
    console.error('Error (should not occur):', error);
    return false;
  }
}

// Create a new shift log
export async function createShiftLog(shiftLogData: Omit<ShiftLog, 'id' | 'created_at' | 'updated_at'>) {
  const { employee_id, shift_assignment_id, clock_in_time } = shiftLogData;
  // Resolve tenant from employee
  const emp = await query(`SELECT tenant_id FROM employees WHERE id = $1`, [employee_id])
  const tenant_id = emp.rows[0]?.tenant_id || null

  try {
    const result = await query(
      `INSERT INTO time_entries (
        employee_id, shift_assignment_id, date, clock_in, status, tenant_id
      ) VALUES ($1, $2, $3, $4, 'in-progress', $5) RETURNING *`,
      [employee_id, shift_assignment_id || null, clock_in_time.split('T')[0], clock_in_time, tenant_id]
    );
    return result.rows[0];
  } catch (err: any) {
    console.error('Error creating shift log:', err)
    throw err
  }
}

// Update shift log (clock out)
export async function updateShiftLog(id: string, shiftLogData: Partial<ShiftLog>) {
  const { clock_out_time, total_shift_hours, break_time_used, status } = shiftLogData;
  const result = await query(
    `UPDATE time_entries SET 
      clock_out = COALESCE($1, clock_out), 
      total_hours = COALESCE($2, total_hours), 
      break_hours = COALESCE($3, break_hours), 
      status = COALESCE($4, status),
      updated_at = NOW()
    WHERE id = $5 RETURNING *`,
    [clock_out_time || null, total_shift_hours || null, break_time_used || null, status || 'completed', id]
  );
  return result.rows[0];
}

// Get shift logs for an employee
export async function getShiftLogs(filters: { employee_id?: string; start_date?: string; end_date?: string; status?: string; tenant_id?: string; }) {
  const conditions: string[] = []
  const params: any[] = []
  let i = 0
  if (filters.tenant_id) { i++; conditions.push(`e.tenant_id = $${i}`); params.push(filters.tenant_id) }
  if (filters.employee_id) { i++; conditions.push(`te.employee_id = $${i}`); params.push(filters.employee_id) }
  if (filters.start_date) { i++; conditions.push(`DATE(te.clock_in) >= $${i}`); params.push(filters.start_date) }
  if (filters.end_date) { i++; conditions.push(`DATE(te.clock_in) <= $${i}`); params.push(filters.end_date) }
  if (filters.status) { i++; conditions.push(`te.status = $${i}`); params.push(filters.status) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const res = await query(
    `SELECT te.*, e.first_name, e.last_name, e.employee_code as emp_code, e.tenant_id as tenant_id
     FROM time_entries te
     LEFT JOIN employees e ON te.employee_id = e.id
     ${where}
     ORDER BY te.clock_in DESC`,
     params
  )
  return res.rows
}

// Create a break log
export async function createBreakLog(breakLogData: Omit<BreakLog, 'id' | 'created_at' | 'updated_at'>) {
  const { shift_log_id, employee_id, break_start_time } = breakLogData
  // represent an active break by setting status='break' and break_start
  const res = await query(
    `UPDATE time_entries SET status='break', break_start = $1, updated_at = NOW()
     WHERE id = $2 AND employee_id = $3 RETURNING *`,
    [break_start_time, shift_log_id, employee_id]
  )
  return res.rows[0]
}

// Update break log (end break)
export async function updateBreakLog(id: string, breakLogData: Partial<BreakLog>) {
  const { break_end_time, break_duration, status } = breakLogData
  const res = await query(
    `UPDATE time_entries SET break_end = COALESCE($1, break_end), break_hours = COALESCE($2, break_hours), status = COALESCE($3, status), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [break_end_time || null, break_duration || null, status || 'in-progress', id]
  )
  return res.rows[0]
}

// Get break logs with filters
export async function getBreakLogs(filters: { employee_id?: string; shift_log_id?: string; start_date?: string; end_date?: string; status?: string; }) {
  const conditions: string[] = []
  const params: any[] = []
  let i = 0
  if (filters.employee_id) { i++; conditions.push(`te.employee_id = $${i}`); params.push(filters.employee_id) }
  if (filters.shift_log_id) { i++; conditions.push(`te.id = $${i}`); params.push(filters.shift_log_id) }
  if (filters.start_date) { i++; conditions.push(`DATE(te.break_start) >= $${i}`); params.push(filters.start_date) }
  if (filters.end_date) { i++; conditions.push(`DATE(te.break_start) <= $${i}`); params.push(filters.end_date) }
  if (filters.status) { i++; conditions.push(`te.status = $${i}`); params.push(filters.status) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const res = await query(
    `SELECT te.*, e.first_name, e.last_name
     FROM time_entries te
     LEFT JOIN employees e ON te.employee_id = e.id
     ${where}
     ORDER BY te.break_start DESC`,
    params
  )
  return res.rows
}

// Get current active break for an employee
export async function getCurrentBreak(employeeId: string, tenantId?: string) {
  const params: any[] = [employeeId]
  let tenantClause = ''
  if (tenantId) {
    params.push(tenantId)
    tenantClause = 'AND e.tenant_id = $2'
  }
  const res = await query(
    `SELECT te.* FROM time_entries te
     LEFT JOIN employees e ON te.employee_id = e.id
     WHERE te.employee_id = $1 AND te.status = 'break' ${tenantClause}
     ORDER BY te.break_start DESC LIMIT 1`,
    params
  )
  return res.rows[0] || null
}

// Update attendance summary for a date
export async function updateAttendanceSummary(employeeId: string, date: string) {
  // Get all shift logs for the employee on the given date
  const shiftLogs = await getShiftLogs({
    employee_id: employeeId,
    start_date: date,
    end_date: date
  });
  
  let total_shifts = 0;
  let total_hours_worked = 0;
  let total_break_time = 0;
  let late_count = 0;
  let no_show_count = 0;
  let on_time_count = 0;
  
  for (const shift of shiftLogs) {
    total_shifts++;
    total_hours_worked += shift.total_shift_hours || 0;
    total_break_time += shift.break_time_used || 0;
    
    if (shift.is_no_show) {
      no_show_count++;
    } else if (shift.is_late) {
      late_count++;
    } else {
      on_time_count++;
    }
  }
  
  // Upsert attendance summary
  await query(
    `INSERT INTO attendance_summary (
      employee_id, date, total_shifts, total_hours_worked, total_break_time,
      late_count, no_show_count, on_time_count
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (employee_id, date) DO UPDATE SET
      total_shifts = EXCLUDED.total_shifts,
      total_hours_worked = EXCLUDED.total_hours_worked,
      total_break_time = EXCLUDED.total_break_time,
      late_count = EXCLUDED.late_count,
      no_show_count = EXCLUDED.no_show_count,
      on_time_count = EXCLUDED.on_time_count,
      updated_at = NOW()`,
    [employeeId, date, total_shifts, total_hours_worked, total_break_time, late_count, no_show_count, on_time_count]
  );
}

// Get attendance summary for reporting
export async function getAttendanceSummary(filters: {
  start_date: string
  end_date: string
  employee_id?: string
  department?: string
}) {
  let conditions = ['as.date >= $1', 'as.date <= $2'];
  let params = [filters.start_date, filters.end_date];
  let paramCount = 2;
  
  if (filters.employee_id) {
    paramCount++;
    conditions.push(`as.employee_id = $${paramCount}`);
    params.push(filters.employee_id);
  }
  
  if (filters.department) {
    paramCount++;
    conditions.push(`e.department = $${paramCount}`);
    params.push(filters.department);
  }
  
  const result = await query(
    `SELECT as.*, e.first_name, e.last_name, e.employee_code as emp_id, e.department
     FROM attendance_summary as
     LEFT JOIN employees e ON as.employee_id = e.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY as.date DESC, e.first_name, e.last_name`,
    params
  );
  
  return result.rows;
}

/**
 * Check if an employee is currently clocked in (by email)
 */
export async function isEmployeeClockedInByEmail(email: string) {
  const result = await query(`
    SELECT te.id FROM time_entries te
    JOIN employees e ON te.employee_id = e.id
    WHERE e.email = $1 
    AND te.status = 'in-progress'
  `, [email])

  return result.rows.length > 0
}

/**
 * Get shift assignments by email
 */
export async function getShiftAssignmentsByEmail(filters: {
  start_date: string
  end_date: string
  email: string
  status?: string
}) {
  let queryText = `
    SELECT 
      sa.id,
      sa.employee_id,
      sa.template_id,
      sa.date,
      sa.status,
      sa.notes,
      st.name as shift_name,
      st.start_time as shift_start_time,
      st.end_time as shift_end_time
    FROM shift_assignments sa
    JOIN employees e ON sa.employee_id = e.id
    JOIN shift_templates st ON sa.template_id = st.id
    WHERE sa.date >= $1 AND sa.date <= $2 AND e.email = $3
  `
  const params: any[] = [filters.start_date, filters.end_date, filters.email]
  let paramIndex = 4

  if (filters.status) {
    queryText += ` AND sa.status = $${paramIndex}`
    params.push(filters.status)
  }

  queryText += ' ORDER BY sa.date'

  const result = await query(queryText, params)
  return result.rows
}

/**
 * Create a shift log by email
 */
export async function createShiftLogByEmail(shiftLogData: {
  email: string
  shift_assignment_id?: string
  clock_in_time: string
  max_break_allowed?: number
}) {
  const { email, shift_assignment_id, clock_in_time, max_break_allowed = 1.0 } = shiftLogData;
  
  // Get employee UUID by email
  const employeeResult = await query(`
    SELECT id, tenant_id FROM employees WHERE email = $1
  `, [email])
  
  if (employeeResult.rows.length === 0) {
    throw new Error('Employee not found')
  }
  
  const employee_id = employeeResult.rows[0].id
  const tenant_id = employeeResult.rows[0].tenant_id
  
  // Get the assigned shift to check for lateness
  let is_late = false;
  let is_no_show = false;
  let late_minutes = 0;
  
  if (shift_assignment_id) {
    const shiftAssignment = await query(
      'SELECT sa.*, st.start_time FROM shift_assignments sa JOIN shift_templates st ON sa.template_id = st.id WHERE sa.id = $1',
      [shift_assignment_id]
    );
    
    if (shiftAssignment.rows.length > 0) {
      const assignment = shiftAssignment.rows[0];
      const shiftStartTime = new Date(`${assignment.date}T${assignment.start_time || assignment.shift_start_time}`);
      const clockInTime = new Date(clock_in_time);
      const minutesLate = Math.floor((clockInTime.getTime() - shiftStartTime.getTime()) / (1000 * 60));
      
      if (minutesLate > 30) {
        is_no_show = true;
        late_minutes = minutesLate;
      } else if (minutesLate > 5) {
        is_late = true;
        late_minutes = minutesLate;
      }
    }
  }
  
  try {
    const result = await query(
      `INSERT INTO time_entries (
        employee_id, shift_assignment_id, date, clock_in, status, tenant_id
      ) VALUES ($1, $2, $3, $4, 'in-progress', $5) RETURNING *`,
      [employee_id, shift_assignment_id || null, clock_in_time.split('T')[0], clock_in_time, tenant_id]
    );
    return result.rows[0]
  } catch (err: any) {
    console.error('Error creating time entry:', err)
    throw err
  }
}

/**
 * Get employee by email
 */
export async function getEmployeeByEmail(email: string) {
  const result = await query(`
    SELECT id, employee_code as employee_id, first_name, last_name, email, department, job_position, role, team_id, tenant_id, organization_id, is_active
    FROM employees WHERE email = $1 AND is_active = true
  `, [email])
  
  return result.rows[0] || null
}

// =====================================================
// TEAM LEAD HELPER FUNCTIONS
// =====================================================

/**
 * Get team by team lead ID
 */
export async function getTeamByLead(leadId: string) {
  const result = await query(`
    SELECT t.* 
    FROM teams t 
    WHERE t.team_lead_id = $1 AND t.is_active = true
    ORDER BY t.created_at ASC
    LIMIT 1
  `, [leadId])
  
  return result.rows[0] || null
}

/**
 * Get team members by team ID
 */
export async function getTeamMembers(teamId: string) {
  const result = await query(`
    SELECT e.*, ta.assigned_date, ta.is_active as assignment_active
    FROM employees e
    JOIN team_assignments ta ON e.id = ta.employee_id
    WHERE ta.team_id = $1 AND ta.is_active = true AND e.is_active = true
    ORDER BY e.first_name, e.last_name
  `, [teamId])
  
  return result.rows
}

/**
 * Check if employee belongs to team lead's team
 */
export async function isEmployeeInTeamLeadTeam(leadId: string, employeeId: string) {
  const result = await query(`
    SELECT 1 
    FROM teams t
    JOIN team_assignments ta ON t.id = ta.team_id
    WHERE t.team_lead_id = $1 
      AND ta.employee_id = $2 
      AND t.is_active = true 
      AND ta.is_active = true
    LIMIT 1
  `, [leadId, employeeId])
  
  return result.rows.length > 0
}

/**
 * Add employee to team (for team lead operations)
 */
export async function addEmployeeToTeam(teamId: string, employeeId: string) {
  // Check if employee is already in the team
  const existingResult = await query(`
    SELECT 1 FROM team_assignments 
    WHERE team_id = $1 AND employee_id = $2 AND is_active = true
  `, [teamId, employeeId])
  
  if (existingResult.rows.length > 0) {
    throw new Error('Employee is already a member of this team')
  }
  
  // Add to team_assignments
  await query(`
    INSERT INTO team_assignments (team_id, employee_id, assigned_date, is_active)
    VALUES ($1, $2, CURRENT_DATE, true)
  `, [teamId, employeeId])
  
  // Update employee's team_id
  await query(`
    UPDATE employees SET team_id = $1, updated_at = NOW()
    WHERE id = $2
  `, [teamId, employeeId])
  
  return true
}

/**
 * Remove employee from team (for team lead operations)
 */
export async function removeEmployeeFromTeam(teamId: string, employeeId: string) {
  // Deactivate team assignment
  await query(`
    UPDATE team_assignments 
    SET is_active = false, updated_at = NOW()
    WHERE team_id = $1 AND employee_id = $2
  `, [teamId, employeeId])
  
  // Clear employee's team_id if it matches
  await query(`
    UPDATE employees 
    SET team_id = NULL, updated_at = NOW()
    WHERE id = $2 AND team_id = $1
  `, [teamId, employeeId])
  
  return true
}
