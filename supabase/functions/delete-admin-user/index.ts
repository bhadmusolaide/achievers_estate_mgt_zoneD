import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteAdminRequest {
  admin_id: string
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
      return new Response(JSON.stringify({ error: 'Only chairman can delete admin users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { admin_id }: DeleteAdminRequest = await req.json()

    // Validate input
    if (!admin_id) {
      return new Response(JSON.stringify({ error: 'admin_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Prevent chairman from deleting themselves
    if (admin_id === user.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if target user exists and is not a chairman
    const { data: targetUser, error: targetError } = await userClient
      .from('admin_profiles')
      .select('id, full_name, role')
      .eq('id', admin_id)
      .single()

    if (targetError || !targetUser) {
      return new Response(JSON.stringify({ error: 'Admin user not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Prevent deleting another chairman
    if (targetUser.role === 'chairman') {
      return new Response(JSON.stringify({ error: 'Cannot delete a chairman account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create admin client with service role for user deletion
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

    // Delete the admin profile first (due to foreign key constraints)
    const { error: profileDeleteError } = await adminClient
      .from('admin_profiles')
      .delete()
      .eq('id', admin_id)

    if (profileDeleteError) {
      console.error('Delete profile error:', profileDeleteError)
      return new Response(JSON.stringify({ error: 'Failed to delete admin profile' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Delete the auth user
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(admin_id)

    if (authDeleteError) {
      console.error('Delete auth user error:', authDeleteError)
      // Profile already deleted, log but continue
      return new Response(JSON.stringify({ 
        success: true, 
        warning: 'Profile deleted but auth user deletion failed',
        deleted_user: targetUser.full_name
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Admin user "${targetUser.full_name}" has been deleted`,
      deleted_user: targetUser.full_name
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Delete admin user error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

