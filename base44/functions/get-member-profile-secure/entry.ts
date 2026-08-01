import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetId = body?.user_id;
    if (!targetId) return Response.json({ error: 'user_id required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Access control: caller and target must share at least one active group.
    const [myGroups, theirGroups] = await Promise.all([
      svc.entities.GroupMember.filter({ user_id: me.id, status: 'active' }, '-created_date', 100),
      svc.entities.GroupMember.filter({ user_id: targetId, status: 'active' }, '-created_date', 100),
    ]);
    const myGroupIds = new Set((myGroups || []).map((m) => m.group_id));
    const sharesGroup = (theirGroups || []).some((m) => myGroupIds.has(m.group_id));
    if (!sharesGroup) return Response.json({ error: 'Not in a shared group' }, { status: 403 });

    let profile = null;
    try { profile = await svc.entities.User.get(targetId); } catch (e) { /* private */ }

    // Primary motorcycle (shared group members may see this).
    let bike = null;
    try {
      const bikes = await svc.entities.Bike.filter({ created_by_id: targetId, is_primary: true }, '-created_date', 1);
      bike = bikes[0] || null;
      if (!bike) { const all = await svc.entities.Bike.filter({ created_by_id: targetId }, '-created_date', 1); bike = all[0] || null; }
    } catch (e) {}

    // Rides for achievement stats.
    let rides = [];
    try { rides = await svc.entities.Ride.filter({ created_by_id: targetId }, '-ride_date', 100); } catch (e) {}

    const rideDate = (r) => new Date(r.ride_date || r.created_date);
    const totalDist = rides.reduce((s, r) => s + (r.distance_km || 0), 0);
    const maxSpeed = rides.reduce((m, r) => Math.max(m, r.max_speed_kmh || 0), 0);
    const totalRides = rides.length;

    // Monthly distance.
    const monthAgo = new Date(Date.now() - 30 * 86400000);
    const monthlyDist = rides.filter((r) => rideDate(r) >= monthAgo).reduce((s, r) => s + (r.distance_km || 0), 0);

    // Streak (consecutive riding days).
    const now = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    let streak = 0, started = false;
    for (let i = 0; i < 60; i++) {
      const day = startOfDay(new Date(now.getTime() - i * 86400000));
      const next = new Date(day.getTime() + 86400000);
      const has = rides.some((r) => { const d = rideDate(r); return d >= day && d < next; });
      if (has) { streak++; started = true; } else if (started) break;
    }

    // Events count.
    let eventsCount = 0;
    try { const ev = await svc.entities.Event.filter({ created_by_id: targetId }, '-created_date', 100); eventsCount = ev.length; } catch (e) {}

    // Fuel avg consumption (best effort).
    let fuelAvg = 0;
    try {
      if (bike) {
        const fps = await svc.entities.FuelProfile.filter({ bike_id: bike.id }, '-last_calculated', 1);
        if (fps && fps[0]) fuelAvg = fps[0].adaptive_l_per_100km || fps[0].baseline_l_per_100km || 0;
      }
    } catch (e) {}

    return Response.json({
      user_id: targetId,
      nickname: profile?.nickname || profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      cover_url: profile?.cover_url || null,
      bike: bike ? { make: bike.make, model: bike.model, nickname: bike.nickname || null } : null,
      stats: {
        rides_completed: totalRides,
        total_distance_km: Math.round(totalDist),
        max_speed_kmh: maxSpeed,
        streak,
        monthly: { distance_km: Math.round(monthlyDist * 10) / 10 },
        events_count: eventsCount,
        fuel: { avg_consumption_l_per_100km: fuelAvg },
        photos: [],
        history: rides.slice(0, 10).map((r) => ({ max_speed_kmh: r.max_speed_kmh || 0 })),
      },
    });
  } catch (error) {
    console.error('get-member-profile-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}