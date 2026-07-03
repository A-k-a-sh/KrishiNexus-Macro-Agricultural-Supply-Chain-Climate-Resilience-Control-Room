const { MongoClient } = require('mongodb');

let db = null;

async function connectDb() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(); // uses the db name from the connection string
  console.log('Connected to MongoDB Atlas:', db.databaseName);
}

function getDb() {
  if (!db) throw new Error('DB not initialised — call connectDb() first');
  return db;
}

module.exports = { connectDb, getDb };