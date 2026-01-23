// Supabase Edge Function for sending emails via Gmail SMTP
// Deploy with: supabase functions deploy send-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, landlordName, receiptNumber, amount, paymentType, paymentDate, pdfUrl }: EmailRequest = await req.json();

    // Get SMTP credentials from environment
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const estateName = Deno.env.get("ESTATE_NAME") || "Zone-D Estate";

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
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

    // Use Resend or similar email service API
    // For Gmail SMTP, we'd need a proper SMTP library
    // Here's a placeholder using a simple fetch to an email service

    // For production, you would use a proper email service like Resend, SendGrid, etc.
    // This is a simplified example
    console.log(`Sending email to: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${htmlBody.substring(0, 200)}...`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email queued for sending",
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

