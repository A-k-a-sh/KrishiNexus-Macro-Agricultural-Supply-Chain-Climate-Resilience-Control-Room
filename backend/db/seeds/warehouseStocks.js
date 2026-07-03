require('dotenv').config({ path: '../../.env' });
const { connectDb, getDb } = require('../connect');

// Realistic-looking grain reserve figures based on Bangladesh Food Directorate
// public reports. These are SIMULATED — clearly marked in the UI.
const WAREHOUSE_STOCKS = [
  // Dhaka
  { divisionId: '6', divisionName: 'Dhaka',      crop: 'Rice',  reserveMtons: 45000 },
  { divisionId: '6', divisionName: 'Dhaka',      crop: 'Wheat', reserveMtons: 12000 },
  { divisionId: '6', divisionName: 'Dhaka',      crop: 'Onion', reserveMtons: 8500  },
  // Chattagram
  { divisionId: '1', divisionName: 'Chattagram', crop: 'Rice',  reserveMtons: 38000 },
  { divisionId: '1', divisionName: 'Chattagram', crop: 'Wheat', reserveMtons: 9500  },
  { divisionId: '1', divisionName: 'Chattagram', crop: 'Onion', reserveMtons: 6200  },
  // Rajshahi
  { divisionId: '2', divisionName: 'Rajshahi',   crop: 'Rice',  reserveMtons: 52000 },
  { divisionId: '2', divisionName: 'Rajshahi',   crop: 'Wheat', reserveMtons: 18000 },
  { divisionId: '2', divisionName: 'Rajshahi',   crop: 'Onion', reserveMtons: 14000 },
  // Khulna
  { divisionId: '3', divisionName: 'Khulna',     crop: 'Rice',  reserveMtons: 41000 },
  { divisionId: '3', divisionName: 'Khulna',     crop: 'Wheat', reserveMtons: 11000 },
  { divisionId: '3', divisionName: 'Khulna',     crop: 'Onion', reserveMtons: 7800  },
  // Barishal
  { divisionId: '4', divisionName: 'Barishal',   crop: 'Rice',  reserveMtons: 29000 },
  { divisionId: '4', divisionName: 'Barishal',   crop: 'Wheat', reserveMtons: 6500  },
  { divisionId: '4', divisionName: 'Barishal',   crop: 'Onion', reserveMtons: 4100  },
  // Sylhet
  { divisionId: '5', divisionName: 'Sylhet',     crop: 'Rice',  reserveMtons: 24000 },
  { divisionId: '5', divisionName: 'Sylhet',     crop: 'Wheat', reserveMtons: 5000  },
  { divisionId: '5', divisionName: 'Sylhet',     crop: 'Onion', reserveMtons: 3800  },
  // Rangpur
  { divisionId: '7', divisionName: 'Rangpur',    crop: 'Rice',  reserveMtons: 48000 },
  { divisionId: '7', divisionName: 'Rangpur',    crop: 'Wheat', reserveMtons: 16000 },
  { divisionId: '7', divisionName: 'Rangpur',    crop: 'Onion', reserveMtons: 12500 },
  // Mymensingh
  { divisionId: '8', divisionName: 'Mymensingh', crop: 'Rice',  reserveMtons: 33000 },
  { divisionId: '8', divisionName: 'Mymensingh', crop: 'Wheat', reserveMtons: 8500  },
  { divisionId: '8', divisionName: 'Mymensingh', crop: 'Onion', reserveMtons: 5900  },
];

async function seedWarehouseStocks() {
  await connectDb();
  const db = getDb();
  const col = db.collection('warehouse_stocks');

  // Add metadata before inserting
  const now = new Date().toISOString();
  const docs = WAREHOUSE_STOCKS.map((s, i) => ({
    _id: `stock_${s.divisionName.toLowerCase()}_${s.crop.toLowerCase()}`,
    ...s,
    isSimulated: true,
    lastUpdated: now,
  }));

  // Upsert so re-running the seed doesn't duplicate
  for (const doc of docs) {
    await col.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }

  console.log(`Seeded ${docs.length} warehouse stock documents.`);
  process.exit(0);
}

seedWarehouseStocks().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});