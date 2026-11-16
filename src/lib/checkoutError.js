/**
 * Turns a failed checkout call into a short, safe message the rider can act on.
 * Server messages are bucketed, never forwarded raw, so nothing internal leaks.
 */
export function checkoutErrorMessage(error) {
  const status = error?.response?.status ?? error?.status ?? null;
  const raw = error?.response?.data?.error || error?.data?.error || error?.message || '';
  const text = String(raw).toLowerCase();

  if (status === 401 || status === 403) {
    return 'Please sign in again to start checkout.';
  }
  if (text.includes('plan not found') || text.includes('resolve paystack plan')) {
    return 'This plan is not available right now. Please try again in a moment.';
  }
  if (status === 502 || status === 503 || status === 504 || text.includes('network') || text.includes('fetch')) {
    return 'Payments are temporarily unavailable. Check your connection and try again.';
  }
  if (status === 500 || text.includes('secret') || text.includes('paystack') || text.includes('authenticated')) {
    return 'Payments are not available right now. Please try again later or contact support.';
  }
  return 'Checkout failed. Please try again.';
}