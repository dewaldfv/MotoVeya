import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { group_ride_id } = body || {};
    if (!group_ride_id) return Response.json({ error: 'Missing ride id' }, { status: 400 });

    const svc = base44.asServiceRole;
    const ride = await svc.entities.GroupRide.get(group_ride_id);
    if (!ride) return Response.json({ error: 'Ride not found' }, { status: 404 });
    if (ride.leader_id !== me.id) return Response.json({ error: 'Only the leader can end the ride' }, { status: 403 });

    const participants = await svc.entities.RideParticipant.filter({ group_ride_id }, '-last_updated', 100);
    const now = new Date();
    const start = ride.started_at ? new Date(ride.started_at) : (ride.planned_date ? new Date(ride.planned_date) : now);
    const durationMin = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
    const leaderP = participants.find((p) => p.user_id === ride.leader_id);
    const rideDistance = leaderP?.distance_km || (ride.start_lat != null && ride.destination_lat != null ? haversine(ride.start_lat, ride.start_lng, ride.destination_lat, ride.destination_lng) : 0);
    const maxSpeed = participants.reduce((m, p) => Math.max(m, p.max_speed_kmh || 0), 0);
    const avgSpeed = durationMin > 0 ? Math.round((rideDistance / (durationMin / 60)) * 10) / 10 : 0;

    let weather = ride.weather || null;
    if (ride.destination_lat != null) {
      try {
        const wres = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${ride.destination_lat}&longitude=${ride.destination_lng}&current=temperature_2m,weather_code,wind_speed_10m`);
        const wj = await wres.json();
        const c = wj.current;
        if (c) weather = `${Math.round(c.temperature_2m)}°C, ${wmoText(c.weather_code)}, wind ${Math.round(c.wind_speed_10m)} km/h`;
      } catch (e) {}
    }

    let photos = [];
    try {
      const ids = participants.map((p) => p.user_id);
      const recent = await svc.entities.Ride.list('-ride_date', 20);
      photos = recent.filter((r) => ids.includes(r.created_by_id)).flatMap((r) => r.photo_urls || []).slice(0, 12);
    } catch (e) {}

    const achievements = [];
    if (participants.length >= 2) achievements.push({ emoji: '👥', label: 'Group Ride', desc: `${participants.length} riders` });
    if (rideDistance >= 100) achievements.push({ emoji: '💯', label: 'Century', desc: '100 km ride' });
    if (durationMin >= 60) achievements.push({ emoji: '⏱️', label: 'Hour Plus', desc: 'Over an hour riding' });
    if (maxSpeed >= 120) achievements.push({ emoji: '🚀', label: 'Speed Demon', desc: 'Hit 120 km/h' });
    if (photos.length >= 3) achievements.push({ emoji: '📷', label: 'Memories', desc: 'Photos captured' });

    const summary = {
      distance_km: Math.round(rideDistance * 10) / 10,
      duration_minutes: durationMin,
      average_speed_kmh: avgSpeed,
      max_speed_kmh: maxSpeed,
      weather,
      photos,
      attendance: participants.map((p) => ({ user_id: p.user_id, name: p.user_name, role: p.role, distance_km: p.distance_km || 0 })),
      achievements,
      finished_at: now.toISOString(),
    };

    await svc.entities.GroupRide.update(group_ride_id, { status: 'finished', summary: JSON.stringify(summary), distance_remaining_km: 0 });
    return Response.json({ summary, ride_id: group_ride_id });
  } catch (error) {
    console.error('generate-ride-summary error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function wmoText(c) {
  if (c == null) return 'Unknown';
  if (c === 0) return 'Clear';
  if (c <= 3) return 'Partly cloudy';
  if (c <= 48) return 'Foggy';
  if (c <= 67) return 'Rainy';
  if (c <= 77) return 'Snowy';
  if (c <= 82) return 'Showers';
  if (c <= 99) return 'Stormy';
  return 'Variable';
}