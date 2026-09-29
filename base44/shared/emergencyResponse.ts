// Shared rider-down logic used by both the user-session crash trigger
// (trigger-emergency-response) and the device-token crash trigger
// (trigger-emergency-native) so background crash alerts fire identically
// whether or not the rider has a live app session.

import { haversine } from './geo.ts';
import { sendPushToUsers } from './webPush.ts';

// Returns { status, body } — the caller wraps it in Response.json.
export async function runEmergencyResponse(base44, user, body) {
  const svc = base44.asServiceRole;

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 400, body: { error: 'Valid location required' } };
  }

  const riderName = body.rider_name || user.full_name || 'Rider';
  const severity = body.severity || 'low';
  const timestamp = new Date().toISOString();
  const trackingLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
  const localTime = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

  const alert = await svc.entities.CrashAlert.create({
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
        candidates.map((phone) => svc.entities.User.filter({ phone }, '-created_date', 10).catch(() => []))
      );
      const contact = matches.flat().find((u) => u.id !== user.id && normalizePhone(u.phone) === ecNorm);
      if (contact) {
        await svc.entities.Notification.create({
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

  const distress = await svc.entities.DistressAlert.create({
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

  let nearbyNotified = 0;
  const nearbyIds = [];
  try {
    const riders = await svc.entities.User.list('-last_location_updated', 500);
    for (const rider of riders || []) {
      if (!rider?.id || rider.id === user.id || rider.last_lat == null || rider.last_lng == null) continue;
      const distance = haversine(lat, lng, Number(rider.last_lat), Number(rider.last_lng));
      if (distance > 20) continue;
      const body = `${riderName} may need help nearby (${Math.round(distance * 10) / 10} km away).`;
      try {
        await svc.entities.Notification.create({
          type: 'distress_alert',
          title: 'RIDER DOWN',
          body,
          is_read: false,
          recipient_id: rider.id,
          action_url: trackingLink,
          data: JSON.stringify({
            rider_down: true,
            alert_id: distress.id,
            lat, lng,
            radius_km: 20,
          }),
        });
        nearbyNotified++;
        nearbyIds.push(rider.id);
      } catch (e) { console.error('Failed to notify nearby rider:', e); }
    }
  } catch (e) { console.error('Failed to notify nearby riders:', e); }

  // Deliver an OS-level Web Push to nearby riders so the alert reaches them
  // immediately even if the app is closed.
  if (nearbyIds.length > 0) {
    try {
      await sendPushToUsers(svc, nearbyIds, {
        title: 'RIDER DOWN',
        body: `${riderName} may need help within 20 km. Tap to view live location.`,
        type: 'distress_alert',
        action_url: trackingLink,
        rider_down: true,
        alert_id: distress.id,
        lat, lng,
        radius_km: 20,
      });
    } catch (e) { console.error('Failed to push Rider Down to nearby riders:', e); }
  }

  const contactReached = contactNotified || contactMessaged;
  const updated = await svc.entities.CrashAlert.update(alert.id, {
    notified_emergency_contact: contactReached,
    notified_emergency_services: false,
    notified_nearby_riders: nearbyNotified > 0,
  });

  return {
    status: 200,
    body: {
      alert: updated,
      distress_alert_id: distress.id,
      rider_down: true,
      radius_km: 20,
      contact_notified: contactReached,
      contact_messaged: contactMessaged,
      nearby_notified: nearbyNotified,
      tracking_link: trackingLink,
    },
  };
}