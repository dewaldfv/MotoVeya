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