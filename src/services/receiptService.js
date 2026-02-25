import { supabase } from '../lib/supabase';
import { generateReceiptNumber } from '../utils/helpers';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';

export const receiptService = {
  /**
   * Get all receipts
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('receipts')
      .select(`
        *,
        payments (
          *,
          landlords (title, full_name, phone, email, house_address),
          payment_types (name)
        )
      `)
      .order('generated_at', { ascending: false });

    if (filters.sent_email !== undefined) {
      query = query.eq('sent_email', filters.sent_email);
    }
    if (filters.sent_whatsapp !== undefined) {
      query = query.eq('sent_whatsapp', filters.sent_whatsapp);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Get receipt by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        payments (
          *,
          landlords (*),
          payment_types (*),
          admin_profiles:logged_by (full_name)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get receipt by payment ID
   */
  async getByPaymentId(paymentId) {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Create a receipt
   */
  async create(paymentId, pdfUrl = null, adminId = null) {
    const receiptNumber = generateReceiptNumber();

    const { data, error } = await supabase
      .from('receipts')
      .insert([{
        payment_id: paymentId,
        receipt_number: receiptNumber,
        pdf_url: pdfUrl,
      }])
      .select()
      .single();

    if (error) throw error;

    // Log the activity
    if (adminId) {
      await activityLogService.log({
        adminId,
        actionType: ACTION_TYPES.RECEIPT_GENERATED,
        entityType: ENTITY_TYPES.RECEIPT,
        entityId: data.id,
        metadata: {
          receipt_number: receiptNumber,
          payment_id: paymentId,
        },
      });
    }

    return data;
  },

  /**
   * Update receipt delivery status
   */
  async updateDeliveryStatus(id, updates, adminId = null) {
    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log if sent via email or whatsapp
    if (adminId) {
      if (updates.sent_email) {
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.RECEIPT_SENT_EMAIL,
          entityType: ENTITY_TYPES.RECEIPT,
          entityId: data.id,
          metadata: { receipt_number: data.receipt_number },
        });
      }
      if (updates.sent_whatsapp) {
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.RECEIPT_SENT_WHATSAPP,
          entityType: ENTITY_TYPES.RECEIPT,
          entityId: data.id,
          metadata: { receipt_number: data.receipt_number },
        });
      }
    }

    return data;
  },

  /**
   * Upload receipt PDF to storage
   */
  async uploadPdf(receiptId, pdfBlob) {
    const fileName = `${receiptId}.pdf`;

    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(fileName);

    // Update receipt with PDF URL
    await this.updateDeliveryStatus(receiptId, { pdf_url: urlData.publicUrl });

    return urlData.publicUrl;
  },

  /**
   * Get today's receipt count
   */
  async getTodayCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count, error } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .gte('generated_at', today.toISOString());

    if (error) throw error;
    return count || 0;
  },
};

export default receiptService;

