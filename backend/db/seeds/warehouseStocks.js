require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { connectDb, getDb } = require('../connect');

const DIVISIONS = [
  { divisionId: '6', divisionName: 'Dhaka' },
  { divisionId: '1', divisionName: 'Chattagram' },
  { divisionId: '2', divisionName: 'Rajshahi' },
  { divisionId: '3', divisionName: 'Khulna' },
  { divisionId: '4', divisionName: 'Barishal' },
  { divisionId: '5', divisionName: 'Sylhet' },
  { divisionId: '7', divisionName: 'Rangpur' },
  { divisionId: '8', divisionName: 'Mymensingh' }
];

const CROP_BASE_RESERVES = {
  Rice: { base: 22000, multiplier: 3500 },
  Wheat: { base: 5000, multiplier: 1400 },
  Onion: { base: 3500, multiplier: 1100 },
  Garlic: { base: 2000, multiplier: 800 },
  Tomato: { base: 1500, multiplier: 650 },
  Cabbage: { base: 1200, multiplier: 500 },
  Cauliflower: { base: 1000, multiplier: 450 },
  Beans: { base: 800, multiplier: 400 },
  Radish: { base: 600, multiplier: 350 },
  Laushak: { base: 400, multiplier: 200 }
};

async function seedWarehouseStocks() {
  await connectDb();
  const db = getDb();
  const col = db.collection('warehouse_stocks');

  console.log('Generating warehouse stocks for all crops...');
  const now = new Date().toISOString();
  const docs = [];

  for (const div of DIVISIONS) {
    const idNum = parseInt(div.divisionId) || 1;
    for (const [crop, config] of Object.entries(CROP_BASE_RESERVES)) {
      // Deterministic but varied reserve numbers for each division and crop
      const reserveMtons = config.base + ((idNum * 7 + crop.length * 3) % 10) * config.multiplier;
      
      docs.push({
        _id: `stock_${div.divisionName.toLowerCase()}_${crop.toLowerCase()}`,
        divisionId: div.divisionId,
        divisionName: div.divisionName,
        crop,
        reserveMtons,
        isSimulated: true,
        lastUpdated: now
      });
    }
  }

  // Clear existing stocks first to avoid leftover stubs
  await col.deleteMany({});
  
  // Insert new stocks
  await col.insertMany(docs);

  console.log(`Successfully seeded ${docs.length} warehouse stock documents across 10 crops.`);
  process.exit(0);
}

seedWarehouseStocks().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});