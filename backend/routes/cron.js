const { Router } = require('express');
const { runWeatherRefresh } = require('../cron/weatherRefresh');

const router = Router();

/**
 * GET /api/cron/weather-refresh
 * Triggers the weather refresh and risk scorer manually.
 * Can be called by Vercel Cron.
 */
router.get('/weather-refresh', async (req, res, next) => {
  try {
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers['authorization'];
    
    // Check authorization in production environments
    if (process.env.NODE_ENV === 'production') {
      const isAuthorized = isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);
      if (!isAuthorized) {
        console.warn('[cron route] Unauthorized attempt to trigger weather refresh');
        return res.status(401).json({ ok: false, message: 'Unauthorized' });
      }
    }

    console.log('[cron route] Starting weather refresh from API trigger...');
    
    // Run the weather refresh
    await runWeatherRefresh();
    
    console.log('[cron route] Weather refresh completed successfully.');
    res.json({ ok: true, message: 'Weather refresh completed successfully' });
  } catch (err) {
    console.error('[cron route] Weather refresh failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
