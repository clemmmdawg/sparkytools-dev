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

/**
 * Breaker type definitions.
 *   slots       — how many panel spaces the breaker physically occupies
 *   numCircuits — number of independently labelled circuits
 *                 0 = no load circuits (empty/space), 1+ = circuit(s)
 */
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

// Sub-circuit label sets for specialty breakers
const SUB_LABELS = {
  tandem: ['A', 'B'],
  triple: ['120V ①', '240V', '120V ②'],
  quad:   ['240V A', '240V B'],
};


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

/** Top-level application state. */
const state = {
  panelInfo: {
    address:         '',
    panelName:       'Panel A',
    mainType:        'main-breaker',
    mainBreakerSize: 200,
    voltage:         '120/240-1ph',
    jobNumber:       '',
    panelRating:     200,
    notes:           '',
  },
  left:  [],   // breaker objects, left side (odd circuits)
  right: [],   // breaker objects, right side (even circuits)
};

function initState() {
  state.left  = Array.from({ length: 4 }, () => makeBreaker('empty'));
  state.right = Array.from({ length: 4 }, () => makeBreaker('empty'));
}

/**
 * Returns the circuit numbers a given breaker occupies.
 * Left side: odd numbers (1, 3, 5, …); right side: even (2, 4, 6, …).
 */
function calcCircNums(arr, idx, side) {
  let slot = 1;
  for (let i = 0; i < idx; i++) slot += slotsFor(arr[i].type);
  const slots = slotsFor(arr[idx].type);
  return Array.from({ length: slots }, (_, i) =>
    side === 'left' ? 2 * (slot + i) - 1 : 2 * (slot + i)
  );
}

/**
 * Builds a flat array of slot entries for one side.
 * Each "first" slot of a breaker produces { b, circNums, span }.
 * Continuation slots for multi-slot breakers produce null.
 */
function buildSlots(arr, side) {
  const result = [];
  arr.forEach((b, idx) => {
    const circNums = calcCircNums(arr, idx, side);
    const span     = slotsFor(b.type);
    result.push({ b, circNums, span });
    for (let s = 1; s < span; s++) result.push(null);
  });
  return result;
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

/**
 * Returns the inner HTML for a breaker body cell (no wrapper <td>).
 * The delete button is present on ALL breaker types.
 */
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
      </div>
      <div class="ps-row ps-row--wire">
        <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(b.wireSize)}</select>
        <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(b.conduitSize)}</select>
      </div>`;
  }

  if (isComplex) {
    const labels  = SUB_LABELS[b.type] ?? b.circuits.map((_, i) => String(i + 1));
    const subHtml = (b.circuits || []).map((sc, i) => `
      <div class="ps-sub-ckt" data-sub="${i}">
        <span class="ps-sub-tag">${labels[i]}</span>
        <input  class="ps-lbl"      type="text" placeholder="Label" value="${esc(sc.label)}" data-field="label">
        <select class="ps-size-sel" data-field="size">${sizeOpts(sc.size)}</select>
      </div>`).join('');

    return `
      <div class="ps-row ps-row--main">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        ${delBtn}
      </div>
      ${subHtml}
      <div class="ps-row ps-row--wire">
        <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(b.wireSize)}</select>
        <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(b.conduitSize)}</select>
      </div>`;
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

  const leftSlots  = buildSlots(state.left,  'left');
  const rightSlots = buildSlots(state.right, 'right');
  const totalRows  = Math.max(leftSlots.length, rightSlots.length, 1);

  // Pad shorter side so both arrays have equal length
  while (leftSlots.length < totalRows)  leftSlots.push({ b: null, circNums: [], span: 1 });
  while (rightSlots.length < totalRows) rightSlots.push({ b: null, circNums: [], span: 1 });

  let html      = '';
  let spineDone = false;

  for (let i = 0; i < totalRows; i++) {
    const L = leftSlots[i];
    const R = rightSlots[i];

    html += '<tr class="ps-tr">';

    // ── Left: circuit number | body ──────────────────────────────────────
    if (L === null) {
      // Row is spanned by a previous multi-slot breaker — omit left cells
    } else if (L.b) {
      const numHtml = L.circNums.map(n => `<span>${n}</span>`).join('');
      html += `<td class="ps-td-ckt ps-td-ckt--left" rowspan="${L.span}">${numHtml}</td>`;
      html += `<td class="ps-td-body ps-td-body--${L.b.type}" data-id="${L.b.id}" data-side="left" rowspan="${L.span}">`;
      html += renderBreakerBodyHtml(L.b);
      html += '</td>';
    } else {
      // Padding (right side is taller)
      html += '<td class="ps-td-ckt ps-td-ckt--left ps-td-pad"></td><td class="ps-td-body ps-td-pad"></td>';
    }

    // ── Spine ─────────────────────────────────────────────────────────────
    if (!spineDone) {
      html += `<td class="ps-td-spine" rowspan="${totalRows}"></td>`;
      spineDone = true;
    }

    // ── Right: body | circuit number ──────────────────────────────────────
    if (R === null) {
      // Row is spanned — omit right cells
    } else if (R.b) {
      html += `<td class="ps-td-body ps-td-body--${R.b.type}" data-id="${R.b.id}" data-side="right" rowspan="${R.span}">`;
      html += renderBreakerBodyHtml(R.b);
      html += '</td>';
      const numHtml = R.circNums.map(n => `<span>${n}</span>`).join('');
      html += `<td class="ps-td-ckt ps-td-ckt--right" rowspan="${R.span}">${numHtml}</td>`;
    } else {
      // Padding
      html += '<td class="ps-td-body ps-td-pad"></td><td class="ps-td-ckt ps-td-ckt--right ps-td-pad"></td>';
    }

    html += '</tr>';
  }

  tbody.innerHTML = html;
}


// ══════════════════════════════════════════════════════════════════════════
// 5. Print table generation
// ══════════════════════════════════════════════════════════════════════════

function breakerPrintCells(b, circNums, span) {
  const circStr = circNums.join('–');
  let desc = '';
  let amps = '';
  const wire = [b.wireSize, b.conduitSize].filter(Boolean).join(' / ');

  if (b.type === 'empty') {
    desc = 'EMPTY';
    amps = '';
  } else if (b.type === 'spare') {
    desc = 'SPARE';
    amps = `${b.size}A`;
  } else if (b.circuits) {
    const labels = SUB_LABELS[b.type] ?? b.circuits.map((_, i) => String(i + 1));
    desc = b.circuits
      .map((sc, i) => `<b>${labels[i]}:</b> ${esc(sc.label || '—')} ${sc.size}A`)
      .join('<br>');
    amps = '';
  } else {
    desc = esc(b.label || '—');
    amps = `${b.size}A`;
  }

  return (
    `<td class="ps-pt-ckt"  rowspan="${span}">${circStr}</td>` +
    `<td class="ps-pt-desc" rowspan="${span}">${desc}</td>` +
    `<td class="ps-pt-amp"  rowspan="${span}">${amps}</td>` +
    `<td class="ps-pt-wire" rowspan="${span}">${esc(wire)}</td>`
  );
}

function generatePrintTable() {
  const container = document.getElementById('ps-print-table');
  if (!container) return;

  const leftSlots  = buildSlots(state.left,  'left');
  const rightSlots = buildSlots(state.right, 'right');
  const totalRows  = Math.max(leftSlots.length, rightSlots.length, 1);

  while (leftSlots.length < totalRows)  leftSlots.push({ b: null, circNums: [], span: 1 });
  while (rightSlots.length < totalRows) rightSlots.push({ b: null, circNums: [], span: 1 });

  let html = `
    <table class="ps-print-tbl">
      <thead>
        <tr>
          <th colspan="4" class="ps-pt-side-hd">Left — Odd Circuits</th>
          <th colspan="4" class="ps-pt-side-hd">Right — Even Circuits</th>
        </tr>
        <tr>
          <th class="ps-pt-hd">Ckt</th>
          <th class="ps-pt-hd">Description</th>
          <th class="ps-pt-hd">Amps</th>
          <th class="ps-pt-hd">Wire / Conduit</th>
          <th class="ps-pt-hd">Ckt</th>
          <th class="ps-pt-hd">Description</th>
          <th class="ps-pt-hd">Amps</th>
          <th class="ps-pt-hd">Wire / Conduit</th>
        </tr>
      </thead>
      <tbody>`;

  for (let i = 0; i < totalRows; i++) {
    const L = leftSlots[i];
    const R = rightSlots[i];

    html += '<tr>';

    if (L === null) {
      // Spanned — no cells needed
    } else if (L.b) {
      html += breakerPrintCells(L.b, L.circNums, L.span);
    } else {
      html += '<td></td><td></td><td></td><td></td>';
    }

    if (R === null) {
      // Spanned — no cells needed
    } else if (R.b) {
      html += breakerPrintCells(R.b, R.circNums, R.span);
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
  setVal('ps-voltage',    info.voltage);
  setVal('ps-job-num',    info.jobNumber);
  setVal('ps-notes',      info.notes);

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
    ? 'Main Lug'
    : `Main Breaker — ${info.mainBreakerSize}A`;

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('ps-print-name',      info.panelName || 'Panel Schedule');
  setText('ps-print-address',   info.address);
  setText('ps-print-job',       info.jobNumber ? `Job #${info.jobNumber}` : '');
  setText('ps-print-main-type', mainLabel);
  setText('ps-print-voltage',   voltLabel);
  setText('ps-print-rating',    `${info.panelRating}A`);
  setText('ps-print-notes',     info.notes);

  const notesRow = document.getElementById('ps-print-notes-row');
  if (notesRow) notesRow.style.display = info.notes ? '' : 'none';
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
  render();
}

function render() {
  renderTable();
}


// ══════════════════════════════════════════════════════════════════════════
// 8. Event handling
// ══════════════════════════════════════════════════════════════════════════

function handleBreakerEvent(e) {
  // Find the body cell — carries data-id and data-side
  const bodyCell = e.target.closest('td[data-id]');
  if (!bodyCell) return;

  const side = bodyCell.dataset.side;
  const id   = bodyCell.dataset.id;
  const arr  = state[side];
  const idx  = arr.findIndex(b => b.id === id);
  if (idx === -1) return;
  const b = arr[idx];

  // Determine target: top-level breaker or a sub-circuit
  const subEl  = e.target.closest('.ps-sub-ckt');
  const subIdx = subEl ? parseInt(subEl.dataset.sub, 10) : null;
  const target = (subIdx !== null && b.circuits) ? b.circuits[subIdx] : b;
  if (!target) return;

  const field = e.target.dataset.field;

  // Remove button
  if (e.target.classList.contains('ps-del') && e.type === 'click') {
    removeBreaker(side, id);
    return;
  }

  // Type change
  if (field === 'type' && e.type === 'change') {
    changeType(side, idx, e.target.value);
    renderTable();
    return;
  }

  // Field updates
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
    'ps-job-num':      'jobNumber',
    'ps-panel-rating': 'panelRating',
    'ps-notes':        'notes',
  };

  const field = fieldMap[e.target.id];
  if (!field) return;

  const numFields = ['mainBreakerSize', 'panelRating'];
  state.panelInfo[field] = numFields.includes(field)
    ? parseInt(e.target.value, 10) || 0
    : e.target.value;

  if (field === 'mainType') syncMainBreakerRow();
  syncPrintHeader();
}


// ══════════════════════════════════════════════════════════════════════════
// 9. Export — init()
// ══════════════════════════════════════════════════════════════════════════

export function init() {
  const section = document.getElementById('panel-tool');
  if (!section) return;

  initState();
  renderInfo();
  render();
  syncPrintHeader();

  // Panel info form
  const fieldset = section.querySelector('.ps-fieldset');
  if (fieldset) {
    fieldset.addEventListener('input',  handleInfoEvent);
    fieldset.addEventListener('change', handleInfoEvent);
  }

  // Circuit table (event delegation covers all breaker interactions)
  const table = section.querySelector('.ps-table');
  if (table) {
    table.addEventListener('click',  handleBreakerEvent);
    table.addEventListener('change', handleBreakerEvent);
    table.addEventListener('input',  handleBreakerEvent);
  }

  // Footer: add circuit buttons
  document.getElementById('ps-add-left')?.addEventListener('click',
    () => addBreaker('left'));
  document.getElementById('ps-add-right')?.addEventListener('click',
    () => addBreaker('right'));

  // Footer: clear and print
  document.getElementById('ps-clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear all panel data?')) clearAll();
  });

  document.getElementById('ps-print-btn')?.addEventListener('click', () => {
    syncPrintHeader();
    generatePrintTable();
    window.print();
  });

  // Clean up generated print table after printing
  window.addEventListener('afterprint', clearPrintTable);
}
