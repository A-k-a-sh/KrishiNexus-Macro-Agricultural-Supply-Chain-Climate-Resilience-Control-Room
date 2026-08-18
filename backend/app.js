const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');
const { connectDb } = require('./db/connect');

const districtsRouter = require('./routes/districts');
const ragRouter       = require('./routes/rag');
const logisticsRouter = require('./routes/logistics');
const manifestRouter  = require('./routes/manifest');
const cronRouter      = require('./routes/cron');
const upazilasRouter  = require('./routes/upazilas');
const marketRouter    = require('./routes/market');
const alertsRouter    = require('./routes/alerts');
const analyticsRouter = require('./routes/analytics');
const reportsRouter   = require('./routes/reports');

const auth = require('./middleware/authMiddleware');
const role = require('./middleware/roleMiddleware');

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

app.use('/api/health', (req, res) => {
  res.json({ ok: true, service: 'krishinexus-backend' });
});

app.use('/api/districts', auth, districtsRouter);
app.use('/api/rag',       auth, ragRouter);
app.use('/api/logistics', auth, role(['logistics_manager', 'admin']), logisticsRouter);
app.use('/api/manifest',  auth, role(['logistics_manager', 'admin']), manifestRouter);
app.use('/api/cron',      auth, role(['admin']), cronRouter);
app.use('/api/upazilas',  auth, upazilasRouter);
app.use('/api/market',    auth, marketRouter);
app.use('/api/alerts',    auth, role(['logistics_manager', 'admin']), alertsRouter);
app.use('/api/analytics', auth, role(['admin']), analyticsRouter);
app.use('/api/reports',   auth, role(['logistics_manager', 'admin']), reportsRouter);
// Must be mounted LAST — catches any error passed to next(err) from routes
app.use(errorHandler);

module.exports = app;