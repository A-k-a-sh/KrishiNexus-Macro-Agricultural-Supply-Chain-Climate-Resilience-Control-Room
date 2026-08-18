require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { connectDb, getDb } = require('../db/connect');
const { getEnvBaseUrl, normalizeBanglaName, extractDistrictNameFromText } = require('./bamisClient');

const BDAPI_BASE_URL = getEnvBaseUrl('BDAPI_BASE_URL', 'https://bdapi.vercel.app/api/v.1');
const MAP_PATH = path.resolve(__dirname, 'zilaIdMap.json');
const BANGLA_COLLATOR = new Intl.Collator('bn', { usage: 'search', sensitivity: 'base' });
const DISTRICT_NAME_ALIASES = {
  নেত্রকোনা: '64',
};

async function loadBdapiDistricts() {
  const response = await fetch(`${BDAPI_BASE_URL}/district`);
  if (!response.ok) throw new Error(`bdapi district fetch failed (${response.status})`);
  const payload = await response.json();
  return payload?.data || payload || [];
}

function matchDistrictName(bnName, districts) {
  const normalized = normalizeBanglaName(bnName);

  if (DISTRICT_NAME_ALIASES[normalized]) {
    const aliasId = String(DISTRICT_NAME_ALIASES[normalized]);
    const aliasDistrict = districts.find((district) => String(district.id) === aliasId || String(district._id) === aliasId);
    if (aliasDistrict) {
      return aliasDistrict;
    }
  }

  return districts.find((district) => {
    const districtBnName = district.bn_name || district.bnName || '';
    const bnMatch = normalizeBanglaName(districtBnName) === normalized || BANGLA_COLLATOR.compare(normalizeBanglaName(districtBnName), normalized) === 0;
    const nameMatch = normalizeBanglaName(district.name) === normalized;
    return bnMatch || nameMatch;
  });
}

async function generateZilaIdMap() {
  await connectDb();
  const db = getDb();
  const districts = await loadBdapiDistricts();
  const rawBulletins = await db
    .collection('raw_bulletins')
    .find({})
    .project({ zilaId: 1, bulletinNo: 1, rawText: 1, sourceUrl: 1 })
    .toArray();

  const map = {};
  const unresolved = [];

  for (const bulletin of rawBulletins) {
    const districtName = extractDistrictNameFromText(bulletin.rawText);
    if (!districtName) {
      unresolved.push({ zilaId: bulletin.zilaId, reason: 'district name not found' });
      continue;
    }

    const district = matchDistrictName(districtName, districts);
    if (!district) {
      unresolved.push({ zilaId: bulletin.zilaId, districtName });
      continue;
    }

    map[bulletin.zilaId] = String(district.id);
  }

  fs.writeFileSync(MAP_PATH, `${JSON.stringify(map, null, 2)}\n`);

  for (const [zilaId, districtId] of Object.entries(map)) {
    await db.collection('districts').updateOne({ _id: districtId }, { $set: { bamisZilaId: zilaId } });
  }

  console.log(`[generateZilaIdMap] mapped ${Object.keys(map).length} districts and wrote ${MAP_PATH}`);
  if (unresolved.length > 0) {
    console.warn('[generateZilaIdMap] unresolved zila ids:', JSON.stringify(unresolved.slice(0, 10), null, 2));
  }

  return { map, unresolved };
}

if (require.main === module) {
  generateZilaIdMap().catch((error) => {
    console.error('[generateZilaIdMap] Failed:', error);
    process.exit(1);
  });
}

module.exports = { generateZilaIdMap };