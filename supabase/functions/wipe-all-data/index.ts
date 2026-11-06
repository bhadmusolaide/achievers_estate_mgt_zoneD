import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type DeletionResult = { table: string; count: number; error?: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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

    const { confirmationPhrase } = await req.json()
    const expectedPhrase = 'DELETE ALL DATA'

    if (confirmationPhrase !== expectedPhrase) {
      return new Response(
        JSON.stringify({ error: `Invalid confirmation. Please type "${expectedPhrase}" exactly.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Data wipe initiated by chairman: ${user.email}`)

    const deletionResults: DeletionResult[] = []

    const { data: rpcResults, error: rpcError } = await supabaseAdmin.rpc('wipe_all_application_data')

    if (rpcError) {
      console.error('wipe_all_application_data RPC failed:', rpcError.message)
      return new Response(
        JSON.stringify({
          error: 'Data wipe failed. Ensure the latest database migration has been applied, then retry.',
          details: rpcError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (Array.isArray(rpcResults)) {
      for (const row of rpcResults) {
        deletionResults.push({
          table: row.table,
          count: row.count ?? 0,
        })
      }
    }

    const { data: files } = await supabaseAdmin.storage.from('receipts').list()
    if (files && files.length > 0) {
      const filePaths = files.map(f => f.name)
      const { error: storageError } = await supabaseAdmin.storage.from('receipts').remove(filePaths)
      deletionResults.push({
        table: 'storage:receipts',
        count: storageError ? 0 : files.length,
        error: storageError?.message,
      })
    }

    const errors = deletionResults.filter(r => r.error)
    console.log('Data wipe completed:', deletionResults)

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        message: errors.length === 0
          ? 'All data has been deleted successfully'
          : 'Data wipe completed with errors — review the summary below.',
        results: deletionResults,
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
