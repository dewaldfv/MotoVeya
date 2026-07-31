import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DEFAULT_PRIVACY = {
  show_motorcycle: true,
  show_weekly_stats: true,
  share_live_location: true,
  location_group_rides_only: false,
  show_completed_rides: true,
  show_events: true,
  show_achievements: true,
  show_fuel_stats: false,
  show_photos: true,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.user_ids)
      ? body.user_ids.filter(Boolean)
      : body?.user_id ? [body.user_id] : [];
    if (ids.length === 0) return Response.json({ riders: [] });

    // Access control: only return data for riders who are accepted friends of the requester.
    const [asReq, asRec] = await Promise.all([
      base44.entities.Friend.filter({ requester_id: me.id, status: 'accepted' }, '-created_date', 200),
      base44.entities.Friend.filter({ recipient_id: me.id, status: 'accepted' }, '-created_date', 200),
    ]);
    const allowed = new Set();
    for (const f of [...(asReq || []), ...(asRec || [])]) {
      allowed.add(f.requester_id === me.id ? f.recipient_id : f.requester_id);
    }
    const denied = ids.filter((id) => !allowed.has(id));
    const targets = ids.filter((id) => allowed.has(id));

    const svc = base44.asServiceRole;
    const now = new Date();
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const rideDate = (r) => new Date(r.ride_date || r.created_date);

    const riders = [];
    for (const uid of targets) {
      let profile = null;
      try { profile = await svc.entities.User.get(uid); } catch (e) { /* private user */ }

      // Load the target user's privacy settings — they control what gets shared.
      let privacy = { ...DEFAULT_PRIVACY };
      try {
        const ps = await svc.entities.PrivacySetting.filter({ created_by_id: uid }, '-created_date', 1);
        if (ps && ps[0]) privacy = { ...privacy, ...ps[0] };
      } catch (e) { /* no settings = defaults */ }

      // Profile, bike details and stats are private to the owner. Only the owner
      // receives their full rider stats; every other user (even a friend) gets
      // identity only — no bio, club, bike, stats, history, photos or fuel data.
      if (uid !== me.id) {
        riders.push({
          user_id: uid,
          nickname: profile?.nickname || profile?.full_name || null,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          bio: null, phone: null, motorcycle_club: null,
          bike_make: null, bike_model: null, bike_nickname: null,
          weekly: null, streak: null, monthly: null, fuel: null,
          events_count: null, rides_completed: null, photos: [], history: [],
          total_distance_km: null, privacy, profile_private: true,
        });
        continue;
      }

      // Only load rides if at least one dependent section is visible.
      const needsRides = privacy.show_weekly_stats || privacy.show_completed_rides || privacy.show_fuel_stats || privacy.show_events || privacy.show_photos;
      let rides = [];
      if (needsRides) {
        try { rides = await svc.entities.Ride.filter({ created_by_id: uid }, '-ride_date', 100); } catch (e) {}
      }

      let bike = null;
      if (privacy.show_motorcycle) {
        try {
          const bikes = await svc.entities.Bike.filter({ created_by_id: uid, is_primary: true }, '-created_date', 1);
          bike = bikes[0] || null;
          if (!bike) { const all = await svc.entities.Bike.filter({ created_by_id: uid }, '-created_date', 1); bike = all[0] || null; }
        } catch (e) {}
      }

      let refills = [];
      if (privacy.show_fuel_stats) {
        try { refills = await svc.entities.FuelRefill.filter({ created_by_id: uid }, '-refill_date', 50); } catch (e) {}
      }

      let fuelProfile = null;
      if (privacy.show_fuel_stats && bike) {
        try { const fps = await svc.entities.FuelProfile.filter({ bike_id: bike.id }, '-last_calculated', 1); fuelProfile = fps[0] || null; } catch (e) {}
      }

      let eventsCount = 0;
      if (privacy.show_events) {
        try { const ev = await svc.entities.Event.filter({ created_by_id: uid }, '-created_date', 100); eventsCount = ev.length; } catch (e) {}
      }

      const weekRides = rides.filter((r) => rideDate(r) >= weekAgo);
      const monthRides = rides.filter((r) => rideDate(r) >= monthAgo);
      const weeklyDistance = weekRides.reduce((s, r) => s + (r.distance_km || 0), 0);
      const weeklyTime = weekRides.reduce((s, r) => s + (r.duration_minutes || 0), 0);
      const monthlyDistance = monthRides.reduce((s, r) => s + (r.distance_km || 0), 0);
      const monthlyTime = monthRides.reduce((s, r) => s + (r.duration_minutes || 0), 0);
      const monthlyFuel = monthRides.reduce((s, r) => s + (r.fuel_consumed_l || 0), 0);
      const totalFuel = rides.reduce((s, r) => s + (r.fuel_consumed_l || 0), 0);
      const totalDist = rides.reduce((s, r) => s + (r.distance_km || 0), 0);

      const activity = [];
      for (let i = 6; i >= 0; i--) {
        const day = startOfDay(new Date(now.getTime() - i * 86400000));
        const next = new Date(day.getTime() + 86400000);
        const dist = rides.filter((r) => { const d = rideDate(r); return d >= day && d < next; }).reduce((s, r) => s + (r.distance_km || 0), 0);
        activity.push(Math.round(dist * 10) / 10);
      }

      let streak = 0;
      let started = false;
      for (let i = 0; i < 60; i++) {
        const day = startOfDay(new Date(now.getTime() - i * 86400000));
        const next = new Date(day.getTime() + 86400000);
        const has = rides.some((r) => { const d = rideDate(r); return d >= day && d < next; });
        if (has) { streak++; started = true; } else if (started) break;
      }

      const lastRide = rides[0];
      const lastRideDate = lastRide ? (lastRide.ride_date || lastRide.created_date) : null;
      const photos = privacy.show_photos ? rides.flatMap((r) => r.photo_urls || []).slice(0, 12) : [];
      const history = privacy.show_completed_rides ? rides.slice(0, 10).map((r) => ({
        id: r.id, title: r.title, distance_km: r.distance_km, duration_minutes: r.duration_minutes,
        ride_date: r.ride_date || r.created_date, max_speed_kmh: r.max_speed_kmh,
        start_location_name: r.start_location_name, end_location_name: r.end_location_name,
      })) : [];

      const avgConsumption = totalDist > 0
        ? Math.round((totalFuel / totalDist) * 100 * 10) / 10
        : (bike?.fuel_consumption_l_per_100km || fuelProfile?.adaptive_l_per_100km || 0);

      riders.push({
        user_id: uid,
        nickname: profile?.nickname || profile?.full_name || null,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        bio: profile?.bio || null,
        phone: null, // always private
        motorcycle_club: profile?.motorcycle_club || null,
        bike_make: privacy.show_motorcycle ? (bike?.make || null) : null,
        bike_model: privacy.show_motorcycle ? (bike?.model || null) : null,
        bike_nickname: privacy.show_motorcycle ? (bike?.nickname || null) : null,
        weekly: privacy.show_weekly_stats ? { distance_km: Math.round(weeklyDistance * 10) / 10, ride_time_min: weeklyTime, ride_count: weekRides.length, last_ride_date: lastRideDate, activity } : null,
        streak: privacy.show_weekly_stats ? streak : null,
        monthly: privacy.show_weekly_stats ? { distance_km: Math.round(monthlyDistance * 10) / 10, ride_time_min: monthlyTime, ride_count: monthRides.length, fuel_l: Math.round(monthlyFuel * 10) / 10 } : null,
        fuel: privacy.show_fuel_stats ? { avg_consumption_l_per_100km: avgConsumption, refill_count: refills.length, km_per_litre: fuelProfile?.km_per_litre || null, estimated_range_km: fuelProfile?.estimated_range_km || null } : null,
        events_count: privacy.show_events ? eventsCount : null,
        rides_completed: privacy.show_completed_rides ? rides.length : null,
        photos,
        history,
        total_distance_km: privacy.show_weekly_stats ? Math.round(totalDist) : null,
        privacy,
      });
    }

    return Response.json({ riders, access_denied: denied.length > 0 ? denied : undefined });
  } catch (error) {
    console.error('get-rider-stats error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});