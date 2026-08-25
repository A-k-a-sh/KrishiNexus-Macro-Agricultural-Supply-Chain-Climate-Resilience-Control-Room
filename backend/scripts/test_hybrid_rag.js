require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDb } = require('../db/connect');
const { embedText } = require('../services/geminiEmbed');
const { searchAdvisories } = require('../services/vectorSearch');

const TEST_QUERIES = [
  { id: 1, text: 'ব্রি ধান ৮৭ চাষ পদ্ধতি ও রোগ দমন', districtId: '22', desc: 'Specific Variety (BRRI 87)' },
  { id: 2, text: 'বোরো ধানের ব্লাস্ট রোগ ও প্রতিকার', districtId: '22', desc: 'Pest & Blast Disease' },
  { id: 3, text: 'আমন ধানের বীজতলা তৈরি ও বন্যা ঝুঁকি', districtId: '7', desc: 'Seedbed & Flood Risk' },
  { id: 4, text: 'সবজি ও উদ্যান ফসলের বালাই দমন', districtId: '7', desc: 'Horticulture Pest Management' },
  { id: 5, text: 'flood risk paddy seedling management', districtId: '22', desc: 'Bilingual / English query' },
];

async function runHybridTests() {
  console.log('🧪 Starting Phase 7 Hybrid RAG Verification Suite...\n');
  await connectDb();

  for (const test of TEST_QUERIES) {
    console.log(`\n======================================================`);
    console.log(`📋 Test ${test.id}: "${test.text}"`);
    console.log(`🎯 Category: ${test.desc} (District: ${test.districtId})`);
    console.log(`======================================================`);

    try {
      const queryVector = await embedText(test.text);

      // Run Pure Vector Search
      console.log('\n--- 🔹 1. Pure Vector Search (useHybrid: false) ---');
      const vectorResults = await searchAdvisories(queryVector, test.text, 3, { districtId: test.districtId }, false);
      if (vectorResults.length === 0) {
        console.log('No vector results found.');
      } else {
        vectorResults.forEach((r, idx) => {
          const preview = (r.ragContextChunk || '').replace(/\n/g, ' ').slice(0, 120);
          console.log(`  [Rank ${idx + 1}] (Score: ${r.searchScore ?? 'N/A'}) ${preview}...`);
        });
      }

      // Run Hybrid Search
      console.log('\n--- 🔶 2. Hybrid Search (useHybrid: true) ---');
      const hybridResults = await searchAdvisories(queryVector, test.text, 3, { districtId: test.districtId }, true);
      if (hybridResults.length === 0) {
        console.log('No hybrid results found.');
      } else {
        hybridResults.forEach((r, idx) => {
          const preview = (r.ragContextChunk || '').replace(/\n/g, ' ').slice(0, 120);
          console.log(`  [Rank ${idx + 1}] (Mode: ${r.searchMode}, Score: ${r.rrfScore ?? r.searchScore ?? 'N/A'}) ${preview}...`);
        });
      }
    } catch (err) {
      console.error(`❌ Error in Test ${test.id}:`, err.message);
    }
  }

  console.log('\n\n✅ Hybrid Verification Suite Completed.');
  process.exit(0);
}

runHybridTests();
