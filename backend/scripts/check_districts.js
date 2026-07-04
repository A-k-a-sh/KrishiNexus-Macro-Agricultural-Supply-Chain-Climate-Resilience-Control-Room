require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { connectDb, getDb } = require('../db/connect');

(async function(){
  try{
    await connectDb();
    const db = getDb();
    const total = await db.collection('districts').countDocuments();
    const docs = await db.collection('districts').find({ bamisZilaId: { $ne: null } }).project({ _id:1, name:1, bamisZilaId:1 }).toArray();
    console.log('districts total:', total);
    console.log('districts with bamisZilaId:', docs.length);
    console.log(docs.slice(0,20));
    const missing = await db.collection('districts').find({ $or: [ { bamisZilaId: null }, { bamisZilaId: { $exists: false } } ] }).project({ _id:1, name:1 }).toArray();
    console.log('districts missing bamisZilaId:', missing.length);
    console.log(missing.map(d=>d._id));
    process.exit(0);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
})();
