import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const AMOUNT_CENTS = {
  monthly: 7999,   // R79.99
  annual: 79999,   // R799.99
};

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

    const body = await req.json();
    const { billing_cycle, user_id, user_email, origin } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email is required' }, { status: 400 });
    }

    const cycle = billing_cycle === 'annual' ? 'annual' : 'monthly';
    const amount = AMOUNT_CENTS[cycle];
    const reference = `motogo_${cycle}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const appOrigin = origin || req.headers.get('origin') || 'https://app.base44.com';
    const appId = secrets.get('BASE44_APP_ID') || '';

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secrets.get('PAYSTACK_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user_email,
        amount,
        currency: 'ZAR',
        reference,
        callback_url: `${appOrigin}/premium?status=success`,
        metadata: {
          user_id: user_id || '',
          user_email,
          billing_cycle: cycle,
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