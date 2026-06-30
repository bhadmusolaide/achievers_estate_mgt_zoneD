import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the supabase client before importing the service under test.
const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}));

import { transactionService } from './transactionService';

beforeEach(() => {
  rpc.mockReset();
});

describe('transactionService.create', () => {
  it('calls the create_transaction RPC with mapped params and returns the row', async () => {
    const row = { id: 'tx-1', status: 'approved' };
    rpc.mockResolvedValue({ data: row, error: null });

    const result = await transactionService.create({
      transaction_type: 'debit',
      category_id: 'cat-1',
      amount: 2500,
      description: 'Repairs',
      reference: 'REF-1',
      landlord_id: 'll-1',
      payment_id: 'pay-1',
    });

    expect(rpc).toHaveBeenCalledWith('create_transaction', {
      p_transaction_type: 'debit',
      p_category_id: 'cat-1',
      p_amount: 2500,
      p_description: 'Repairs',
      p_reference: 'REF-1',
      p_landlord_id: 'll-1',
      p_payment_id: 'pay-1',
    });
    expect(result).toBe(row);
  });

  it('defaults optional fields to null', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });

    await transactionService.create({
      transaction_type: 'credit',
      category_id: 'cat-2',
      amount: 100,
    });

    expect(rpc).toHaveBeenCalledWith('create_transaction', {
      p_transaction_type: 'credit',
      p_category_id: 'cat-2',
      p_amount: 100,
      p_description: null,
      p_reference: null,
      p_landlord_id: null,
      p_payment_id: null,
    });
  });

  it('throws when the RPC returns an error', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('Not authorized') });
    await expect(
      transactionService.create({ transaction_type: 'credit', category_id: 'c', amount: 1 })
    ).rejects.toThrow('Not authorized');
  });
});

describe('transactionService.approve', () => {
  it('calls approve_transaction with the id', async () => {
    const row = { id: 'tx-9', status: 'approved' };
    rpc.mockResolvedValue({ data: row, error: null });

    const result = await transactionService.approve('tx-9');

    expect(rpc).toHaveBeenCalledWith('approve_transaction', { p_transaction_id: 'tx-9' });
    expect(result).toBe(row);
  });

  it('propagates RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('not pending') });
    await expect(transactionService.approve('tx-9')).rejects.toThrow('not pending');
  });
});

describe('transactionService.reject', () => {
  it('calls reject_transaction with id and reason', async () => {
    rpc.mockResolvedValue({ data: { id: 'tx-3', status: 'rejected' }, error: null });

    await transactionService.reject('tx-3', 'Duplicate');

    expect(rpc).toHaveBeenCalledWith('reject_transaction', {
      p_transaction_id: 'tx-3',
      p_reason: 'Duplicate',
    });
  });

  it('defaults the reason to an empty string', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });

    await transactionService.reject('tx-4');

    expect(rpc).toHaveBeenCalledWith('reject_transaction', {
      p_transaction_id: 'tx-4',
      p_reason: '',
    });
  });
});

describe('transactionService.updateAccountBalance', () => {
  it('delegates to the recompute_account_balance RPC and returns the balance', async () => {
    rpc.mockResolvedValue({ data: 12345, error: null });

    const balance = await transactionService.updateAccountBalance();

    expect(rpc).toHaveBeenCalledWith('recompute_account_balance');
    expect(balance).toBe(12345);
  });

  it('throws when the RPC errors', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(transactionService.updateAccountBalance()).rejects.toThrow('boom');
  });
});
