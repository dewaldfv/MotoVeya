import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const bikeId = body.bike_id;
    if (!bikeId) return Response.json({ error: 'bike_id is required' }, { status: 400 });

    const bikes = await base44.entities.Bike.filter({ id: bikeId }, '-created_date', 1);
    const bike = bikes[0];
    if (!bike) return Response.json({ error: 'Bike not found' }, { status: 404 });

    const refills = await base44.entities.FuelRefill.filter({ bike_id: bikeId }, 'refill_date', 500);

    const existingProfiles = await base44.entities.FuelProfile.filter({ bike_id: bikeId }, '-created_date', 1);
    const baseline = existingProfiles[0]?.baseline_l_per_100km || bike.fuel_consumption_l_per_100km || 5.0;
    const tankCapacity = bike.tank_capacity_l || 15;

    refills.sort((a, b) => new Date(a.refill_date) - new Date(b.refill_date));

    let totalLitres = 0;
    let totalCost = 0;
    let totalDistance = 0;
    let priceSum = 0;
    let priceCount = 0;
    // Cumulative totals across every logged refill (always shown).
    for (const r of refills) {
      totalLitres += Number(r.litres) || 0;
      totalCost += Number(r.total_cost) || 0;

      if (r.fuel_price_per_litre != null) {
        priceSum += Number(r.fuel_price_per_litre) || 0;
        priceCount++;
      }
    }

    const avgPrice = priceCount > 0 ? priceSum / priceCount : 0;

    // L/100km is only calculated once at least two refills with odometer
    // readings exist. It uses the total litres logged divided by the
    // odometer difference between the first and last odometer reading.
    const odometerReadings = refills
      .filter((r) => r.odometer_km != null)
      .map((r) => Number(r.odometer_km));
    const hasEnoughData = odometerReadings.length >= 2;
    const firstOdometer = hasEnoughData ? odometerReadings[0] : null;
    const lastOdometer = hasEnoughData ? odometerReadings[odometerReadings.length - 1] : null;
    const odometerDiff = hasEnoughData && firstOdometer != null && lastOdometer != null
      ? lastOdometer - firstOdometer
      : 0;

    let adaptive = 0;
    let kmPerLitre = 0;
    let costPerKm = 0;
    let estimatedRange = 0;

    if (hasEnoughData && odometerDiff > 0 && totalLitres > 0) {
      totalDistance = odometerDiff;
      adaptive = (totalLitres / odometerDiff) * 100;
      kmPerLitre = adaptive > 0 ? 100 / adaptive : 0;
      costPerKm = kmPerLitre > 0 && avgPrice > 0 ? avgPrice / kmPerLitre : 0;
      estimatedRange = Math.round(tankCapacity * kmPerLitre);
    }

    const dataPoints = hasEnoughData ? odometerReadings.length - 1 : 0;
    const confidence = Math.min(100, Math.round(dataPoints * 20 + refills.length * 2));

    const profileData = {
      bike_id: bikeId,
      bike_make: bike.make,
      bike_model: bike.model,
      baseline_l_per_100km: Math.round(baseline * 100) / 100,
      adaptive_l_per_100km: Math.round(adaptive * 100) / 100,
      km_per_litre: Math.round(kmPerLitre * 100) / 100,
      cost_per_km: Math.round(costPerKm * 100) / 100,
      total_fuel_cost: Math.round(totalCost * 100) / 100,
      total_fuel_l: Math.round(totalLitres * 100) / 100,
      total_distance_km: Math.round(totalDistance * 100) / 100,
      refill_count: refills.length,
      confidence_score: confidence,
      avg_price_per_litre: Math.round(avgPrice * 100) / 100,
      estimated_range_km: estimatedRange,
      last_calculated: new Date().toISOString(),
    };

    let profile;
    if (existingProfiles.length > 0) {
      profile = await base44.entities.FuelProfile.update(existingProfiles[0].id, profileData);
    } else {
      profile = await base44.entities.FuelProfile.create(profileData);
    }

    // Keep the Bike Garage in sync with the calculated real-world average.
    // Only sync once a real consumption has been calculated (needs >= 2
    // refills with odometer readings); otherwise leave the bike's value alone.
    if (adaptive > 0) {
      const calculatedConsumption = Math.round(adaptive * 100) / 100;
      await base44.entities.Bike.update(bikeId, {
        fuel_consumption_l_per_100km: calculatedConsumption,
      });
    }

    return Response.json({
      profile,
      refills_processed: refills.length,
      actual_data_points: dataPoints,
      calculated_consumption_l_per_100km: adaptive > 0 ? Math.round(adaptive * 100) / 100 : null,
    });
  } catch (error) {
    console.error('Fuel profile recalculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});