// Supabase Edge Function for sending emails via Gmail SMTP
// Deploy with: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  landlordName: string;
  receiptNumber: string;
  amount: number;
  paymentType: string;
  paymentDate: string;
  pdfUrl?: string;
}

serve(async (req) => {
  console.log("Send-email function invoked");
  console.log("Request method:", req.method);
  console.log("Authorization header:", req.headers.get('authorization'));
  console.log("Request headers:", Object.fromEntries(req.headers.entries()));

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log("Request body:", requestBody);

    const { to, subject, landlordName, receiptNumber, amount, paymentType, paymentDate, pdfUrl }: EmailRequest = requestBody;

    console.log("Parsed email data:", { to, subject, landlordName, receiptNumber, amount, paymentType, paymentDate, pdfUrl });

    // Get SMTP credentials from environment
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const estateName = Deno.env.get("ESTATE_NAME") || "Zone-D Estate";

    console.log("Environment variables check:");
    console.log("SMTP_HOST:", smtpHost);
    console.log("SMTP_PORT:", smtpPort);
    console.log("SMTP_USER present:", !!smtpUser);
    console.log("SMTP_PASS present:", !!smtpPass);
    console.log("ESTATE_NAME:", estateName);

    if (!smtpUser || !smtpPass) {
      console.error("SMTP credentials missing");
      console.error("SMTP_USER value:", smtpUser);
      console.error("SMTP_PASS value:", smtpPass ? '[HIDDEN]' : null);
      throw new Error("SMTP credentials not configured. Please check that SMTP_USER and SMTP_PASS are set in your Supabase Edge Function environment variables (not in the local .env file)");
    }

    // Email HTML template
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a365d; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f7fafc; }
    .receipt-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .receipt-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .amount { font-size: 24px; font-weight: bold; color: #38a169; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${estateName}</h1>
      <p>Payment Receipt</p>
    </div>
    <div class="content">
      <p>Dear ${landlordName},</p>
      <p>Your payment has been confirmed. Please find your receipt details below:</p>

      <div class="receipt-box">
        <div class="receipt-row">
          <span>Receipt Number:</span>
          <strong>${receiptNumber}</strong>
        </div>
        <div class="receipt-row">
          <span>Payment Type:</span>
          <span>${paymentType}</span>
        </div>
        <div class="receipt-row">
          <span>Payment Date:</span>
          <span>${new Date(paymentDate).toLocaleDateString()}</span>
        </div>
        <div class="receipt-row">
          <span>Amount Paid:</span>
          <span class="amount">₦${Number(amount).toLocaleString()}</span>
        </div>
      </div>

      ${pdfUrl ? `<p><a href="${pdfUrl}">Download Receipt PDF</a></p>` : ""}

      <p>Thank you for your payment.</p>
    </div>
    <div class="footer">
      <p>This is an automated message from ${estateName} Management System.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using SMTP
    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);

    const client = new SmtpClient();

    try {
      console.log("Connecting to SMTP server...");
      await client.connectTLS({
        hostname: smtpHost,
        port: smtpPort,
        username: smtpUser,
        password: smtpPass,
      });
      console.log("Connected to SMTP server successfully");

      console.log("Sending email...");
      const sendResult = await client.send({
        from: smtpUser,
        to: to,
        subject: subject,
        content: htmlBody,
        html: htmlBody,
      });
      console.log("Email send result:", sendResult);
      console.log("Email sent successfully");
    } catch (smtpError) {
      console.error("SMTP error:", smtpError);
      throw new Error(`Failed to send email: ${smtpError.message}`);
    } finally {
      console.log("Closing SMTP connection");
      await client.close();
      console.log("SMTP connection closed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        to,
        receiptNumber
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (error) {
    console.error("Email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});

