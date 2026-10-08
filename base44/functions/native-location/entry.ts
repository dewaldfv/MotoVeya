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
    const svc = base44.asServiceRole;

    await svc.entities.NativeDevice.update(device.id, {
      last_lat: lat,
      last_lng: lng,
      last_accuracy: Number.isFinite(accuracy) ? accuracy : null,
      last_speed_kmh: Number.isFinite(speed) ? speed : null,
      last_heading: Number.isFinite(heading) ? heading : null,
      last_location_at: now,
    });

    // Match the consent gate used by update-my-location. Native tracking must not
    // publish a rider's coordinates just because the device token is valid.
    let privacy = {
      share_live_location: true,
      background_sharing_enabled: false,
      location_audience: 'friends',
      location_group_rides_only: false,
    };
    try {
      const settings = await svc.entities.PrivacySetting.filter(
        { created_by_id: device.user_id }, '-created_date', 1
      );
      if (settings?.[0]) privacy = { ...privacy, ...settings[0] };
    } catch (error) {
      console.error('native-location privacy lookup failed:', error);
    }

    const audience = privacy.location_audience
      || (privacy.location_group_rides_only ? 'group_rides' : (privacy.share_live_location ? 'friends' : 'nobody'));
    const sharingAllowed = (privacy.share_live_location === true || privacy.background_sharing_enabled === true)
      && audience !== 'nobody';

    if (sharingAllowed) {
      await svc.entities.User.update(device.user_id, {
        last_lat: lat,
        last_lng: lng,
        last_location_updated: now,
        last_speed_kmh: Number.isFinite(speed) ? speed : null,
        last_heading: Number.isFinite(heading) ? heading : null,
      });
    } else {
      const activeSessions = await svc.entities.LocationSession.filter(
        { user_id: device.user_id, status: 'active' }, '-started_at', 50
      ).catch(() => []);
      for (const session of activeSessions || []) {
        try {
          await svc.entities.LocationSession.update(session.id, { status: 'expired', ended_at: now });
        } catch (error) {
          console.error('native-location session expiry failed:', error);
        }
      }
      await svc.entities.User.update(device.user_id, {
        last_lat: null,
        last_lng: null,
        last_location_updated: null,
      });
    }

    return Response.json({ updated: true, sharing: sharingAllowed, timestamp: now });
  } catch (error) {
    console.error('native-location:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
