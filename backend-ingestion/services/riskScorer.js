const { getDb } = require('../db/connect');

/**
 * Score a district's risk level by comparing its liveWeather
 * against the parsedRules in crop_thresholds for its active crops.
 *
 * Returns { riskStatus, activeAlerts } — these are written back to the
 * districts collection by the cron job after each weather refresh.
 *
 * @param {object} district - A full district document (must have liveWeather + activeCrops)
 * @returns {Promise<{ riskStatus: string, activeAlerts: object[] }>}
 */
async function scoreDistrict(district) {
  const db = getDb();
  const { liveWeather, activeCrops = [] } = district;

  if (!liveWeather) return { riskStatus: 'green', activeAlerts: [] };

  const { tempMaxToday, humidityMaxToday, precipitationSum7Day = [] } = liveWeather;

  // 3-day cumulative precipitation (days 0, 1, 2)
  const precip3Day = precipitationSum7Day.slice(0, 3).reduce((a, b) => a + b, 0);

  const alerts = [];

  // ── Rule 1: Universal weather-based checks (no crop threshold needed) ──────

  // Flood alert: ≥120mm in 3 days is a genuine flood/waterlogging event for Bangladesh.
  // 50mm over 3 days is normal monsoon rain (avg July daily = 15-25mm).
  // Threshold raised from 50→120mm to avoid marking ALL districts RED every July day.
  if (precip3Day >= 120) {
    alerts.push({
      type: 'flood',
      label: 'Flood / Waterlogging Risk',
      cropAffected: 'All Crops',
      severity: 'high',
      triggerReason: `3-day cumulative precipitation ${precip3Day.toFixed(1)}mm ≥ 120mm threshold`,
    });
  } else if (precip3Day >= 60) {
    // Moderate: 60-119mm → warning, not severe
    alerts.push({
      type: 'flood',
      label: 'Heavy Rain / Waterlogging Watch',
      cropAffected: 'All Crops',
      severity: 'medium',
      triggerReason: `3-day cumulative precipitation ${precip3Day.toFixed(1)}mm ≥ 60mm threshold`,
    });
  }

  // Pest/blast alert: ≥95% humidity at ≥30°C sustained = real epidemic window.
  // 90% humidity at 28°C is typical ALL of June-Sep in Bangladesh — not an alert condition.
  // Threshold raised from 90%/28°C → 95%/30°C.
  if (humidityMaxToday >= 95 && tempMaxToday >= 30) {
    alerts.push({
      type: 'pest',
      label: 'General Pest & Fungal Outbreak Risk',
      cropAffected: 'All Crops',
      severity: 'medium',
      triggerReason: `Humidity ${humidityMaxToday}% ≥ 95% at temp ${tempMaxToday}°C — favourable for blast, blight, and beetle outbreaks`,
    });
  }

  // ── Rule 2: Crop-specific threshold checks ────────────────────────────────

  if (activeCrops.length > 0) {
    const cropNames = activeCrops.map((c) => c.crop);

    // Fetch matching threshold documents for the district's active crops.
    // We do a simple regex match on cropName since exact names may differ slightly.
    const thresholdDocs = await db
      .collection('crop_thresholds')
      .find(
        { cropName: { $in: cropNames } },
        { projection: { parsedRules: 1, cropName: 1 } }
      )
      .toArray();

    for (const thresh of thresholdDocs) {
      const rules = thresh.parsedRules;
      if (!rules) continue;

      // Flowering disruption check
      if (rules.floweringDisruptAbove && tempMaxToday > rules.floweringDisruptAbove) {
        alerts.push({
          type: 'heat',
          label: `Heat Stress — ${thresh.cropName} Flowering Disruption`,
          cropAffected: thresh.cropName,
          severity: 'high',
          triggerReason: `Temp ${tempMaxToday}°C exceeds ${thresh.cropName} flowering disruption threshold of ${rules.floweringDisruptAbove}°C`,
        });
      }

      // Germination cold stress check
      if (rules.germinationTempMin && tempMaxToday < rules.germinationTempMin) {
        alerts.push({
          type: 'cold',
          label: `Cold Stress — ${thresh.cropName} Germination Risk`,
          cropAffected: thresh.cropName,
          severity: 'medium',
          triggerReason: `Temp ${tempMaxToday}°C below ${thresh.cropName} minimum germination temp of ${rules.germinationTempMin}°C`,
        });
      }

      // Humidity out-of-range check (for crops with defined flowering humidity ranges)
      if (rules.floweringHumidityMax && humidityMaxToday > rules.floweringHumidityMax) {
        alerts.push({
          type: 'humidity',
          label: `Excess Humidity — ${thresh.cropName} Disease Window`,
          cropAffected: thresh.cropName,
          severity: 'medium',
          triggerReason: `Humidity ${humidityMaxToday}% exceeds ${thresh.cropName} flowering humidity max of ${rules.floweringHumidityMax}%`,
        });
      }
    }
  }

  // ── Deduplicate alerts by label ───────────────────────────────────────────
  const seen = new Set();
  const uniqueAlerts = alerts.filter((a) => {
    if (seen.has(a.label)) return false;
    seen.add(a.label);
    return true;
  });

  // ── Determine overall riskStatus ──────────────────────────────────────────
  let riskStatus = 'green';
  if (uniqueAlerts.some((a) => a.severity === 'high')) riskStatus = 'red';
  else if (uniqueAlerts.some((a) => a.severity === 'medium')) riskStatus = 'yellow';

  return { riskStatus, activeAlerts: uniqueAlerts };
}

module.exports = { scoreDistrict };