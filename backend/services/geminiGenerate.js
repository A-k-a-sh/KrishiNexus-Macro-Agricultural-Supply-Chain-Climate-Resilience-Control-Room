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
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini generate failed (${res.status}): ${err}`);
  }

  const data = await res.json();

  // Surface a clear error if Gemini blocked or returned no candidates
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini returned no candidates. Possible safety block.');
  }

  return data.candidates[0].content.parts[0].text;
}

module.exports = { generateText };