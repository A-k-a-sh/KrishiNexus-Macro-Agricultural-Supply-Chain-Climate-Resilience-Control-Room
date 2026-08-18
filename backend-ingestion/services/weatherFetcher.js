const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

/**
 * Fetch 7-day weather forecast for a lat/lon from Open-Meteo.
 * Free, no API key required.
 *
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<object>} Structured liveWeather object ready to store in districts collection
 */
async function fetchWeather(lat, lon, retries = 3, delay = 500) {
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

  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${OPEN_METEO_BASE}?${params}`);

      if (res.status === 429) {
        console.warn(`[weatherFetcher] 429 Rate Limited for lat=${lat} lon=${lon}. Retrying in ${delay * (i + 1)}ms...`);
        await new Promise((r) => setTimeout(r, delay * (i + 1)));
        continue;
      }

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
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
}

module.exports = { fetchWeather };