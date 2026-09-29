// Token-authenticated revocation for the native background service.
// Called by the native layer when location permission is revoked or the user
// disables background tracking from the OS settings. Expires the user's active
// location sessions, clears their live position, and marks the device as
// tracking_enabled=false so native-location / crash ingestion stop accepting
// fixes from this device.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.device_token || '');
    if (token.length < 32) {
      return Response.json({ error: 'Invalid device token' }, { status: 400 });
    }

    const hash = await sha256(token);
    const devices = await base44.asServiceRole.entities.NativeDevice.filter(
      { device_token_hash: hash }, '-created_date', 1
    );
    const device = devices?.[0];
    if (!device) {
      return Response.json({ error: 'Device not registered' }, { status: 404 });
    }
    const userId = device.user_id;
    const svc = base44.asServiceRole;
    const now = new Date().toISOString();

    // Stop accepting background fixes from this device.
    await svc.entities.NativeDevice.update(device.id, { tracking_enabled: false });

    // Expire active location sessions.
    const active = await svc.entities.LocationSession.filter({ user_id: userId, status: 'active' }, '-started_at', 50);
    for (const s of (active || [])) {
      try { await svc.entities.LocationSession.update(s.id, { status: 'revoked', ended_at: now }); } catch (e) {}
    }

    // Clear the live position so nobody sees a stale location.
    await svc.entities.User.update(userId, { last_lat: null, last_lng: null, last_location_updated: null });

    return Response.json({ ok: true, tracking_disabled: true });
  } catch (error) {
    console.error('revoke-native-tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});