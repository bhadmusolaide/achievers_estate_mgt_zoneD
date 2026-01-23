import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateAdminRequest {
  full_name: string
  email: string
  password: string
  role: 'secretary' | 'treasurer' | 'officer'
  zone?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create client with user's auth to verify they're chairman
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user is chairman
    const { data: adminProfile, error: adminError } = await userClient
      .from('admin_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (adminError || !adminProfile || adminProfile.role !== 'chairman') {
      return new Response(JSON.stringify({ error: 'Only chairman can create admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { full_name, email, password, role, zone = 'Zone D' }: CreateAdminRequest = await req.json()

    // Validate input
    if (!full_name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!['secretary', 'treasurer', 'officer'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin client with service role for user creation
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
    })

    if (createError) {
      console.error('Create user error:', createError)
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin profile with default permissions (all enabled)
    const defaultPermissions = {
      dashboard: true,
      landlords: true,
      onboarding: true,
      bulk_import: true,
      payments: true,
      receipts: true,
      financial_overview: true,
      celebrations: true,
      audit_log: true,
      settings: true,
    }

    const { error: profileError } = await adminClient
      .from('admin_profiles')
      .insert({
        id: newUser.user.id,
        full_name,
        email,
        role,
        zone,
        feature_permissions: defaultPermissions,
      })

    if (profileError) {
      console.error('Create profile error:', profileError)
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(newUser.user.id)
      return new Response(JSON.stringify({ error: 'Failed to create admin profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        full_name,
        role,
        zone,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Create admin user error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

