import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get auth header to verify the requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to verify identity
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the user is a chairman
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('admin_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (profile.role !== 'chairman') {
      return new Response(
        JSON.stringify({ error: 'Only the Chairman can perform this action' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get confirmation phrase from request body
    const { confirmationPhrase } = await req.json()
    const expectedPhrase = 'DELETE ALL DATA'
    
    if (confirmationPhrase !== expectedPhrase) {
      return new Response(
        JSON.stringify({ error: `Invalid confirmation. Please type "${expectedPhrase}" exactly.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Data wipe initiated by chairman: ${user.email}`)

    // Delete data in order (respecting foreign key constraints)
    const deletionResults: { table: string; count: number; error?: string }[] = []

    // 1. Delete activity logs
    const { count: activityCount, error: activityError } = await supabaseAdmin
      .from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'activity_logs', count: activityCount || 0, error: activityError?.message })

    // 2. Delete receipts (files will be handled by storage deletion)
    const { count: receiptsCount, error: receiptsError } = await supabaseAdmin
      .from('receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'receipts', count: receiptsCount || 0, error: receiptsError?.message })

    // 3. Clear account_balance foreign key reference to transactions BEFORE deleting transactions
    const { error: clearRefError } = await supabaseAdmin
      .from('account_balance')
      .update({ last_transaction_id: null })
      .eq('id', '00000000-0000-0000-0000-000000000001')
    if (clearRefError) {
      console.error('Failed to clear account_balance reference:', clearRefError.message)
    }

    // 4. Delete transactions (now safe after clearing FK reference)
    const { count: txCount, error: txError } = await supabaseAdmin
      .from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'transactions', count: txCount || 0, error: txError?.message })

    // 5. Delete payments
    const { count: paymentsCount, error: paymentsError } = await supabaseAdmin
      .from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'payments', count: paymentsCount || 0, error: paymentsError?.message })

    // 6. Delete onboarding tasks
    const { count: taskCount, error: taskError } = await supabaseAdmin
      .from('onboarding_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'onboarding_tasks', count: taskCount || 0, error: taskError?.message })

    // 7. Delete onboarding activity log
    const { count: onboardLogCount, error: onboardLogError } = await supabaseAdmin
      .from('onboarding_activity_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'onboarding_activity_log', count: onboardLogCount || 0, error: onboardLogError?.message })

    // 8. Delete celebrations queue
    const { count: celebCount, error: celebError } = await supabaseAdmin
      .from('celebrations_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'celebrations_queue', count: celebCount || 0, error: celebError?.message })

    // 9. Delete landlord payment types
    const { count: lptCount, error: lptError } = await supabaseAdmin
      .from('landlord_payment_types').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'landlord_payment_types', count: lptCount || 0, error: lptError?.message })

    // 10. Delete landlords
    const { count: landlordsCount, error: landlordsError } = await supabaseAdmin
      .from('landlords').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    deletionResults.push({ table: 'landlords', count: landlordsCount || 0, error: landlordsError?.message })

    // 11. Reset account balance to 0
    const { error: balanceError } = await supabaseAdmin
      .from('account_balance').update({ balance: 0 }).eq('id', '00000000-0000-0000-0000-000000000001')
    deletionResults.push({ table: 'account_balance (reset)', count: balanceError ? 0 : 1, error: balanceError?.message })

    // 12. Delete receipt files from storage
    const { data: files } = await supabaseAdmin.storage.from('receipts').list()
    if (files && files.length > 0) {
      const filePaths = files.map(f => f.name)
      await supabaseAdmin.storage.from('receipts').remove(filePaths)
      deletionResults.push({ table: 'storage:receipts', count: files.length })
    }

    console.log('Data wipe completed:', deletionResults)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'All data has been deleted successfully',
        results: deletionResults
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error wiping data:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to wipe data' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

