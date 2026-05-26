/**
 * @file voltage-drop.js
 * @description Voltage Drop Calculator — NEC 210.19(A)(1) Informational Note
 *
 * Formula: VD = (K × I × D × M) / CM
 * Thresholds: ≤3% branch circuit, ≤5% combined branch + feeder
 *
 * Circuit settings (voltage, phase, amps) are shared.
 * Each wire run has its own material, size, and distance.
 * Results always shown as a table; always starts with one run.
 */

import { getEl, formatNumber } from '../utils/formatting.js';

let necData = null;

// All wire runs — always at least one entry
const runs = [{ material: 'CU', size: '12', distance: 100 }];

// ── Init ─────────────────────────────────────────────────────────────────────

export function init(data) {
  necData = data;

  document.querySelectorAll('#vd-voltage, #vd-phase, #vd-amps')
    .forEach(el => el.addEventListener('input', update));

  const addBtn = getEl('vdr-add-btn');
  if (addBtn) addBtn.addEventListener('click', addRun);

  renderRuns();
  update();
}

// ── Run management ────────────────────────────────────────────────────────────

function addRun() {
  runs.push({ material: 'CU', size: '12', distance: 100 });
  renderRuns();
  update();
}

function removeRun(index) {
  if (runs.length <= 1) return;
  runs.splice(index, 1);
  renderRuns();
  update();
}

// ── DOM rendering ─────────────────────────────────────────────────────────────

function buildSizeOptions(material, selectedSize) {
  const isAL = material === 'AL';
  const frag = document.createDocumentFragment();
  necData.conductors.wireSizeOrder.forEach(s => {
    if (isAL && s === '14') return;
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `#${s}`;
    if (s === selectedSize) opt.selected = true;
    frag.appendChild(opt);
  });
  return frag;
}

function renderRuns() {
  const list = getEl('vdr-list');
  if (!list) return;
  list.innerHTML = '';

  runs.forEach((run, i) => {
    const row = document.createElement('div');
    row.className = 'vdr-row';

    // Run number label
    const lbl = document.createElement('span');
    lbl.className = 'vdr-seg-label';
    lbl.textContent = `#${i + 1}`;
    row.appendChild(lbl);

    // Material select
    const matGrp = document.createElement('div');
    matGrp.className = 'input-group';
    const matLbl = document.createElement('label');
    matLbl.textContent = 'Material';
    const matSel = document.createElement('select');
    matSel.setAttribute('aria-label', `Run ${i + 1} material`);
    ['CU', 'AL'].forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m === 'CU' ? 'Copper (CU)' : 'Aluminum (AL)';
      if (m === run.material) opt.selected = true;
      matSel.appendChild(opt);
    });
    matSel.addEventListener('change', () => {
      run.material = matSel.value;
      if (run.material === 'AL' && run.size === '14') run.size = '12';
      sizeSel.innerHTML = '';
      sizeSel.appendChild(buildSizeOptions(run.material, run.size));
      run.size = sizeSel.value;
      update();
    });
    matGrp.appendChild(matLbl);
    matGrp.appendChild(matSel);
    row.appendChild(matGrp);

    // Size select
    const sizeGrp = document.createElement('div');
    sizeGrp.className = 'input-group';
    const sizeLbl = document.createElement('label');
    sizeLbl.textContent = 'Wire Size';
    const sizeSel = document.createElement('select');
    sizeSel.setAttribute('aria-label', `Run ${i + 1} wire size`);
    sizeSel.appendChild(buildSizeOptions(run.material, run.size));
    sizeSel.addEventListener('change', () => {
      run.size = sizeSel.value;
      update();
    });
    sizeGrp.appendChild(sizeLbl);
    sizeGrp.appendChild(sizeSel);
    row.appendChild(sizeGrp);

    // Distance input
    const distGrp = document.createElement('div');
    distGrp.className = 'input-group';
    const distLbl = document.createElement('label');
    distLbl.textContent = 'Distance (ft)';
    const distIn = document.createElement('input');
    distIn.type = 'number';
    distIn.min = '0';
    distIn.step = '1';
    distIn.value = run.distance;
    distIn.setAttribute('aria-label', `Run ${i + 1} one-way distance in feet`);
    distIn.addEventListener('input', () => {
      run.distance = parseFloat(distIn.value) || 0;
      update();
    });
    distGrp.appendChild(distLbl);
    distGrp.appendChild(distIn);
    row.appendChild(distGrp);

    // Remove button — dimmed when only one run remains
    const rmBtn = document.createElement('button');
    rmBtn.className = 'remove-btn';
    rmBtn.type = 'button';
    rmBtn.textContent = '×';
    rmBtn.setAttribute('aria-label', `Remove run ${i + 1}`);
    rmBtn.disabled = runs.length === 1;
    rmBtn.style.opacity = runs.length === 1 ? '0.3' : '';
    rmBtn.addEventListener('click', () => removeRun(i));
    row.appendChild(rmBtn);

    list.appendChild(row);
  });
}

// ── Calculation and results ───────────────────────────────────────────────────

// NEC 210.19(A)(1): ≤3% branch circuit, ≤5% combined branch + feeder
function update() {
  const tbody = getEl('vdr-tbody');
  const tfoot = getEl('vdr-tfoot');
  const statusEl = getEl('vd-status');
  if (!tbody || !tfoot || !statusEl) return;

  const voltage = parseFloat(getEl('vd-voltage')?.value) || 120;
  const M = necData.conductors.phaseMultiplier[getEl('vd-phase')?.value ?? '1'];
  const amps = parseFloat(getEl('vd-amps')?.value) || 0;

  let runningVolts = 0;
  let totalDist = 0;
  tbody.innerHTML = '';

  runs.forEach((run, i) => {
    const K = necData.conductors.kFactors[run.material];
    const CM = necData.conductors.circularMils[run.size];
    const drop = (CM && M && amps > 0) ? (M * K * amps * run.distance) / CM : 0;
    const pct = voltage ? (drop / voltage) * 100 : 0;

    runningVolts += drop;
    totalDist += run.distance;
    const runPct = voltage ? (runningVolts / voltage) * 100 : 0;

    const tr = document.createElement('tr');
    if (runPct > 3) tr.classList.add('vdr-table-row--over');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${run.material}</td>
      <td>#${run.size}</td>
      <td>${run.distance} ft</td>
      <td>${formatNumber(drop)} V</td>
      <td>${formatNumber(pct)}%</td>
      <td>${formatNumber(runPct)}%</td>
    `;
    tbody.appendChild(tr);
  });

  const totalPct = voltage ? (runningVolts / voltage) * 100 : 0;

  tfoot.innerHTML = `
    <tr>
      <td colspan="3">Total</td>
      <td>${totalDist} ft</td>
      <td>${formatNumber(runningVolts)} V</td>
      <td>${formatNumber(totalPct)}%</td>
      <td>${formatNumber(totalPct)}%</td>
    </tr>
  `;

  if (totalPct <= 3) {
    statusEl.textContent = 'WITHIN NEC RECOMMENDATION (≤3%)';
    statusEl.style.background = 'var(--status-ok-bg)';
    statusEl.style.color = 'var(--status-ok-text)';
  } else if (totalPct <= 5) {
    statusEl.textContent = 'EXCEEDS 3% — WITHIN 5% COMBINED LIMIT';
    statusEl.style.background = 'color-mix(in srgb, var(--accent-yellow) 20%, var(--card-bg))';
    statusEl.style.color = 'color-mix(in srgb, var(--accent-yellow) 70%, #000)';
  } else {
    statusEl.textContent = 'EXCEEDS 5% COMBINED RECOMMENDATION';
    statusEl.style.background = 'var(--status-err-bg)';
    statusEl.style.color = 'var(--status-err-text)';
  }
}
