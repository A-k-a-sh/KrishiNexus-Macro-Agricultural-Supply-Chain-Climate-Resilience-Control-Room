const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const { connectDb } = require('./db/connect');

const districtsRouter = require('./routes/districts');
const ragRouter       = require('./routes/rag');
const logisticsRouter = require('./routes/logistics');
const manifestRouter  = require('./routes/manifest');
const cronRouter      = require('./routes/cron');

const app = express();

// Middleware to ensure DB connection is established (crucial for serverless environments like Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'krishinexus-backend' });
});

app.use('/api/districts', districtsRouter);
app.use('/api/rag',       ragRouter);
app.use('/api/logistics', logisticsRouter);
app.use('/api/manifest',  manifestRouter);
app.use('/api/cron',      cronRouter);

// Must be mounted LAST — catches any error passed to next(err) from routes
app.use(errorHandler);

module.exports = app;