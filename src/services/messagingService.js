import { supabase } from '../lib/supabase';
import emailjs from '@emailjs/browser';

const ESTATE_NAME = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';

export const messagingService = {
  /**
   * Send receipt via Email using EmailJS
   * NOTE: This replaces Supabase Edge Function for email delivery
   */
  async sendEmail(receipt, landlord, payment) {
    try {
      // Prepare email template
      const templateParams = {
        to_email: landlord.email,
        to_name: landlord.full_name,
        subject: `${ESTATE_NAME} - Payment Receipt ${receipt.receipt_number}`,
        receipt_number: receipt.receipt_number,
        amount: payment.amount,
        payment_type: payment.payment_types?.name,
        payment_date: new Date(payment.confirmed_at).toLocaleDateString(),
        estate_name: ESTATE_NAME,
        pdf_url: receipt.pdf_url || '',
      };

      // Send email using EmailJS
      const response = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID, // Your EmailJS service ID
        import.meta.env.VITE_EMAILJS_TEMPLATE_RECEIPT, // Receipt template ID
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY  // Your EmailJS public key
      );

      return { success: true, data: response };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send celebration message via Email using EmailJS
   * NOTE: This replaces Supabase Edge Function for email delivery
   */
  async sendCelebrationEmail(celebration, landlord, message) {
    try {
      // Debug: Log the email address being used
      console.log('Sending celebration email to:', landlord.email, 'for landlord:', landlord.full_name);

      // Validate email exists
      if (!landlord.email || !landlord.email.trim()) {
        throw new Error('No email address found for this landlord');
      }

      // Prepare email template for celebration
      const templateParams = {
        to_email: landlord.email,
        to_name: landlord.full_name,
        subject: celebration.celebration_type === 'birthday'
          ? `🎂 Happy Birthday from ${ESTATE_NAME}!`
          : `💍 Happy Anniversary from ${ESTATE_NAME}!`,
        celebration_type: celebration.celebration_type,
        message: message,
        estate_name: ESTATE_NAME,
      };

      console.log('EmailJS template params:', templateParams);

      // Send email using EmailJS
      const response = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID, // Your EmailJS service ID
        import.meta.env.VITE_EMAILJS_TEMPLATE_CELEBRATION, // Celebration template ID
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY  // Your EmailJS public key
      );

      console.log('EmailJS response:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('Celebration email send error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send notification email using EmailJS
   * NOTE: This replaces Supabase Edge Function for email delivery
   */
  async sendNotificationEmail(toEmail, toName, subject, message, metadata = {}) {
    try {
      // Prepare email template for notification
      const templateParams = {
        to_email: toEmail,
        to_name: toName,
        subject: subject,
        message: message,
        estate_name: ESTATE_NAME,
        ...metadata, // Include any additional metadata
      };

      // Send email using EmailJS
      const response = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID, // Your EmailJS service ID
        import.meta.env.VITE_EMAILJS_TEMPLATE_NOTIFICATION, // Notification template ID
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY  // Your EmailJS public key
      );

      return { success: true, data: response };
    } catch (error) {
      console.error('Notification email send error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Send receipt via WhatsApp using Supabase Edge Function
   */
  async sendWhatsApp(receipt, landlord, payment) {
    try {
      // Format phone number for WhatsApp (remove leading 0, add country code)
      let phone = landlord.phone.replace(/\s/g, '');
      if (phone.startsWith('0')) {
        phone = '234' + phone.slice(1);
      } else if (phone.startsWith('+')) {
        phone = phone.slice(1);
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone,
          message: `
Hello ${landlord.full_name},

Your payment has been confirmed!

🏠 *${ESTATE_NAME}*
📄 Receipt: ${receipt.receipt_number}
💰 Amount: ₦${parseFloat(payment.amount).toLocaleString()}
📋 Purpose: ${payment.payment_types?.name}
📅 Date: ${new Date(payment.confirmed_at).toLocaleDateString()}

Thank you for your payment.
          `.trim(),
          pdfUrl: receipt.pdf_url,
        },
      });

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('WhatsApp send error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Placeholder for SMS (future implementation)
   * @param {string} phone - Phone number to send SMS to
   * @param {string} message - Message content
   */
  // eslint-disable-next-line no-unused-vars
  async sendSMS(phone, message) {
    console.log('SMS sending not implemented yet');
    return { success: false, error: 'SMS not implemented' };
  },
};

export default messagingService;

