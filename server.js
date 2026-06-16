const express = require('express');
const path = require('path');
const { calculateVattenkontot } = require('./lib/calculateVattenkontot');
const { fetchSydvattenProduction } = require('./lib/fetchSydvatten');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function getBaseInput(req, currentLps, fetchedAt) {
  return {
    availability: req.query.availability || process.env.TEST_AVAILABILITY || 'stor',
    refillOutlook: req.query.refillOutlook || process.env.TEST_REFILL_OUTLOOK || 'dålig',
    consumptionRateClass: req.query.consumptionRateClass || process.env.TEST_CONSUMPTION_RATE_CLASS || undefined,
    currentLps,
    normalLps: req.query.normalLps || process.env.TEST_NORMAL_LPS || 600,
    householdCount: req.query.householdCount || process.env.HOUSEHOLD_COUNT || 200000,
    updatedAt: req.query.updatedAt || process.env.TEST_UPDATED_AT || undefined,
    fetchedAt
  };
}

app.get('/api/vattenkontot', async (req, res) => {
  const fallbackCurrentLps = Number(req.query.currentLps || process.env.TEST_CURRENT_LPS || 670);

  try {
    const useFallback = String(req.query.source || '').toLowerCase() === 'test';

    if (useFallback) {
      const data = calculateVattenkontot(getBaseInput(req, fallbackCurrentLps));
      return res.json({
        source: 'testdata',
        note: 'Testläge. Lägg till ?source=test för att tvinga testdata.',
        ...data
      });
    }

    const sydvatten = await fetchSydvattenProduction();
    const data = calculateVattenkontot(getBaseInput(req, sydvatten.vomb, sydvatten.fetchedAt));

    return res.json({
      source: 'sydvatten-live',
      note: 'Vombverkets leverans hämtas live från Sydvattens publika endpoint. Tillgång och påfyllnadsutsikt är fortfarande prototypvärden i denna version.',
      dataQuality: 'Senaste avlästa värde, inte rullande 24-timmarsmedel.',
      sydvatten: {
        sourceUrl: sydvatten.sourceUrl,
        fetchedAt: sydvatten.fetchedAt,
        vombLps: sydvatten.vomb,
        ringLps: sydvatten.ring
      },
      ...data
    });
  } catch (error) {
    console.error('Kunde inte hämta Sydvatten-data:', error);

    const data = calculateVattenkontot(getBaseInput(req, fallbackCurrentLps));
    return res.status(200).json({
      source: 'fallback-testdata',
      warning: 'Kunde inte hämta livevärde från Sydvatten. API:t använder tillfälligt testvärde.',
      error: error.message,
      ...data
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vattenkontot MVP kör på http://localhost:${PORT}`);
});
