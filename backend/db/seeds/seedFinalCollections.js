/**
 * seedFinalCollections.js
 * 
 * Reads the three final JSONL files containing pre-embedded data:
 *  - final_crop_pathology.jsonl -> crop_pathology
 *  - final_crop_thresholds.jsonl -> crop_thresholds
 *  - final_regional_advisories.jsonl -> regional_advisories
 * 
 * And writes them directly into the current MongoDB database.
 * 
 * Usage:
 *   node backend/db/seeds/seedFinalCollections.js
 */

const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

const DATA_DIR = path.resolve(__dirname, '../../../others/data, chunk, embeed/data');

const filesToCollections = [
  {
    fileName: 'final_crop_pathology.jsonl',
    collectionName: 'crop_pathology'
  },
  {
    fileName: 'final_crop_thresholds.jsonl',
    collectionName: 'crop_thresholds'
  },
  {
    fileName: 'final_regional_advisories.jsonl',
    collectionName: 'regional_advisories'
  }
];

async function importJsonl(db, filePath, collectionName) {
  const col = db.collection(collectionName);
  
  // Clear any existing records first (as requested: "prev ones i deleted, now those new one need to be inserted")
  console.log(`Clearing collection: ${collectionName}...`);
  await col.deleteMany({});

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`Importing ${filePath} to collection ${collectionName}...`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let docs = [];
  let count = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const doc = JSON.parse(line);
      
      // If there are duplicate _id objects/stubs or custom objectIds, parse them
      // MongoDB will insert them with the explicit string _id from the JSONL.
      docs.push(doc);
      count++;

      // Batch insert in chunks of 500
      if (docs.length >= 500) {
        await col.insertMany(docs);
        docs = [];
        console.log(`  Inserted ${count} documents...`);
      }
    } catch (err) {
      console.error(`Error parsing line in ${filePath}:`, err);
    }
  }

  if (docs.length > 0) {
    await col.insertMany(docs);
    console.log(`  Inserted final batch. Total: ${count} documents.`);
  }
}

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('ERROR: MONGO_URI or MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB URI...`);
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: ${db.databaseName}`);

    for (const item of filesToCollections) {
      const filePath = path.join(DATA_DIR, item.fileName);
      await importJsonl(db, filePath, item.collectionName);
    }

    console.log('\n✓ Seeding of final embedded datasets completed successfully.');
  } catch (err) {
    console.error('Fatal error seeding collections:', err);
  } finally {
    await client.close();
  }
}

run();
