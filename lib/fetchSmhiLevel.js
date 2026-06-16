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

function extractLatestLevelFromCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let header = null;
  let valueIndex = -1;
  let dateIndex = -1;
  let timeIndex = -1;
  const observations = [];

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const cols = splitCsvLine(line);
    const lower = cols.map((c) => c.toLowerCase());

    if (lower.some((c) => c.includes('datum') || c === 'date') &&
        lower.some((c) => c.includes('värde') || c.includes('varde') || c === 'value')) {
      header = lower;
      valueIndex = header.findIndex((c) => c.includes('värde') || c.includes('varde') || c === 'value');
      dateIndex = header.findIndex((c) => c.includes('datum') || c === 'date');
      timeIndex = header.findIndex((c) => c.includes('tid') || c === 'time');
      continue;
    }

    let value = null;
    if (valueIndex >= 0 && cols.length > valueIndex) {
      value = parseNumber(cols[valueIndex]);
    } else {
      const numericCandidates = cols.map(parseNumber).filter((v) => v !== null);
      value = numericCandidates.length ? numericCandidates[numericCandidates.length - 1] : null;
    }

    if (value !== null) {
      observations.push({
        rawValue: value,
        levelM: convertLevelToMeters(value),
        date: dateIndex >= 0 ? cols[dateIndex] : null,
        time: timeIndex >= 0 ? cols[timeIndex] : null
      });
    }
  }

  if (!observations.length) {
    throw new Error('Kunde inte läsa vattennivå från SMHI-CSV.');
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
