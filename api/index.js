const app = require('../backend/app');

// In serverless environments, app.js exports the Express app instance.
// Vercel wraps this exported app into a serverless handler automatically.
module.exports = app;
