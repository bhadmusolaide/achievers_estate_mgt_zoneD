// Edge Function: public-dashboard
// Returns public dashboard data without requiring auth.
// Uses service_role to bypass RLS on existing tables.
// Deploy with: supabase functions deploy public-dashboard

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const [balanceResult, outstandingResult, projectsResult, projectBudgetResult, paymentsResult, pledgesResult, debtorsResult, totalDebtResult] =
      await Promise.all([
        supabase.from("account_balance").select("balance").limit(1).maybeSingle(),
        getTotalOutstanding(supabase),
        getProjects(supabase),
        getTotalProjectBudget(supabase),
        getRecentPayments(supabase),
        getPledges(supabase),
        getTopDebtors(supabase),
        getTotalDebt(supabase),
      ]);

    const data = {
      account_balance: balanceResult.data?.balance ?? 0,
      total_outstanding: outstandingResult,
      total_project_budget: projectBudgetResult,
      total_debt: totalDebtResult,
      projects: projectsResult,
      recent_payments: paymentsResult,
      pledges: pledgesResult,
      top_debtors: debtorsResult,
    };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getTotalOutstanding(supabase) {
  const { data: expected } = await supabase
    .from("landlord_payment_types")
    .select("landlord_id, amount")
    .eq("active", true);

  if (!expected || expected.length === 0) return 0;

  const landlordIds = [...new Set(expected.map((e) => e.landlord_id))];

  const { data: paid } = await supabase
    .from("payments")
    .select("landlord_id, amount")
    .eq("status", "confirmed")
    .in("landlord_id", landlordIds);

  const paidByLandlord = {};
  if (paid) {
    for (const p of paid) {
      paidByLandlord[p.landlord_id] = (paidByLandlord[p.landlord_id] ?? 0) + Number(p.amount);
    }
  }

  const expectedByLandlord = {};
  for (const e of expected) {
    expectedByLandlord[e.landlord_id] = (expectedByLandlord[e.landlord_id] ?? 0) + Number(e.amount);
  }

  let totalOutstanding = 0;
  for (const [id, total] of Object.entries(expectedByLandlord)) {
    const paidAmount = paidByLandlord[id] ?? 0;
    if (total > paidAmount) {
      totalOutstanding += total - paidAmount;
    }
  }

  return totalOutstanding;
}

async function getTotalProjectBudget(supabase) {
  const { data } = await supabase
    .from("projects")
    .select("estimated_budget")
    .eq("status", "active");

  if (!data) return 0;
  return data.reduce((sum, p) => sum + Number(p.estimated_budget ?? 0), 0);
}

async function getTotalDebt(supabase) {
  const { data } = await supabase
    .from("project_debts")
    .select("remaining_amount")
    .eq("status", "active");

  if (!data) return 0;
  return data.reduce((sum, d) => sum + Number(d.remaining_amount ?? 0), 0);
}

async function getProjects(supabase) {
  const { data } = await supabase
    .from("projects")
    .select("id, name, description, estimated_budget, milestone_level, status, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return data ?? [];
}

async function getRecentPayments(supabase) {
  const { data } = await supabase
    .from("payments")
    .select(`
      id, amount, status, created_at,
      landlords!inner(title, full_name, house_number, lane_number, road),
      payment_types!inner(name)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data) return [];

  return data.map((p) => ({
    id: p.id,
    amount: p.amount,
    status: p.status,
    created_at: p.created_at,
    landlord: {
      title: p.landlords?.title,
      full_name: p.landlords?.full_name,
      house_number: p.landlords?.house_number,
      lane_number: p.landlords?.lane_number,
      road: p.landlords?.road,
    },
    payment_type: { name: p.payment_types?.name },
  }));
}

async function getPledges(supabase) {
  const { data } = await supabase
    .from("pledges")
    .select(`
      id, donor_name, amount, description, status, created_at, landlord_id,
      landlords!left(title, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!data) return [];

  return data.map((pl) => ({
    id: pl.id,
    donor_name: pl.donor_name,
    amount: pl.amount,
    description: pl.description,
    status: pl.status,
    created_at: pl.created_at,
    landlord: pl.landlords
      ? { title: pl.landlords.title, full_name: pl.landlords.full_name }
      : null,
  }));
}

async function getTopDebtors(supabase) {
  const { data: expected } = await supabase
    .from("landlord_payment_types")
    .select("landlord_id, amount")
    .eq("active", true);

  if (!expected || expected.length === 0) return [];

  const landlordIds = [...new Set(expected.map((e) => e.landlord_id))];

  const { data: paid } = await supabase
    .from("payments")
    .select("landlord_id, amount")
    .eq("status", "confirmed")
    .in("landlord_id", landlordIds);

  const paidByLandlord = {};
  if (paid) {
    for (const p of paid) {
      paidByLandlord[p.landlord_id] = (paidByLandlord[p.landlord_id] ?? 0) + Number(p.amount);
    }
  }

  const expectedByLandlord = {};
  for (const e of expected) {
    expectedByLandlord[e.landlord_id] = (expectedByLandlord[e.landlord_id] ?? 0) + Number(e.amount);
  }

  const debtors = [];
  for (const [id, total] of Object.entries(expectedByLandlord)) {
    const paidAmount = paidByLandlord[id] ?? 0;
    if (total > paidAmount) {
      debtors.push({ landlord_id: id, outstanding: total - paidAmount });
    }
  }

  debtors.sort((a, b) => b.outstanding - a.outstanding);
  const top10 = debtors.slice(0, 10);

  if (top10.length === 0) return [];

  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, title, full_name")
    .eq("status", "active")
    .in("id", top10.map((d) => d.landlord_id));

  const landlordMap = {};
  if (landlords) {
    for (const l of landlords) {
      landlordMap[l.id] = l;
    }
  }

  return top10.map((d) => ({
    id: d.landlord_id,
    title: landlordMap[d.landlord_id]?.title,
    full_name: landlordMap[d.landlord_id]?.full_name,
    outstanding: d.outstanding,
  }));
}