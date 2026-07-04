require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDb, getDb } = require('../db/connect');
(async ()=>{
  try{
    await connectDb();
    const db = getDb();
    const docs = await db.collection('districts').find({ _id: { $in: ['11','17'] } }).project({ _id:1, name:1, bn_name:1 }).toArray();
    console.log('missing:', docs);
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();
