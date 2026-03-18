/**
 * @file panel-schedule.js
 * @description Panel Schedule Creator — build and print electrical panel schedules.
 *
 * Data model is kept flat and serialisable so future enhancements (save/load,
 * export, load calculations) can be added without restructuring.
 *
 * Sections:
 *   1. Constants
 *   2. State & helpers
 *   3. HTML generation
 *   4. Rendering
 *   5. State mutation
 *   6. Event handling
 *   7. Export — init()
 */


// ══════════════════════════════════════════════════════════════════════════
// 1. Constants
// ══════════════════════════════════════════════════════════════════════════

/**
 * Breaker type definitions.
 *   slots       — how many panel spaces the breaker physically occupies
 *   numCircuits — number of independently labelled circuits
 *                 0 = blank space, 1 = standard single circuit,
 *                 2+ = multi-circuit specialty breakers
 */
const BREAKER_TYPES = [
  { value: 'space',  label: '— Space —',   slots: 1, numCircuits: 0 },
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

function makeBreaker(type = 'space') {
  const nc = numCircuitsFor(type);
  return {
    id:          uid(),
    type,
    size:        20,
    label:       '',
    wireSize:    '',
    conduitSize: '',
    // circuits is non-null only for multi-circuit specialty breakers
    circuits:    nc > 1 ? Array.from({ length: nc }, () => defaultSubCkt()) : null,
  };
}

/**
 * Top-level application state.
 * Designed to be JSON-serialisable for future save/load support.
 */
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
  state.left  = Array.from({ length: 10 }, () => makeBreaker('space'));
  state.right = Array.from({ length: 10 }, () => makeBreaker('space'));
}

/**
 * Returns the circuit numbers (1-based, incrementing by 2 per side) that a
 * given breaker occupies, based on the accumulated slot positions before it.
 */
function calcCircNums(arr, idx, side) {
  let slot = 1;
  for (let i = 0; i < idx; i++) slot += slotsFor(arr[i].type);
  const slots = slotsFor(arr[idx].type);
  return Array.from({ length: slots }, (_, i) =>
    side === 'left' ? 2 * (slot + i) - 1 : 2 * (slot + i)
  );
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


// ══════════════════════════════════════════════════════════════════════════
// 4. Rendering
// ══════════════════════════════════════════════════════════════════════════

function renderBreakerHtml(b, circNums, side) {
  const isLeft    = side === 'left';
  const isSpace   = b.type === 'space';
  const isComplex = b.circuits !== null;   // tandem / triple / quad
  const isSingle  = !isSpace && !isComplex;

  // Circuit number column — single number or stacked for multi-slot
  const numHtml = `<div class="ps-ckt-num">${circNums.map(n => `<span>${n}</span>`).join('')}</div>`;

  let bodyHtml = '';

  if (isSpace) {
    bodyHtml = `
      <div class="ps-row">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        <span class="ps-space-hint">empty</span>
      </div>`;

  } else if (isSingle) {
    // 1-pole, 2-pole, 3-pole — single circuit
    bodyHtml = `
      <div class="ps-row ps-row--main">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        <input  class="ps-lbl" type="text" placeholder="Label" value="${esc(b.label)}" data-field="label">
        <select class="ps-size-sel" data-field="size">${sizeOpts(b.size)}</select>
        <button class="ps-del remove-btn" title="Remove circuit">×</button>
      </div>
      <div class="ps-row ps-row--wire">
        <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(b.wireSize)}</select>
        <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(b.conduitSize)}</select>
      </div>`;

  } else {
    // tandem, triple, quad — multiple labelled sub-circuits
    const labels   = SUB_LABELS[b.type] ?? b.circuits.map((_, i) => String(i + 1));
    const subHtml  = (b.circuits || []).map((sc, i) => `
      <div class="ps-sub-ckt" data-sub="${i}">
        <span class="ps-sub-tag">${labels[i]}</span>
        <input  class="ps-lbl"      type="text" placeholder="Label" value="${esc(sc.label)}" data-field="label">
        <select class="ps-size-sel" data-field="size">${sizeOpts(sc.size)}</select>
      </div>`).join('');

    bodyHtml = `
      <div class="ps-row ps-row--main">
        <select class="ps-type-sel" data-field="type">${typeOpts(b.type)}</select>
        <button class="ps-del remove-btn" title="Remove circuit">×</button>
      </div>
      ${subHtml}
      <div class="ps-row ps-row--wire">
        <select class="ps-wire-sel"  data-field="wireSize"   >${wireOpts(b.wireSize)}</select>
        <select class="ps-cond-sel"  data-field="conduitSize">${conduitOpts(b.conduitSize)}</select>
      </div>`;
  }

  const cls = [
    'ps-breaker',
    `ps-breaker--${b.type}`,
    isSpace ? 'ps-breaker--space' : '',
  ].filter(Boolean).join(' ');

  return `
    <div class="${cls}" data-id="${b.id}" data-side="${side}" style="--ps-slots:${slotsFor(b.type)}" role="listitem">
      ${isLeft ? numHtml : ''}
      <div class="ps-breaker-body">${bodyHtml}</div>
      ${isLeft ? '' : numHtml}
    </div>`;
}

function renderSide(side) {
  const id  = side === 'left' ? 'ps-left' : 'ps-right';
  const el  = document.getElementById(id);
  if (!el) return;
  el.innerHTML = state[side]
    .map((b, i) => renderBreakerHtml(b, calcCircNums(state[side], i, side), side))
    .join('');
}

function render() {
  renderSide('left');
  renderSide('right');
}

// ── Panel info ─────────────────────────────────────────────────────────────

function renderInfo() {
  const info = state.panelInfo;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('ps-address',    info.address);
  setVal('ps-panel-name', info.panelName);
  setVal('ps-main-type',  info.mainType);
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
  const info     = state.panelInfo;
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
// 5. State mutation
// ══════════════════════════════════════════════════════════════════════════

function changeType(side, idx, newType) {
  const b  = state[side][idx];
  b.type   = newType;
  const nc = numCircuitsFor(newType);
  // Preserve existing size as default for sub-circuits when type changes
  b.circuits = nc > 1
    ? Array.from({ length: nc }, () => defaultSubCkt(b.size))
    : null;
}

function addBreaker(side) {
  state[side].push(makeBreaker('space'));
  renderSide(side);
}

function removeBreaker(side, id) {
  const arr = state[side];
  const idx = arr.findIndex(b => b.id === id);
  if (idx !== -1) arr.splice(idx, 1);
  renderSide(side);
}

function clearAll() {
  initState();
  render();
}


// ══════════════════════════════════════════════════════════════════════════
// 6. Event handling
// ══════════════════════════════════════════════════════════════════════════

function handleBreakerEvent(e) {
  const breakerEl = e.target.closest('.ps-breaker');
  if (!breakerEl) return;

  const side = breakerEl.dataset.side;
  const id   = breakerEl.dataset.id;
  const arr  = state[side];
  const idx  = arr.findIndex(b => b.id === id);
  if (idx === -1) return;
  const b = arr[idx];

  // Determine target object: top-level breaker or a sub-circuit
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

  // Type change — may alter slot count and sub-circuit structure
  if (field === 'type' && e.type === 'change') {
    changeType(side, idx, e.target.value);
    renderSide(side);
    return;
  }

  // Field updates (input + change)
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
// 7. Export — init()
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

  // Circuit grid (event delegation covers all breaker interactions)
  const grid = section.querySelector('.ps-panel-wrap');
  if (grid) {
    grid.addEventListener('click',  handleBreakerEvent);
    grid.addEventListener('change', handleBreakerEvent);
    grid.addEventListener('input',  handleBreakerEvent);
  }

  // Footer controls
  document.getElementById('ps-add-left')?.addEventListener('click',
    () => addBreaker('left'));
  document.getElementById('ps-add-right')?.addEventListener('click',
    () => addBreaker('right'));

  document.getElementById('ps-clear-btn')?.addEventListener('click', () => {
    if (confirm('Clear all panel data?')) clearAll();
  });

  document.getElementById('ps-print-btn')?.addEventListener('click', () => {
    syncPrintHeader();
    window.print();
  });
}
