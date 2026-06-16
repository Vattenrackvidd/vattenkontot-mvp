const express = require('express');
const path = require('path');
const { calculateVattenkontot } = require('./lib/calculateVattenkontot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/vattenkontot', (req, res) => {
  const data = calculateVattenkontot({
    availability: req.query.availability || process.env.TEST_AVAILABILITY || 'stor',
    refillOutlook: req.query.refillOutlook || process.env.TEST_REFILL_OUTLOOK || 'dålig',
    consumptionRateClass: req.query.consumptionRateClass || process.env.TEST_CONSUMPTION_RATE_CLASS || 'hög',
    currentLps: req.query.currentLps || process.env.TEST_CURRENT_LPS || 670,
    normalLps: req.query.normalLps || process.env.TEST_NORMAL_LPS || 600,
    householdCount: req.query.householdCount || process.env.HOUSEHOLD_COUNT || 200000,
    updatedAt: req.query.updatedAt || process.env.TEST_UPDATED_AT || undefined
  });

  res.json({
    source: 'testdata',
    note: 'MVP med testdata. Nästa steg är att koppla riktiga datakällor.',
    ...data
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Vattenkontot MVP kör på http://localhost:${PORT}`);
});
