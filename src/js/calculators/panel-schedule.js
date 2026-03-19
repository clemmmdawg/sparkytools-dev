/**
 * @file panel-schedule.js
 * @description Panel Schedule Creator — build and print electrical panel schedules.
 *
 * Sections:
 *   1. Constants
 *   2. State & helpers
 *   3. HTML generation helpers
 *   4. Table rendering (interactive)
 *   5. Print table generation
 *   6. Panel info rendering
 *   7. State mutation
 *   8. Event handling
 *   9. Export — init()
 */


// ══════════════════════════════════════════════════════════════════════════
// 1. Constants
// ══════════════════════════════════════════════════════════════════════════

const BREAKER_TYPES = [
  { value: 'empty',  label: 'Empty',       slots: 1, numCircuits: 0 },
  { value: 'spare',  label: 'Spare',       slots: 1, numCircuits: 1 },
  { value: '1-pole', label: 'Single Pole', slots: 1, numCircuits: 1 },
  { value: 'tandem', label: 'Tandem',      slots: 1, numCircuits: 2 },
  { value: '2-pole', label: '2 Pole',      slots: 2, numCircuits: 1 },
  { value: 'triple', label: 'Triple',      slots: 2, numCircuits: 3 },
  { value: 'quad',   label: 'Quad',        slots: 2, numCircuits: 2 },
  { value: '3-pole', label: '3 Pole',      slots: 3, numCircuits: 1 },
];

const TYPE_META = Object.fromEntries(BREAKER_TYPES.map(t => [t.value, t]));

const BREAKER_SIZES = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
  100, 110, 120, 125, 150, 175, 200, 225, 250, 300, 350, 400,
];

const MAIN_SIZES = [
  70, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 600, 800, 1000, 1200,
];

const PANEL_RATINGS = [100, 125, 150, 200, 225, 400, 600, 800, 1000, 1200, 1600, 2000];

const WIRE_SIZES = [
  '',
  '#14 Cu', '#12 Cu', '#10 Cu', '#8 Cu', '#6 Cu', '#4 Cu',
  '#3 Cu',  '#2 Cu',  '#1 Cu',
  '1/0 Cu', '2/0 Cu', '3/0 Cu', '4/0 Cu',
  '250 kcmil Cu', '300 kcmil Cu', '350 kcmil Cu', '400 kcmil Cu', '500 kcmil Cu',
  '#6 Al',  '#4 Al',  '#2 Al',  '#1 Al',
  '1/0 Al', '2/0 Al', '3/0 Al', '4/0 Al',
  '250 kcmil Al', '300 kcmil Al', '350 kcmil Al', '400 kcmil Al', '500 kcmil Al',
];

const CONDUIT_SIZES = ['', '1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '3-1/2"', '4"'];

const VOLTAGE_OPTIONS = [
  { value: '120/240-1ph', label: '120/240V Single Phase' },
  { value: '120/208-3ph', label: '120/208V Three Phase'  },
  { value: '277/480-3ph', label: '277/480V Three Phase'  },
  { value: '240-1ph',     label: '240V Delta (2-wire)'   },
  { value: '120-1ph',     label: '120V Single Phase'     },
];

// Sub-labels are voltage-dependent for triple and quad breakers
function getSubLabels(type) {
  const v = state.panelInfo.voltage;
  if (type === 'tandem') return ['A', 'B'];
  if (type === 'triple') {
    if (v === '277/480-3ph') return ['277V ①', '480V', '277V ②'];
    if (v === '120/208-3ph') return ['120V ①', '208V', '120V ②'];
    return ['120V ①', '240V', '120V ②'];
  }
  if (type === 'quad') {
    if (v === '277/480-3ph') return ['480V A', '480V B'];
    if (v === '120/208-3ph') return ['208V A', '208V B'];
    return ['240V A', '240V B'];
  }
  return null;
}


// ══════════════════════════════════════════════════════════════════════════
// 2. State & helpers
// ══════════════════════════════════════════════════════════════════════════

let _uid = 1;
function uid() { return 'ps-' + (_uid++); }

function slotsFor(type)       { return TYPE_META[type]?.slots      ?? 1; }
function numCircuitsFor(type) { return TYPE_META[type]?.numCircuits ?? 0; }

function defaultSubCkt(size = 20) {
  return { label: '', size, wireSize: '', conduitSize: '' };
}

function makeBreaker(type = 'empty') {
  const nc = numCircuitsFor(type);
  return {
    id:          uid(),
    type,
    size:        20,
    label:       type === 'spare' ? 'SPARE' : '',
    wireSize:    '',
    conduitSize: '',
    circuits:    nc > 1 ? Array.from({ length: nc }, () => defaultSubCkt()) : null,
  };
}

const state = {
  panelInfo: {
    address:         '',
    panelName:       'Panel A',
    mainType:        'main-breaker',
    mainBreakerSize: 200,
    voltage:         '120/240-1ph',
    jobNumber:       '',
    panelRating:     200,
    startCircuit:    1,
    notes:           '',
  },
  left:  [],
  right: [],
};

function initState() {
  state.left  = Array.from({ length: 4 }, () => makeBreaker('empty'));
  state.right = Array.from({ length: 4 }, () => makeBreaker('empty'));
}

function calcCircNums(arr, idx, side) {
  // Ensure the base is always an odd number (left side = odd circuits)
  const raw  = state.panelInfo.startCircuit ?? 1;
  const base = raw % 2 === 0 ? raw - 1 : raw;

  let slot = 1;
  for (let i = 0; i < idx; i++) slot += slotsFor(arr[i].type);
  const slots = slotsFor(arr[idx].type);
  return Array.from({ length: slots }, (_, i) => {
    const pos = slot + i - 1; // 0-based slot offset from start
    return side === 'left' ? base + pos * 2 : base + pos * 2 + 1;
  });
}

/**
 * Builds a flat array of one entry per panel slot for one side.
 *
 * Each entry is an object:
 *   { b, slotCircNum, span, isFirst }
 *
 *   isFirst:true  + b:Breaker  — first slot of a real breaker; body rowspan = span
 *   isFirst:true  + b:null     — padding row (shorter side); no body cell
 *   isFirst:false + b:null     — continuation slot of a multi-slot breaker;
 *                                body cell already opened above (rowspan), skip it
 *
 * slotCircNum is the circuit number for this specific slot, enabling per-row
 * alignment of the circuit number column without stacking inside a rowspan cell.
 */
function buildSlots(arr, side) {
  const result = [];
  arr.forEach((b, idx) => {
    const circNums = calcCircNums(arr, idx, side);
    const span     = slotsFor(b.type);
    result.push({ b, circNums, span, slotCircNum: circNums[0] ?? null, isFirst: true });
    for (let s = 1; s < span; s++) {
      result.push({ b: null, circNums: null, span: 0, slotCircNum: circNums[s] ?? null, isFirst: false });
    }
  });
  return result;
}

/**
 * Returns the phase label (A / B / C) for a given 1-based slot number,
 * based on the current panel voltage/phase setting.
 */
function getPhaseLabel(slotNum) {
  const v = state.panelInfo.voltage;
  if (v === '120-1ph') return 'A';
  if (v === '120/208-3ph' || v === '277/480-3ph') {
    return ['A', 'B', 'C'][(slotNum - 1) % 3];
  }
  // 120/240-1ph, 240-1ph — split phase, alternating legs
  return ['A', 'B'][(slotNum - 1) % 2];
}


// ══════════════════════════════════════════════════════════════════════════
// 3. HTML generation helpers
// ══════════════════════════════════════════════════════════════════════════

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function typeOpts(selected) {
  return BREAKER_TYPES.map(t =>
    `<option value="${t.value}"${t.value === selected ? ' selected' : ''}>${t.label}</option>`
  ).join('');
}

function sizeOpts(selected) {
  return BREAKER_SIZES.map(s =>
    `<option value="${s}"${s === selected ? ' selected' : ''}>${s}A</option>`
  ).join('');
}

function wireOpts(selected) {
  return WIRE_SIZES.map(s =>
    `<option value="${esc(s)}"${s === selected ? ' selected' : ''}>${s || '— Wire —'}</option>`
  ).join('');
}

function conduitOpts(selected) {
  return CONDUIT_SIZES.map(s =>
    `<option value="${esc(s)}"${s === selected ? ' selected' : ''}>${s || '— Conduit —'}</option>`
  ).join('');
}

/** Returns the inner HTML for a breaker body cell (no wrapper <td>). */
function renderBreakerBodyHtml(b) {
  const isEmpty   = b.type === 'empty';
  const isSpare   = b.type === 'spare';
  const isComplex = b.circuits !== null;

  const delBtn = `<button class="ps-del remove-btn" title="Remove row" aria-label="Remove row">×</button>`;

  if (isEmpty) {
    return `
      <div class="ps-row">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        ${delBtn}
      </div>`;
  }

  if (isSpare) {
    return `
      <div class="ps-row">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        <select class="ps-size-sel" data-field="size">${sizeOpts(b.size)}</select>
        ${delBtn}
      </div>`;
  }

  if (isComplex) {
    const labels  = getSubLabels(b.type) ?? b.circuits.map((_, i) => String(i + 1));
    const subHtml = (b.circuits || []).map((sc, i) => `
      <div class="ps-sub-ckt" data-sub="${i}">
        <div class="ps-sub-main">
          <span class="ps-sub-tag">${labels[i]}</span>
          <input  class="ps-lbl"      type="text" placeholder="Label" value="${esc(sc.label)}" data-field="label">
          <select class="ps-size-sel" data-field="size">${sizeOpts(sc.size)}</select>
        </div>
        <div class="ps-sub-wire">
          <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(sc.wireSize)}</select>
          <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(sc.conduitSize)}</select>
        </div>
      </div>`).join('');

    return `
      <div class="ps-row ps-row--main">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        ${delBtn}
      </div>
      ${subHtml}`;
  }

  // Single-circuit: 1-pole, 2-pole, 3-pole
  return `
    <div class="ps-row ps-row--main">
      <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
      <input  class="ps-lbl"      type="text" placeholder="Label" value="${esc(b.label)}" data-field="label">
      <select class="ps-size-sel" data-field="size">${sizeOpts(b.size)}</select>
      ${delBtn}
    </div>
    <div class="ps-row ps-row--wire">
      <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(b.wireSize)}</select>
      <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(b.conduitSize)}</select>
    </div>`;
}


// ══════════════════════════════════════════════════════════════════════════
// 4. Table rendering (interactive)
// ══════════════════════════════════════════════════════════════════════════

function renderTable() {
  const tbody = document.getElementById('ps-tbody');
  if (!tbody) return;

  // Tag the table with voltage type so CSS can apply NEC wire color coding
  const table = document.getElementById('ps-table');
  if (table) {
    table.dataset.vtype = state.panelInfo.voltage === '277/480-3ph' ? 'hv' : 'lv';
  }

  const leftSlots  = buildSlots(state.left,  'left');
  const rightSlots = buildSlots(state.right, 'right');
  const totalRows  = Math.max(leftSlots.length, rightSlots.length, 1);

  // Pad shorter side with neutral filler entries
  while (leftSlots.length < totalRows)  leftSlots.push({ b: null, circNums: null, span: 1, slotCircNum: null, isFirst: true });
  while (rightSlots.length < totalRows) rightSlots.push({ b: null, circNums: null, span: 1, slotCircNum: null, isFirst: true });

  let html = '';

  for (let i = 0; i < totalRows; i++) {
    const L = leftSlots[i];
    const R = rightSlots[i];
    const slotNum = i + 1;
    const phase   = getPhaseLabel(slotNum);

    html += '<tr class="ps-tr">';

    // ── Left: circuit number (one <td> per slot row, no rowspan) ──────────
    const leftCktCls = 'ps-td-ckt ps-td-ckt--left ps-col-left' +
      (L.isFirst && !L.b ? ' ps-td-pad' : '');
    html += `<td class="${leftCktCls}">${L.slotCircNum ?? ''}</td>`;

    // ── Left: body (rowspan only on first slot of a real breaker) ─────────
    if (L.isFirst && L.b) {
      const bodyCls = `ps-td-body ps-td-body--${L.b.type} ps-col-left`;
      html += `<td class="${bodyCls}" data-id="${L.b.id}" data-side="left" rowspan="${L.span}">`;
      html += renderBreakerBodyHtml(L.b);
      html += '</td>';
    } else if (L.isFirst && !L.b) {
      // Padding: empty body cell
      html += '<td class="ps-td-body ps-td-pad ps-col-left"></td>';
    }
    // Continuation (!L.isFirst): body already open from previous row, skip

    // ── Spine: one cell per slot, colored and labelled by phase ───────────
    html += `<td class="ps-td-spine ps-td-spine--${phase}" aria-label="Phase ${phase}">${phase}</td>`;

    // ── Right: body (rowspan only on first slot of a real breaker) ────────
    if (R.isFirst && R.b) {
      const bodyCls = `ps-td-body ps-td-body--${R.b.type} ps-col-right`;
      html += `<td class="${bodyCls}" data-id="${R.b.id}" data-side="right" rowspan="${R.span}">`;
      html += renderBreakerBodyHtml(R.b);
      html += '</td>';
    } else if (R.isFirst && !R.b) {
      html += '<td class="ps-td-body ps-td-pad ps-col-right"></td>';
    }
    // Continuation: skip

    // ── Right: circuit number (one <td> per slot row, no rowspan) ─────────
    const rightCktCls = 'ps-td-ckt ps-td-ckt--right ps-col-right' +
      (R.isFirst && !R.b ? ' ps-td-pad' : '');
    html += `<td class="${rightCktCls}">${R.slotCircNum ?? ''}</td>`;

    html += '</tr>';
  }

  tbody.innerHTML = html;
}


// ══════════════════════════════════════════════════════════════════════════
// 5. Print table generation
// ══════════════════════════════════════════════════════════════════════════

function breakerPrintCells(b, circNums, span, side) {
  const circStr = circNums.join('–');
  let desc = '', amps = '', wire = '';

  if (b.type === 'empty') {
    desc = '<em class="ps-pt-empty">EMPTY</em>';
  } else if (b.type === 'spare') {
    desc = '<em class="ps-pt-spare">SPARE</em>';
    amps = `${b.size}A`;
  } else if (b.circuits) {
    const labels = getSubLabels(b.type) ?? b.circuits.map((_, i) => String(i + 1));
    const subDesc = b.circuits.map((sc, i) =>
      `<div class="ps-pt-sub-row"><span class="ps-pt-sub-lbl">${labels[i]}:</span> ${esc(sc.label || '—')}</div>`
    ).join('');
    const subAmps = b.circuits.map(sc =>
      `<div class="ps-pt-sub-row">${sc.size}A</div>`
    ).join('');
    const subWire = b.circuits.map(sc => {
      const w = [sc.wireSize, sc.conduitSize].filter(Boolean).join(' / ');
      return `<div class="ps-pt-sub-row">${esc(w)}</div>`;
    }).join('');

    const cktTd  = `<td class="ps-pt-ckt ps-pt-ckt--complex" rowspan="${span}">${circStr}</td>`;
    const descTd = `<td class="ps-pt-desc ps-pt-desc--complex" rowspan="${span}">${subDesc}</td>`;
    const ampsTd = `<td class="ps-pt-amp ps-pt-amp--complex" rowspan="${span}">${subAmps}</td>`;
    const wireTd = `<td class="ps-pt-wire ps-pt-wire--complex" rowspan="${span}">${subWire}</td>`;
    return side === 'left'
      ? cktTd + descTd + ampsTd + wireTd
      : wireTd + ampsTd + descTd + cktTd;
  } else {
    desc = esc(b.label || '—');
    amps = `${b.size}A`;
    wire = [b.wireSize, b.conduitSize].filter(Boolean).join(' / ');
  }

  const cktTd  = `<td class="ps-pt-ckt"  rowspan="${span}">${circStr}</td>`;
  const descTd = `<td class="ps-pt-desc ps-pt-desc--${b.type}" rowspan="${span}">${desc}</td>`;
  const ampsTd = `<td class="ps-pt-amp"  rowspan="${span}">${amps}</td>`;
  const wireTd = `<td class="ps-pt-wire" rowspan="${span}">${esc(wire)}</td>`;

  return side === 'left'
    ? cktTd + descTd + ampsTd + wireTd
    : wireTd + ampsTd + descTd + cktTd;
}

function generatePrintTable() {
  const container = document.getElementById('ps-print-table');
  if (!container) return;

  const leftSlots  = buildSlots(state.left,  'left');
  const rightSlots = buildSlots(state.right, 'right');
  const totalRows  = Math.max(leftSlots.length, rightSlots.length, 1);

  while (leftSlots.length < totalRows)  leftSlots.push({ b: null, circNums: null, span: 1, slotCircNum: null, isFirst: true });
  while (rightSlots.length < totalRows) rightSlots.push({ b: null, circNums: null, span: 1, slotCircNum: null, isFirst: true });

  let html = `
    <table class="ps-print-tbl">
      <thead>
        <tr>
          <th colspan="4" class="ps-pt-side-hd">Left — Odd Circuits</th>
          <th class="ps-pt-side-hd ps-pt-phase-hd">Ph</th>
          <th colspan="4" class="ps-pt-side-hd">Right — Even Circuits</th>
        </tr>
        <tr>
          <th class="ps-pt-hd ps-pt-ckt">Ckt</th>
          <th class="ps-pt-hd">Description</th>
          <th class="ps-pt-hd ps-pt-amp">Amps</th>
          <th class="ps-pt-hd ps-pt-wire">Wire / Conduit</th>
          <th class="ps-pt-hd ps-pt-phase">Ph</th>
          <th class="ps-pt-hd ps-pt-wire">Wire / Conduit</th>
          <th class="ps-pt-hd ps-pt-amp">Amps</th>
          <th class="ps-pt-hd">Description</th>
          <th class="ps-pt-hd ps-pt-ckt">Ckt</th>
        </tr>
      </thead>
      <tbody>`;

  for (let i = 0; i < totalRows; i++) {
    const L = leftSlots[i];
    const R = rightSlots[i];
    const slotNum = i + 1;
    const phase   = getPhaseLabel(slotNum);

    html += '<tr>';

    if (!L.isFirst) {
      // Spanned, skip all left cells
    } else if (L.b) {
      html += breakerPrintCells(L.b, L.circNums, L.span, 'left');
    } else {
      html += '<td></td><td></td><td></td><td></td>';
    }

    // Phase column — one cell per slot row
    html += `<td class="ps-pt-phase ps-pt-phase--${phase}">${phase}</td>`;

    if (!R.isFirst) {
      // Spanned, skip all right cells
    } else if (R.b) {
      html += breakerPrintCells(R.b, R.circNums, R.span, 'right');
    } else {
      html += '<td></td><td></td><td></td><td></td>';
    }

    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function clearPrintTable() {
  const container = document.getElementById('ps-print-table');
  if (container) container.innerHTML = '';
}


// ══════════════════════════════════════════════════════════════════════════
// 6. Panel info rendering
// ══════════════════════════════════════════════════════════════════════════

function renderInfo() {
  const info = state.panelInfo;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  setVal('ps-address',    info.address);
  setVal('ps-panel-name', info.panelName);
  setVal('ps-main-type',  info.mainType);
  setVal('ps-job-num',       info.jobNumber);
  setVal('ps-start-circuit', info.startCircuit);
  setVal('ps-notes',         info.notes);

  const mainSizeEl = document.getElementById('ps-main-size');
  if (mainSizeEl) {
    mainSizeEl.innerHTML = MAIN_SIZES.map(s =>
      `<option value="${s}"${s === info.mainBreakerSize ? ' selected' : ''}>${s}A</option>`
    ).join('');
  }

  const voltageEl = document.getElementById('ps-voltage');
  if (voltageEl) {
    voltageEl.innerHTML = VOLTAGE_OPTIONS.map(o =>
      `<option value="${o.value}"${o.value === info.voltage ? ' selected' : ''}>${o.label}</option>`
    ).join('');
  }

  const ratingEl = document.getElementById('ps-panel-rating');
  if (ratingEl) {
    ratingEl.innerHTML = PANEL_RATINGS.map(r =>
      `<option value="${r}"${r === info.panelRating ? ' selected' : ''}>${r}A</option>`
    ).join('');
  }

  syncMainBreakerRow();
}

function syncMainBreakerRow() {
  const row = document.getElementById('ps-main-size-row');
  if (row) row.style.display = state.panelInfo.mainType === 'main-lug' ? 'none' : '';
}

function syncPrintHeader() {
  const info      = state.panelInfo;
  const voltLabel = VOLTAGE_OPTIONS.find(o => o.value === info.voltage)?.label ?? info.voltage;
  const mainLabel = info.mainType === 'main-lug'
    ? 'MLO'
    : `${info.mainBreakerSize}A`;

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('ps-print-name',      info.panelName || 'Panel Schedule');
  setText('ps-print-address',   info.address   || '—');
  setText('ps-print-job',       info.jobNumber  || '—');
  setText('ps-print-main-type', mainLabel);
  setText('ps-print-voltage',   voltLabel);
  setText('ps-print-rating',    `${info.panelRating}A`);
  setText('ps-print-notes',     info.notes     || '—');
}


// ══════════════════════════════════════════════════════════════════════════
// 7. State mutation
// ══════════════════════════════════════════════════════════════════════════

function changeType(side, idx, newType) {
  const b  = state[side][idx];
  b.type   = newType;
  const nc = numCircuitsFor(newType);
  b.circuits = nc > 1
    ? Array.from({ length: nc }, () => defaultSubCkt(b.size))
    : null;
  if (newType === 'spare' && !b.label) b.label = 'SPARE';
}

function addBreaker(side) {
  state[side].push(makeBreaker('empty'));
  renderTable();
}

function removeBreaker(side, id) {
  const arr = state[side];
  const idx = arr.findIndex(b => b.id === id);
  if (idx !== -1) arr.splice(idx, 1);
  renderTable();
}

function clearAll() {
  initState();
  renderTable();
}


// ══════════════════════════════════════════════════════════════════════════
// 8. Event handling
// ══════════════════════════════════════════════════════════════════════════

function handleBreakerEvent(e) {
  const bodyCell = e.target.closest('td[data-id]');
  if (!bodyCell) return;

  const side = bodyCell.dataset.side;
  const id   = bodyCell.dataset.id;
  const arr  = state[side];
  const idx  = arr.findIndex(b => b.id === id);
  if (idx === -1) return;
  const b = arr[idx];

  const subEl  = e.target.closest('.ps-sub-ckt');
  const subIdx = subEl ? parseInt(subEl.dataset.sub, 10) : null;
  const target = (subIdx !== null && b.circuits) ? b.circuits[subIdx] : b;
  if (!target) return;

  const field = e.target.dataset.field;

  if (e.target.classList.contains('ps-del') && e.type === 'click') {
    removeBreaker(side, id);
    return;
  }

  if (field === 'type' && e.type === 'change') {
    changeType(side, idx, e.target.value);
    renderTable();
    return;
  }

  if (e.type === 'input' || e.type === 'change') {
    if (field === 'label')       target.label       = e.target.value;
    if (field === 'size')        target.size        = parseInt(e.target.value, 10) || 20;
    if (field === 'wireSize')    target.wireSize    = e.target.value;
    if (field === 'conduitSize') target.conduitSize = e.target.value;
  }
}

function handleInfoEvent(e) {
  const fieldMap = {
    'ps-address':      'address',
    'ps-panel-name':   'panelName',
    'ps-main-type':    'mainType',
    'ps-main-size':    'mainBreakerSize',
    'ps-voltage':      'voltage',
    'ps-job-num':       'jobNumber',
    'ps-panel-rating':  'panelRating',
    'ps-start-circuit': 'startCircuit',
    'ps-notes':         'notes',
  };

  const field = fieldMap[e.target.id];
  if (!field) return;

  const numFields = ['mainBreakerSize', 'panelRating', 'startCircuit'];
  state.panelInfo[field] = numFields.includes(field)
    ? parseInt(e.target.value, 10) || 1
    : e.target.value;

  if (field === 'mainType') syncMainBreakerRow();
  // These fields affect circuit numbering or phase labels — re-render
  if (field === 'voltage' || field === 'startCircuit') renderTable();
  syncPrintHeader();
}


// ══════════════════════════════════════════════════════════════════════════
// 9. Export — init()
// ══════════════════════════════════════════════════════════════════════════

function initMobileTabs() {
  const tabs  = document.getElementById('ps-side-tabs');
  const table = document.getElementById('ps-table');
  if (!tabs || !table) return;

  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.ps-side-tab');
    if (!tab) return;
    const side = tab.dataset.side;

    // Update active tab appearance
    tabs.querySelectorAll('.ps-side-tab').forEach(t => t.classList.remove('ps-side-tab--active'));
    tab.classList.add('ps-side-tab--active');

    // Toggle visibility class on the table
    table.classList.remove('ps-show-left', 'ps-show-right');
    table.classList.add(`ps-show-${side}`);
  });
}

export function init() {
  const section = document.getElementById('panel-tool');
  if (!section) return;

  initState();
  renderInfo();
  renderTable();
  syncPrintHeader();
  initMobileTabs();

  // Panel info form
  const fieldset = section.querySelector('.ps-fieldset');
  if (fieldset) {
    fieldset.addEventListener('input',  handleInfoEvent);
    fieldset.addEventListener('change', handleInfoEvent);
  }

  // Circuit table (event delegation)
  const table = section.querySelector('.ps-table');
  if (table) {
    table.addEventListener('click',  handleBreakerEvent);
    table.addEventListener('change', handleBreakerEvent);
    table.addEventListener('input',  handleBreakerEvent);
  }

  // Footer add buttons
  document.getElementById('ps-add-left')?.addEventListener('click',
    () => addBreaker('left'));
  document.getElementById('ps-add-right')?.addEventListener('click',
    () => addBreaker('right'));

  // Clear and print
  document.getElementById('ps-clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear all panel data?')) clearAll();
  });

  document.getElementById('ps-print-btn')?.addEventListener('click', () => {
    syncPrintHeader();
    generatePrintTable();
    window.print();
  });

  window.addEventListener('afterprint', clearPrintTable);
}
