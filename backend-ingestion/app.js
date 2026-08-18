const express = require('express');
const { connectDb } = require('./db/connect');

const app = express();

app.use(async (req, res, next) => {
  try {
    await connectDb();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.json());

// Placeholder for /ingestion/trigger endpoint

module.exports = app;
