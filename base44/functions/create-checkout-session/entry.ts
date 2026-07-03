import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
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
    const { price_id, user_id, user_email, billing_cycle, origin } = body;

    if (!price_id) {
      return Response.json({ error: 'price_id is required' }, { status: 400 });
    }

    const appOrigin = origin || req.headers.get('origin') || 'https://app.base44.com';

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', price_id);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${appOrigin}/premium?status=success`);
    params.append('cancel_url', `${appOrigin}/premium?status=cancelled`);
    params.append('metadata[user_id]', user_id || '');
    params.append('metadata[user_email]', user_email || '');
    params.append('metadata[billing_cycle]', billing_cycle || 'monthly');
    params.append('metadata[base44_app_id]', Deno.env.get('BASE44_APP_ID') || '');
    if (user_email) params.append('customer_email', user_email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe checkout error:', JSON.stringify(session));
      return Response.json({ error: session.error?.message || 'Failed to create checkout session' }, { status: 400 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});