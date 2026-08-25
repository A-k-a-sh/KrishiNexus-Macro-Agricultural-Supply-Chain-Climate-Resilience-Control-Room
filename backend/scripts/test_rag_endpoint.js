require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDb } = require('../db/connect');
const express = require('express');
const ragRouter = require('../routes/rag');

async function testRagEndpoint() {
  console.log('🚀 Testing End-to-End RAG endpoint with useHybrid: true...');
  await connectDb();

  const app = express();
  app.use(express.json());
  app.use('/api/rag', ragRouter);

  const server = app.listen(5099, async () => {
    try {
      const response = await fetch('http://localhost:5099/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: 'আমন ধানের বীজতলা তৈরি ও সার প্রয়োগ সম্পর্কে পরামর্শ দিন',
          districtId: '7',
          useHybrid: true,
          language: 'bn',
        }),
      });

      const data = await response.json();
      console.log('\n📥 Response Status:', response.status);
      console.log('📊 Meta Info:', JSON.stringify(data.meta, null, 2));
      console.log('\n🤖 AI Generated Answer:');
      console.log(data.answer);
    } catch (err) {
      console.error('❌ Request error:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

testRagEndpoint();
