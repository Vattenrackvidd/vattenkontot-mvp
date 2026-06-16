const seasonalPercentiles = require('../data/vombsjon-seasonal-percentiles.json');

function pad2(value) {
  return String(value).padStart(2, '0');
}

function monthDayFromDate(value) {
  const date = value ? new Date(`${value}T12:00:00+01:00`) : new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${pad2(fallback.getMonth() + 1)}-${pad2(fallback.getDate())}`;
  }
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function round2(value) {
  return Number(Number(value).toFixed(2));
}

function classifySeasonalAvailability(levelM, observationDate) {
  const numericLevel = Number(levelM);
  const monthDay = monthDayFromDate(observationDate);
  const reference = seasonalPercentiles.byMonthDay[monthDay];

  if (!Number.isFinite(numericLevel)) {
    return {
      availability: 'liten',
      monthDay,
      seasonalStatus: 'okänd nivå',
      seasonalStatusShort: 'okänd',
      reason: 'Vattennivån kunde inte läsas. Prototypen använder försiktighetsprincipen och visar liten tillgång.',
      classificationRule: 'Om vattennivån saknas klassas tillgången försiktigt som liten.'
    };
  }

  if (!reference || !Number.isFinite(Number(reference.p50))) {
    return {
      availability: 'liten',
      monthDay,
      levelM: round2(numericLevel),
      seasonalStatus: 'säsongsreferens saknas',
      seasonalStatusShort: 'referens saknas',
      reason: 'Säsongsnormal referens saknas. Prototypen använder försiktighetsprincipen och visar liten tillgång.',
      classificationRule: 'Om säsongsreferens saknas klassas tillgången försiktigt som liten.'
    };
  }

  const p10 = Number(reference.p10);
  const p25 = Number(reference.p25);
  const p50 = Number(reference.p50);
  const p75 = Number(reference.p75);

  let seasonalStatus = 'nära säsongsnormal nivå';
  let seasonalStatusShort = 'nära normal';
  let availability = 'stor';

  if (numericLevel < p10) {
    availability = 'liten';
    seasonalStatus = 'mycket låg för årstiden';
    seasonalStatusShort = 'mycket låg';
  } else if (numericLevel < p25) {
    availability = 'liten';
    seasonalStatus = 'låg för årstiden';
    seasonalStatusShort = 'låg';
  } else if (numericLevel < p50) {
    availability = 'liten';
    seasonalStatus = 'under säsongsnormal nivå';
    seasonalStatusShort = 'under normal';
  } else if (numericLevel >= p75) {
    availability = 'stor';
    seasonalStatus = 'hög för årstiden';
    seasonalStatusShort = 'hög';
  }

  return {
    availability,
    levelM: round2(numericLevel),
    monthDay,
    seasonalStatus,
    seasonalStatusShort,
    thresholdM: round2(p50),
    thresholdPercentile: 'P50',
    comparisonToP50M: round2(numericLevel - p50),
    reference: {
      windowDays: seasonalPercentiles.metadata.windowDays,
      observationStart: seasonalPercentiles.metadata.observationStart,
      observationEnd: seasonalPercentiles.metadata.observationEnd,
      count: reference.count,
      min: reference.min,
      p05: reference.p05,
      p10: reference.p10,
      p25: reference.p25,
      p50: reference.p50,
      p75: reference.p75,
      max: reference.max
    },
    reason: `${round2(numericLevel).toLocaleString('sv-SE')} m är ${seasonalStatus} jämfört med historiska nivåer för samma tid på året.`,
    classificationRule: 'Stor tillgång om vattennivån är minst säsongsmedianen (P50) för samma datumfönster ±15 dygn; annars liten.'
  };
}

module.exports = {
  classifySeasonalAvailability,
  seasonalPercentiles
};
