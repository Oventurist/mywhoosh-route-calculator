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
const cardsEl = $('cards');
const matchCountEl = $('match-count');
const idleEl = $('telemetry-idle');
const fileBadgeEl = $('file-loaded-badge');
const fileNameEl = $('file-loaded-name');
const btnMetricEl = $('btn-metric');
const btnImperialEl = $('btn-imperial');

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
  if (btnMetricEl) btnMetricEl.classList.toggle('active', metric);
  if (btnImperialEl) btnImperialEl.classList.toggle('active', !metric);
  const v = parseFloat(weightEl.value);
  if (Number.isFinite(v) && v > 0) {
    const converted = metric ? lbToKg(v) : kgToLb(v);
    weightEl.value = String(Math.round(converted * 10) / 10);
  }
  weightEl.placeholder = metric ? 'e.g. 75' : 'e.g. 165';
  weightEl.step = metric ? '0.1' : '1';
  if (weightUnitLabelEl) weightUnitLabelEl.textContent = metric ? 'KG' : 'LB';
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
  if (!workout || !routes) {
    if (matchCountEl) matchCountEl.textContent = 'No workout loaded';
    if (idleEl) idleEl.style.display = '';
    return;
  }

  const ftp = readNumber(ftpEl);
  const weight = readWeightKg();
  const freeridePct = readNumber(freerideEl);
  if (ftp === null || weight === null || freeridePct === null) {
    summaryEl.textContent = '';
    resultsEl.innerHTML = '';
    if (cardsEl) cardsEl.innerHTML = '';
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
    badge.style.cssText = 'display:inline-block;margin-left:.6rem;padding:.1rem .5rem;border:1px solid var(--volt);color:var(--volt);font-family:"JetBrains Mono",monospace;font-size:.72rem;font-weight:700;';
    badge.textContent = `${fmtClock(parsed.freerideSeconds)} FreeRide @ ${freeridePct}% assumed`;
    summaryEl.appendChild(badge);
  }

  resultsEl.innerHTML = '';
  if (cardsEl) cardsEl.innerHTML = '';
  const fitsCount = shown.filter((r) => r.fits).length;
  if (matchCountEl) {
    matchCountEl.textContent = `Matched routes: ${shown.length} candidate${shown.length === 1 ? '' : 's'} • ${fitsCount} fit`;
  }
  if (idleEl) idleEl.style.display = 'none';
  if (shown.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    const td = document.createElement('td');
    td.colSpan = 7;
    td.textContent = 'No routes fit this workout. Try "Allow 5 min over", or a longer workout.';
    tr.appendChild(td);
    resultsEl.appendChild(tr);
    if (cardsEl) {
      const empty = document.createElement('div');
      empty.className = 'cards-empty';
      empty.textContent = 'No routes fit this workout. Try "Allow 5 min over", or a longer workout.';
      cardsEl.appendChild(empty);
    }
    return;
  }
  for (const r of shown) {
    const tr = document.createElement('tr');

    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    const closeCall = r.fits && r.spareS < 0;
    badge.className = `fit-badge ${r.fits ? (closeCall ? 'fit-close' : 'fit-ok') : 'fit-no'}`;
    badge.textContent = r.fits ? (closeCall ? '± Close call' : '✓ Fit') : '✗ Over';
    statusTd.appendChild(badge);

    const routeTd = document.createElement('td');
    const world = document.createElement('div');
    world.className = 'route-world';
    world.textContent = r.route.world;
    const name = document.createElement('div');
    name.className = 'route-name';
    name.textContent = r.route.name;
    routeTd.append(world, name);

    const distText = formatDistance(r.route.distanceKm, unitSystem());
    const elevText = formatElevation(r.route.elevM, unitSystem());
    const gradeText = r.route.distanceKm > 0
      ? `${((r.route.elevM / (r.route.distanceKm * 1000)) * 100).toFixed(1)}%`
      : '—';
    const predText = fmtRange(r.lowS, r.highS);
    const spareText = `${fmtSpare(r.spareS)} to spare`;

    const distTd = document.createElement('td');
    distTd.className = 'n num';
    distTd.textContent = distText;

    const elevTd = document.createElement('td');
    elevTd.className = 'n num';
    elevTd.textContent = elevText;

    const gradeTd = document.createElement('td');
    gradeTd.className = 'n num';
    gradeTd.textContent = gradeText;

    const predTd = document.createElement('td');
    predTd.className = 'n num';
    predTd.textContent = predText;

    const deltaTd = document.createElement('td');
    deltaTd.style.textAlign = 'center';
    const delta = document.createElement('span');
    delta.className = `delta ${r.fits ? 'delta-ok' : 'delta-bad'}`;
    delta.textContent = spareText;
    deltaTd.appendChild(delta);

    tr.append(statusTd, routeTd, distTd, elevTd, gradeTd, predTd, deltaTd);
    resultsEl.appendChild(tr);

    if (cardsEl) {
      const card = document.createElement('div');
      card.className = 'route-card';
      const top = document.createElement('div');
      top.className = 'route-card-top';
      const titleWrap = document.createElement('div');
      const worldC = document.createElement('div');
      worldC.className = 'route-world';
      worldC.textContent = r.route.world;
      const nameC = document.createElement('div');
      nameC.className = 'route-name';
      nameC.textContent = r.route.name;
      titleWrap.append(worldC, nameC);
      const badgeC = badge.cloneNode(true);
      top.append(titleWrap, badgeC);
      const stats = document.createElement('div');
      stats.className = 'route-card-stats';
      const statDefs = [
        ['Distance', distText],
        ['Elevation', elevText],
        ['Avg grade', gradeText],
        ['Predicted', predText],
      ];
      for (const [label, value] of statDefs) {
        const s = document.createElement('div');
        s.className = 'stat';
        const l = document.createElement('span');
        l.className = 'stat-label';
        l.textContent = label;
        const v = document.createElement('span');
        v.className = 'stat-value';
        v.textContent = value;
        s.append(l, v);
        stats.appendChild(s);
      }
      const foot = document.createElement('div');
      foot.className = 'route-card-foot';
      const deltaC = document.createElement('span');
      deltaC.className = `delta ${r.fits ? 'delta-ok' : 'delta-bad'}`;
      deltaC.textContent = spareText;
      foot.appendChild(deltaC);
      card.append(top, stats, foot);
      cardsEl.appendChild(card);
    }
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
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileBadgeEl) fileBadgeEl.classList.add('show');
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
if (btnMetricEl) btnMetricEl.addEventListener('click', () => { unitsEl.value = 'metric'; onUnitsChange(); });
if (btnImperialEl) btnImperialEl.addEventListener('click', () => { unitsEl.value = 'imperial'; onUnitsChange(); });

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
