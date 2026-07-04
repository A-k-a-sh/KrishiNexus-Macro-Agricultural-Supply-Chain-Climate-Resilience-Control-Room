require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const { connectDb, getDb } = require('../db/connect');
const { fetchJsonOrText, getEnvBaseUrl, unwrapPayload, normalizeBanglaName, extractDistrictNameFromText } = require('./bamisClient');

const BDAPI_BASE_URL = getEnvBaseUrl('BDAPI_BASE_URL', 'https://bdapi.vercel.app/api/v.1');
const BULLENTIN_BASE_URL = getEnvBaseUrl('BAMIS_BULLETIN_BASE_URL', 'http://localhost:5001/api/fetch-bulletin');
const MAP_PATH = path.resolve(__dirname, 'zilaIdMap.json');

async function loadBdapiDistricts() {
  const response = await fetch(`${BDAPI_BASE_URL}/district`);
  if (!response.ok) throw new Error(`bdapi district fetch failed (${response.status})`);
  const payload = await response.json();
  return payload?.data || payload || [];
}

async function loadBulletinText(zilaId) {
  const localUrl = `${BULLENTIN_BASE_URL}/${zilaId}`;
  const payload = await fetchJsonOrText(localUrl);
  const data = unwrapPayload(payload);
  return {
    zilaId: String(zilaId),
    rawText: data.rawText || data.text || data.content || '',
  };
}

function matchDistrictName(bnName, districts) {
  const normalized = normalizeBanglaName(bnName);
  return districts.find((district) => normalizeBanglaName(district.bn_name) === normalized);
}

async function generateZilaIdMap() {
  await connectDb();
  const db = getDb();
  const districts = await loadBdapiDistricts();
  const rawBulletins = await Promise.all(
    Array.from({ length: 64 }, (_, index) => loadBulletinText(index + 1).catch(() => null))
  );

  const map = {};
  const unresolved = [];

  for (const bulletin of rawBulletins.filter(Boolean)) {
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