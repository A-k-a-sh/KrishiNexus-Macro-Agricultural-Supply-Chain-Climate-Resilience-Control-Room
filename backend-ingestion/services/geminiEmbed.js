const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${
  process.env.EMBEDDING_MODEL || 'gemini-embedding-001'
}:embedContent`;

/**
 * Embed a single string via Gemini embedding API.
 * Returns an array of floats (3072 dimensions for gemini-embedding-001).
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedText(text, retries = 5, backoffMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(`${EMBEDDING_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    if (res.status === 429) {
      console.warn(`[geminiEmbed] ⚠️ Quota (429) hit. Waiting ${backoffMs / 1000}s before retry (attempt ${attempt}/${retries})...`);
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.5, 15000); // Exponential backoff maxing at 15s
      continue; // Try again
    }

    if (!res.ok) {
      const errText = await res.text();
      let cleanMessage = `Gemini embedding failed (${res.status})`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error) cleanMessage = `Gemini embedding error (${res.status}): ${errJson.error.message}`;
      } catch (e) {
        cleanMessage = `Gemini embedding failed (${res.status}): ${errText}`;
      }
      throw new Error(cleanMessage);
    }

    const data = await res.json();
    return data.embedding.values; // array of floats
  }
  
  throw new Error(`Exceeded maximum retries (${retries}) due to 429 quota limits.`);
}

/**
 * Embed an array of strings with a 2000ms delay between calls
 * to stay comfortably within free-tier rate limits.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts) {
  const results = [];
  for (const text of texts) {
    const vector = await embedText(text);
    results.push(vector);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return results;
}

module.exports = { embedText, embedBatch };``