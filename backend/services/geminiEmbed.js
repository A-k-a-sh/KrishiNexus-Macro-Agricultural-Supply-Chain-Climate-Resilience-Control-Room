const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${
  process.env.EMBEDDING_MODEL || 'gemini-embedding-001'
}:embedContent`;

/**
 * Embed a single string via Gemini embedding API.
 * Returns an array of floats (768 dimensions for gemini-embedding-001).
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text) {
  const res = await fetch(`${EMBEDDING_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini embed failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.embedding.values; // array of floats
}

/**
 * Embed an array of strings with a 60ms delay between calls
 * to stay comfortably within free-tier rate limits.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  const results = [];
  for (const text of texts) {
    const vector = await embedText(text);
    results.push(vector);
    await new Promise((r) => setTimeout(r, 60));
  }
  return results;
}

module.exports = { embedText, embedBatch };