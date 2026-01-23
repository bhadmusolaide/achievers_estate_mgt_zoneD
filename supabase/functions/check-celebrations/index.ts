import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Landlord {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  wedding_anniversary: string | null;
  celebrate_opt_in: boolean;
  status: string;
}

interface CelebrationInsert {
  landlord_id: string;
  celebration_type: "birthday" | "anniversary";
  celebration_date: string;
  days_to_event: number;
  year: number;
  status: "pending";
}

function parseMonthDay(dateString: string): { month: number; day: number } | null {
  // DB DATE columns return YYYY-MM-DD. We also accept MM-DD for backward compatibility.
  const parts = dateString.split("-").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;

  let month: number | undefined;
  let day: number | undefined;

  if (parts.length === 3) {
    // YYYY-MM-DD
    month = parts[1];
    day = parts[2];
  } else if (parts.length === 2) {
    // MM-DD
    month = parts[0];
    day = parts[1];
  } else {
    return null;
  }

  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const currentYear = today.getFullYear();
    
    // Get all active landlords with celebrate_opt_in = true AND onboarding complete
    const { data: landlords, error: landlordsError } = await supabase
      .from("landlords")
      .select("id, full_name, date_of_birth, wedding_anniversary, celebrate_opt_in, status, onboarding_status")
      .eq("status", "active")
      .eq("onboarding_status", "active")
      .eq("celebrate_opt_in", true);

    if (landlordsError) {
      throw new Error(`Failed to fetch landlords: ${landlordsError.message}`);
    }

    const celebrationsToInsert: CelebrationInsert[] = [];
    const daysToCheck = [0, 1, 2, 3]; // Same day, 1-3 days ahead

    for (const landlord of (landlords || []) as Landlord[]) {
      // Parse birthday (YYYY-MM-DD from DB DATE column)
      if (landlord.date_of_birth) {
        try {
          const parsed = parseMonthDay(landlord.date_of_birth);
          if (!parsed) {
            console.error(`Invalid birthday format for ${landlord.id}: ${landlord.date_of_birth}`);
            continue;
          }
          const { month, day } = parsed;
          
          const birthdayThisYear = new Date(currentYear, month - 1, day); // month is 0-indexed
          
          for (const daysAhead of daysToCheck) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + daysAhead);
            
            if (
              checkDate.getMonth() === birthdayThisYear.getMonth() &&
              checkDate.getDate() === birthdayThisYear.getDate()
            ) {
              celebrationsToInsert.push({
                landlord_id: landlord.id,
                celebration_type: "birthday",
                celebration_date: birthdayThisYear.toISOString().split("T")[0],
                days_to_event: daysAhead,
                year: currentYear,
                status: "pending",
              });
            }
          }
        } catch (err) {
          console.error(`Error parsing birthday for ${landlord.id}:`, err);
        }
      }

      // Parse anniversary (YYYY-MM-DD from DB DATE column)
      if (landlord.wedding_anniversary) {
        try {
          const parsed = parseMonthDay(landlord.wedding_anniversary);
          if (!parsed) {
            console.error(`Invalid anniversary format for ${landlord.id}: ${landlord.wedding_anniversary}`);
            continue;
          }
          const { month, day } = parsed;
          
          const anniversaryThisYear = new Date(currentYear, month - 1, day); // month is 0-indexed
          
          for (const daysAhead of daysToCheck) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() + daysAhead);
            
            if (
              checkDate.getMonth() === anniversaryThisYear.getMonth() &&
              checkDate.getDate() === anniversaryThisYear.getDate()
            ) {
              celebrationsToInsert.push({
                landlord_id: landlord.id,
                celebration_type: "anniversary",
                celebration_date: anniversaryThisYear.toISOString().split("T")[0],
                days_to_event: daysAhead,
                year: currentYear,
                status: "pending",
              });
            }
          }
        } catch (err) {
          console.error(`Error parsing anniversary for ${landlord.id}:`, err);
        }
      }
    }

    // Insert celebrations with better error handling
    let inserted = 0;
    let skipped = 0;

    if (celebrationsToInsert.length > 0) {
      // Batch insert with upsert
      const { data, error: insertError } = await supabase
        .from("celebrations_queue")
        .upsert(celebrationsToInsert, { 
          onConflict: "landlord_id,celebration_type,celebration_date,year",
          ignoreDuplicates: true 
        })
        .select();

      if (insertError) {
        console.error("Insert error:", insertError);
        // Don't fail completely, just log
      } else {
        inserted = data?.length || 0;
        skipped = celebrationsToInsert.length - inserted;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Celebration check complete",
        checked: landlords?.length || 0,
        potential_celebrations: celebrationsToInsert.length,
        inserted,
        skipped,
        date: today.toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Celebration check error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});