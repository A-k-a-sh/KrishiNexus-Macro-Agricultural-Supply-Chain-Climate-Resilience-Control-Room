const CHAT_MODEL = 'gemini-2.5-flash';
const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${CHAT_MODEL}:generateContent`;

/**
 * Call Gemini generation API.
 * @param {string} systemPrompt  - Sets the AI's role/constraints
 * @param {string} userPrompt    - The actual content/question to answer
 * @returns {Promise<string>}    - Generated text
 */
async function generateText(systemPrompt, userPrompt) {
  const res = await fetch(`${GENERATE_URL}?key=${process.env.GEMINI_CHAT_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,      // lower = more factual, less creative
        maxOutputTokens: 8192, // max for gemini-2.5-flash; Bengali text is ~3-5 tokens/word
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let cleanMessage = `Gemini generation failed (${res.status})`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error) {
        if (res.status === 429) {
          cleanMessage = `Gemini Quota Exceeded (429): You exceeded the free tier rate limit (20 requests/minute). Please wait 45-60 seconds and retry.`;
        } else {
          cleanMessage = `Gemini error (${res.status}): ${errJson.error.message}`;
        }
      }
    } catch (e) {
      cleanMessage = `Gemini generation failed (${res.status}): ${errText}`;
    }
    throw new Error(cleanMessage);
  }

  const data = await res.json();

  // Surface a clear error if Gemini blocked or returned no candidates
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned no candidates. Possible safety block.');
  }

  const candidate = data.candidates[0];

  // Warn if the response was cut short by the token limit
  if (candidate.finishReason === 'MAX_TOKENS') {
    console.warn('[geminiGenerate] Response truncated: hit maxOutputTokens limit. Consider raising it or reducing prompt size.');
  }

  return candidate.content.parts[0].text;
}

module.exports = { generateText };