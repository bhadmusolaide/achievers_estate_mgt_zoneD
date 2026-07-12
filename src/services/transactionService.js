import { supabase } from '../lib/supabase';

// Action types for transaction activity logging (mirrors the values written by the RPCs)
export const TRANSACTION_ACTION_TYPES = {
  TRANSACTION_CREATED: 'transaction_created',
  TRANSACTION_APPROVED: 'transaction_approved',
  TRANSACTION_REJECTED: 'transaction_rejected',
};

export const transactionService = {
  /**
   * Get approval threshold from settings
   */
  async getApprovalThreshold() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'debit_approval_threshold')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.warn('Could not fetch approval threshold:', error);
      return 50000; // Default threshold
    }

    return data ? parseFloat(data.value) : 50000;
  },

  /**
   * Get approval roles from settings
   */
  async getApprovalRoles() {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'approval_roles')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.warn('Could not fetch approval roles:', error);
      return ['chairman', 'treasurer'];
    }

    if (data && data.value) {
      try {
        return JSON.parse(data.value);
      } catch (e) {
        console.warn('Invalid approval roles format:', e);
        return ['chairman', 'treasurer'];
      }
    }

    return ['chairman', 'treasurer'];
  },

  /**
   * Check if transaction requires approval
   */
  async requiresApproval(transactionType, amount) {
    if (transactionType !== 'debit') return false;
    const threshold = await this.getApprovalThreshold();
    return amount >= threshold;
  },

  /**
   * Get all transactions with filters
   */
  async getAll(filters = {}) {
    let query = supabase
      .from('transactions')
      .select(`
        *,
        transaction_categories (*),
        landlords (id, title, full_name, house_address, house_number, lane_number),
        payments (id, reference_code, amount),
        admin_profiles:created_by (id, full_name, role),
        approver:approved_by (id, full_name, role),
        rejector:rejected_by (id, full_name, role)
      `)
      .order('created_at', { ascending: false });

    if (filters.transaction_type) {
      query = query.eq('transaction_type', filters.transaction_type);
    }
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.landlord_id) {
      query = query.eq('landlord_id', filters.landlord_id);
    }
    if (filters.payment_id) {
      query = query.eq('payment_id', filters.payment_id);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.search) {
      query = query.or(
        `description.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`
      );
    }

    // Pagination
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count: count || 0, page, pageSize };
  },

  /**
   * Get transaction by ID
   */
  async getById(id) {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_categories (*),
        landlords (*),
        payments (*),
        admin_profiles:created_by (*),
        approver:approved_by (*),
        rejector:rejected_by (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new transaction.
   * Delegates to the create_transaction RPC so the insert, approval decision,
   * balance recompute, and activity log happen atomically and the actor is
   * derived server-side from auth.uid().
   */
  async create(transaction) {
    const { data, error } = await supabase.rpc('create_transaction', {
      p_transaction_type: transaction.transaction_type,
      p_category_id: transaction.category_id,
      p_amount: transaction.amount,
      p_description: transaction.description ?? null,
      p_reference: transaction.reference ?? null,
      p_landlord_id: transaction.landlord_id ?? null,
      p_payment_id: transaction.payment_id ?? null,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Approve a pending transaction.
   * Delegates to the approve_transaction RPC (role-gated, atomic status change +
   * balance recompute + activity log).
   */
  async approve(transactionId) {
    const { data, error } = await supabase.rpc('approve_transaction', {
      p_transaction_id: transactionId,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Reject a pending transaction.
   * Delegates to the reject_transaction RPC (role-gated, atomic status change +
   * activity log).
   */
  async reject(transactionId, reason = '') {
    const { data, error } = await supabase.rpc('reject_transaction', {
      p_transaction_id: transactionId,
      p_reason: reason,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Recompute the account balance from approved transactions.
   * Delegates to a Postgres RPC so the balance is derived atomically
   * (single source of truth) instead of a client-side read-then-write.
   */
  async updateAccountBalance() {
    const { data, error } = await supabase.rpc('recompute_account_balance');
    if (error) throw error;
    return data;
  },

  /**
   * Get current account balance
   */
  async getAccountBalance(accountId = '00000000-0000-0000-0000-000000000001') {
    const { data, error } = await supabase
      .from('account_balance')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No balance record exists, return default
      return {
        id: accountId,
        account_name: 'Main Account',
        balance: 0,
        last_transaction_id: null,
        updated_at: new Date().toISOString(),
      };
    }

    if (error) throw error;
    return data;
  },

  /**
   * Get transaction categories
   */
  async getCategories(type = null) {
    let query = supabase
      .from('transaction_categories')
      .select('*')
      .eq('active', true)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Get transaction statistics
   */
  async getStatistics(filters = {}) {
    const transactionsResult = await this.getAll({ ...filters, pageSize: 10000 });
    const transactions = transactionsResult.data || [];

    const stats = {
      totalCredits: 0,
      totalDebits: 0,
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
      byCategory: {},
    };

    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount);
      
      if (transaction.transaction_type === 'credit') {
        stats.totalCredits += amount;
      } else {
        stats.totalDebits += amount;
      }

      if (transaction.status === 'pending') stats.pendingCount++;
      if (transaction.status === 'approved') stats.approvedCount++;
      if (transaction.status === 'rejected') stats.rejectedCount++;

      const categoryName = transaction.transaction_categories?.description || transaction.transaction_categories?.name || 'Unknown';
      if (!stats.byCategory[categoryName]) {
        stats.byCategory[categoryName] = { credits: 0, debits: 0 };
      }
      if (transaction.transaction_type === 'credit') {
        stats.byCategory[categoryName].credits += amount;
      } else {
        stats.byCategory[categoryName].debits += amount;
      }
    });

    const balance = await this.getAccountBalance();
    stats.currentBalance = parseFloat(balance.balance || 0);
    stats.netFlow = stats.totalCredits - stats.totalDebits;

    return stats;
  },

  /**
   * Export transactions for CSV/PDF
   */
  async getExportData(filters = {}) {
    const result = await this.getAll({ ...filters, pageSize: 10000 });
    return result.data || [];
  },

  /**
   * Create a new transaction category (chairman only)
   */
  async createCategory(category) {
    const { data, error } = await supabase
      .from('transaction_categories')
      .insert([category])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a transaction category (chairman only)
   */
  async updateCategory(categoryId, updates) {
    const { data, error } = await supabase
      .from('transaction_categories')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a transaction category (chairman only)
   */
  async deleteCategory(categoryId) {
    const { error } = await supabase
      .from('transaction_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  },
};

export default transactionService;
