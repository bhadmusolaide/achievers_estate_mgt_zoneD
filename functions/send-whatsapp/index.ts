// Supabase Edge Function for sending WhatsApp messages via WhatsApp Cloud API
// Deploy with: supabase functions deploy send-whatsapp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppRequest {
  phone: string;
  message: string;
  pdfUrl?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, message, pdfUrl }: WhatsAppRequest = await req.json();

    // Get WhatsApp API credentials from environment
    const apiUrl = Deno.env.get("WHATSAPP_API_URL") || "https://graph.facebook.com/v17.0";
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (!phoneNumberId || !accessToken) {
      throw new Error("WhatsApp API credentials not configured");
    }

    // Format phone number (ensure it has country code)
    let formattedPhone = phone.replace(/\s/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "234" + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.slice(1);
    }

    // Send text message
    const textResponse = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: {
          preview_url: true,
          body: message,
        },
      }),
    });

    if (!textResponse.ok) {
      const errorData = await textResponse.json();
      throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
    }

    const textResult = await textResponse.json();

    // If there's a PDF URL, send it as a document
    if (pdfUrl) {
      const docResponse = await fetch(`${apiUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "document",
          document: {
            link: pdfUrl,
            caption: "Payment Receipt",
            filename: "receipt.pdf",
          },
        }),
      });

      if (!docResponse.ok) {
        console.error("Failed to send document:", await docResponse.text());
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp message sent",
        messageId: textResult.messages?.[0]?.id 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error) {
    console.error("WhatsApp error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});

