export async function getWeather(lat, lng) {
  if (lat == null || lng == null) return null;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m`);
    const j = await res.json();
    const c = j.current;
    if (!c) return null;
    return {
      temp: Math.round(c.temperature_2m),
      condition: wmoText(c.weather_code),
      wind: Math.round(c.wind_speed_10m),
      icon: wmoIcon(c.weather_code),
    };
  } catch (e) { return null; }
}

/**
 * Fetch a forecast for the route's key waypoints on the planned date
 * (or "now" if no date is set). Returns an aggregated snapshot plus
 * per-waypoint data and an alert level for rider safety.
 */
export async function getRouteWeather(waypoints = [], plannedDate = '') {
  if (!waypoints.length) return null;
  const sample = waypoints.length <= 5
    ? waypoints
    : [waypoints[0], waypoints[Math.floor(waypoints.length / 2)], waypoints[waypoints.length - 1]];

  const results = await Promise.all(sample.map((w) => fetchForecast(w, plannedDate)));
  const valid = results.filter(Boolean);
  if (!valid.length) return null;

  const temps = valid.map((r) => r.temp).filter((t) => t != null);
  const winds = valid.map((r) => r.wind).filter((t) => t != null);
  const precips = valid.map((r) => r.precip ?? 0);

  const avgTemp = temps.length ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  const maxWind = winds.length ? Math.max(...winds) : null;
  const maxPrecip = precips.length ? Math.max(...precips) : 0;

  const alertLevel = alertFor(maxWind, maxPrecip, valid);

  return {
    temp: avgTemp,
    wind: maxWind,
    precip: maxPrecip,
    condition: worstCondition(valid),
    icon: worstIcon(valid),
    alertLevel, // 'none' | 'caution' | 'danger'
    isCurrent: valid.some((r) => r.isCurrent),
    points: valid,
  };
}

async function fetchForecast(loc, date) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max,precipitation_probability_max` +
      `&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(url);
    const j = await res.json();

    let day = null;
    if (date) {
      const target = date.slice(0, 10);
      const idx = (j.daily?.time || []).indexOf(target);
      if (idx >= 0 && j.daily) {
        day = {
          temp: Math.round(((j.daily.temperature_2m_max[idx] ?? 0) + (j.daily.temperature_2m_min[idx] ?? 0)) / 2),
          condition: wmoText(j.daily.weather_code[idx]),
          wind: Math.round(j.daily.wind_speed_10m_max[idx] ?? 0),
          icon: wmoIcon(j.daily.weather_code[idx]),
          precip: j.daily.precipitation_probability_max?.[idx] ?? 0,
          isCurrent: false,
        };
      }
    }
    if (!day && j.current) {
      day = {
        temp: Math.round(j.current.temperature_2m),
        condition: wmoText(j.current.weather_code),
        wind: Math.round(j.current.wind_speed_10m),
        icon: wmoIcon(j.current.weather_code),
        precip: 0,
        isCurrent: true,
      };
    }
    return day;
  } catch (e) { return null; }
}

function alertFor(maxWind, maxPrecip, points) {
  const hasStorm = points.some((p) => p.condition === 'Stormy');
  if (hasStorm || (maxWind != null && maxWind >= 45) || maxPrecip >= 75) return 'danger';
  if ((maxWind != null && maxWind >= 25) || maxPrecip >= 40) return 'caution';
  return 'none';
}

function worstCondition(points) {
  const order = ['Clear', 'Partly cloudy', 'Variable', 'Foggy', 'Showers', 'Rainy', 'Snowy', 'Stormy'];
  let worst = 'Clear';
  let worstIdx = 0;
  for (const p of points) {
    const idx = order.indexOf(p.condition);
    if (idx > worstIdx) { worst = p.condition; worstIdx = idx; }
  }
  return worst;
}

function worstIcon(points) {
  const map = { 'Clear': '☀️', 'Partly cloudy': '⛅', 'Variable': '🌤️', 'Foggy': '🌫️', 'Showers': '🌦️', 'Rainy': '🌧️', 'Snowy': '❄️', 'Stormy': '⛈️' };
  return map[worstCondition(points)] || '🌡️';
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

function wmoIcon(c) {
  if (c == null) return '🌡️';
  if (c === 0) return '☀️';
  if (c <= 3) return '⛅';
  if (c <= 48) return '🌫️';
  if (c <= 67) return '🌧️';
  if (c <= 77) return '❄️';
  if (c <= 82) return '🌦️';
  if (c <= 99) return '⛈️';
  return '🌤️';
}