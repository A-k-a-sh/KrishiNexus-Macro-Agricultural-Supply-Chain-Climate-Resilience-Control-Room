const { getDb } = require('../db/connect');

/**
 * Extract numeric threshold rules from the raw Bengali text using regex.
 * These parsed numbers feed the riskScorer engine (deterministic rule checks),
 * NOT the vector search.
 *
 * Handles patterns like:
 *   "১০-২১.১৫° সেন্ট্রিগ্রেড"  →  { min: 10, max: 21.15 }
 *   "৩২° সেন্ট্রিগ্রেডের উপরে"  →  32  (single threshold)
 *
 * Bengali digits are converted to ASCII before parsing.
 */

const BN_DIGITS = { '০': 0, '১': 1, '২': 2, '৩': 3, '৪': 4, '৫': 5, '৬': 6, '৭': 7, '৮': 8, '৯': 9 };

function bnToAscii(str) {
  return str.replace(/[০-৯]/g, (d) => BN_DIGITS[d]);
}

function parseRangeOrValue(str) {
  const ascii = bnToAscii(str);
  const rangeMatch = ascii.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (rangeMatch) return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  const singleMatch = ascii.match(/([\d.]+)/);
  if (singleMatch) return parseFloat(singleMatch[1]);
  return null;
}

/**
 * Attempt to extract structured numeric rules from a threshold document's rawText.
 * Returns a parsedRules object with whatever could be found.
 * Fields that can't be found are simply omitted (not set to null).
 *
 * This is best-effort — the text format varies across crops.
 * The riskScorer only uses fields that exist.
 */
function extractParsedRules(rawText) {
  const rules = {};

  // Germination temperature: look for "অংকুরোদগম" + temp range
  const germTempMatch = rawText.match(/অংকুরোদগম[^।\n]*?([\d০-৯.]+\s*[-–]\s*[\d০-৯.]+)\s*°/);
  if (germTempMatch) {
    const parsed = parseRangeOrValue(germTempMatch[1]);
    if (parsed && parsed.min !== undefined) {
      rules.germinationTempMin = parsed.min;
      rules.germinationTempMax = parsed.max;
    }
  }

  // Germination humidity
  const germHumidMatch = rawText.match(/অংকুরোদগম[^।\n]*?([\d০-৯.]+\s*[-–]\s*[\d০-৯.]+)\s*%/);
  if (germHumidMatch) {
    const parsed = parseRangeOrValue(germHumidMatch[1]);
    if (parsed && parsed.min !== undefined) {
      rules.germinationHumidityMin = parsed.min;
      rules.germinationHumidityMax = parsed.max;
    }
  }

  // Flowering temperature range: look for "ফুল" or "ফুল-ফল" + temp range
  const flowerTempMatch = rawText.match(/ফুল[^।\n]*?([\d০-৯.]+\s*[-–]\s*[\d০-৯.]+)\s*°/);
  if (flowerTempMatch) {
    const parsed = parseRangeOrValue(flowerTempMatch[1]);
    if (parsed && parsed.min !== undefined) {
      rules.floweringTempMin = parsed.min;
      rules.floweringTempMax = parsed.max;
    }
  }

  // Flowering disruption above X°C: look for "উপরে" near a temperature
  const disruptMatch = rawText.match(/([\d০-৯.]+)\s*°[^।\n]*উপরে[^।\n]*ফুল|ফুল[^।\n]*([\d০-৯.]+)\s*°[^।\n]*উপরে/);
  if (disruptMatch) {
    const val = parseRangeOrValue(disruptMatch[1] || disruptMatch[2]);
    if (typeof val === 'number') rules.floweringDisruptAbove = val;
  }

  // Flowering humidity range
  const flowerHumidMatch = rawText.match(/ফুল[^।\n]*?([\d০-৯.]+\s*[-–]\s*[\d০-৯.]+)\s*%/);
  if (flowerHumidMatch) {
    const parsed = parseRangeOrValue(flowerHumidMatch[1]);
    if (parsed && parsed.min !== undefined) {
      rules.floweringHumidityMin = parsed.min;
      rules.floweringHumidityMax = parsed.max;
    }
  }

  return Object.keys(rules).length > 0 ? rules : null;
}

/**
 * Extract crop name from the heading.
 * Heading format: "ফসল আবহাওয়া তথ্য - মসুর"
 * Returns "মসুর"
 */
function cropNameFromHeading(heading) {
  if (!heading) return null;
  const parts = heading.split('-');
  return parts[parts.length - 1].trim();
}

/**
 * Convert one raw_thresholds document into a crop_thresholds-ready object.
 * Each threshold doc becomes a single chunk (text is short enough to embed whole).
 *
 * @param {object} doc - A raw_thresholds document
 * @returns {object|null}
 */
function thresholdDocToChunk(doc) {
  if (!doc.rawText || doc.rawText.length < 20) return null;

  const cropName = cropNameFromHeading(doc.heading) || doc.heading || `crop_${doc.thresholdId}`;
  const parsedRules = extractParsedRules(doc.rawText);

  return {
    _id: `threshold_${doc.thresholdId}`,
    sourceId: doc.thresholdId,
    cropName,
    heading: doc.heading,
    ragContextChunk: `ফসল: ${cropName}। আবহাওয়া সীমা: ${doc.rawText}`,
    parsedRules,           // used by riskScorer — may be null if regex found nothing
    embedding: null,       // filled by embedAndStore.js
    sourceUrl: doc.sourceUrl,
  };
}

/**
 * Parse all raw_thresholds documents and write chunks to crop_thresholds.
 */
async function parseThresholds() {
  const db = getDb();
  const rawDocs = await db.collection('raw_thresholds').find({}).toArray();

  console.log(`[parseThresholds] Processing ${rawDocs.length} raw threshold documents...`);

  let written = 0;
  let skipped = 0;

  for (const doc of rawDocs) {
    const chunk = thresholdDocToChunk(doc);

    if (!chunk) {
      skipped++;
      continue;
    }

    await db
      .collection('crop_thresholds')
      .replaceOne({ _id: chunk._id }, chunk, { upsert: true });

    written++;
  }

  console.log(`[parseThresholds] Done. ${written} threshold chunks written. ${skipped} skipped.`);
  return written;
}

module.exports = { parseThresholds, thresholdDocToChunk, extractParsedRules };