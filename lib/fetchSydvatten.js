const SYDVATTEN_URL = 'https://sydvatten.se/update_vattenproduktion/';

function parseNumber(value) {
  const number = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(number) ? number : null;
}

function parseSydvattenProduction(rawText) {
  const text = String(rawText || '');

  // The endpoint currently returns a PHP-style object string, for example:
  // stdClass Object ( [id] => 1 [vomb] => 652 [ring] => 1914 )
  const vombMatch = text.match(/\[vomb\]\s*=>\s*([0-9]+(?:[\.,][0-9]+)?)/i);
  const ringMatch = text.match(/\[ring\]\s*=>\s*([0-9]+(?:[\.,][0-9]+)?)/i);

  const vomb = vombMatch ? parseNumber(vombMatch[1]) : null;
  const ring = ringMatch ? parseNumber(ringMatch[1]) : null;

  if (vomb === null) {
    throw new Error('Kunde inte läsa Vombverkets leverans från Sydvatten-svaret.');
  }

  return { vomb, ring, raw: text.trim() };
}

async function fetchSydvattenProduction({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(SYDVATTEN_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vattenkontot MVP / research prototype'
      }
    });

    if (!response.ok) {
      throw new Error(`Sydvatten svarade med HTTP ${response.status}.`);
    }

    const rawText = await response.text();
    const parsed = parseSydvattenProduction(rawText);

    return {
      sourceUrl: SYDVATTEN_URL,
      fetchedAt: new Date().toISOString(),
      ...parsed
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  SYDVATTEN_URL,
  parseSydvattenProduction,
  fetchSydvattenProduction
};
