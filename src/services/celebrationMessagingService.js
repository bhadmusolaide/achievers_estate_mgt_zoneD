import { supabase } from '../lib/supabase';
import { celebrationService } from './celebrationService';
import { messagingService } from './messagingService';

const ESTATE_NAME = import.meta.env.VITE_ESTATE_NAME || 'Zone-D Estate';

export const celebrationMessagingService = {
  /**
   * Send celebration message via specified channel
   */
  async sendCelebration(celebration, landlord, channel) {
    try {
      // Get the message (custom or default template)
      let message = celebration.custom_message;
      
      if (!message) {
        const template = await celebrationService.getDefaultTemplate(celebration.celebration_type);
        if (template) {
          message = this.replaceTemplateVariables(template.message_template, landlord);
        } else {
          message = this.getDefaultMessage(celebration.celebration_type, landlord);
        }
      }

      if (channel === 'whatsapp') {
        // Call the edge function to send WhatsApp
        const { data, error } = await supabase.functions.invoke('send-celebration', {
          body: {
            channel,
            phone: landlord.phone,
            email: landlord.email,
            landlordName: landlord.full_name,
            celebrationType: celebration.celebration_type,
            message,
          },
        });

        if (error) throw error;
        return { success: true, data };
      } else if (channel === 'email') {
        // Use EmailJS for email
        const result = await messagingService.sendCelebrationEmail(celebration, landlord, message);
        return result;
      }

      return { success: false, error: 'Invalid channel specified' };
    } catch (error) {
      console.error('Celebration messaging error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Replace template variables with actual values
   */
  replaceTemplateVariables(template, landlord) {
    return template
      .replace(/{landlord_name}/g, landlord?.full_name || 'Valued Resident')
      .replace(/{estate_name}/g, ESTATE_NAME)
      .replace(/{chairman_name}/g, 'The Chairman')
      .replace(/{zone}/g, landlord?.zone || 'Zone D');
  },

  /**
   * Get default message if no template exists
   */
  getDefaultMessage(celebrationType, landlord) {
    if (celebrationType === 'birthday') {
      return `Dear ${landlord.full_name},

Wishing you a very Happy Birthday! 🎂🎉

On behalf of ${ESTATE_NAME}, we celebrate you today and wish you many more years of good health, prosperity, and happiness.

Warm regards,
Zone-D Estate Management`;
    }

    return `Dear ${landlord.full_name},

Happy Wedding Anniversary! 💍❤️

On behalf of ${ESTATE_NAME}, we celebrate your special day and wish you many more wonderful years together.

Warm regards,
Zone-D Estate Management`;
  },

  /**
   * Format phone for WhatsApp (Nigerian format)
   */
  formatPhoneForWhatsApp(phone) {
    let formatted = phone.replace(/\s/g, '');
    if (formatted.startsWith('0')) {
      formatted = '234' + formatted.slice(1);
    } else if (formatted.startsWith('+')) {
      formatted = formatted.slice(1);
    }
    return formatted;
  },
};

export default celebrationMessagingService;

