const express = require('express');
const cors = require('cors');
const districtsRouter = require('./routes/districts');
const ragRouter = require('./routes/rag');
const logisticsRouter = require('./routes/logistics');
const manifestRouter = require('./routes/manifest');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'krishinexus-backend' });
});

app.use('/api/districts', districtsRouter);
app.use('/api/rag', ragRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/manifest', manifestRouter);

module.exports = app;