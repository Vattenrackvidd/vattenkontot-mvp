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
const quadrants = [...document.querySelectorAll('.quadrant')];

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function setText(el, value) {
  if (el) el.textContent = value;
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
