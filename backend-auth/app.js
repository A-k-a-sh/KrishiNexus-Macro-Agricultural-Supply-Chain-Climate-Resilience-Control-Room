const express = require('express');
const cors = require('cors');
const { connectDb } = require('./db/connect');
const authRouter = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

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

app.use('/auth', authRouter);

app.use(errorHandler);

module.exports = app;
