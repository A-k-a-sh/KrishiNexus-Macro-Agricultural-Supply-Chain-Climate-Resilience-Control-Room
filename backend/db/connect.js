const { MongoClient } = require('mongodb');

let client = null;
let db = null;

let searchClient = null;
let searchDb = null;

async function connectDb() {
  if (db) return db;

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  client = new MongoClient(mongoUri);
  await client.connect();
  db = client.db();
  console.log('Connected to Primary MongoDB Atlas:', db.databaseName);

  // Initialize Search Cluster (Cluster 2) if configured
  const searchUri = process.env.MONGO_URI_SEARCH || process.env.MONGODB_URI_SEARCH;
  if (searchUri) {
    try {
      searchClient = new MongoClient(searchUri);
      await searchClient.connect();
      searchDb = searchClient.db('agri_data');
      console.log('Connected to Search MongoDB Atlas (Cluster 2):', searchDb.databaseName);
    } catch (err) {
      console.warn('⚠️ Warning: Failed to connect to Search Cluster 2, falling back to primary cluster:', err.message);
      searchDb = db;
    }
  } else {
    searchDb = db;
  }

  return db;
}

function getDb() {
  if (!db) throw new Error('DB not initialised — call connectDb() first');
  return db;
}

function getSearchDb() {
  if (searchDb) return searchDb;
  if (db) return db;
  throw new Error('DB not initialised — call connectDb() first');
}

module.exports = { connectDb, getDb, getSearchDb };