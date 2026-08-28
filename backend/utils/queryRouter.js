const MARKET_KEYWORDS = [
  'দাম', 'মূল্য', 'বাজার', 'টাকা', 'price', 'cost', 'market', 'rate',
  'কেজি', 'কত টাকা', 'কিনতে', 'বিক্রি'
];

const GENERAL_KEYWORDS = [
  'চিকিৎসা', 'প্রতিকার', 'ওষুধ', 'কীটনাশক', 'ছত্রাকনাশক',
  'treatment', 'remedy', 'pesticide', 'fungicide', 'how to', 'কীভাবে',
  'কতটুকু সার', 'fertilizer', 'cultivation', 'চাষ পদ্ধতি'
];

function classifyQuery(question, districtId) {
  const lower = question.toLowerCase();

  // Type 3: market price keywords
  if (MARKET_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'market';
  }

  // Type 2: general agricultural knowledge keywords
  if (GENERAL_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'general';
  }

  // Type 1: default — district advisory (V1 behavior)
  // Applies when districtId is present or question doesn't match above
  return 'advisory';
}

module.exports = { classifyQuery };
