import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LandlordData {
  title?: string
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
  rowNumber?: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check for authorization header
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('No Authorization header found');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: 'No Authorization header provided'
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    console.log('Attempting to get user...');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: userError?.message || 'User not found'
      }), {
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
    const skippedRows: { rowNumber: number, reason: string, data: LandlordData }[] = []

    // STEP 1: Validate all landlords first
    const validatedLandlords: (ValidationResult & { rowNumber: number })[] = []
    
    for (let i = 0; i < landlords.length; i++) {
      const landlord = landlords[i]
      const validation = validateLandlord(landlord)

      if (!validation.isValid) {
        skippedRows.push({
          rowNumber: i + 1,
          reason: validation.errors.join('; '),
          data: landlord
        })
      } else {
        validatedLandlords.push({
          ...validation,
          rowNumber: i + 1
        })
      }
    }

    // STEP 2: Batch check for duplicate phones (CRITICAL FIX)
    const phonesToCheck = validatedLandlords.map(v => normalizePhone(v.normalizedData!.phone))
    
    const { data: existingLandlords, error: checkError } = await supabaseClient
      .from('landlords')
      .select('phone')
      .in('phone', phonesToCheck)

    if (checkError) {
      return new Response(JSON.stringify({ error: 'Failed to check duplicates' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const existingPhones = new Set(existingLandlords?.map(l => l.phone) || [])

    // STEP 3: Filter out duplicates
    const validLandlords: LandlordData[] = []
    
    for (const validated of validatedLandlords) {
      const normalizedPhone = normalizePhone(validated.normalizedData!.phone)
      
      if (existingPhones.has(normalizedPhone)) {
        skippedRows.push({
          rowNumber: validated.rowNumber,
          reason: 'Phone number already exists',
          data: landlords[validated.rowNumber - 1]
        })
      } else {
        validLandlords.push(validated.normalizedData!)
      }
    }

    // STEP 4: Insert valid landlords
    let successfulRows = 0
    
    if (validLandlords.length > 0) {
      const { data, error: insertError } = await supabaseClient
        .from('landlords')
        .insert(validLandlords)
        .select()

      if (insertError) {
        return new Response(JSON.stringify({ 
          error: 'Failed to insert landlords',
          details: insertError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      successfulRows = data?.length || 0
    }

    // STEP 5: Log activity (with proper error handling)
    let activityLogId: string | null = null
    
    try {
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

      if (!logError && activityLog) {
        activityLogId = activityLog.id
      } else {
        // Log activity error silently
      }
    } catch (err) {
      // Log activity exception silently
    }

    // STEP 6: Log skipped rows details (only if activity log succeeded)
    if (skippedRows.length > 0 && activityLogId) {
      try {
        const skippedDetails = skippedRows.map(skip => ({
          activity_log_id: activityLogId,
          row_number: skip.rowNumber,
          failure_reason: skip.reason,
          row_data: skip.data
        }))

        await supabaseClient
          .from('activity_log_details')
          .insert(skippedDetails)
      } catch (err) {
        // Log activity details error silently
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
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/[\s\-]/g, '').replace(/^0+/, '')

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
  const parts = dateStr.split('-')
  if (parts.length !== 2) return false

  const num1 = parseInt(parts[0], 10)
  const num2 = parseInt(parts[1], 10)

  if (isNaN(num1) || isNaN(num2)) return false

  const isDDMM = num1 >= 1 && num1 <= 31 && num2 >= 1 && num2 <= 12
  const isMMDD = num1 >= 1 && num1 <= 12 && num2 >= 1 && num2 <= 31

  return isDDMM || isMMDD
}

function formatMonthDay(dateStr: string): string {
  const parts = dateStr.split('-')
  const num1 = parseInt(parts[0], 10)
  const num2 = parseInt(parts[1], 10)

  if (num1 > 12) {
    return `${num2.toString().padStart(2, '0')}-${num1.toString().padStart(2, '0')}`
  } else {
    return `${num1.toString().padStart(2, '0')}-${num2.toString().padStart(2, '0')}`
  }
}