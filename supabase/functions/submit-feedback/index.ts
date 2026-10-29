// Edge Function: submit-feedback
// Accepts feedback submissions with IP-based rate limiting.
// Deploy with: supabase functions deploy submit-feedback --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 300; // 5 minutes

async function checkRateLimit(supabase: any, key: string, endpoint: string): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_SECONDS * 1000);

  // Clean up old entries
  await supabase.from("rate_limits").delete().lt("window_start", cutoff.toISOString());

  // Check existing entry in current window
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, count, window_start")
    .eq("key", key)
    .eq("endpoint", endpoint)
    .gte("window_start", cutoff.toISOString())
    .maybeSingle();

  if (existing) {
    if (existing.count >= MAX_REQUESTS) return false;
    await supabase
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("rate_limits")
      .insert({ key, endpoint, count: 1, window_start: now.toISOString() });
  }
  return true;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const ip = getClientIp(req);
    const key = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + ":submit-feedback"))
      .then((h) => Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join(""));

    const allowed = await checkRateLimit(supabase, key, "submit-feedback");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, email, phone, category, message } = await req.json();

    if (!message || message.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Message must be at least 10 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("feedback").insert({
      name: name?.trim() || "Anonymous",
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      category: category || "other",
      message: message.trim(),
    });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
