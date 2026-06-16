const SMHI_LEVEL_URL = process.env.SMHI_LEVEL_URL ||
  'https://opendata-download-hydroobs.smhi.se/api/version/latest/parameter/3/station/2018/period/latest-day/data.csv';

function splitCsvLine(line) {
  const delimiter = line.includes(';') ? ';' : ',';
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim().replace(/\s/g, '').replace(',', '.');

  // Important: Number('') is 0 in JavaScript. Empty SMHI CSV cells must not
  // be interpreted as water level 0 cm.
  if (normalized === '') return null;

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function convertLevelToMeters(value) {
  const unit = String(process.env.SMHI_LEVEL_UNIT || 'cm').toLowerCase();
  if (unit === 'm') return value;
  if (unit === 'cm') return value / 100;
  // Fall back to the most likely unit for station 2018 in this prototype.
  return value / 100;
}

function extractObservationsWithRegex(csvText) {
  const observations = [];
  const text = String(csvText || '').replace(/^\uFEFF/, '');
  const regex = /(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2}:\d{2})?\s*;\s*([+-]?\d+(?:[,.]\d+)?)\s*;\s*([A-ZÅÄÖ])?/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const rawValue = parseNumber(match[2]);
    if (rawValue !== null) {
      observations.push({
        rawValue,
        levelM: convertLevelToMeters(rawValue),
        date: match[1],
        time: null,
        quality: match[3] || null
      });
    }
  }

  return observations;
}

function extractLatestLevelFromCsv(csvText) {
  // SMHI's CSV for this station contains metadata and blank semicolon fields.
  // A regex pass is safest because we only accept rows that start with an ISO date
  // followed by a numeric water level value.
  const regexObservations = extractObservationsWithRegex(csvText);
  if (regexObservations.length) {
    return regexObservations[regexObservations.length - 1];
  }

  // Fallback parser for more conventional CSV variants.
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let valueIndex = -1;
  let dateIndex = -1;
  let timeIndex = -1;
  const observations = [];

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const cols = splitCsvLine(line);
    const lower = cols.map((c) => c.toLowerCase());

    if (lower.some((c) => c.includes('datum') || c === 'date') &&
        lower.some((c) => c.includes('vattenstånd') || c.includes('vattenstand') || c.includes('värde') || c.includes('varde') || c === 'value')) {
      valueIndex = lower.findIndex((c) => c.includes('vattenstånd') || c.includes('vattenstand') || c.includes('värde') || c.includes('varde') || c === 'value');
      dateIndex = lower.findIndex((c) => c.includes('datum') || c === 'date');
      timeIndex = lower.findIndex((c) => c.includes('tid') || c === 'time');
      continue;
    }

    const first = cols[0] || '';
    const looksLikeObservation = /^\d{4}-\d{2}-\d{2}/.test(first);
    if (!looksLikeObservation && valueIndex < 0) continue;

    let value = null;
    if (valueIndex >= 0 && cols.length > valueIndex) {
      value = parseNumber(cols[valueIndex]);
    } else if (cols.length > 1) {
      value = parseNumber(cols[1]);
    }

    if (value !== null) {
      observations.push({
        rawValue: value,
        levelM: convertLevelToMeters(value),
        date: dateIndex >= 0 ? cols[dateIndex] : cols[0] || null,
        time: timeIndex >= 0 ? cols[timeIndex] : null,
        quality: cols[2] || null
      });
    }
  }

  if (!observations.length) {
    throw new Error('Kunde inte läsa vattennivå från SMHI-CSV. Inga observationsrader hittades.');
  }

  return observations[observations.length - 1];
}

async function fetchSmhiLevel({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(SMHI_LEVEL_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vattenkontot MVP / research prototype'
      }
    });

    if (!response.ok) {
      throw new Error(`SMHI vattennivå svarade med HTTP ${response.status}.`);
    }

    const csvText = await response.text();
    const latest = extractLatestLevelFromCsv(csvText);

    return {
      sourceUrl: SMHI_LEVEL_URL,
      station: 'Vombsjön övre',
      stationId: 2018,
      fetchedAt: new Date().toISOString(),
      levelM: Number(latest.levelM.toFixed(2)),
      rawValue: latest.rawValue,
      observationDate: latest.date,
      observationTime: latest.time,
      quality: latest.quality || null,
      unitAssumption: process.env.SMHI_LEVEL_UNIT || 'cm'
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  SMHI_LEVEL_URL,
  extractLatestLevelFromCsv,
  fetchSmhiLevel
};
