require('dotenv').config();

const app = require('./app');
const { connectDb } = require('./db/connect');
const port = process.env.PORT || 5001;

async function startServer() {
  await connectDb();

  app.listen(port, () => {
    console.log(`KrishiNexus backend listening on ${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start KrishiNexus backend', error);
  process.exit(1);
});