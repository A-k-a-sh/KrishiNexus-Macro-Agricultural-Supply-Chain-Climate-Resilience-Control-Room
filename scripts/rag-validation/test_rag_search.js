require('dotenv').config({ path: '../../backend/.env' });
const { connectDb } = require('../../backend/db/connect');
const { vectorSearch, searchAdvisories } = require('../../backend/services/vectorSearch');
const { embedText } = require('../../backend-ingestion/services/geminiEmbed');

async function runTests() {
  console.log('Connecting to databases...');
  await connectDb();
  console.log('Connected!');

  // Helper to format output
  const printResults = (title, results) => {
    console.log(`\n========== ${title} ==========`);
    if (results.length === 0) {
      console.log('No results found.');
      return;
    }
    results.forEach((doc, i) => {
      const score = doc.rrfScore || doc.searchScore || 'N/A';
      const mode = doc.searchMode || 'vector';
      console.log(`\n[#${i + 1}] Score: ${score} | Mode: ${mode}`);
      console.log(`Chunk: ${doc.ragContextChunk.substring(0, 150)}...`);
    });
  };

  try {
    // ---------------------------------------------------------
    // TEST 1: crop_thresholds (Pure Vector Search - Primary Cluster)
    // ---------------------------------------------------------
    const q1 = "ধানের ব্লাস্ট রোগের জন্য তাপমাত্রা কত হওয়া দরকার?";
    console.log(`\nEmbedding Query 1: "${q1}"`);
    const vec1 = await embedText(q1);
    const res1 = await vectorSearch('crop_thresholds', vec1, 'embedding', null, 2);
    printResults('TEST 1: crop_thresholds (Vector Only)', res1);

    // ---------------------------------------------------------
    // TEST 2: crop_pathology (Pure Vector Search - Primary Cluster)
    // ---------------------------------------------------------
    const q2 = "আলুর লেট ব্লাইট রোগের লক্ষন এবং দমন ব্যবস্থাপনা";
    console.log(`\nEmbedding Query 2: "${q2}"`);
    const vec2 = await embedText(q2);
    const res2 = await vectorSearch('crop_pathology', vec2, 'embedding', null, 2);
    printResults('TEST 2: crop_pathology (Vector Only)', res2);

    // ---------------------------------------------------------
    // TEST 3: regional_advisories (Hybrid Search - Search Cluster 2)
    // ---------------------------------------------------------
    const q3 = "কুমিল্লা জেলায় ধানের ব্লাস্ট রোগের কোন পরামর্শ আছে কি?";
    // Note: districtId '22' is Comilla based on typical BD maps, or we can just run without filter to test
    console.log(`\nEmbedding Query 3: "${q3}"`);
    const vec3 = await embedText(q3);
    const res3 = await searchAdvisories(vec3, q3, 3, null, true);
    printResults('TEST 3: regional_advisories (Hybrid Vector + BM25 Text)', res3);

  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    process.exit(0);
  }
}

runTests();
