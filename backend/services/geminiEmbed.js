const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${
  process.env.EMBEDDING_MODEL || 'gemini-embedding-001'
}:embedContent`;

/**
 * Embed a single string via Gemini embedding API.
 * Returns an array of floats (3072 dimensions for gemini-embedding-001).
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
    const errText = await res.text();
    let cleanMessage = `Gemini embedding failed (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) {
        if (res.status === 429) {
          cleanMessage = `Gemini Quota Exceeded (429): You exceeded the free tier embedding rate limit (1500 requests/minute). Please wait 30 seconds and retry.`;
        } else {
          cleanMessage = `Gemini embedding error (${res.status}): ${errJson.error.message}`;
        }
      }
    } catch (e) {
      cleanMessage = `Gemini embedding failed (${res.status}): ${errText}`;
    }
    throw new Error(cleanMessage);
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

module.exports = { embedText, embedBatch };``