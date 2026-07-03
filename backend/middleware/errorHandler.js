/**
 * Global Express error handler.
 * Mount this LAST in app.js after all routes.
 *
 * Catches anything passed to next(err) from any route.
 */
function errorHandler(err, req, res, next) {
  console.error(`[error] ${req.method} ${req.path}:`, err.message);

  // Don't leak internal error details to the client in production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(err.status || 500).json({
    ok: false,
    message: err.message || 'Internal server error',
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;