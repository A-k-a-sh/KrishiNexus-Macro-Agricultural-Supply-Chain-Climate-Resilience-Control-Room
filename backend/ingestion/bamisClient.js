const BULLETIN_DISTRICT_REGEX = /জেলা\s*[:ঃ]\s*([^\n]+)/;

function getEnvBaseUrl(name, fallback) {
  return (process.env[name] || fallback).replace(/\/$/, '');
}

async function fetchJsonOrText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(`Request failed (${response.status}) for ${url}`);
    error.status = response.status;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

function unwrapPayload(payload) {
  if (payload == null) return {};
  if (typeof payload === 'string') return { rawText: payload };
  if (Array.isArray(payload)) return { items: payload };
  if (typeof payload === 'object') {
    return payload.data || payload.result || payload.payload || payload;
  }
  return { rawText: String(payload) };
}

function normalizeBanglaName(value) {
  return String(value || '')
    .trim()
    .replace(/[\u200c\u200d]/g, '')
    .replace(/\s+/g, ' ');
}

function extractDistrictNameFromText(rawText) {
  const match = String(rawText || '').match(BULLETIN_DISTRICT_REGEX);
  return match ? normalizeBanglaName(match[1]) : null;
}

module.exports = {
  fetchJsonOrText,
  getEnvBaseUrl,
  unwrapPayload,
  normalizeBanglaName,
  extractDistrictNameFromText,
};