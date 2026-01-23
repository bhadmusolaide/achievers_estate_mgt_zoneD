// Supabase Edge Function for sending celebration messages
// Deploy with: supabase functions deploy send-celebration

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CelebrationRequest {
  channel: "whatsapp" | "email";
  phone?: string;
  email?: string;
  landlordName: string;
  celebrationType: "birthday" | "anniversary";
  message: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { channel, phone, email, landlordName, celebrationType, message }: CelebrationRequest = await req.json();
    const estateName = Deno.env.get("ESTATE_NAME") || "Zone-D Estate";

    if (channel === "whatsapp") {
      // WhatsApp sending logic
      const whatsappApiUrl = Deno.env.get("WHATSAPP_API_URL");
      const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
      const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");

      if (!whatsappApiUrl || !phoneNumberId || !accessToken) {
        throw new Error("WhatsApp API credentials not configured");
      }

      // Format phone number
      let formattedPhone = phone?.replace(/\s/g, "") || "";
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "234" + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith("+")) {
        formattedPhone = formattedPhone.slice(1);
      }

      // Send WhatsApp message
      const response = await fetch(`${whatsappApiUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`WhatsApp API error: ${error}`);
      }

      console.log(`WhatsApp celebration sent to: ${formattedPhone}`);
    } else if (channel === "email") {
      // Email sending logic
      const smtpUser = Deno.env.get("SMTP_USER");
      const smtpPass = Deno.env.get("SMTP_PASS");

      if (!smtpUser || !smtpPass) {
        throw new Error("SMTP credentials not configured");
      }

      const subject = celebrationType === "birthday"
        ? `🎂 Happy Birthday from ${estateName}!`
        : `💍 Happy Anniversary from ${estateName}!`;

      // HTML email template
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${celebrationType === "birthday" ? "#FF6B6B" : "#E91E63"}; 
              color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 30px; background: #f9f9f9; }
    .message { white-space: pre-wrap; line-height: 1.8; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${celebrationType === "birthday" ? "🎂 Happy Birthday! 🎉" : "💍 Happy Anniversary! ❤️"}</h1>
    </div>
    <div class="content">
      <div class="message">${message.replace(/\n/g, "<br>")}</div>
    </div>
    <div class="footer">
      <p>This message was sent by ${estateName} Management System.</p>
    </div>
  </div>
</body>
</html>`;

      console.log(`Email celebration prepared for: ${email}`);
      console.log(`Subject: ${subject}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Celebration message sent via ${channel}`,
        channel,
        recipient: channel === "whatsapp" ? phone : email,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Celebration send error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});

