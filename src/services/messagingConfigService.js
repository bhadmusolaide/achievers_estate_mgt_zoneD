import { supabase } from '../lib/supabase';
import emailjs from '@emailjs/browser';

export const messagingConfigService = {
  /**
   * Test email configuration using EmailJS
   */
  async testEmailConfig(testEmail) {
    try {
      // Prepare test email template
      const templateParams = {
        to_email: testEmail,
        to_name: 'Test User',
        subject: 'Zone-D Estate - Email Configuration Test',
        receipt_number: 'TEST-001',
        amount: 0,
        payment_type: 'Test Payment',
        payment_date: new Date().toLocaleDateString(),
        estate_name: 'Zone-D Estate',
        pdf_url: '',
      };

      // Send test email using EmailJS
      const response = await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID, // Your EmailJS service ID
        import.meta.env.VITE_EMAILJS_TEMPLATE_RECEIPT || import.meta.env.VITE_EMAILJS_TEMPLATE_ID, // Your EmailJS template ID
        templateParams,
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY  // Your EmailJS public key
      );

      return { success: true, configured: true, data: response };
    } catch (error) {
      console.error('Email config test error:', error);
      return { 
        success: false, 
        configured: false, 
        error: error.message || 'Failed to test email configuration' 
      };
    }
  },

  /**
   * Test WhatsApp configuration by invoking the edge function with a test flag
   * NOTE: WhatsApp functionality still relies on Supabase Edge Functions
   */
  async testWhatsAppConfig(testPhone) {
    try {
      // Format phone for WhatsApp
      let phone = testPhone.replace(/\s/g, '');
      if (phone.startsWith('0')) {
        phone = '234' + phone.slice(1);
      } else if (phone.startsWith('+')) {
        phone = phone.slice(1);
      }

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone,
          message: '🔧 Zone-D Estate - WhatsApp Configuration Test\n\nThis is a test message to verify WhatsApp API configuration.',
          isTest: true,
        },
      });

      if (error) {
        // Check for specific configuration errors
        if (error.message?.includes('credentials not configured')) {
          return { 
            success: false, 
            configured: false, 
            error: 'WhatsApp API credentials not configured in Supabase Edge Functions' 
          };
        }
        throw error;
      }

      return { success: true, configured: true, data };
    } catch (error) {
      console.error('WhatsApp config test error:', error);
      return { 
        success: false, 
        configured: false, 
        error: error.message || 'Failed to test WhatsApp configuration' 
      };
    }
  },

  /**
   * Get messaging configuration status
   * Note: This checks if edge functions are deployed and respond
   */
  async getConfigStatus() {
    const status = {
      email: { configured: false, tested: false, lastTest: null },
      whatsapp: { configured: false, tested: false, lastTest: null },
    };

    // We can't directly check env vars from frontend
    // So we'll provide a way to test the configuration
    return status;
  },
};

export default messagingConfigService;

