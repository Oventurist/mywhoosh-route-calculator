// app.js — DOM glue: inputs + file handling + rendering.
// Pure logic lives in zwo.js / physics.js / match.js (tested); this file is
// verified manually (see plan Task 4 Step 5).
import { parseZwo } from './zwo.js';
import { rankRoutes } from './match.js';
import {
  kgToLb,
  lbToKg,
  formatDistance,
  formatElevation,
} from './units.js';

const $ = (id) => document.getElementById(id);
const ftpEl = $('ftp');
const weightEl = $('weight');
const unitsEl = $('units');
const weightUnitLabelEl = $('weight-unit-label');
const freerideEl = $('freeride');
const onlyFitsEl = $('onlyfits');
const allowOverEl = $('allowover');
const dropEl = $('drop');
const fileEl = $('file');
const errorEl = $('error');
const noticeEl = $('notice');
const summaryEl = $('summary');
const resultsEl = $('results');

let routes = null;
let workout = null;
let fileName = '';

function fmtClock(totalS) {
  const s = Math.round(totalS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function fmtRange(lowS, highS) {
  return `${fmtClock(lowS)}–${fmtClock(highS)}`;
}

function fmtSpare(spareS) {
  const sign = spareS >= 0 ? '+' : '−';
  const abs = Math.abs(Math.round(spareS / 60));
  return `${sign}${abs} min`;
}

function readNumber(el) {
  const v = parseFloat(el.value);
  return Number.isFinite(v) && v > 0 ? v : null;
}

function unitSystem() {
  return unitsEl && unitsEl.value === 'metric' ? 'metric' : 'imperial';
}

function isMetric() {
  return unitSystem() === 'metric';
}

function readWeightKg() {
  const v = readNumber(weightEl);
  if (v === null) return null;
  return isMetric() ? v : lbToKg(v);
}

function onUnitsChange() {
  const metric = isMetric();
  const v = parseFloat(weightEl.value);
  if (Number.isFinite(v) && v > 0) {
    const converted = metric ? lbToKg(v) : kgToLb(v);
    weightEl.value = String(Math.round(converted * 10) / 10);
  }
  weightEl.placeholder = metric ? 'e.g. 75' : 'e.g. 165';
  weightEl.step = metric ? '0.1' : '1';
  if (weightUnitLabelEl) weightUnitLabelEl.textContent = metric ? 'kg' : 'lb';
  try {
    localStorage.setItem('units', unitSystem());
  } catch (e) {
    /* private mode: preference just doesn't persist */
  }
  render();
}

function render() {
  errorEl.textContent = '';
  noticeEl.textContent = '';
  if (!workout || !routes) return;

  const ftp = readNumber(ftpEl);
  const weight = readWeightKg();
  const freeridePct = readNumber(freerideEl);
  if (ftp === null || weight === null || freeridePct === null) {
    summaryEl.textContent = '';
    resultsEl.innerHTML = '';
    errorEl.textContent = 'Enter your FTP, weight, and FreeRide % (all must be above zero).';
    return;
  }

  // Re-parse with current inputs (FreeRide assumption may have changed).
  let parsed;
  try {
    parsed = parseZwo(workout, { ftp, freeridePct });
  } catch (e) {
    errorEl.textContent = `Could not parse ${fileName}: ${e.message}`;
    return;
  }
  if (!(parsed.totalSeconds > 0)) {
    errorEl.textContent = `No timed segments found in ${fileName}. Previous results kept.`;
    return;
  }

  const allowOverS = allowOverEl.checked ? 300 : 0;
  const rows = rankRoutes(parsed, routes, { weightKg: weight, allowOverS });
  const shown = onlyFitsEl.checked ? rows.filter((r) => r.fits) : rows;

  const frShare = parsed.totalSeconds > 0 ? parsed.freerideSeconds / parsed.totalSeconds : 0;
  let summary = `${parsed.name || fileName}: ${fmtClock(parsed.totalSeconds)} total, ~${Math.round(parsed.avgWatts)} W avg.`;
  summaryEl.textContent = summary;
  if (frShare >= 1) {
    noticeEl.textContent = 'This workout is all FreeRide — the estimate comes entirely from your assumption, not measured targets.';
  } else if (frShare > 0.15) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `${fmtClock(parsed.freerideSeconds)} FreeRide @ ${freeridePct}% assumed`;
    summaryEl.appendChild(badge);
  }

  resultsEl.innerHTML = '';
  if (shown.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No routes fit this workout. Try "Allow 5 min over", or a longer workout.';
    resultsEl.appendChild(li);
    return;
  }
  for (const r of shown) {
    const li = document.createElement('li');
    const title = document.createElement('div');
    const fitMark = r.fits ? '✓' : '✗';
    title.innerHTML = '';
    title.append(
      document.createTextNode(`${fitMark} ${r.route.name} `),
      Object.assign(document.createElement('span'), {
        className: 'muted',
        textContent: `(${r.route.world}, ${formatDistance(r.route.distanceKm, unitSystem())}, ${formatElevation(r.route.elevM, unitSystem())})`,
      }),
    );
    const pred = document.createElement('div');
    pred.textContent = `Predicted ${fmtRange(r.lowS, r.highS)}`;
    const spare = document.createElement('span');
    spare.className = r.fits ? 'spare-ok' : 'spare-bad';
    spare.textContent = ` ${fmtSpare(r.spareS)} to spare`;
    pred.appendChild(spare);
    li.append(title, pred);
    resultsEl.appendChild(li);
  }
}

async function loadFile(file) {
  errorEl.textContent = '';
  const text = await file.text();
  try {
    // Validate now (with current inputs) so a bad file errors immediately;
    // render() re-parses on every input change.
    parseZwo(text, {
      ftp: readNumber(ftpEl) ?? 200,
      freeridePct: readNumber(freerideEl) ?? 70,
    });
  } catch (e) {
    errorEl.textContent = `Could not parse ${file.name}: not a ZWO workout (${e.message}). Previous results kept.`;
    return;
  }
  workout = text;
  fileName = file.name;
  render();
}

$('pick').addEventListener('click', (e) => {
  e.stopPropagation();
  fileEl.click();
});
fileEl.addEventListener('change', () => {
  if (fileEl.files[0]) loadFile(fileEl.files[0]);
  fileEl.value = '';
});
dropEl.addEventListener('click', () => fileEl.click());
dropEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileEl.click();
});
for (const ev of ['dragenter', 'dragover']) {
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.add('over');
  });
}
for (const ev of ['dragleave', 'drop']) {
  dropEl.addEventListener(ev, (e) => {
    e.preventDefault();
    dropEl.classList.remove('over');
  });
}
dropEl.addEventListener('drop', (e) => {
  if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
});
for (const el of [ftpEl, weightEl, freerideEl, onlyFitsEl, allowOverEl]) {
  el.addEventListener('input', render);
  el.addEventListener('change', render);
}
unitsEl.addEventListener('change', onUnitsChange);

// Restore the saved preference (default Imperial), then sync the
// weight field's placeholder/step/label to it.
try {
  const saved = localStorage.getItem('units');
  if (saved === 'metric' || saved === 'imperial') unitsEl.value = saved;
} catch (e) {
  /* private mode: fall back to the Imperial default */
}
onUnitsChange();

try {
  const res = await fetch('./routes.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  routes = await res.json();
  window.__appReady = true;
} catch (e) {
  document.getElementById('serving-hint').style.display = 'block';
}
