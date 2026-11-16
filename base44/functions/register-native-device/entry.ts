import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Registers this phone for background tracking and/or native push:
//  - device_token: opaque token the native service uses to authenticate
//    background calls when there is no live session
//  - push_token:   Firebase Cloud Messaging token used to deliver alerts
//    to the installed app while it is closed
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = String(body.device_token || '');
    const pushToken = String(body.push_token || '');
    const pushEnabled = body.push_enabled !== false;
    const platform = body.platform === 'ios' ? 'ios' : 'android';
    if (!token && !pushToken) return Response.json({ error: 'Missing device token' }, { status: 400 });
    if (token && token.length < 32) return Response.json({ error: 'Invalid device token' }, { status: 400 });

    const hash = token ? await sha256(token) : '';
    let existing = [];
    if (hash) {
      existing = await base44.asServiceRole.entities.NativeDevice.filter({ device_token_hash: hash }, '-created_date', 5);
      if (existing?.[0] && existing[0].user_id !== user.id) {
        return Response.json({ error: 'Device token already registered' }, { status: 409 });
      }
    } else if (pushToken) {
      // Push-only registration (notifications enabled without ride tracking).
      existing = await base44.asServiceRole.entities.NativeDevice.filter({ push_token: pushToken }, '-created_date', 5);
      if (existing?.[0] && existing[0].user_id !== user.id) {
        return Response.json({ error: 'Device token already registered' }, { status: 409 });
      }
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: user.id,
      platform,
      app_version: String(body.app_version || ''),
      push_enabled: pushEnabled && !!pushToken,
      ...(pushEnabled && pushToken ? { push_token: pushToken, push_token_updated_at: now } : {}),
      ...(!pushEnabled ? { push_token: '' } : {}),
    };
    if (hash) {
      payload.device_token_hash = hash;
      payload.tracking_enabled = body.tracking_enabled !== false;
      payload.last_location_at = now;
    }

    let device = existing?.[0];
    if (device) {
      device = await base44.asServiceRole.entities.NativeDevice.update(device.id, payload);
    } else {
      device = await base44.asServiceRole.entities.NativeDevice.create({ created_at: now, ...payload });
    }

    return Response.json({
      registered: true,
      device_id: device.id,
      push_registered: !!device.push_token && device.push_enabled !== false,
    });
  } catch (error) {
    console.error('register-native-device:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}