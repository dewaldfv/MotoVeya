import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = String(body.device_token || '');
    if (token.length < 32) return Response.json({ error: 'Invalid device token' }, { status: 400 });

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Valid coordinates required' }, { status: 400 });
    }

    const hash = await sha256(token);
    const devices = await base44.asServiceRole.entities.NativeDevice.filter({ device_token_hash: hash }, '-created_date', 1);
    const device = devices?.[0];
    if (!device || device.tracking_enabled === false) {
      return Response.json({ error: 'Device not registered or tracking disabled' }, { status: 403 });
    }

    const now = new Date().toISOString();
    const speed = Number(body.speed_kmh);
    const heading = Number(body.heading);
    const accuracy = Number(body.accuracy);

    await base44.asServiceRole.entities.NativeDevice.update(device.id, {
      last_lat: lat,
      last_lng: lng,
      last_accuracy: Number.isFinite(accuracy) ? accuracy : null,
      last_speed_kmh: Number.isFinite(speed) ? speed : null,
      last_heading: Number.isFinite(heading) ? heading : null,
      last_location_at: now,
    });

    await base44.asServiceRole.entities.User.update(device.user_id, {
      last_lat: lat,
      last_lng: lng,
      last_location_updated: now,
      last_speed_kmh: Number.isFinite(speed) ? speed : null,
      last_heading: Number.isFinite(heading) ? heading : null,
    });

    return Response.json({ updated: true, timestamp: now });
  } catch (error) {
    console.error('native-location:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
