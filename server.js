const express = require('express');
const path = require('path');
const { calculateVattenkontot } = require('./lib/calculateVattenkontot');
const { fetchSydvattenProduction } = require('./lib/fetchSydvatten');
const { fetchSmhiLevel } = require('./lib/fetchSmhiLevel');
const { fetchHydroNuPoint, DEFAULT_REFILL_SUBID } = require('./lib/fetchHydroNu');

const app = express();
const PORT = process.env.PORT || 3000;

const P5_LEVEL_M = Number(process.env.P5_LEVEL_M || 18.73);
const P5_BUFFER_M = Number(process.env.P5_BUFFER_M || 0.20);
const FALLBACK_LEVEL_M = Number(process.env.FALLBACK_LEVEL_M || 19.83);
const FALLBACK_CURRENT_LPS = Number(process.env.TEST_CURRENT_LPS || 670);
const FALLBACK_NORMAL_LPS = Number(process.env.TEST_NORMAL_LPS || 600);

app.use(express.static(path.join(__dirname, 'public')));

function classifyAvailabilityFromLevel(levelM) {
  const threshold = P5_LEVEL_M + P5_BUFFER_M;
  return Number(levelM) > threshold ? 'stor' : 'liten';
}

function formatStockholmTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getBaseInput(req, currentLps, fetchedAt, availability, refillOutlook) {
  return {
    availability: req.query.availability || availability || process.env.TEST_AVAILABILITY || 'stor',
    refillOutlook: req.query.refillOutlook || refillOutlook || process.env.TEST_REFILL_OUTLOOK || 'dålig',
    consumptionRateClass: req.query.consumptionRateClass || process.env.TEST_CONSUMPTION_RATE_CLASS || undefined,
    currentLps,
    normalLps: req.query.normalLps || process.env.TEST_NORMAL_LPS || FALLBACK_NORMAL_LPS,
    householdCount: req.query.householdCount || process.env.HOUSEHOLD_COUNT || 200000,
    updatedAt: req.query.updatedAt || process.env.TEST_UPDATED_AT || undefined,
    fetchedAt
  };
}

function promiseValue(result, fallback) {
  return result.status === 'fulfilled' ? result.value : fallback;
}

function errorMessage(result) {
  return result.status === 'rejected' ? result.reason?.message || String(result.reason) : null;
}

app.get('/api/vattenkontot', async (req, res) => {
  const useFallback = String(req.query.source || '').toLowerCase() === 'test';

  if (useFallback) {
    const levelM = Number(req.query.levelM || FALLBACK_LEVEL_M);
    const availability = req.query.availability || classifyAvailabilityFromLevel(levelM);
    const refillOutlook = req.query.refillOutlook || 'dålig';
    const data = calculateVattenkontot(getBaseInput(req, FALLBACK_CURRENT_LPS, new Date().toISOString(), availability, refillOutlook));

    return res.json({
      source: 'testdata',
      note: 'Testläge. Lägg till ?source=test för att tvinga testdata.',
      dataQuality: 'Testvärden. Ingen livehämtning används.',
      waterLevel: {
        source: 'testdata',
        levelM,
        p5LevelM: P5_LEVEL_M,
        classificationRule: `stor om nivån är över P5 + ${P5_BUFFER_M} m`
      },
      refillProxy: {
        source: 'testdata',
        subid: DEFAULT_REFILL_SUBID,
        label: 'Björkaån/Eggelstad proxy',
        refillOutlook
      },
      ...data
    });
  }

  const [sydvattenResult, smhiLevelResult, hydroNuResult] = await Promise.allSettled([
    fetchSydvattenProduction(),
    fetchSmhiLevel(),
    fetchHydroNuPoint(DEFAULT_REFILL_SUBID)
  ]);

  const sydvatten = promiseValue(sydvattenResult, {
    sourceUrl: null,
    fetchedAt: new Date().toISOString(),
    vomb: FALLBACK_CURRENT_LPS,
    ring: null
  });

  const waterLevel = promiseValue(smhiLevelResult, {
    sourceUrl: null,
    station: 'Vombsjön övre',
    stationId: 2018,
    fetchedAt: new Date().toISOString(),
    levelM: FALLBACK_LEVEL_M,
    fallback: true
  });

  const refillProxy = promiseValue(hydroNuResult, {
    sourceUrl: null,
    fetchedAt: new Date().toISOString(),
    subid: DEFAULT_REFILL_SUBID,
    label: 'Björkaån/Eggelstad proxy',
    model: 'SMHI HydroNu/S-HYPE',
    refillOutlook: process.env.TEST_REFILL_OUTLOOK || 'dålig',
    basis: 'fallback',
    reason: 'Kunde inte hämta HydroNu/S-HYPE. Prototypen använder fallback för påfyllnadsutsikt.'
  });

  const availability = req.query.availability || classifyAvailabilityFromLevel(waterLevel.levelM);
  const refillOutlook = req.query.refillOutlook || refillProxy.refillOutlook;
  const latestFetch = sydvatten.fetchedAt || waterLevel.fetchedAt || refillProxy.fetchedAt || new Date().toISOString();

  const data = calculateVattenkontot(getBaseInput(req, sydvatten.vomb, latestFetch, availability, refillOutlook));

  return res.json({
    source: 'live-with-smhi-and-hydronu-proxy',
    note: 'Vombverkets leverans och Vombsjöns vattennivå hämtas live. Påfyllnadsutsikt använder första S-HYPE-proxy: Björkaån/Eggelstad SUBID 103. Detta är ännu inte total tillrinning till Vombsjön.',
    dataQuality: 'Förbrukningstakt är senaste avlästa Vombverket-värde, inte rullande 24-timmarsmedel. Påfyllnadsutsikt är första trendproxy, inte slutlig säsongsnormal tillrinningsklassning.',
    warnings: {
      sydvatten: errorMessage(sydvattenResult),
      smhiLevel: errorMessage(smhiLevelResult),
      hydroNu: errorMessage(hydroNuResult)
    },
    sydvatten: {
      sourceUrl: sydvatten.sourceUrl,
      fetchedAt: sydvatten.fetchedAt,
      vombLps: sydvatten.vomb,
      ringLps: sydvatten.ring
    },
    waterLevel: {
      ...waterLevel,
      p5LevelM: P5_LEVEL_M,
      p5BufferM: P5_BUFFER_M,
      availabilityClassification: availability,
      classificationRule: `stor om vattennivån är över ${Number((P5_LEVEL_M + P5_BUFFER_M).toFixed(2))} m; annars liten`
    },
    refillProxy,
    updatedAtIso: latestFetch,
    updatedAtFull: formatStockholmTime(latestFetch),
    ...data
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vattenkontot MVP kör på http://localhost:${PORT}`);
});
