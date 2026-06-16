const DEFAULT_REFILL_SUBID = Number(process.env.REFILL_PROXY_SUBID || 103);
const HYDRONU_BASE_URL = process.env.HYDRONU_BASE_URL || 'https://vattenwebb.smhi.se/hydronu/data/point';

function parseNumber(value) {
  if (value === undefined || value === null) return null;
  const number = Number(String(value).trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function extractNumericSeries(node, depth = 0) {
  if (depth > 6 || node == null) return [];

  if (Array.isArray(node)) {
    // Common HydroNu shape: [[timestamp, value], [timestamp, value], ...]
    if (node.every((item) => Array.isArray(item) && item.length >= 2)) {
      const values = node
        .map((item) => parseNumber(item[1]))
        .filter((value) => value !== null);
      if (values.length >= 2) return values;
    }

    // Fallback: array of objects with a value-like field.
    if (node.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      const values = node
        .map((item) => parseNumber(item.value ?? item.y ?? item.flow ?? item.cout))
        .filter((value) => value !== null);
      if (values.length >= 2) return values;
    }

    for (const item of node) {
      const child = extractNumericSeries(item, depth + 1);
      if (child.length >= 2) return child;
    }
  }

  if (typeof node === 'object') {
    // Prefer forecast series if available.
    const preferredKeys = [
      'coutForecast',
      'flowForecast',
      'forecast',
      'data'
    ];

    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const child = extractNumericSeries(node[key], depth + 1);
        if (child.length >= 2) return child;
      }
    }

    for (const value of Object.values(node)) {
      const child = extractNumericSeries(value, depth + 1);
      if (child.length >= 2) return child;
    }
  }

  return [];
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyRefillFromForecast(values) {
  if (!values || values.length < 2) {
    return {
      refillOutlook: 'dålig',
      basis: 'fallback',
      reason: 'För få prognosvärden för att klassa påfyllnadsutsikt.'
    };
  }

  const first = values[0];
  const forecastValues = values.slice(1, 11);
  const forecastMean = mean(forecastValues);

  // First proxy rule: if the coming 10-day mean is at least as high as the first/current value,
  // classify as good. This is a prototype trend rule, not the final seasonal-normal rule.
  const refillOutlook = forecastMean >= first ? 'god' : 'dålig';

  return {
    refillOutlook,
    basis: 'trend-proxy',
    currentModelFlow: Number(first.toFixed(2)),
    forecastMean10d: Number(forecastMean.toFixed(2)),
    forecastDaysUsed: forecastValues.length,
    reason: refillOutlook === 'god'
      ? 'Prognosmedel för kommande dagar är lika med eller högre än första modellvärdet.'
      : 'Prognosmedel för kommande dagar är lägre än första modellvärdet.'
  };
}

async function fetchHydroNuPoint(subid = DEFAULT_REFILL_SUBID, { timeoutMs = 10000 } = {}) {
  const url = `${HYDRONU_BASE_URL}?subid=${encodeURIComponent(subid)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Vattenkontot MVP / research prototype'
      }
    });

    if (!response.ok) {
      throw new Error(`HydroNu svarade med HTTP ${response.status}.`);
    }

    const json = await response.json();
    const root = json.chartData || json;
    const values = extractNumericSeries(root);
    const classification = classifyRefillFromForecast(values);

    return {
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      subid,
      label: 'Björkaån/Eggelstad proxy',
      model: 'SMHI HydroNu/S-HYPE',
      valuesPreview: values.slice(0, 11).map((value) => Number(value.toFixed(2))),
      ...classification
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  HYDRONU_BASE_URL,
  DEFAULT_REFILL_SUBID,
  extractNumericSeries,
  classifyRefillFromForecast,
  fetchHydroNuPoint
};
