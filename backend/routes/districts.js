const router = require('express').Router();

router.get('/', (req, res) => {
  res.json([]);
});

router.get('/:id', (req, res) => {
  res.status(404).json({ error: 'District route template only' });
});

module.exports = router;