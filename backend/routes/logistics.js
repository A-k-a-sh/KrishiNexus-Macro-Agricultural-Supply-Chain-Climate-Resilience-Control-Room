const router = require('express').Router();

router.post('/calculate', (req, res) => {
  res.json({ baselineMtons: 0, projectedDeficit: 0, recommendedCargo: 0 });
});

router.post('/dispatch', (req, res) => {
  res.json({ status: 'queued' });
});

module.exports = router;