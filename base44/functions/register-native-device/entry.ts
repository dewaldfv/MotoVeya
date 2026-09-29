import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const token = String(body.device_token || '');
    const platform = body.platform === 'ios' ? 'ios' : 'android';
    if (token.length < 32) return Response.json({ error: 'Invalid device token' }, { status: 400 });

    const hash = await sha256(token);
    const existing = await base44.asServiceRole.entities.NativeDevice.filter({ device_token_hash: hash }, '-created_date', 5);
    if (existing?.[0] && existing[0].user_id !== user.id) {
      return Response.json({ error: 'Device token already registered' }, { status: 409 });
    }

    const payload = {
      user_id: user.id,
      device_token_hash: hash,
      platform,
      app_version: String(body.app_version || ''),
      tracking_enabled: true,
      last_location_at: new Date().toISOString(),
    };

    let device = existing?.[0];
    if (device) {
      device = await base44.asServiceRole.entities.NativeDevice.update(device.id, payload);
    } else {
      device = await base44.asServiceRole.entities.NativeDevice.create(payload);
    }

    return Response.json({ registered: true, device_id: device.id });
  } catch (error) {
    console.error('register-native-device:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
