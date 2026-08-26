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
 * Extract the meaningful parts of a BAMIS disease section text.
 *
 * BAMIS section.text has this structure:
 *   Line 1: disease name (repeated — skip it)
 *   Block A: plain text paragraph ("অনুকূল আবহাওয়া তাপমাত্রা ২৮-৩০°...")
 *   Block B: pipe-delimited key-value pairs ("অনুকূল আবহাওয়া | তাপমাত্রা...")
 *   Block C: line-by-line repetition of key-value pairs (redundant — skip)
 *
 * We keep: Block A (plain text) + key-value labels from Block B.
 * We discard: Block C (starts after the second occurrence of "অনুকূল আবহাওয়া |").
 */
function extractCleanSectionText(sectionTitle, sectionText) {
  if (!sectionText) return '';
  const lines = sectionText.trim().split('\n');

  // Remove first line if it's just the disease name repeated
  const contentLines =
    lines[0].trim() === (sectionTitle || '').trim() ? lines.slice(1) : lines;

  // Find where the pipe-delimited section starts (first line containing " | ")
  const pipeStart = contentLines.findIndex((l) => l.includes(' | '));

  if (pipeStart === -1) {
    // No pipe-delimited section — return as-is (already clean)
    return contentLines.join('\n').trim();
  }

  // Keep: everything before pipe section (plain text) + first pipe block only
  const plainText = contentLines.slice(0, pipeStart).join('\n').trim();

  // Extract key-value pairs from pipe block — only the labeled fields
  const pipeLines = contentLines.slice(pipeStart);
  const kvPairs = [];
  for (const line of pipeLines) {
    if (!line.includes(' | ')) break; // end of structured block
    const parts = line.split(' | ').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 2) {
      for (let j = 0; j < parts.length - 1; j += 2) {
        if (parts[j] && parts[j + 1]) {
          kvPairs.push(`${parts[j]}: ${parts[j + 1]}`);
        }
      }
      break;
    } else if (parts.length === 2) {
      kvPairs.push(`${parts[0]}: ${parts[1]}`);
    }
  }

  const uniqueKv = [...new Set(kvPairs)];
  const structured = uniqueKv.join('। ');
  return [plainText, structured].filter(Boolean).join('\n').trim();
}

function buildChunk(cropName, sectionTitle, sectionText) {
  const cleanBody = extractCleanSectionText(sectionTitle, sectionText);
  return `ফসল: ${cropName}। রোগ: ${sectionTitle}। ${cleanBody}`;
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
  const cropName = doc.diseaseName || '';

  // If there are no sections or all are stubs, try the full rawText as one chunk
  const validSections = (doc.sections || []).filter((s) => !isStubSection(s));

  if (validSections.length === 0) {
    const fallbackText = (doc.sourceRawText || doc.rawText || '').trim();
    if (fallbackText.length < 20) return [];

    chunks.push({
      _id: `path_${doc.diseaseId}_full`,
      sourceId: doc.diseaseId,
      cropName,
      diseaseName: cropName,
      images: doc.images?.map((img) => (typeof img === 'string' ? img : img.full)).filter(Boolean) || [],
      fullText: fallbackText,
      ragContextChunk: `ফসল: ${cropName}। রোগ তথ্য: ${fallbackText}`,
      embedding: null,
      sourceUrl: doc.sourceUrl,
      needsReview: false,
    });

    return chunks;
  }

  // One chunk per valid section
  for (let i = 0; i < validSections.length; i++) {
    const section = validSections[i];
    const ragContextChunk = buildChunk(cropName, section.title, section.text);

    chunks.push({
      _id: `path_${doc.diseaseId}_${i}`,
      sourceId: doc.diseaseId,
      cropName,
      diseaseName: section.title,
      images: doc.images?.map((img) => (typeof img === 'string' ? img : img.full)).filter(Boolean) || [],
      fullText: section.text,
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

module.exports = {
  parseDiseases,
  diseaseDocToChunks,
  isStubSection,
  extractCleanSectionText,
  buildChunk,
};