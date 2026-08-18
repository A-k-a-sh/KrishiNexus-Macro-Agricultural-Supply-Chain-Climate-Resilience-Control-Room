const { getDb } = require('../db/connect');

// All known top-level section header keywords in BAMIS bulletins.
// ⚠️ Extend this list if you find bulletins with headers not listed here.
const SECTION_HEADERS = [
  'ধান আমন',
  'ধান আউশ',
  'ধান বোরো',
  'সবজি',
  'উদ্যান ফসল',
  'গবাদি পশু',
  'হাঁসমুরগী',
  'মৎস্য',
  'ডাল ফসল',
  'তেল ফসল',
];

/**
 * Split one bulletin's rawText into per-crop-section chunks.
 * Each chunk covers one crop's advisory block (e.g. "ধান আমন" section).
 *
 * @param {string} rawText
 * @returns {{ crop: string, stage: string|null, guidelineText: string }[]}
 */
function splitBulletinSections(rawText) {
  const escaped = SECTION_HEADERS.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})\\n`, 'g');

  const matches = [...rawText.matchAll(pattern)];
  if (matches.length === 0) return [];

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    const crop = matches[i][1];
    const body = rawText.slice(start + crop.length, end).trim();

    // Extract stage label if present: "পর্যায়:বীজতলা" or "পর্যায়: বীজতলা"
    const stageMatch = body.match(/^পর্যায়\s*:\s*([^\n]+)/);
    const stage = stageMatch ? stageMatch[1].trim() : null;

    if (!body || body.length < 10) continue; // skip near-empty sections

    sections.push({ crop, stage, guidelineText: body });
  }
  return sections;
}

/**
 * Convert one raw_bulletins document into an array of regional_advisories-ready objects.
 * (embedding added later by embedAndStore.js)
 *
 * @param {object} doc - A raw_bulletins document
 * @param {string} resolvedDistrictId - The bdapi district _id (from zilaIdMap)
 * @returns {object[]}
 */
function bulletinToChunks(doc, resolvedDistrictId) {
  const sections = splitBulletinSections(doc.rawText);
  return sections.map((s, idx) => ({
    _id: `adv_${doc.zilaId}_${doc.bulletinNo}_${idx}`,
    districtId: resolvedDistrictId,
    bamisZilaId: doc.zilaId,
    bulletinNo: doc.bulletinNo,
    publishDate: doc.scrapedAt,
    sourceUrl: doc.sourceUrl,
    crop: s.crop,
    stage: s.stage,
    guidelineText: s.guidelineText,
    // ragContextChunk is the exact string that will be embedded
    ragContextChunk: [
      `জেলা: ${resolvedDistrictId}`,
      `ফসল: ${s.crop}`,
      s.stage ? `পর্যায়: ${s.stage}` : null,
      `পরামর্শ: ${s.guidelineText}`,
    ]
      .filter(Boolean)
      .join('। '),
    embedding: null, // filled by embedAndStore.js
  }));
}

/**
 * Parse all raw_bulletins documents and write chunks to regional_advisories.
 * Requires zilaIdMap to be passed in — build this map manually first (see spec §4.1).
 *
 * @param {object} zilaIdMap - e.g. { "22": "4", "1": "1", ... }
 *                             key = bamisZilaId, value = bdapi district _id
 */
async function parseBulletins(zilaIdMap) {
  const db = getDb();
  const rawDocs = await db.collection('raw_bulletins').find({}).toArray();

  console.log(`[parseBulletins] Processing ${rawDocs.length} raw bulletins...`);

  let totalChunks = 0;
  let skipped = 0;

  for (const doc of rawDocs) {
    const resolvedDistrictId = zilaIdMap[doc.zilaId];

    if (!resolvedDistrictId) {
      console.warn(`[parseBulletins] No mapping for bamisZilaId=${doc.zilaId} — skipping`);
      skipped++;
      continue;
    }

    const chunks = bulletinToChunks(doc, resolvedDistrictId);

    for (const chunk of chunks) {
      await db
        .collection('regional_advisories')
        .replaceOne({ _id: chunk._id }, chunk, { upsert: true });
    }

    totalChunks += chunks.length;
  }

  console.log(
    `[parseBulletins] Done. ${totalChunks} advisory chunks written. ${skipped} bulletins skipped (no zilaId mapping).`
  );

  return totalChunks;
}

module.exports = { parseBulletins, bulletinToChunks, splitBulletinSections };