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

    const baseline = bike.fuel_consumption_l_per_100km || 5.0;
    const tankCapacity = bike.tank_capacity_l || 15;

    refills.sort((a, b) => new Date(a.refill_date) - new Date(b.refill_date));

    let totalLitres = 0;
    let totalCost = 0;
    let totalDistance = 0;
    let priceSum = 0;
    let priceCount = 0;
    let actualConsumptions = [];

    let prevOdo = null;
    let litresSinceLastFull = 0;

    for (const r of refills) {
      totalLitres += r.litres || 0;
      totalCost += r.total_cost || 0;
      if (r.fuel_price_per_litre) { priceSum += r.fuel_price_per_litre; priceCount++; }

      if (r.is_full_tank && r.odometer_km != null) {
        if (prevOdo != null) {
          const distance = r.odometer_km - prevOdo;
          if (distance > 0 && litresSinceLastFull > 0) {
            const consumption = (litresSinceLastFull / distance) * 100;
            if (consumption > 0 && consumption < 30) {
              actualConsumptions.push(consumption);
              totalDistance += distance;
            }
          }
        }
        prevOdo = r.odometer_km;
        litresSinceLastFull = r.litres || 0;
      } else {
        litresSinceLastFull += r.litres || 0;
      }
    }

    let adaptive = baseline;
    if (actualConsumptions.length > 0) {
      const avgActual = actualConsumptions.reduce((a, b) => a + b, 0) / actualConsumptions.length;
      const weightActual = Math.min(0.75, actualConsumptions.length * 0.15);
      adaptive = baseline * (1 - weightActual) + avgActual * weightActual;
    }

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

    const existing = await base44.entities.FuelProfile.filter({ bike_id: bikeId }, '-created_date', 1);
    let profile;
    if (existing.length > 0) {
      profile = await base44.entities.FuelProfile.update(existing[0].id, profileData);
    } else {
      profile = await base44.entities.FuelProfile.create(profileData);
    }

    return Response.json({ profile, refills_processed: refills.length, actual_data_points: actualConsumptions.length });
  } catch (error) {
    console.error('Fuel profile recalculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});