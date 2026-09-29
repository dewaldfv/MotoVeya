import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const PLAN_AMOUNT = 8999; // kobo = R89.99
const PLAN_CURRENCY = 'ZAR';
const PLAN_INTERVAL = 'monthly';
const PLAN_NAME = 'MotoVeya Premium Monthly';

// Keep PAYSTACK_SECRET_KEY server-side in Base44.

// Resolve the recurring plan dynamically so a stale/deleted plan code never
// breaks checkout. Reuses an existing plan matching amount/currency/interval,
// otherwise creates one. Works across test/live key swaps.
async function resolvePlanCode(secret) {
  const listRes = await fetch('https://api.paystack.co/plan', {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const listData = await listRes.json().catch(() => ({}));
  const plans = Array.isArray(listData?.data) ? listData.data : [];
  const match = plans.find(
    (p) => Number(p.amount) === PLAN_AMOUNT && p.currency === PLAN_CURRENCY && p.interval === PLAN_INTERVAL
  );
  if (match?.plan_code) return match.plan_code;

  const createRes = await fetch('https://api.paystack.co/plan', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: PLAN_NAME,
      amount: PLAN_AMOUNT,
      interval: PLAN_INTERVAL,
      currency: PLAN_CURRENCY,
    }),
  });
  const createData = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createData?.data?.plan_code) {
    throw new Error(createData?.message || 'Failed to resolve Paystack plan');
  }
  return createData.data.plan_code;
}

export default async function(req) {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const base44 = createClientFromRequest(req);
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!me?.id || !me?.email) {
      return Response.json({ error: 'Authenticated user could not be resolved' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { billing_cycle, origin } = body;
    // MotoVeya currently uses the configured Paystack monthly Premium plan.
    // Annual billing is not enabled until a separate annual Paystack plan exists.
    const cycle = 'monthly';
    const reference = `motogo_${cycle}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const appId = secrets.get('BASE44_APP_ID') || '';
    const secret = secrets.get('PAYSTACK_SECRET_KEY');
    const planCode = await resolvePlanCode(secret);

    // Strict origin whitelist to prevent open-redirect via callback_url injection
    const TRUSTED_ORIGINS = [
      'https://motoveya.base44.app',
      'https://web-motoveya.base44.app',
    ];
    const candidateOrigin = (typeof origin === 'string' ? origin : '') || req.headers.get('origin') || '';
    const appOrigin = TRUSTED_ORIGINS.includes(candidateOrigin) ? candidateOrigin : TRUSTED_ORIGINS[0];

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: me.email,
        // Paystack uses the plan for the recurring subscription amount.
        amount: PLAN_AMOUNT,
        currency: PLAN_CURRENCY,
        plan: planCode,
        reference,
        callback_url: `${appOrigin}/premium?status=success`,
        metadata: {
          user_id: me.id,
          user_email: me.email,
          billing_cycle: cycle,
          paystack_plan_code: planCode,
          base44_app_id: appId,
          custom_fields: [
            { display_name: 'App ID', variable_name: 'app_id', value: appId },
            { display_name: 'Billing Cycle', variable_name: 'billing_cycle', value: cycle },
          ],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Paystack checkout error:', JSON.stringify(data));
      return Response.json({ error: data.message || 'Failed to create checkout session' }, { status: 400 });
    }

    return Response.json({
      url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}