import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { sendEmail, buildOrgVerificationEmail, buildWelcomeEmail } from '@/lib/email'

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:QlUXSBsWFuwjhodaivUXTUXDuQhWigHL@metro.proxy.rlwy.net:36516/railway',
  ssl: { rejectUnauthorized: false }
})

interface OrganizationSignupData {
  organizationName: string
  organizationEmail: string
  organizationPhone: string
  organizationAddress?: string
  organizationCity?: string
  organizationState?: string
  organizationCountry: string
  organizationIndustry: string
  organizationSize: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPhone: string
  adminPassword: string
  selectedPlan: string
}

export async function POST(request: NextRequest) {
  try {
    const body: OrganizationSignupData = await request.json()
    const requiredFields = [
      'organizationName','organizationEmail','organizationPhone','organizationIndustry','organizationSize',
      'adminFirstName','adminLastName','adminEmail','adminPhone','adminPassword','selectedPlan'
    ]
    for (const field of requiredFields) {
      if (!body[field as keyof OrganizationSignupData]) {
        return NextResponse.json({ success: false, error: `Missing required field: ${field}` }, { status: 400 })
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.organizationEmail) || !emailRegex.test(body.adminEmail)) {
      return NextResponse.json({ success: false, error: 'Invalid email format' }, { status: 400 })
    }
    if (body.adminPassword.length < 8) {
      return NextResponse.json({ success: false, error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    const existingOrg = await pool.query('SELECT id FROM organizations WHERE email = $1', [body.organizationEmail])
    if (existingOrg.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Organization with this email already exists' }, { status: 409 })
    }

    const existingAdmin = await pool.query('SELECT id FROM employees WHERE email = $1', [body.adminEmail])
    if (existingAdmin.rows.length > 0) {
      return NextResponse.json({ success: false, error: 'Admin user with this email already exists' }, { status: 409 })
    }

    const tenantId = generateTenantId(body.organizationName)
    const slug = generateSlug(body.organizationName)

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const organizationResult = await client.query(`
        INSERT INTO organizations (
          tenant_id,name,slug,email,phone,address,city,state,country,industry,company_size,subscription_status,subscription_plan,trial_start_date,trial_end_date,is_verified,is_active
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'trial',$12,NOW(), NOW() + INTERVAL '30 days', false, true)
        RETURNING id, tenant_id
      `, [
        tenantId,
        body.organizationName,
        slug,
        body.organizationEmail,
        body.organizationPhone,
        body.organizationAddress || null,
        body.organizationCity || null,
        body.organizationState || null,
        body.organizationCountry,
        body.organizationIndustry,
        body.organizationSize,
        body.selectedPlan,
      ])

      const organization = organizationResult.rows[0]
      const hashedPassword = await bcrypt.hash(body.adminPassword, 12)

      const adminResult = await client.query(`
        INSERT INTO employees (
          id, employee_code, first_name, last_name, email, phone, password_hash, role, is_active, tenant_id, organization_id, department, job_position, hire_date, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'admin', true, $8, $9, $10, $11, CURRENT_DATE, NOW(), NOW())
        RETURNING id, employee_code, first_name, last_name, email, role
      `, [
        uuidv4(),
        generateEmployeeCode(body.adminFirstName, body.adminLastName),
        body.adminFirstName,
        body.adminLastName,
        body.adminEmail,
        body.adminPhone,
        hashedPassword,
        tenantId,
        organization.id,
        'Administration',
        'Owner',
      ])

      const admin = adminResult.rows[0]

      // Create default location for the organization
      const defaultLocationResult = await client.query(`
        INSERT INTO locations (tenant_id, organization_id, name, description, is_active, created_by)
        VALUES ($1, $2, $3, $4, true, $5)
        RETURNING id, name
      `, [
        tenantId,
        organization.id,
        body.organizationName ? `${body.organizationName} Headquarters` : 'Main Office',
        'Default location created during organization setup',
        admin.id
      ])

      const defaultLocation = defaultLocationResult.rows[0]

      // Update admin employee with default location
      await client.query(`
        UPDATE employees 
        SET location_id = $1, updated_at = NOW()
        WHERE id = $2
      `, [defaultLocation.id, admin.id])

      await client.query(`
        INSERT INTO organization_admins (organization_id, user_id, role, permissions)
        VALUES ($1, $2, 'owner', $3)
      `, [organization.id, admin.id, JSON.stringify({ manage_employees: true, manage_shifts: true, view_reports: true, manage_billing: true, manage_settings: true })])

      const currentDate = new Date()
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
      await client.query(`
        INSERT INTO payroll_periods (period_name, start_date, end_date, status, tenant_id, organization_id)
        VALUES ($1, $2, $3, 'active', $4, $5)
      `, [`${currentDate.toLocaleString('default', { month: 'long' })} ${currentDate.getFullYear()}`, startOfMonth, endOfMonth, tenantId, organization.id])

      await client.query('COMMIT')

      // Send verification and welcome emails (best-effort)
      try {
        const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.rotaclock.com'}/api/organizations/verify?tenant_id=${encodeURIComponent(tenantId)}`
        const v = buildOrgVerificationEmail({ orgName: body.organizationName, verifyUrl })
        await sendEmail({ to: body.organizationEmail, subject: v.subject, html: v.html })

        const w = buildWelcomeEmail({ orgName: body.organizationName, email: body.adminEmail, loginUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.rotaclock.com'}/login` })
        await sendEmail({ to: body.adminEmail, subject: w.subject, html: w.html })
      } catch (e) {
        console.warn('Email sending failed', e)
      }

      return NextResponse.json({
        success: true,
        message: 'Organization created successfully. Verification email sent.',
        data: {
          organization: { id: organization.id, tenant_id: organization.tenant_id, name: body.organizationName, slug, email: body.organizationEmail, subscription_status: 'trial', subscription_plan: body.selectedPlan },
          admin: { id: admin.id, employee_code: admin.employee_code, first_name: admin.first_name, last_name: admin.last_name, email: admin.email, role: admin.role },
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Organization signup error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

function generateTenantId(organizationName: string): string {
  const base = organizationName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
  const timestamp = Date.now().toString(36)
  return `${base}-${timestamp}`
}

function generateSlug(organizationName: string): string {
  return organizationName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().substring(0, 50)
}

function generateEmployeeCode(firstName: string, lastName: string): string {
  const prefix = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
  const timestamp = Date.now().toString().slice(-6)
  return `${prefix}${timestamp}`
}
