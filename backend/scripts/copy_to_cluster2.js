require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

async function copyToCluster2() {
  const uri1 = process.env.MONGO_URI;
  const uri2 = process.env.MONGO_URI_SEARCH;

  if (!uri1 || !uri2) {
    console.error('❌ MONGO_URI or MONGO_URI_SEARCH is not defined in backend/.env');
    process.exit(1);
  }

  console.log('🔄 Connecting to Source Cluster 1...');
  const client1 = new MongoClient(uri1);
  await client1.connect();
  const db1 = client1.db('agri_data');

  console.log('🔄 Connecting to Destination Cluster 2...');
  const client2 = new MongoClient(uri2);
  await client2.connect();
  const db2 = client2.db('agri_data');

  try {
    const collectionName = 'regional_advisories';
    const totalDocs = await db1.collection(collectionName).countDocuments();
    console.log(`📦 Found ${totalDocs} documents in Cluster 1: [${collectionName}]`);

    if (totalDocs === 0) {
      console.warn('⚠️ No documents found in source collection!');
      return;
    }

    // Drop or clean target collection first
    await db2.collection(collectionName).deleteMany({});
    console.log(`🧹 Cleared target collection [${collectionName}] in Cluster 2`);

    // Fetch and insert in batches
    const batchSize = 250;
    let copied = 0;
    const cursor = db1.collection(collectionName).find({});

    let batch = [];
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      batch.push(doc);

      if (batch.length === batchSize) {
        await db2.collection(collectionName).insertMany(batch);
        copied += batch.length;
        console.log(`⏳ Copied ${copied}/${totalDocs} documents (${Math.round((copied / totalDocs) * 100)}%)...`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await db2.collection(collectionName).insertMany(batch);
      copied += batch.length;
      console.log(`⏳ Copied ${copied}/${totalDocs} documents (100%)...`);
    }

    const destCount = await db2.collection(collectionName).countDocuments();
    console.log(`\n✅ Migration Complete!`);
    console.log(`📊 Cluster 1 [${collectionName}]: ${totalDocs} documents`);
    console.log(`📊 Cluster 2 [${collectionName}]: ${destCount} documents`);

    if (totalDocs === destCount) {
      console.log(`🎉 Perfect match! ${destCount} documents successfully migrated to Cluster 2.`);
    } else {
      console.warn(`⚠️ Warning: Count mismatch (${totalDocs} vs ${destCount})`);
    }
  } catch (err) {
    console.error('❌ Error during copy:', err);
  } finally {
    await client1.close();
    await client2.close();
  }
}

copyToCluster2();
