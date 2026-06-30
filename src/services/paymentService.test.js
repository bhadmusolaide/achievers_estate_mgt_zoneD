import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../lib/supabase', () => ({
  supabase: { rpc: (...args) => rpc(...args) },
}));

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('./toastService', () => ({ default: toast }));

import { paymentService } from './paymentService';

beforeEach(() => {
  rpc.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe('paymentService.confirm', () => {
  it('calls the confirm_payment RPC with the payment id', async () => {
    rpc.mockResolvedValue({ data: { id: 'pay-1', reference_code: 'ZD-REF' }, error: null });

    const result = await paymentService.confirm('pay-1');

    expect(rpc).toHaveBeenCalledWith('confirm_payment', { p_payment_id: 'pay-1' });
    expect(result).toEqual({ id: 'pay-1', reference_code: 'ZD-REF' });
  });

  it('shows a success toast with the reference code on success', async () => {
    rpc.mockResolvedValue({ data: { id: 'pay-2', reference_code: 'ZD-XYZ' }, error: null });

    await paymentService.confirm('pay-2');

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('ZD-XYZ'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('shows an error toast and rethrows when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('already confirmed') });

    await expect(paymentService.confirm('pay-3')).rejects.toThrow('already confirmed');
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('already confirmed'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});
