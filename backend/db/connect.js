const { MongoClient } = require('mongodb');

let db = null;

async function connectDb() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  const client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  console.log('Connected to MongoDB Atlas:', db.databaseName);
}

function getDb() {
  if (!db) throw new Error('DB not initialised — call connectDb() first');
  return db;
}

module.exports = { connectDb, getDb };