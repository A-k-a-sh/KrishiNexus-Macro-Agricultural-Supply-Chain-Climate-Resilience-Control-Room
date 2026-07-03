const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch 7-day weather forecast for a lat/lon from Open-Meteo.
 * Free, no API key required.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object>} Structured liveWeather object ready to store in districts collection
 */
async function fetchWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    daily: [
      'precipitation_sum',
      'temperature_2m_max',
      'temperature_2m_min',
      'relative_humidity_2m_max',
    ].join(','),
    timezone: 'Asia/Dhaka',
    forecast_days: 7,
  });

  const res = await fetch(`${OPEN_METEO_BASE}?${params}`);

  if (!res.ok) {
    throw new Error(`Open-Meteo fetch failed (${res.status}) for lat=${lat} lon=${lon}`);
  }

  const data = await res.json();
  const d = data.daily;

  // Today = index 0 of the daily arrays
  return {
    fetchedAt: new Date().toISOString(),
    tempMaxToday: d.temperature_2m_max[0],
    tempMinToday: d.temperature_2m_min[0],
    humidityMaxToday: d.relative_humidity_2m_max[0],
    precipitationSum7Day: d.precipitation_sum,       // array of 7 values
    tempMax7Day: d.temperature_2m_max,               // array of 7 values
    tempMin7Day: d.temperature_2m_min,               // array of 7 values
    forecastDates: d.time,                           // array of 7 date strings
  };
}

module.exports = { fetchWeather };