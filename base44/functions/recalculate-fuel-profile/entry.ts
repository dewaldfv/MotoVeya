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
    let actualConsumptions = [];

    // Full-to-full calculation:
    // Refill #1 establishes the starting odometer.
    // Refill #2 supplies the fuel consumed over the #1 -> #2 distance.
    // Thereafter each new full refill replaces the previous interval:
    // #2 -> #3, #3 -> #4, etc.
    // If partial refills occur between two full tanks, their litres are included.
    let prevFullOdo = null;
    let litresSinceLastFull = 0;

    for (const r of refills) {
      const litres = Number(r.litres) || 0;
      totalLitres += litres;
      totalCost += Number(r.total_cost) || 0;
      if (r.fuel_price_per_litre != null) {
        priceSum += Number(r.fuel_price_per_litre) || 0;
        priceCount++;
      }

      if (r.is_full_tank === true && r.odometer_km != null) {
        const currentOdo = Number(r.odometer_km);

        if (prevFullOdo != null) {
          const distance = currentOdo - prevFullOdo;
          // The current full refill is part of the fuel consumed since the
          // previous full tank, so include it before calculating consumption.
          const intervalLitres = litresSinceLastFull + litres;

          if (distance > 0 && intervalLitres > 0) {
            const consumption = (intervalLitres / distance) * 100;
            if (consumption > 0 && consumption < 30) {
              actualConsumptions.push(consumption);
              totalDistance += distance;
            }
          }
        }

        prevFullOdo = currentOdo;
        litresSinceLastFull = 0;
      } else {
        litresSinceLastFull += litres;
      }
    }

    // Use the latest valid two-full-refill interval as the rider-facing average.
    // With two refills this is refill #1 -> #2. With three it becomes #2 -> #3,
    // and so on. This is deliberately not a lifetime average.
    const latestConsumption = actualConsumptions.length > 0
      ? actualConsumptions[actualConsumptions.length - 1]
      : baseline;
    const adaptive = latestConsumption;

    const confidence = Math.min(100, Math.round(actualConsumptions.length * 20 + refills.length * 2));
    const kmPerLitre = adaptive > 0 ? 100 / adaptive : 0;
    const avgPrice = priceCount > 0 ? priceSum / priceCount : 0;
    const costPerKm = kmPerLitre > 0 && avgPrice > 0 ? avgPrice / kmPerLitre : 0;
    const estimatedRange = Math.round(tankCapacity * kmPerLitre);

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
    // The original baseline is preserved in FuelProfile so future recalculations
    // do not compound the adaptive weighting on top of previous results.
    const calculatedConsumption = Math.round(adaptive * 100) / 100;
    await base44.entities.Bike.update(bikeId, {
      fuel_consumption_l_per_100km: calculatedConsumption,
    });

    return Response.json({
      profile,
      refills_processed: refills.length,
      actual_data_points: actualConsumptions.length,
      calculated_consumption_l_per_100km: calculatedConsumption,
    });
  } catch (error) {
    console.error('Fuel profile recalculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});