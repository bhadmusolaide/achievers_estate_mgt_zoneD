// Edge Function: public-landlord-lookup
// Accepts phone number, returns landlord name and total outstanding.
// No status filter — works for all existing landlords so they can see their info.
// Deploy with: supabase functions deploy public-landlord-lookup

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { phone } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneInput = String(phone).trim();
    const digits = phoneInput.replace(/\D/g, "");

    if (digits.length < 10) {
      return new Response(JSON.stringify({ error: "Please enter a valid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last10 = digits.slice(-10);
    const localFormat = "0" + last10;
    const intlFormat = "+234" + last10;
    const bareFormat = "234" + last10;

    const { data: landlord, error: landlordError } = await supabase
      .from("landlords")
      .select("id, title, full_name, status")
      .in("phone", [localFormat, intlFormat, bareFormat])
      .maybeSingle();

    if (landlordError) throw landlordError;
    if (!landlord) {
      return new Response(JSON.stringify({ error: "No landlord found with that phone number" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: expectedPayments } = await supabase
      .from("landlord_payment_types")
      .select("amount")
      .eq("landlord_id", landlord.id)
      .eq("active", true);

    const { data: paidPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("landlord_id", landlord.id)
      .eq("status", "confirmed");

    const totalExpected = (expectedPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const totalPaid = (paidPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = Math.max(0, totalExpected - totalPaid);

    return new Response(JSON.stringify({
      found: true,
      name: landlord.title
        ? `${landlord.title} ${landlord.full_name}`
        : landlord.full_name,
      outstanding,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});