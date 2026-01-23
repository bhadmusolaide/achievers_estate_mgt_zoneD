import { supabase } from '../lib/supabase';
import { transactionService } from './transactionService';
import { financialOverviewService } from './financialOverviewService';
import { celebrationService } from './celebrationService';

export const dashboardService = {
  /**
   * Get dashboard metrics
   */
  async getMetrics() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total landlords count
    const { count: totalLandlords } = await supabase
      .from('landlords')
      .select('*', { count: 'exact', head: true });

    // Get active landlords count
    const { count: activeLandlords } = await supabase
      .from('landlords')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get confirmed payments total
    const { data: confirmedPayments } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'confirmed');

    const totalConfirmedAmount = confirmedPayments?.reduce(
      (sum, p) => sum + parseFloat(p.amount), 0
    ) || 0;

    // Get total outstanding amount from financial overview
    let totalOutstanding = 0;
    try {
      const totals = await financialOverviewService.getAggregateTotals();
      totalOutstanding = totals.totalOutstanding || 0;
    } catch (error) {
      console.warn('Could not fetch outstanding payments:', error);
    }

    // Get receipts sent today
    const { count: receiptsSentToday } = await supabase
      .from('receipts')
      .select('*', { count: 'exact', head: true })
      .gte('generated_at', today.toISOString());

    // Get account balance
    let accountBalance = 0;
    try {
      const balance = await transactionService.getAccountBalance();
      accountBalance = parseFloat(balance.balance || 0);
    } catch (error) {
      console.warn('Could not fetch account balance:', error);
    }

    return {
      totalLandlords: totalLandlords || 0,
      activeLandlords: activeLandlords || 0,
      totalConfirmedAmount,
      pendingPayments: totalOutstanding,
      receiptsSentToday: receiptsSentToday || 0,
      accountBalance,
    };
  },

  /**
   * Get recent payments
   */
  async getRecentPayments(limit = 5) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        landlords (full_name),
        payment_types (name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  /**
   * Get payment statistics by month
   */
  async getMonthlyStats(year) {
    const { data, error } = await supabase
      .from('payments')
      .select('payment_month, amount, status')
      .eq('payment_year', year)
      .eq('status', 'confirmed');

    if (error) throw error;

    // Aggregate by month
    const monthlyData = Array(12).fill(0);
    data.forEach((payment) => {
      monthlyData[payment.payment_month - 1] += parseFloat(payment.amount);
    });

    return monthlyData;
  },

  /**
   * Get payment type distribution
   */
  async getPaymentTypeDistribution() {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        amount,
        payment_types (name)
      `)
      .eq('status', 'confirmed');

    if (error) throw error;

    // Aggregate by payment type
    const distribution = {};
    data.forEach((payment) => {
      const typeName = payment.payment_types?.name || 'Unknown';
      distribution[typeName] = (distribution[typeName] || 0) + parseFloat(payment.amount);
    });

    return distribution;
  },

  /**
   * Get upcoming celebrations (within 3 days)
   */
  async getUpcomingCelebrations() {
    try {
      // Fetch upcoming celebrations from the queue
      const { data: queuedCelebrations, error: queueError } = await supabase
        .from('celebrations_queue')
        .select(`
          *,
          landlords (
            id,
            full_name,
            phone,
            email,
            house_address,
            road,
            zone
          )
        `)
        .in('status', ['pending', 'approved'])
        .gt('days_to_event', 0)
        .lte('days_to_event', 3)
        .order('days_to_event', { ascending: true })
        .limit(5); // Limit to top 5 upcoming celebrations

      if (queueError) throw queueError;

      // If queue is empty, fall back to computing directly from landlords
      if (!queuedCelebrations || queuedCelebrations.length === 0) {
        const { data: landlords } = await supabase
          .from('landlords')
          .select('id, full_name, phone, email, house_address, road, zone, date_of_birth, wedding_anniversary, celebrate_opt_in, status, onboarding_status')
          .eq('status', 'active')
          .eq('celebrate_opt_in', true);

        if (landlords && landlords.length > 0) {
          const eligible = landlords.filter((ll) => ll.onboarding_status === 'active' || ll.onboarding_status === 'pending' || ll.onboarding_status == null);
          
          // Get computed upcoming events within 3 days
          const computedBirthdays = await celebrationService.getByType('birthday');
          const computedAnniversaries = await celebrationService.getByType('anniversary');
          
          const filteredBirthdays = (computedBirthdays || []).filter(c => c.days_to_event > 0 && c.days_to_event <= 3);
          const filteredAnniversaries = (computedAnniversaries || []).filter(c => c.days_to_event > 0 && c.days_to_event <= 3);
          
          return [...filteredBirthdays, ...filteredAnniversaries]
            .sort((a, b) => a.days_to_event - b.days_to_event)
            .slice(0, 5);
        }
      }

      return queuedCelebrations || [];
    } catch (error) {
      console.error('Error fetching upcoming celebrations:', error);
      return [];
    }
  },
};

export default dashboardService;

