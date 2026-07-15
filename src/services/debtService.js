import { supabase } from '../lib/supabase';
import { transactionService } from './transactionService';

export const debtService = {
  async getAll() {
    const { data, error } = await supabase
      .from('project_debts')
      .select(`
        *,
        projects (id, name, estimated_budget, milestone_level),
        debt_payments (id, amount, payment_method, notes, created_at, created_by)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getActiveDebts() {
    const { data, error } = await supabase
      .from('project_debts')
      .select(`
        *,
        projects (id, name, estimated_budget, milestone_level),
        debt_payments (id, amount, payment_method, notes, created_at, created_by)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('project_debts')
      .select(`
        *,
        projects (id, name, estimated_budget, milestone_level),
        debt_payments (id, amount, payment_method, notes, created_at, created_by)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async create(debt) {
    const { data, error } = await supabase
      .from('project_debts')
      .insert([{
        project_id: debt.project_id,
        total_amount: debt.amount,
        remaining_amount: debt.amount,
        created_by: debt.created_by || null,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Record a payment against a debt.
   * Creates a debt_payment record AND a debit transaction
   * (debt_repayment category) that decreases the account balance.
   */
  async makePayment(debtId, amount, paymentMethod, notes, adminId) {
    const debt = await this.getById(debtId);
    if (!debt) throw new Error('Debt not found');
    if (debt.status === 'paid') throw new Error('Debt is already fully paid');
    if (amount <= 0) throw new Error('Payment amount must be positive');

    const newRemaining = Math.max(0, parseFloat(debt.remaining_amount) - parseFloat(amount));
    const newStatus = newRemaining <= 0 ? 'paid' : 'active';

    // Get the debt_repayment category (debit type)
    const categories = await transactionService.getCategories('debit');
    const debtCategory = categories.find(c => c.name === 'debt_repayment');
    if (!debtCategory) throw new Error('debt_repayment category not found. Run the migration.');

    // Create the debit transaction (money going out to pay the debt)
    const transaction = await transactionService.create({
      transaction_type: 'debit',
      category_id: debtCategory.id,
      amount: parseFloat(amount),
      description: notes || `Debt payment for project: ${debt.projects?.name || 'Unknown'}`,
      reference: `DEBT-${debtId.slice(0, 8).toUpperCase()}`,
    });

    // Auto-approve the transaction
    if (transaction.status === 'pending') {
      await transactionService.approve(transaction.id);
    }

    // Insert the debt payment record
    const { data: payment, error: payError } = await supabase
      .from('debt_payments')
      .insert([{
        debt_id: debtId,
        amount: parseFloat(amount),
        payment_method: paymentMethod || 'bank_transfer',
        notes: notes || null,
        created_by: adminId || null,
      }])
      .select()
      .single();

    if (payError) throw payError;

    // Update the debt remaining amount and status
    const { data: updatedDebt, error: updateError } = await supabase
      .from('project_debts')
      .update({
        remaining_amount: newRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', debtId)
      .select()
      .single();

    if (updateError) throw updateError;

    return { payment, debt: updatedDebt, transaction };
  },

  async getTotalOutstanding() {
    const { data, error } = await supabase
      .from('project_debts')
      .select('remaining_amount')
      .eq('status', 'active');

    if (error) throw error;
    return (data || []).reduce((sum, d) => sum + parseFloat(d.remaining_amount || 0), 0);
  },

  async remove(id) {
    const { error } = await supabase
      .from('project_debts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },
};

export default debtService;