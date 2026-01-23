import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LandlordData {
  full_name: string
  phone: string
  email?: string
  house_address?: string
  zone?: string
  occupancy_type: 'owner' | 'tenant'
  date_of_birth?: string
  wedding_anniversary?: string
  celebrate_opt_in?: boolean | string
  onboarding_status?: string
  status?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  normalizedData?: LandlordData
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Bulk import request received');
    console.log('Authorization header:', req.headers.get('Authorization') ? 'Present' : 'Missing');
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    console.log('User auth result:', { user: user ? 'found' : 'not found', error: userError });

    if (userError || !user) {
      console.log('Authentication failed:', { userError, user });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is admin
    const { data: adminProfile, error: adminError } = await supabaseClient
      .from('admin_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (adminError || !adminProfile) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { landlords }: { landlords: LandlordData[] } = await req.json()

    if (!landlords || !Array.isArray(landlords)) {
      return new Response(JSON.stringify({ error: 'Invalid request: landlords array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const totalRows = landlords.length
    let successfulRows = 0
    let skippedRows: { rowNumber: number, reason: string, data: LandlordData }[] = []

    // Process each landlord
    const validLandlords: LandlordData[] = []

    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i]
      const validation = validateLandlord(landlord)

      if (!validation.isValid) {
        skippedRows.push({
          rowNumber: i + 1,
          reason: validation.errors.join('; '),
          data: landlord
        })
        continue
      }

      // Check for duplicate phone
      const normalizedPhone = normalizePhone(validation.normalizedData!.phone)
      const { data: existing } = await supabaseClient
        .from('landlords')
        .select('id')
        .eq('phone', normalizedPhone)
        .single()

      if (existing) {
        skippedRows.push({
          rowNumber: i + 1,
          reason: 'Phone number already exists',
          data: landlord
        })
        continue
      }

      validLandlords.push(validation.normalizedData!)
    }

    // Insert valid landlords
    if (validLandlords.length > 0) {
      const { data, error: insertError } = await supabaseClient
        .from('landlords')
        .insert(validLandlords)
        .select()

      if (insertError) {
        console.error('Insert error:', insertError)
        return new Response(JSON.stringify({ error: 'Failed to insert landlords' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      successfulRows = data.length
    }

    // Log activity
    const { data: activityLog, error: logError } = await supabaseClient
      .from('activity_logs')
      .insert({
        admin_id: adminProfile.id,
        action_type: 'landlord_csv_import',
        total_rows: totalRows,
        successful_rows: successfulRows,
        skipped_rows: skippedRows.length,
        details: {
          successful_rows: successfulRows,
          skipped_rows: skippedRows.length
        }
      })
      .select()
      .single()

    if (logError) {
      console.error('Activity log error:', logError)
    }

    // Log skipped rows details
    if (skippedRows.length > 0 && activityLog) {
      const skippedDetails = skippedRows.map(skip => ({
        activity_log_id: activityLog.id,
        row_number: skip.rowNumber,
        failure_reason: skip.reason,
        row_data: skip.data
      }))

      const { error: detailsError } = await supabaseClient
        .from('activity_log_details')
        .insert(skippedDetails)

      if (detailsError) {
        console.error('Activity log details error:', detailsError)
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_rows: totalRows,
      successful_rows: successfulRows,
      skipped_rows: skippedRows.length,
      skipped_details: skippedRows
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Bulk import error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, leading zeros
  let normalized = phone.replace(/[\s\-]/g, '').replace(/^0+/, '')

  // Add +234 if it starts with digits without +
  if (!normalized.startsWith('+') && /^\d+$/.test(normalized)) {
    normalized = '+234' + normalized
  }

  return normalized
}

function validateLandlord(landlord: LandlordData): ValidationResult {
  const errors: string[] = []
  const normalized: LandlordData = { ...landlord }

  // Required fields
  if (!landlord.full_name || landlord.full_name.trim() === '') {
    errors.push('full_name is required')
  } else {
    normalized.full_name = landlord.full_name.trim()
  }

  if (!landlord.phone || landlord.phone.trim() === '') {
    errors.push('phone is required')
  } else {
    normalized.phone = normalizePhone(landlord.phone.trim())
    // Basic phone validation after normalization
    if (!/^(\+234|234)\d{10}$/.test(normalized.phone)) {
      errors.push('invalid phone number format')
    }
  }

  if (!landlord.occupancy_type || !['owner', 'tenant'].includes(landlord.occupancy_type)) {
    errors.push('occupancy_type must be owner or tenant')
  }

  // Optional fields
  if (landlord.email && landlord.email.trim() !== '') {
    normalized.email = landlord.email.trim()
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalized.email)) {
      errors.push('invalid email format')
    }
  } else {
    normalized.email = undefined
  }

  if (landlord.house_address && landlord.house_address.trim() !== '') {
    normalized.house_address = landlord.house_address.trim()
  } else {
    normalized.house_address = undefined
  }

  if (landlord.zone && landlord.zone.trim() !== '') {
    normalized.zone = landlord.zone.trim()
  } else {
    normalized.zone = 'Zone D'
  }

  // Date validations
  if (landlord.date_of_birth && landlord.date_of_birth.trim() !== '') {
    const dateStr = landlord.date_of_birth.trim()
    if (!isValidMonthDay(dateStr)) {
      errors.push('invalid date_of_birth format (DD-MM or MM-DD)')
    } else {
      normalized.date_of_birth = formatMonthDay(dateStr)
    }
  } else {
    normalized.date_of_birth = undefined
  }

  if (landlord.wedding_anniversary && landlord.wedding_anniversary.trim() !== '') {
    const dateStr = landlord.wedding_anniversary.trim()
    if (!isValidMonthDay(dateStr)) {
      errors.push('invalid wedding_anniversary format (DD-MM or MM-DD)')
    } else {
      normalized.wedding_anniversary = formatMonthDay(dateStr)
    }
  } else {
    normalized.wedding_anniversary = undefined
  }

  // Boolean fields
  if (landlord.celebrate_opt_in !== undefined) {
    if (typeof landlord.celebrate_opt_in === 'string') {
      normalized.celebrate_opt_in = landlord.celebrate_opt_in.toLowerCase() === 'true'
    } else {
      normalized.celebrate_opt_in = Boolean(landlord.celebrate_opt_in)
    }
  } else {
    normalized.celebrate_opt_in = false
  }

  // Defaults
  normalized.onboarding_status = 'pending'
  normalized.status = 'active'

  return {
    isValid: errors.length === 0,
    errors,
    normalizedData: normalized
  }
}

function isValidMonthDay(dateStr: string): boolean {
  // Accept DD-MM or MM-DD
  const parts = dateStr.split('-')
  if (parts.length !== 2) return false

  const num1 = parseInt(parts[0], 10)
  const num2 = parseInt(parts[1], 10)

  if (isNaN(num1) || isNaN(num2)) return false

  // Check if it's DD-MM (day 1-31, month 1-12) or MM-DD (month 1-12, day 1-31)
  const isDDMM = num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12
  const isMMDD = num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31

  return isDDMM || isMMDD
}

function formatMonthDay(dateStr: string): string {
  const parts = dateStr.split('-')
  const num1 = parseInt(parts[0], 10)
  const num2 = parseInt(parts[1], 10)

  // Determine format: if first number > 12, it's DD-MM, else MM-DD
  if (num1 > 12) {
    // DD-MM, convert to MM-DD
    return `${num2.toString().padStart(2, '0')}-${num1.toString().padStart(2, '0')}`
  } else {
    // MM-DD
    return `${num1.toString().padStart(2, '0')}-${num2.toString().padStart(2, '0')}`
  }
}