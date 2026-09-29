import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Valid location required' }, { status: 400 });
    }

    const riderName = body.rider_name || user.full_name || 'Rider';
    const severity = body.severity || 'low';
    const timestamp = new Date().toISOString();
    const trackingLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
    const localTime = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

    const alert = await base44.asServiceRole.entities.CrashAlert.create({
      rider_id: user.id,
      rider_name: riderName,
      lat, lng, timestamp,
      status: 'active',
      severity,
      is_premium: false,
      notified_emergency_contact: false,
      notified_emergency_services: false,
      notified_nearby_riders: false,
      last_lat: lat,
      last_lng: lng,
      last_updated: timestamp,
      crash_indicators: body.indicators ? JSON.stringify(body.indicators) : 'manual',
      speed_at_impact: body.speed_at_impact,
      heading_at_impact: body.heading_at_impact,
      battery_level: body.battery_level,
      bike_make: body.bike_make,
      bike_model: body.bike_model,
      bike_year: body.bike_year,
    });

    // Keep the user's designated emergency contact notification.
    let contactNotified = false;
    let contactMessaged = false;
    if (user.emergency_contact_email) {
      try {
        await base44.integrations.Core.SendEmail({
          to: user.emergency_contact_email,
          subject: `RIDER DOWN: MotoVeya alert — ${riderName}`,
          body: `RIDER DOWN ALERT — MotoVeya

Rider: ${riderName}
Severity: ${severity.toUpperCase()}
Time: ${localTime}
Motorcycle: ${body.bike_make || ''} ${body.bike_model || ''} ${body.bike_year || ''}

Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Live tracking: ${trackingLink}

Last known speed: ${body.speed_at_impact != null ? body.speed_at_impact + ' km/h' : 'Unknown'}
Last known heading: ${body.heading_at_impact != null ? Math.round(body.heading_at_impact) + '°' : 'Unknown'}
Battery level: ${body.battery_level != null ? body.battery_level + '%' : 'Unknown'}

MotoVeya has detected a potential rider-down incident. The rider's live GPS location is being transmitted and updated continuously.

Please attempt to contact the rider or reach them safely if you are nearby. This alert is visible to MotoVeya riders within 20 km of the incident.

This is an automated Rider Down alert from MotoVeya.`,
        });
        contactNotified = true;
      } catch (e) { console.error('Failed to send Rider Down email:', e); }
    }

    // If the emergency contact is also a MotoVeya user, send an in-app notification.
    if (user.emergency_contact_phone) {
      try {
        const normalizePhone = (p) => String(p || '').replace(/\D/g, '').slice(-9);
        const ecNorm = normalizePhone(user.emergency_contact_phone);
        const candidates = [...new Set([
          user.emergency_contact_phone,
          `0${ecNorm}`,
          `+27${ecNorm}`,
          `27${ecNorm}`,
        ].filter(Boolean))];
        const matches = await Promise.all(
          candidates.map((phone) => base44.asServiceRole.entities.User.filter({ phone }, '-created_date', 10).catch(() => []))
        );
        const contact = matches.flat().find((u) => u.id !== user.id && normalizePhone(u.phone) === ecNorm);
        if (contact) {
          await base44.asServiceRole.entities.Notification.create({
            type: 'distress_alert',
            title: 'RIDER DOWN',
            body: `${riderName} may need help. Live location is available.`,
            is_read: false,
            recipient_id: contact.id,
            action_url: trackingLink,
            data: JSON.stringify({ rider_down: true, alert_id: alert.id, lat, lng, radius_km: 20 }),
          });
          contactMessaged = true;
        }
      } catch (e) { console.error('Failed to notify emergency contact:', e); }
    }

    const distress = await base44.asServiceRole.entities.DistressAlert.create({
      rider_id: user.id,
      rider_name: riderName,
      lat, lng,
      timestamp,
      status: 'active',
      reason: `Rider Down — ${body.indicators ? 'crash detected' : 'manual alert'}`,
      last_lat: lat,
      last_lng: lng,
      last_updated: timestamp,
    });

    // Universal 20 km notification. No Premium/friend requirement.
    let nearbyNotified = 0;
    try {
      const riders = await base44.asServiceRole.entities.User.list('-last_location_updated', 500);
      for (const rider of riders || []) {
        if (!rider?.id || rider.id === user.id || rider.last_lat == null || rider.last_lng == null) continue;
        const distance = haversine(lat, lng, Number(rider.last_lat), Number(rider.last_lng));
        if (distance > 20) continue;
        try {
          await base44.asServiceRole.entities.Notification.create({
            type: 'distress_alert',
            title: 'RIDER DOWN',
            body: `${riderName} may need help nearby (${Math.round(distance * 10) / 10} km away).`,
            is_read: false,
            recipient_id: rider.id,
            action_url: trackingLink,
            data: JSON.stringify({
              rider_down: true,
              alert_id: distress.id,
              lat,
              lng,
              radius_km: 20,
            }),
          });
          nearbyNotified++;
        } catch (e) { console.error('Failed to notify nearby rider:', e); }
      }
    } catch (e) { console.error('Failed to notify nearby riders:', e); }

    const contactReached = contactNotified || contactMessaged;
    const updated = await base44.asServiceRole.entities.CrashAlert.update(alert.id, {
      notified_emergency_contact: contactReached,
      notified_emergency_services: false,
      notified_nearby_riders: nearbyNotified > 0,
    });

    return Response.json({
      alert: updated,
      distress_alert_id: distress.id,
      rider_down: true,
      radius_km: 20,
      contact_notified: contactReached,
      contact_messaged: contactMessaged,
      nearby_notified: nearbyNotified,
      tracking_link: trackingLink,
    });
  } catch (error) {
    console.error('Rider Down response error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
