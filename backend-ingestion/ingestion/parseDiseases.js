const { getDb } = require('../db/connect');

/**
 * A disease section is a "stub" (useless for RAG) when its text is
 * identical to or barely longer than its title — e.g.:
 * { title: "ক্যাঙ্কার রোগ", text: "ক্যাঙ্কার রোগ" }
 * Embedding these would pollute the vector space with zero-information chunks.
 */
function isStubSection(section) {
  const titleLen = (section.title || '').trim().length;
  const textLen = (section.text || '').trim().length;
  // Consider a stub if text adds fewer than 15 characters beyond the title
  return textLen - titleLen < 15;
}

/**
 * Parse a pipe-delimited structured text block from BAMIS diseases into
 * a key-value object. Example input:
 * "অনুকূল আবহাওয়া | তাপমাত্রা ২৮-৩০° সে. | দমন ব্যবস্থা | সার ব্যবস্থপনা"
 *
 * Returns: { "অনুকূল আবহাওয়া": "তাপমাত্রা ২৮-৩০° সে.", "দমন ব্যবস্থা": "সার ব্যবস্থপনা" }
 */
function parsePipeDelimited(text) {
  const parts = text.split('|').map((p) => p.trim()).filter(Boolean);
  const result = {};
  for (let i = 0; i < parts.length - 1; i += 2) {
    result[parts[i]] = parts[i + 1] || '';
  }
  return result;
}

/**
 * Convert one raw_diseases document into an array of crop_pathology-ready chunks.
 * One chunk per non-stub section within the disease page.
 *
 * @param {object} doc - A raw_diseases document
 * @returns {object[]}
 */
function diseaseDocToChunks(doc) {
  const chunks = [];

  // If there are no sections or all are stubs, try the full rawText as one chunk
  const validSections = (doc.sections || []).filter((s) => !isStubSection(s));

  if (validSections.length === 0) {
    // Fall back: use the full rawText if it has enough substance
    if (!doc.rawText || doc.rawText.length < 20) return [];

    chunks.push({
      _id: `path_${doc.diseaseId}_full`,
      sourceId: doc.diseaseId,
      cropName: doc.diseaseName,
      diseaseName: doc.diseaseName,
      images: doc.images?.map((img) => img.full).filter(Boolean) || [],
      fullText: doc.rawText,
      ragContextChunk: `ফসল: ${doc.diseaseName}। রোগ তথ্য: ${doc.rawText}`,
      embedding: null,
      sourceUrl: doc.sourceUrl,
      needsReview: false,
    });

    return chunks;
  }

  // One chunk per valid section
  for (let i = 0; i < validSections.length; i++) {
    const section = validSections[i];
    const parsed = section.text.includes('|') ? parsePipeDelimited(section.text) : null;

    // Build a clean readable context chunk
    let ragContextChunk;
    if (parsed && Object.keys(parsed).length > 0) {
      const kvLines = Object.entries(parsed)
        .map(([k, v]) => `${k}: ${v}`)
        .join('। ');
      ragContextChunk = `রোগের নাম: ${section.title}। ফসল: ${doc.diseaseName}। ${kvLines}`;
    } else {
      ragContextChunk = `রোগের নাম: ${section.title}। ফসল: ${doc.diseaseName}। বিবরণ: ${section.text}`;
    }

    chunks.push({
      _id: `path_${doc.diseaseId}_${i}`,
      sourceId: doc.diseaseId,
      cropName: doc.diseaseName,
      diseaseName: section.title,
      images: doc.images?.map((img) => img.full).filter(Boolean) || [],
      fullText: section.text,
      parsedFields: parsed || null,
      ragContextChunk,
      embedding: null,
      sourceUrl: doc.sourceUrl,
      needsReview: false,
    });
  }

  return chunks;
}

/**
 * Parse all raw_diseases documents and write chunks to crop_pathology.
 */
async function parseDiseases() {
  const db = getDb();
  const rawDocs = await db.collection('raw_diseases').find({}).toArray();

  console.log(`[parseDiseases] Processing ${rawDocs.length} raw disease documents...`);

  let totalChunks = 0;
  let skippedDocs = 0;

  for (const doc of rawDocs) {
    const chunks = diseaseDocToChunks(doc);

    if (chunks.length === 0) {
      skippedDocs++;
      continue;
    }

    for (const chunk of chunks) {
      await db
        .collection('crop_pathology')
        .replaceOne({ _id: chunk._id }, chunk, { upsert: true });
    }

    totalChunks += chunks.length;
  }

  console.log(
    `[parseDiseases] Done. ${totalChunks} pathology chunks written. ${skippedDocs} stub/empty docs skipped.`
  );

  return totalChunks;
}

module.exports = { parseDiseases, diseaseDocToChunks, isStubSection };