const router = require('express').Router();

router.post('/query', (req, res) => {
  res.json({ answer: 'RAG route template only' });
});

module.exports = router;