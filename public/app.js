const titleEl = document.getElementById('situationTitle');
const comboEl = document.getElementById('situationCombo');
const mainEl = document.getElementById('recommendationMain');
const subEl = document.getElementById('recommendationSub');
const supportEl = document.getElementById('recommendationSupport');
const statusPillEl = document.getElementById('statusPill');
const availabilityEl = document.getElementById('availabilityValue');
const refillEl = document.getElementById('refillValue');
const consumptionEl = document.getElementById('consumptionValue');
const updatedAtEl = document.getElementById('updatedAt');
const consumptionDetailEl = document.getElementById('consumptionDetail');
const availabilityDetailEl = document.getElementById('availabilityDetail');
const refillDetailEl = document.getElementById('refillDetail');
const quadrants = [...document.querySelectorAll('.quadrant')];

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function formatLevel(levelM) {
  if (levelM === undefined || levelM === null) return null;
  return Number(levelM).toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render(data) {
  titleEl.innerHTML = `Situation ${data.situationNumber} –<br>${data.waterSituationName}`;
  setText(comboEl, `${capitalize(data.availability)} tillgång · ${capitalize(data.refillOutlook)} påfyllnadsutsikt · ${capitalize(data.consumptionRateClass)} förbrukningstakt`);

  if (data.recommendedLiters > 0) {
    mainEl.innerHTML = `Minska med cirka <strong>${data.recommendedLiters}</strong> liter`;
    setText(subEl, 'per hushåll idag');
    setText(statusPillEl, 'Över dagens mål');
  } else {
    mainEl.innerHTML = 'Fortsätt använda vatten klokt';
    setText(subEl, 'idag');
    setText(statusPillEl, 'På dagens mål');
  }

  setText(supportEl, data.supportText);
  setText(availabilityEl, capitalize(data.availability));
  setText(refillEl, capitalize(data.refillOutlook));
  setText(consumptionEl, capitalize(data.consumptionRateClass));

  if (data.currentLps) {
    setText(consumptionDetailEl, `Senast avläst: ${data.currentLps} l/s`);
  }

  if (data.waterLevel?.levelM !== undefined) {
    const level = formatLevel(data.waterLevel.levelM);
    const assessment = data.waterLevel.availabilityAssessment;
    const status = assessment?.seasonalStatusShort || assessment?.seasonalStatus || (data.waterLevel.fallback ? 'fallbackvärde' : 'SMHI');
    setText(availabilityDetailEl, `Vattennivå: ${level} m · ${status}`);
  }

  if (data.refillProxy) {
    const mean = data.refillProxy.forecastMean10d;
    const current = data.refillProxy.currentModelFlow;
    if (mean !== undefined && current !== undefined) {
      setText(refillDetailEl, `SUBID ${data.refillProxy.subid}: ${current} → ${mean} m³/s`);
    } else {
      setText(refillDetailEl, `SUBID ${data.refillProxy.subid}: ${data.refillProxy.basis || 'proxy'}`);
    }
  }

  setText(updatedAtEl, `Senast uppdaterad ${data.updatedAt}`);

  quadrants.forEach((q) => q.classList.toggle('active', q.dataset.key === data.waterSituationKey));
}

async function loadVattenkontot() {
  try {
    const response = await fetch('/api/vattenkontot');
    if (!response.ok) throw new Error(`API svarade ${response.status}`);
    const data = await response.json();
    render(data);
  } catch (error) {
    console.error(error);
    setText(supportEl, 'Kunde inte hämta dagens läge. Försök ladda om sidan.');
  }
}

loadVattenkontot();
