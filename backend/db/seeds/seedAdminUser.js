require('dotenv').config({ path: __dirname + '/../../.env' });
const bcrypt = require('bcryptjs');
const { connectDb, getDb } = require('../connect');

async function seed() {
  try {
    await connectDb();
    const db = getDb();
    
    // Check if admin already exists
    const existing = await db.collection('users').findOne({ email: 'admin@krishinexus.gov.bd' });
    if (existing) {
      console.log('Admin user already exists');
      process.exit(0);
    }

    const hash = await bcrypt.hash('changeme123', 12);
    
    await db.collection('users').insertOne({
      email: 'admin@krishinexus.gov.bd',
      passwordHash: hash,
      role: 'admin',
      assignedRegion: { type: 'national' },
      name: 'System Admin',
      isActive: true,
      createdAt: new Date(),
      lastLogin: null
    });
    console.log('Admin user created');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
