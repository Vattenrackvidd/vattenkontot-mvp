const SECONDS_PER_DAY = 86400;

const WATER_SITUATIONS = {
  'stor|god': {
    key: 'tryggt',
    name: 'Tryggt läge',
    targetFactor: 0.98,
    shortExplanation: 'God tillgång och god påfyllnadsutsikt.'
  },
  'stor|dålig': {
    key: 'forebyggande',
    name: 'Förebyggande sparläge',
    targetFactor: 0.92,
    shortExplanation: 'Tillgången är stor, men påfyllnadsutsikten är svag.'
  },
  'liten|god': {
    key: 'pa-vag-upp',
    name: 'På väg upp',
    targetFactor: 0.88,
    shortExplanation: 'Påfyllnaden hjälper, men reserven är fortfarande liten.'
  },
  'liten|dålig': {
    key: 'spara-nu',
    name: 'Spara nu',
    targetFactor: 0.80,
    shortExplanation: 'Liten tillgång och svag påfyllnadsutsikt.'
  }
};

const SITUATIONS = {
  'stor|god|låg': {
    number: 1,
    recommendation: 'Bibehåll',
    tone: 'positive',
    explanation: 'Läget är stabilt och förbrukningstakten ligger under eller nära dagens mål.'
  },
  'stor|god|hög': {
    number: 2,
    recommendation: 'Minska något',
    tone: 'moderate',
    explanation: 'Tillgången är god, men den höga förbrukningstakten bör dämpas mot dagens mål.'
  },
  'stor|dålig|låg': {
    number: 3,
    recommendation: 'Var återhållsam',
    tone: 'watch',
    explanation: 'Tillgången är god, men svag påfyllnad motiverar fortsatt försiktighet.'
  },
  'stor|dålig|hög': {
    number: 4,
    recommendation: 'Minska',
    tone: 'warning',
    explanation: 'God tillgång idag, men svag påfyllnad och hög förbrukningstakt kräver tidig minskning.'
  },
  'liten|god|låg': {
    number: 5,
    recommendation: 'Fortsätt spara',
    tone: 'recovering',
    explanation: 'Läget är på väg upp, men reserven är fortfarande liten.'
  },
  'liten|god|hög': {
    number: 6,
    recommendation: 'Minska tydligt',
    tone: 'warning',
    explanation: 'Påfyllnaden hjälper, men hög förbrukningstakt bromsar återhämtningen.'
  },
  'liten|dålig|låg': {
    number: 7,
    recommendation: 'Spara',
    tone: 'danger',
    explanation: 'Låg reserv och svag påfyllnad kräver fortsatt låg förbrukningstakt.'
  },
  'liten|dålig|hög': {
    number: 8,
    recommendation: 'Minska betydligt',
    tone: 'critical',
    explanation: 'Kritiskt kombinationsläge: låg reserv, svag påfyllnad och hög förbrukningstakt.'
  }
};

function normalizeSwedishValue(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function roundToNearest(value, step = 5) {
  return Math.round(value / step) * step;
}

function formatStockholmTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('sv-SE', {
    timeZone: 'Europe/Stockholm',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function calculateVattenkontot(input = {}) {
  const availability = normalizeSwedishValue(input.availability, ['stor', 'liten'], 'stor');
  const refillOutlook = normalizeSwedishValue(input.refillOutlook, ['god', 'dålig'], 'dålig');

  const householdCount = Number(input.householdCount || 200000);
  const currentLps = Number(input.currentLps || 670);
  const normalLps = Number(input.normalLps || 600);

  const waterSituation = WATER_SITUATIONS[`${availability}|${refillOutlook}`];
  const targetLps = normalLps * waterSituation.targetFactor;

  const explicitConsumptionRateClass = String(input.consumptionRateClass || '').trim().toLowerCase();
  const consumptionRateClass = ['låg', 'hög'].includes(explicitConsumptionRateClass)
    ? explicitConsumptionRateClass
    : currentLps > targetLps
      ? 'hög'
      : 'låg';

  const situation = SITUATIONS[`${availability}|${refillOutlook}|${consumptionRateClass}`];

  const requiredReductionLps = Math.max(0, currentLps - targetLps);
  const rawLitersPerHousehold = requiredReductionLps * SECONDS_PER_DAY / householdCount;
  const recommendedLiters = roundToNearest(rawLitersPerHousehold, 5);

  return {
    updatedAt: input.updatedAt || formatStockholmTime(input.fetchedAt || new Date()),
    availability,
    refillOutlook,
    consumptionRateClass,
    currentLps: Math.round(currentLps),
    normalLps: Math.round(normalLps),
    targetLps: Math.round(targetLps),
    householdCount,
    waterSituationName: waterSituation.name,
    waterSituationKey: waterSituation.key,
    situationNumber: situation.number,
    recommendation: situation.recommendation,
    tone: situation.tone,
    explanation: situation.explanation,
    shortWaterExplanation: waterSituation.shortExplanation,
    requiredReductionLps: Math.round(requiredReductionLps),
    recommendedLiters,
    headline: recommendedLiters > 0
      ? `Minska med cirka ${recommendedLiters} liter`
      : 'Fortsätt använda vatten klokt',
    subheadline: recommendedLiters > 0
      ? 'per hushåll idag'
      : 'idag',
    supportText: recommendedLiters > 0
      ? 'Om alla hjälps åt räcker små minskningar långt.'
      : 'Fortsätt hålla förbrukningen på dagens mål.'
  };
}

module.exports = { calculateVattenkontot };
