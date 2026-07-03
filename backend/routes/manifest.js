const router = require('express').Router();

router.post('/', (req, res) => {
  res.json({ manifestText: 'Manifest route template only' });
});

module.exports = router;