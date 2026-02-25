import { supabase } from '../lib/supabase';
import { generateReferenceCode } from '../utils/helpers';
import { activityLogService, ACTION_TYPES, ENTITY_TYPES } from './activityLogService';
import { transactionService } from './transactionService';
import toastService from './toastService';

export const financialOverviewService = {
  /**
   * Get financial overview data for all landlords with filters, pagination, and sorting
   * Uses server-side SQL aggregation for efficiency
   */
  async getOverview(filters = {}, page = 1, pageSize = 20, sortConfig = { key: 'full_name', direction: 'asc' }) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build base query for landlords
    let query = supabase
      .from('landlords')
      .select(`
        id,
        title,
        full_name,
        phone,
        house_address,
        road,
        zone,
        status
      `, { count: 'exact' })
      .eq('status', 'active');

    // Add sorting
    if (sortConfig.key === 'full_name') {
      query = query.order('full_name', { ascending: sortConfig.direction === 'asc' });
    } else if (sortConfig.key === 'lastPaymentDate') {
      // For lastPaymentDate, we need to sort by the max payment date per landlord
      // This is complex, so we'll handle it in the processing step
      query = query.order('full_name'); // Default fallback
    } else {
      // For other fields that are calculated, we'll sort client-side
      query = query.order('full_name'); // Default order
    }

    // Apply filters
    if (filters.zone) {
      query = query.eq('zone', filters.zone);
    }
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,phone.ilike.%${filters.search}%,house_address.ilike.%${filters.search}%,road.ilike.%${filters.search}%`
      );
    }
    if (filters.road) {
      query = query.eq('road', filters.road);
    }
    if (filters.paymentTypeId) {
      // Get landlords with this payment type assigned
      const { data: assigned, error: assignError } = await supabase
        .from('landlord_payment_types')
        .select('landlord_id')
        .eq('payment_type_id', filters.paymentTypeId)
        .eq('active', true);
      if (assignError) throw assignError;
      const assignedIds = assigned.map(a => a.landlord_id);
      query = query.in('id', assignedIds);
    }

    // Apply pagination
    query = query.range(from, to);

    const { data: landlords, error, count } = await query;
    if (error) throw error;

    // Get landlord payment type assignments for these landlords
    const landlordIds = landlords.map(l => l.id);
    let landlordPaymentTypes = [];
    try {
      const { data, error } = await supabase
        .from('landlord_payment_types')
        .select(`
          landlord_id,
          payment_type_id,
          amount,
          frequency,
          start_month,
          start_year,
          active,
          assigned_at,
          payment_types (id, name, frequency)
        `)
        .in('landlord_id', landlordIds)
        .eq('active', true);

      if (error) throw error;
      landlordPaymentTypes = data || [];
    } catch (error) {
      // Table might not exist yet, proceed with empty assignments
      console.warn('landlord_payment_types table not available:', error.message);
      landlordPaymentTypes = [];
    }

    // Get confirmed payments for these landlords
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select('landlord_id, payment_type_id, amount')
      .in('landlord_id', landlordIds)
      .eq('status', 'confirmed');

    if (paymentsError) throw paymentsError;

    // Get last payment dates
    const { data: lastPayments, error: lastPaymentsError } = await supabase
      .from('payments')
      .select('landlord_id, created_at')
      .in('landlord_id', landlordIds)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false });

    if (lastPaymentsError) throw lastPaymentsError;

    // Create lookup maps
    // Group payments by landlord AND payment_type for proper matching
    const paymentsByLandlordAndType = {};
    payments.forEach(p => {
      const key = `${p.landlord_id}_${p.payment_type_id}`;
      if (!paymentsByLandlordAndType[key]) {
        paymentsByLandlordAndType[key] = [];
      }
      paymentsByLandlordAndType[key].push(p);
    });

    // Also keep a flat list of all payments per landlord for "other payments" tracking
    const allPaymentsByLandlord = {};
    payments.forEach(p => {
      if (!allPaymentsByLandlord[p.landlord_id]) {
        allPaymentsByLandlord[p.landlord_id] = [];
      }
      allPaymentsByLandlord[p.landlord_id].push(p);
    });

    const landlordPaymentTypesByLandlord = {};
    landlordPaymentTypes.forEach(lpt => {
      if (!landlordPaymentTypesByLandlord[lpt.landlord_id]) {
        landlordPaymentTypesByLandlord[lpt.landlord_id] = [];
      }
      landlordPaymentTypesByLandlord[lpt.landlord_id].push(lpt);
    });

    const lastPaymentByLandlord = {};
    lastPayments.forEach(p => {
      if (!lastPaymentByLandlord[p.landlord_id]) {
        lastPaymentByLandlord[p.landlord_id] = p.created_at;
      }
    });

    // Process landlord data with calculations
    const processedData = landlords.map(landlord => {
      const activeAssignments = landlordPaymentTypesByLandlord[landlord.id] || [];
      const allLandlordPayments = allPaymentsByLandlord[landlord.id] || [];

      // Get all assigned payment type IDs for this landlord
      const assignedTypeIds = new Set(activeAssignments.map(a => a.payment_type_id));

      // Calculate per-payment-type breakdown with matched payments
      const paymentTypeBreakdown = activeAssignments.map(assignment => {
        const key = `${landlord.id}_${assignment.payment_type_id}`;
        const matchedPayments = paymentsByLandlordAndType[key] || [];
        const expectedAmount = parseFloat(assignment.amount || 0);
        const paidAmount = matchedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const balance = expectedAmount - paidAmount;

        return {
          id: assignment.payment_type_id,
          name: assignment.payment_types?.name,
          frequency: assignment.frequency || assignment.payment_types?.frequency || 'monthly',
          expected: expectedAmount,
          paid: paidAmount,
          balance: balance
        };
      });

      // Calculate totals from the breakdown (only matched payments count toward assigned balances)
      const totalExpected = paymentTypeBreakdown.reduce((sum, pt) => sum + pt.expected, 0);
      const totalPaidForAssigned = paymentTypeBreakdown.reduce((sum, pt) => sum + pt.paid, 0);
      const totalBalance = paymentTypeBreakdown.reduce((sum, pt) => sum + pt.balance, 0);

      // Calculate unassigned payments (payments for types not in landlord's assignments)
      const unassignedPayments = allLandlordPayments.filter(p => !assignedTypeIds.has(p.payment_type_id));
      const totalUnassignedPaid = unassignedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

      // Total paid includes both assigned and unassigned payments
      const totalPaid = totalPaidForAssigned + totalUnassignedPaid;

      // Determine payment status based on assigned payment types only
      let paymentStatus = 'pending';
      if (totalExpected > 0) {
        if (totalBalance <= 0) {
          paymentStatus = 'paid';
        } else if (totalPaidForAssigned > 0) {
          paymentStatus = 'partial';
        }
      }

      return {
        ...landlord,
        assignedPaymentTypes: paymentTypeBreakdown,
        totalExpected,
        totalPaid,
        totalPaidForAssigned,
        totalUnassignedPaid,
        balance: totalBalance,
        paymentStatus,
        lastPaymentDate: lastPaymentByLandlord[landlord.id] || null
      };
    });

    // Apply payment status filter if specified
    let filteredData = processedData;
    if (filters.paymentStatus) {
      filteredData = processedData.filter(d => d.paymentStatus === filters.paymentStatus);
    }

    // Apply client-side sorting for calculated fields
    if (sortConfig.key !== 'full_name') {
      filteredData.sort((a, b) => {
        let aValue, bValue;

        switch (sortConfig.key) {
          case 'totalExpected':
            aValue = a.totalExpected;
            bValue = b.totalExpected;
            break;
          case 'totalPaid':
            aValue = a.totalPaid;
            bValue = b.totalPaid;
            break;
          case 'balance':
            aValue = a.balance;
            bValue = b.balance;
            break;
          case 'paymentStatus':
            // Sort by status priority: paid > partial > pending
            const statusOrder = { paid: 3, partial: 2, pending: 1 };
            aValue = statusOrder[a.paymentStatus] || 0;
            bValue = statusOrder[b.paymentStatus] || 0;
            break;
          case 'lastPaymentDate':
            aValue = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
            bValue = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
            break;
          default:
            aValue = a[sortConfig.key] || '';
            bValue = b[sortConfig.key] || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return {
      data: filteredData,
      count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize)
    };
  },

  /**
   * Get aggregate totals for filtered landlords
   */
  async getAggregateTotals(filters = {}) {
    // Get all matching landlords (no pagination for totals)
    const { data } = await this.getOverview(filters, 1, 10000);
    
    const totals = data.reduce((acc, landlord) => ({
      totalExpected: acc.totalExpected + landlord.totalExpected,
      totalPaid: acc.totalPaid + landlord.totalPaid,
      totalOutstanding: acc.totalOutstanding + Math.max(0, landlord.balance)
    }), { totalExpected: 0, totalPaid: 0, totalOutstanding: 0 });

    return {
      ...totals,
      landlordCount: data.length,
      paidCount: data.filter(d => d.paymentStatus === 'paid').length,
      partialCount: data.filter(d => d.paymentStatus === 'partial').length,
      pendingCount: data.filter(d => d.paymentStatus === 'pending').length
    };
  },

  /**
   * Get all payment types
   */
  async getPaymentTypes() {
    const { data, error } = await supabase
      .from('payment_types')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Create payments for outstanding amounts for current period
   */
  async createOutstandingPayments(landlordId, adminId) {
    try {
      // Get current date for period
      const now = new Date();
      const paymentMonth = now.getMonth() + 1; // JS months are 0-based
      const paymentYear = now.getFullYear();

      // Get landlord's assigned payment types with frequency
      const { data: assignments, error: assignError } = await supabase
        .from('landlord_payment_types')
        .select(`
          payment_type_id,
          amount,
          payment_types (id, name, frequency)
        `)
        .eq('landlord_id', landlordId)
        .eq('active', true);

      if (assignError) throw assignError;

      // Get existing confirmed payments for this period
      const { data: existingPayments, error: payError } = await supabase
        .from('payments')
        .select('payment_type_id, amount')
        .eq('landlord_id', landlordId)
        .eq('payment_month', paymentMonth)
        .eq('payment_year', paymentYear)
        .eq('status', 'confirmed');

      if (payError) throw payError;

      // Calculate outstanding amounts per payment type, considering frequency
      const paymentsMap = {};
      existingPayments.forEach(p => {
        paymentsMap[p.payment_type_id] = (paymentsMap[p.payment_type_id] || 0) + parseFloat(p.amount);
      });

      const paymentsToCreate = [];

      for (const assignment of assignments) {
        const frequency = assignment.payment_types?.frequency || 'monthly';
        const expected = parseFloat(assignment.amount);

        // Check if this payment type should be expected for current period
        let shouldCreatePayment = false;

        switch (frequency) {
          case 'monthly':
            // Monthly payments are always expected
            shouldCreatePayment = true;
            break;

          case 'yearly':
            // Yearly payments only in January
            shouldCreatePayment = paymentMonth === 1;
            break;

          case 'one-time':
            // One-time payments only if never paid before
            const hasEverPaid = await supabase
              .from('payments')
              .select('id')
              .eq('landlord_id', landlordId)
              .eq('payment_type_id', assignment.payment_type_id)
              .eq('status', 'confirmed')
              .limit(1);

            shouldCreatePayment = hasEverPaid.data?.length === 0;
            break;
        }

        if (shouldCreatePayment) {
          const paid = paymentsMap[assignment.payment_type_id] || 0;
          const outstanding = expected - paid;

          if (outstanding > 0) {
            paymentsToCreate.push({
              landlord_id: landlordId,
              payment_type_id: assignment.payment_type_id,
              amount: outstanding,
              payment_method: 'cash', // Default
              payment_month: paymentMonth,
              payment_year: paymentYear,
              payment_type_name: assignment.payment_types?.name || 'PAY',
            });
          }
        }
      }

      if (paymentsToCreate.length === 0) {
        throw new Error('No outstanding payments found for current period');
      }

      // Create payments
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentsToCreate.map(payment => ({
          landlord_id: payment.landlord_id,
          payment_type_id: payment.payment_type_id,
          amount: payment.amount,
          payment_method: payment.payment_method,
          payment_month: payment.payment_month,
          payment_year: payment.payment_year,
          reference_code: generateReferenceCode(
            landlordId,
            payment.payment_year,
            payment.payment_month,
            payment.payment_type_name
          ),
          logged_by: adminId,
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })))
        .select();

      if (error) throw error;

      // Create corresponding credit transactions for each payment
      try {
        // Get rent_income category
        const categories = await transactionService.getCategories('credit');
        const rentIncomeCategory = categories.find(c => c.name === 'rent_income');
        
        if (rentIncomeCategory && adminId) {
          for (const payment of data) {
            const paymentType = paymentsToCreate.find(p => p.payment_type_id === payment.payment_type_id);
            
            const transaction = await transactionService.create({
              transaction_type: 'credit',
              category_id: rentIncomeCategory.id,
              amount: parseFloat(payment.amount),
              description: `Payment from Landlord ID ${payment.landlord_id} - ${paymentType?.payment_type_name || 'Payment'}`,
              reference: payment.reference_code,
              landlord_id: payment.landlord_id,
              payment_id: payment.id,
            }, adminId);

            // Auto-approve the transaction
            if (transaction.status === 'pending') {
              await transactionService.approve(transaction.id, adminId);
            }
          }
        }
      } catch (transactionError) {
        // Log error but don't fail the overall operation
        console.error('Error creating transactions for payments:', transactionError);
      }

      // Log activities
      for (const payment of data) {
        const paymentType = paymentsToCreate.find(p => p.payment_type_id === payment.payment_type_id);
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.PAYMENT_CONFIRMED,
          entityType: ENTITY_TYPES.PAYMENT,
          entityId: payment.id,
          metadata: {
            amount: payment.amount,
            payment_type: paymentType?.payment_type_name || 'unknown',
            year: payment.payment_year,
            month: payment.payment_month,
            landlord_id: landlordId,
          },
        });
      }

      // Show success toast
      toastService.success(`Created ${data.length} outstanding payment(s) for current period`);

      return data;
    } catch (error) {
      // Show error toast
      toastService.error(`Failed to create outstanding payments: ${error.message}`);
      throw error;
    }
  },

  /**
   * Bulk assign payment types to landlords
   * Uses INSERT ... ON CONFLICT ... UPDATE for efficiency
   */
  async bulkAssign(landlordIds, paymentTypeId, amount, adminId, frequency = 'monthly', startMonth = null, startYear = null) {
    try {
      const assignments = landlordIds.map(landlordId => ({
        landlord_id: landlordId,
        payment_type_id: paymentTypeId,
        amount: amount,
        frequency: frequency,
        start_month: startMonth,
        start_year: startYear,
        active: true,
        assigned_by: adminId,
        assigned_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('landlord_payment_types')
        .upsert(assignments, {
          onConflict: 'landlord_id,payment_type_id',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      // Log the activity
      if (adminId) {
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.PAYMENT_TYPE_ASSIGNED,
          entityType: ENTITY_TYPES.LANDLORD,
          entityId: null,
          metadata: {
            landlord_count: landlordIds.length,
            payment_type_id: paymentTypeId,
            amount: amount,
            frequency: frequency
          }
        });
      }

      // Show success toast
      toastService.success(`Assigned payment type to ${landlordIds.length} landlord(s)`);

      return data;
    } catch (error) {
      // Show error toast
      toastService.error(`Failed to assign payment types: ${error.message}`);
      throw error;
    }
  },

  /**
   * Bulk unassign payment types from landlords
   * Sets active = false instead of deleting
   */
  async bulkUnassign(landlordIds, paymentTypeId, adminId) {
    try {
      const { data, error } = await supabase
        .from('landlord_payment_types')
        .update({ active: false })
        .in('landlord_id', landlordIds)
        .eq('payment_type_id', paymentTypeId)
        .select();

      if (error) throw error;

      // Log the activity
      if (adminId) {
        await activityLogService.log({
          adminId,
          actionType: ACTION_TYPES.PAYMENT_TYPE_UNASSIGNED,
          entityType: ENTITY_TYPES.LANDLORD,
          entityId: null,
          metadata: {
            landlord_count: landlordIds.length,
            payment_type_id: paymentTypeId
          }
        });
      }

      // Show success toast
      toastService.success(`Unassigned payment type from ${landlordIds.length} landlord(s)`);

      return data;
    } catch (error) {
      // Show error toast
      toastService.error(`Failed to unassign payment types: ${error.message}`);
      throw error;
    }
  },

  /**
   * Assign single payment type to single landlord
   */
  async assignPaymentType(landlordId, paymentTypeId, amount, adminId) {
    const { data, error } = await supabase
      .from('landlord_payment_types')
      .upsert({
        landlord_id: landlordId,
        payment_type_id: paymentTypeId,
        amount: amount,
        active: true,
        assigned_by: adminId,
        assigned_at: new Date().toISOString()
      }, {
        onConflict: 'landlord_id,payment_type_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Unassign single payment type from single landlord
   */
  async unassignPaymentType(landlordId, paymentTypeId) {
    const { data, error } = await supabase
      .from('landlord_payment_types')
      .update({ active: false })
      .eq('landlord_id', landlordId)
      .eq('payment_type_id', paymentTypeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Get landlord assignments for a specific landlord
   */
  async getLandlordAssignments(landlordId) {
    const { data, error } = await supabase
      .from('landlord_payment_types')
      .select(`
        *,
        payment_types (id, name, default_amount)
      `)
      .eq('landlord_id', landlordId)
      .eq('active', true);

    if (error) throw error;
    return data;
  },

  /**
   * Get distinct zones for filter dropdown
   */
  async getZones() {
    const { data, error } = await supabase
      .from('landlords')
      .select('zone')
      .eq('status', 'active');

    if (error) throw error;

    const uniqueZones = [...new Set(data.map(d => d.zone).filter(Boolean))];
    return uniqueZones.sort();
  },

  /**
   * Export data for CSV/PDF generation
   */
  async getExportData(filters = {}) {
    const { data } = await this.getOverview(filters, 1, 10000);
    return data;
  }
};

export default financialOverviewService;

