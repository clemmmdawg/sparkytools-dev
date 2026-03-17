/**
 * @file service-load.js
 * @description Residential Service Load Calculator
 *
 * NEC 220.40–220.53  — Standard Method
 * NEC 220.82         — Optional Method (New Dwelling):  10,000 VA @ 100% + remainder @ 40%
 * NEC 220.83         — Optional Method (Existing):       8,000 VA @ 100% + remainder @ 40%
 *
 * All load sections (dryers, washers, fixed appliances, HVAC, custom) are
 * fully dynamic — rows are added/removed at runtime.
 * Each row supports: Shed (exclude from generator calc) and New (220.83 annotation).
 */

import { getEl, escapeHTML } from '../utils/formatting.js';

let necData = null;

// ── Public API ─────────────────────────────────────────────────────────────────

export function init(data) {
  necData = data;

  document.querySelectorAll('.sl-static-input').forEach(el => el.addEventListener('input', calculate));
  getEl('sl-dwelling-type')?.addEventListener('change', () => { updateDwellingContext(); calculate(); });
  getEl('sl-method')?.addEventListener('change',        () => { updateDwellingContext(); calculate(); });

  getEl('sl-sa-dec')?.addEventListener('click',      () => stepCircuit('sl-sa-count',      0, -1));
  getEl('sl-sa-inc')?.addEventListener('click',      () => stepCircuit('sl-sa-count',      0, +1));
  getEl('sl-laundry-dec')?.addEventListener('click', () => stepCircuit('sl-laundry-count', 0, -1));
  getEl('sl-laundry-inc')?.addEventListener('click', () => stepCircuit('sl-laundry-count', 0, +1));

  getEl('sl-add-cooking-btn')?.addEventListener('click', () => addRow('cooking'));
  getEl('sl-add-dryer-btn')?.addEventListener('click',   () => addRow('dryer'));
  getEl('sl-add-fixed-btn')?.addEventListener('click',  () => addRow('fixed'));
  getEl('sl-add-hvac-btn')?.addEventListener('click',   () => addRow('hvac'));
  getEl('sl-add-custom-btn')?.addEventListener('click', () => addRow('custom'));

  getEl('sl-print-btn')?.addEventListener('click', () => window.print());
  getEl('sl-clear-btn')?.addEventListener('click', clearCalculator);

  const dateEl = getEl('sl-print-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  updateDwellingContext();
  calculate();
}

export function clearCalculator() {
  // Reset static inputs to defaults
  const set = (id, val) => { const el = getEl(id); if (el) el.value = val; };
  set('sl-job-name',      '');
  set('sl-dwelling-type', 'new');
  set('sl-method',        'standard');
  set('sl-sqft',          '2000');
  set('sl-existing-service', '');
  set('sl-sa-count',      '2');
  set('sl-laundry-count', '1');
  // Remove all dynamic rows
  ['sl-cooking-list', 'sl-dryer-list', 'sl-fixed-list', 'sl-hvac-list', 'sl-custom-list'].forEach(id => {
    const el = getEl(id);
    if (el) el.innerHTML = '';
  });

  updateDwellingContext();
  calculate();
}

export function calculate() {
  if (!necData?.serviceLoad) return;
  const d      = necData.serviceLoad;
  const inputs = collectInputs();

  updateShedVisuals();
  updateNewLoadVisuals();
  updatePrintSummary(inputs, d);

  const hasShed    = hasShedLoads(inputs);
  const fullResult = runCalc(inputs, d, false);
  const shedResult = hasShed ? runCalc(inputs, d, true) : null;

  renderResults(fullResult, shedResult, inputs, d);
}

// ── Circuit steppers ───────────────────────────────────────────────────────────

function stepCircuit(id, min, delta) {
  const el = getEl(id);
  if (!el) return;
  el.value = Math.max(min, (parseInt(el.value) || min) + delta);
  calculate();
}

// ── Dynamic row factories ──────────────────────────────────────────────────────

const FIXED_TYPES = [
  { name: 'Bathroom Fan',       defaultVA: 100   },
  { name: 'Clothes Washer',     defaultVA: 1200  },
  { name: 'Dishwasher',         defaultVA: 1200  },
  { name: 'Garbage Disposal',   defaultVA: 700   },
  { name: 'Garage Door Opener', defaultVA: 400   },
  { name: 'Microwave',          defaultVA: 1500  },
  { name: 'Pool / Spa Pump',    defaultVA: 2000  },
  { name: 'Trash Compactor',    defaultVA: 700   },
  { name: 'Water Heater',       defaultVA: 4500  },
  { name: 'Well Pump',          defaultVA: 1500  },
  { name: 'Custom',             defaultVA: 0     },
];

// defaultVA are typical nameplate values — always editable by the user
const COOKING_TYPES = [
  { name: 'Range / Cooktop', defaultVA: 12000 },
  { name: 'Wall Oven',       defaultVA: 4500  },
  { name: 'Cooktop',         defaultVA: 6000  },
  { name: 'Custom',          defaultVA: 0     },
];

const HVAC_OPTIONS = [
  { value: 'cooling', text: 'A/C Unit (Cooling)',           defaultVA: 3600  },
  { value: 'cooling', text: 'Heat Pump — Cooling Mode',     defaultVA: 3600  },
  { value: 'heating', text: 'Electric Heat — Baseboard',    defaultVA: 1500  },
  { value: 'heating', text: 'Electric Heat — Heat Strips',  defaultVA: 5000  },
  { value: 'heating', text: 'Electric Heat — Furnace',      defaultVA: 5000  },
  { value: 'heating', text: 'Heat Pump — Heating Mode',     defaultVA: 3600  },
];

const MAX_ROWS_PER_KIND = 20;

function addRow(kind) {
  const listId = {
    cooking: 'sl-cooking-list',
    dryer: 'sl-dryer-list', fixed: 'sl-fixed-list',
    hvac:  'sl-hvac-list',  custom: 'sl-custom-list',
  }[kind];
  const list = getEl(listId);
  if (!list) return;
  if (list.children.length >= MAX_ROWS_PER_KIND) return;
  const row = document.createElement('div');
  row.className = `sl-load-row sl-${kind}-row`;
  row.innerHTML  = buildRowHTML(kind);
  list.appendChild(row);
  wireRow(row, kind);
  calculate();
}

function buildRowHTML(kind) {
  const controls = `
    <div class="sl-row-controls">
      <label class="sl-shed-wrap" title="Exclude from post-shed / generator calculation">
        <input type="checkbox" class="sl-themed-cb sl-shed"> Shed
      </label>
      <label class="sl-new-wrap" title="Mark as newly added load (annotated in 220.83 results)">
        <input type="checkbox" class="sl-themed-cb sl-new"> New
      </label>
      <button class="remove-btn" aria-label="Remove" title="Remove row">×</button>
    </div>`;

  if (kind === 'cooking') {
    const opts = COOKING_TYPES.map(t => `<option value="${t.name}" data-default="${t.defaultVA}">${t.name}</option>`).join('');
    return `
    <div class="sl-row-inputs">
      <select class="sl-type sl-input" aria-label="Appliance type"><option value="" data-default="0">— Select type —</option>${opts}</select>
      <input type="text"   class="sl-name sl-custom-name-input sl-input" placeholder="Custom name" aria-label="Custom name" style="display:none">
      <input type="number" class="sl-watts sl-input" value="0" min="0" max="50000" step="100" aria-label="VA">
      <span class="sl-unit">VA</span>
    </div>${controls}`;
  }

  if (kind === 'dryer') return `
    <div class="sl-row-inputs">
      <span class="sl-row-label">Dryer</span>
      <input type="number" class="sl-watts sl-input" value="5500" min="0" max="15000" step="100" aria-label="Dryer VA">
      <span class="sl-unit">VA</span>
    </div>${controls}`;

  if (kind === 'fixed') {
    const opts = FIXED_TYPES.map(t => `<option value="${t.name}" data-default="${t.defaultVA}">${t.name}</option>`).join('');
    return `
    <div class="sl-row-inputs">
      <select class="sl-type sl-input" aria-label="Appliance type"><option value="" data-default="0">— Select type —</option>${opts}</select>
      <input type="text"   class="sl-name sl-custom-name-input sl-input" placeholder="Custom name" aria-label="Custom name" style="display:none">
      <input type="number" class="sl-watts sl-input" value="0" min="0" max="50000" step="50" aria-label="VA">
      <span class="sl-unit">VA</span>
    </div>${controls}`;
  }

  if (kind === 'hvac') {
    const firstDefault = HVAC_OPTIONS[0].defaultVA;
    const opts = HVAC_OPTIONS.map(o => `<option value="${o.value}" data-default="${o.defaultVA}">${o.text}</option>`).join('');
    return `
    <div class="sl-row-inputs">
      <select class="sl-type sl-input" aria-label="HVAC type">${opts}</select>
      <input type="number" class="sl-watts sl-input" value="${firstDefault}" min="0" max="100000" step="100" aria-label="VA">
      <span class="sl-unit">VA</span>
    </div>${controls}`;
  }

  return `
    <div class="sl-row-inputs">
      <input type="text"   class="sl-name sl-input"  placeholder="Load name" aria-label="Custom load name">
      <input type="number" class="sl-watts sl-input" value="0" min="0" max="100000" step="100" aria-label="VA">
      <span class="sl-unit">VA</span>
    </div>${controls}`;
}

function wireRow(row, kind) {
  row.querySelectorAll('.sl-input').forEach(el => el.addEventListener('input', calculate));
  row.querySelectorAll('.sl-themed-cb').forEach(el => el.addEventListener('change', calculate));
  row.querySelector('.remove-btn')?.addEventListener('click', () => { row.remove(); calculate(); });

  if (kind === 'cooking' || kind === 'fixed') {
    const typeEl  = row.querySelector('.sl-type');
    const nameEl  = row.querySelector('.sl-custom-name-input');
    const vaEl    = row.querySelector('.sl-watts');
    typeEl?.addEventListener('change', () => {
      const isCustom = typeEl.value === 'Custom';
      const opt = typeEl.options[typeEl.selectedIndex];
      if (nameEl) nameEl.style.display = isCustom ? '' : 'none';
      if (typeEl) typeEl.style.display  = isCustom ? 'none' : '';
      if (vaEl && opt?.dataset.default !== undefined) {
        vaEl.value = opt.dataset.default;
        calculate();
      }
    });
  }

  if (kind === 'hvac') {
    const typeEl = row.querySelector('.sl-type');
    const vaEl   = row.querySelector('.sl-watts');
    typeEl?.addEventListener('change', () => {
      const opt = typeEl.options[typeEl.selectedIndex];
      if (vaEl && opt?.dataset.default !== undefined) {
        vaEl.value = opt.dataset.default;
        calculate();
      }
    });
  }
}

// ── Input collection ───────────────────────────────────────────────────────────

function collectInputs() {
  const v  = id => parseFloat(getEl(id)?.value) || 0;
  const sv = id => getEl(id)?.value || '';
  const iv = id => parseInt(getEl(id)?.value)   || 0;
  return {
    jobName:          sv('sl-job-name'),
    dwellingType:     sv('sl-dwelling-type'),
    method:           sv('sl-method'),
    sqft:             v('sl-sqft'),
    existingServiceA: v('sl-existing-service'),
    saCircuits:       Math.max(0, iv('sl-sa-count')),
    laundryCircuits:  Math.max(0, iv('sl-laundry-count')),
    cookingLoads: collectRows('.sl-cooking-row'),
    dryerLoads:  collectRows('.sl-dryer-row'),
    fixedLoads:  collectRows('.sl-fixed-row'),
    hvacLoads:   collectHVACRows('.sl-hvac-row'),
    customLoads: collectRows('.sl-custom-row'),
  };
}

function collectRows(selector) {
  return [...document.querySelectorAll(selector)].map(row => ({
    type:  row.querySelector('.sl-type')?.style.display === 'none'
             ? 'Custom'
             : row.querySelector('.sl-type')?.value?.trim() || '',
    name:  (row.querySelector('.sl-custom-name-input')?.value?.trim() || row.querySelector('.sl-name')?.value?.trim()) || '',
    watts: parseFloat(row.querySelector('.sl-watts')?.value)            || 0,
    shed:  row.querySelector('.sl-shed')?.checked  || false,
    isNew: row.querySelector('.sl-new')?.checked   || false,
  })).filter(r => r.watts > 0);
}

function collectHVACRows(selector) {
  return [...document.querySelectorAll(selector)].map(row => {
    const sel = row.querySelector('.sl-type');
    return {
      type:     sel?.value?.trim() || 'cooling',
      typeName: sel?.options[sel?.selectedIndex]?.text || '',
      watts:    parseFloat(row.querySelector('.sl-watts')?.value) || 0,
      shed:     row.querySelector('.sl-shed')?.checked || false,
      isNew:    row.querySelector('.sl-new')?.checked  || false,
    };
  }).filter(r => r.watts > 0);
}

function hasShedLoads(inputs) {
  return [...inputs.cookingLoads, ...inputs.dryerLoads, ...inputs.fixedLoads,
          ...inputs.hvacLoads, ...inputs.customLoads].some(l => l.shed);
}

// ── Core dispatch ──────────────────────────────────────────────────────────────

function runCalc(inputs, d, excludeShed) {
  const ex = load => excludeShed && load.shed;
  return inputs.method === 'standard'
    ? runStandard(inputs, d, ex)
    : runOptional(inputs, d, ex);
}

// ── Standard Method ─────────────────────────────────────────────────────────────

function runStandard(inputs, d, ex) {
  const steps = [];
  let total = 0;

  // 1. Lighting / SA / Laundry → Table 220.42 demand
  const lightVA   = inputs.sqft * d.lightingVAPerSqFt;
  const saVA      = inputs.saCircuits    * d.smallApplianceVAPerCircuit;
  const laundryVA = inputs.laundryCircuits * d.laundryVAPerCircuit;
  const lightSub  = lightVA + saVA + laundryVA;
  const lightDem  = applyLightingDemand(lightSub, d.lightingDemandTable);

  steps.push({ label: `Apply Table 220.42 Demand Factors → ${fmtVA(lightDem)}`, nec: '220.42', va: lightDem, isAdjustment: true, note: buildDemandNote(lightSub, d.lightingDemandTable) });
  steps.push({ label: `  └ General Lighting & Receptacles (${inputs.sqft.toLocaleString()} sq ft × 3 VA)`, nec: '220.12',    va: lightVA,   isSubItem: true });
  steps.push({ label: `  └ Small Appliance Circuits (${inputs.saCircuits} × 1,500 VA)`,                     nec: '220.52(A)', va: saVA,      isSubItem: true });
  steps.push({ label: `  └ Laundry Circuit${inputs.laundryCircuits > 1 ? 's' : ''} (${inputs.laundryCircuits} × 1,500 VA)`, nec: '220.52(B)', va: laundryVA, isSubItem: true });
  total += lightDem;

  // 2. Cooking — Table 220.55
  const activeCooking = inputs.cookingLoads.filter(l => !ex(l));
  if (inputs.cookingLoads.length > 0) {
    if (activeCooking.length > 0) {
      const cookTotalVA = activeCooking.reduce((s, l) => s + l.watts, 0);
      const cookKW      = cookTotalVA / 1000;
      const demandVA    = Math.round(getRangeDemandKW(cookKW, d.rangeBreakpoints) * 1000);
      steps.push({
        label: `Cooking Equipment Demand → ${fmtVA(demandVA)}`,
        nec: '220.55', va: demandVA, isAdjustment: true,
        note: getRangeDemandNote(cookKW, d.rangeBreakpoints),
      });
      total += demandVA;
    }
    inputs.cookingLoads.forEach((load, i) => {
      const name = escapeHTML(load.type === 'Custom' && load.name ? load.name : (load.type || 'Appliance'));
      steps.push({
        label: `  └ ${name} (${load.watts.toLocaleString()} VA)`,
        nec: '220.55', va: ex(load) ? 0 : load.watts,
        shed: load.shed, isSubItem: true, isNew: load.isNew,
        note: load.shed ? 'Load shed — excluded' : 'At nameplate (combined for Table 220.55)',
      });
    });
  }

  // 3. Dryers — 220.54 (nameplate or 5,000 VA min)
  inputs.dryerLoads.forEach((load, i) => {
    const rawVA = Math.max(load.watts, d.dryerMinVA);
    const demVA = ex(load) ? 0 : rawVA;
    steps.push({
      label: `Dryer${inputs.dryerLoads.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
      nec: '220.54', va: demVA, shed: load.shed, isNew: load.isNew,
      note: ex(load) ? 'Load shed — excluded' : load.watts < d.dryerMinVA ? `< ${d.dryerMinVA.toLocaleString()} VA minimum; using minimum` : 'At nameplate',
    });
    total += demVA;
  });

  // 4. Fixed appliances — 220.53 (washers + fixed rows; 75% when ≥4 active)
  const allFixed = buildFixedList(inputs);
  if (allFixed.length > 0) {
    const active    = allFixed.filter(l => !ex(l));
    const activeSum = active.reduce((s, l) => s + l.watts, 0);
    const factor    = active.length >= d.fixedApplianceThreshold ? d.fixedApplianceDemandFactor : 1.0;
    const fixDem    = Math.round(activeSum * factor);
    steps.push({
      label: `Fixed Appliances Demand (${(factor * 100).toFixed(0)}% × ${fmtVA(activeSum)})`,
      nec: '220.53', va: fixDem, isAdjustment: true,
      note: active.length >= d.fixedApplianceThreshold
        ? `${active.length} appliances ≥ ${d.fixedApplianceThreshold} → 75% demand factor`
        : `${active.length} appliance${active.length !== 1 ? 's' : ''} — fewer than ${d.fixedApplianceThreshold}, no reduction`,
    });
    allFixed.forEach(l => steps.push({ label: `  └ ${l.label}`, nec: '220.53', va: ex(l) ? 0 : l.watts, shed: l.shed, isSubItem: true, isNew: l.isNew }));
    total += fixDem;
  }

  // 5. HVAC — non-coincident 220.60; heat at 65% per 220.51
  const hvac = computeHVAC(inputs.hvacLoads, ex);
  hvac.steps.forEach(s => steps.push(s));
  total += hvac.totalVA;

  // 6. Custom
  inputs.customLoads.forEach(load => {
    const va = ex(load) ? 0 : load.watts;
    steps.push({ label: `${escapeHTML(load.name || 'Custom Load')} (${load.watts.toLocaleString()} VA)`, nec: 'Custom', va, shed: load.shed, isNew: load.isNew, note: ex(load) ? 'Load shed — excluded' : 'At 100%' });
    total += va;
  });

  return finalize(steps, total, necData.serviceLoad);
}

// ── Optional Method ────────────────────────────────────────────────────────────

function runOptional(inputs, d, ex) {
  const steps    = [];
  const allLoads = [];
  const isExist  = inputs.dwellingType === 'existing';
  const necRef   = isExist ? '220.83' : '220.82';
  const firstVA  = isExist ? d.optional220_83FirstVA : d.optionalFirstVA;

  allLoads.push({ label: `General Lighting & Receptacles (${inputs.sqft.toLocaleString()} sq ft × 3 VA)`, nec: necRef, va: inputs.sqft * d.lightingVAPerSqFt });
  allLoads.push({ label: `Small Appliance Circuits (${inputs.saCircuits} × 1,500 VA)`, nec: necRef, va: inputs.saCircuits * d.smallApplianceVAPerCircuit });
  allLoads.push({ label: `Laundry Circuit${inputs.laundryCircuits > 1 ? 's' : ''} (${inputs.laundryCircuits} × 1,500 VA)`, nec: necRef, va: inputs.laundryCircuits * d.laundryVAPerCircuit });

  const activeCooking = inputs.cookingLoads.filter(l => !ex(l));
  if (inputs.cookingLoads.length > 0) {
    if (activeCooking.length > 0) {
      const cookTotalVA = activeCooking.reduce((s, l) => s + l.watts, 0);
      allLoads.push({
        label: `Cooking Equipment (${activeCooking.length} appliance${activeCooking.length !== 1 ? 's' : ''}, ${fmtVA(cookTotalVA)} combined)`,
        nec: necRef, va: 0, displayVA: cookTotalVA, isAdjustment: true, note: 'At nameplate VA',
      });
    }
    inputs.cookingLoads.forEach(load => {
      const name = escapeHTML(load.type === 'Custom' && load.name ? load.name : (load.type || 'Appliance'));
      allLoads.push({
        label: `  └ ${name} (${load.watts.toLocaleString()} VA)`,
        nec: necRef, va: ex(load) ? 0 : load.watts,
        shed: load.shed, isSubItem: true, isNew: load.isNew,
      });
    });
  }

  inputs.dryerLoads.forEach((load, i) => {
    const rawVA = Math.max(load.watts, d.dryerMinVA);
    allLoads.push({
      label: `Dryer${inputs.dryerLoads.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
      nec: necRef, va: ex(load) ? 0 : rawVA, shed: load.shed, isNew: load.isNew,
      note: load.watts < d.dryerMinVA ? `< ${d.dryerMinVA.toLocaleString()} VA minimum` : '',
    });
  });

  buildFixedList(inputs).forEach(l => allLoads.push({ label: l.label, nec: necRef, va: ex(l) ? 0 : l.watts, shed: l.shed, isNew: l.isNew }));

  // NOTE: HVAC is NOT added to allLoads — per 220.82(C) it is added after the demand factor

  inputs.customLoads.forEach(load => allLoads.push({ label: `${escapeHTML(load.name || 'Custom Load')} (${load.watts.toLocaleString()} VA)`, nec: 'Custom', va: ex(load) ? 0 : load.watts, shed: load.shed, isNew: load.isNew }));

  allLoads.forEach(l => steps.push(l));
  const subtotal  = allLoads.reduce((s, l) => s + l.va, 0);
  steps.push({ label: 'Subtotal — All General Loads at Nameplate', nec: '', va: subtotal, isSubtotal: true });

  const first     = Math.min(subtotal, firstVA);
  const remainder = Math.max(0, subtotal - firstVA);
  const generalDemand = Math.round(first * d.optionalFirstFactor + remainder * d.optionalRemainderFactor);

  steps.push({ label: `First ${firstVA.toLocaleString()} VA × ${d.optionalFirstFactor * 100}%`, nec: necRef, va: Math.round(first * d.optionalFirstFactor), isAdjustment: true });
  if (remainder > 0) steps.push({ label: `Remaining ${remainder.toLocaleString()} VA × ${d.optionalRemainderFactor * 100}%`, nec: necRef, va: Math.round(remainder * d.optionalRemainderFactor), isAdjustment: true });

  // 220.82(C) — HVAC added separately at its own demand rates, AFTER the general demand factor
  const hvac = computeHVACOptional(inputs.hvacLoads, ex);
  hvac.steps.forEach(s => steps.push(s));

  return finalize(steps, generalDemand + hvac.totalVA, necData.serviceLoad);
}

// ── HVAC — Optional Method 220.82(C) ──────────────────────────────────────────
// Added AFTER the general demand factor. Only the largest group is used.
// 220.82(C)(1)/(2): A/C & heat pumps → 100%
// 220.82(C)(4): Electric resistance heat, < 4 units → 65%
// 220.82(C)(5): Electric resistance heat, ≥ 4 units → 40%

function computeHVACOptional(hvacLoads, ex) {
  if (!hvacLoads.length) return { steps: [], totalVA: 0 };

  const active  = hvacLoads.filter(l => !ex(l));
  if (!active.length) return { steps: [], totalVA: 0 };

  const cooling     = active.filter(l => l.type === 'cooling');
  // Heat Pump Heating is also 100% per 220.82(C)(2) — detect by typeName
  const hpHeating   = active.filter(l => l.type === 'heating' && (l.typeName || '').toLowerCase().includes('heat pump'));
  const resHeating  = active.filter(l => l.type === 'heating' && !(l.typeName || '').toLowerCase().includes('heat pump'));

  const coolingVA   = cooling.reduce((s, l) => s + l.watts, 0);
  const hpHeatVA    = hpHeating.reduce((s, l) => s + l.watts, 0);
  const resHeatVA   = resHeating.reduce((s, l) => s + l.watts, 0);

  // The group with the largest nameplate total wins
  const groups = [
    { id: 'cooling',    loads: cooling,    nameplateVA: coolingVA,  factor: 1.0,  label: 'A/C & Cooling',        nec: '220.82(C)(1)' },
    { id: 'hp-heat',    loads: hpHeating,  nameplateVA: hpHeatVA,   factor: 1.0,  label: 'Heat Pump Heating',     nec: '220.82(C)(2)' },
    { id: 'res-heat',   loads: resHeating, nameplateVA: resHeatVA,
      factor: resHeating.length >= 4 ? 0.40 : 0.65,
      label: `Electric Resistance Heating (${resHeating.length} unit${resHeating.length !== 1 ? 's' : ''})`,
      nec: resHeating.length >= 4 ? '220.82(C)(5)' : '220.82(C)(4)' },
  ].filter(g => g.nameplateVA > 0);

  if (!groups.length) return { steps: [], totalVA: 0 };

  // Select the group with the highest nameplate VA
  const winner  = groups.reduce((a, b) => b.nameplateVA > a.nameplateVA ? b : a);
  const demandVA = Math.round(winner.nameplateVA * winner.factor);
  const pct      = Math.round(winner.factor * 100);
  const steps    = [];
  const subItems = [];

  winner.loads.forEach((load, i) => {
    const name = load.typeName || (load.type === 'cooling' ? 'A/C Unit' : 'Electric Heat');
    subItems.push({
      label:   `  └ ${name}${winner.loads.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
      nec:     winner.nec, va: load.watts, isSubItem: true, isNew: load.isNew, shed: load.shed,
      note:    `Included in ${winner.label} group`,
    });
  });

  // Show the other (losing) groups as non-coincident / omitted rows
  groups.filter(g => g.id !== winner.id).forEach(g => {
    g.loads.forEach((load, i) => {
      const name = load.typeName || (load.type === 'cooling' ? 'A/C Unit' : 'Electric Heat');
      subItems.push({
        label:         `  └ ${name}${g.loads.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
        nec:           g.nec, va: load.watts, isSubItem: true, nonCoincident: true, isNew: load.isNew,
        note:          `${g.label} group is smaller — omitted per 220.82(C)`,
      });
    });
  });

  const factorNote = pct === 100 ? 'at 100%' : `at ${pct}% per ${winner.nec}`;
  steps.push({
    label:       `220.82(C) HVAC — ${winner.label} selected (${fmtVA(winner.nameplateVA)} × ${pct}%)`,
    nec:         winner.nec, va: 0, displayVA: demandVA, isAdjustment: true,
    note:        `Largest group ${factorNote}`,
  });
  subItems.forEach(s => steps.push(s));

  return { steps, totalVA: demandVA };
}

// ── HVAC non-coincident (Standard Method 220.60) ───────────────────────────────

function computeHVAC(hvacLoads, ex) {
  if (!hvacLoads.length) return { steps: [], totalVA: 0 };

  const cooling = hvacLoads.filter(l => l.type === 'cooling');
  const heating = hvacLoads.filter(l => l.type === 'heating');

  const coolingVA   = cooling.filter(l => !ex(l)).reduce((s, l) => s + l.watts, 0);
  const heatingVA   = heating.filter(l => !ex(l)).reduce((s, l) => s + l.watts, 0);
  const useCooling  = coolingVA >= heatingVA;
  const totalVA     = Math.max(coolingVA, heatingVA);
  const steps       = [];
  const subItems    = [];

  cooling.forEach((load, i) => {
    const isShed = ex(load);
    const nc     = !isShed && !useCooling;
    subItems.push({
      label: `  └ ${load.typeName || 'A/C Unit'}${cooling.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
      nec: '220.60', va: (isShed || nc) ? 0 : load.watts,
      shed: load.shed, nonCoincident: nc, isNew: load.isNew, isSubItem: true,
      note: isShed     ? 'Load shed — excluded'
          : useCooling ? 'Cooling group selected (larger) — included at 100%'
                       : 'Cooling group is smaller — omitted per NEC 220.60',
    });
  });

  heating.forEach((load, i) => {
    const isShed = ex(load);
    const nc     = !isShed && useCooling;
    subItems.push({
      label: `  └ ${load.typeName || 'Electric Heat'}${heating.length > 1 ? ` #${i + 1}` : ''} (${load.watts.toLocaleString()} VA)`,
      nec: '220.51',
      va: (isShed || nc) ? 0 : load.watts,
      shed: load.shed, nonCoincident: nc, isNew: load.isNew, isSubItem: true,
      note: isShed      ? 'Load shed — excluded'
          : !useCooling ? 'Heating group selected (larger) — at 100% per NEC 220.51'
                        : 'Heating group is smaller — omitted per NEC 220.60',
    });
  });

  if (subItems.length) {
    steps.push({
      label: `HVAC Non-Coincident Demand (${useCooling ? 'cooling' : 'heating'} group)`,
      nec: '220.60', va: 0, displayVA: totalVA, isAdjustment: true,
      note: `Using larger group: ${useCooling ? `${fmtVA(coolingVA)} cooling` : `${fmtVA(heatingVA)} heating`}`,
    });
    subItems.forEach(s => steps.push(s));
  }
  return { steps, totalVA };
}

// ── Fixed appliance list ───────────────────────────────────────────────────────

function buildFixedList(inputs) {
  return inputs.fixedLoads.map(l => ({
    label: `${escapeHTML(l.type === 'Custom' && l.name ? l.name : (l.type || 'Appliance'))} (${l.watts.toLocaleString()} VA)`,
    watts: l.watts, shed: l.shed, isNew: l.isNew,
  })).filter(l => l.watts > 0);
}

// ── Finalization ───────────────────────────────────────────────────────────────

function finalize(steps, totalVA, d) {
  const totalAmps   = totalVA / d.systemVoltage;
  const serviceSize = recommendServiceSize(totalAmps, d.standardSizes);
  const conductor   = d.conductorSizes.find(c => c.amps === serviceSize);
  return { steps, totalVA, totalAmps, serviceSize, conductorLabel: conductor?.awg || '—' };
}

// ── NEC helpers ────────────────────────────────────────────────────────────────

function applyLightingDemand(va, table) {
  let remaining = va, total = 0, prevUpTo = 0;
  for (const tier of table) {
    if (remaining <= 0) break;
    const tierSize = tier.upTo !== undefined ? tier.upTo - prevUpTo : Infinity;
    const inTier   = Math.min(remaining, tierSize);
    total     += inTier * tier.factor;
    remaining -= inTier;
    if (tier.upTo !== undefined) prevUpTo = tier.upTo;
  }
  return Math.round(total);
}

function getRangeDemandKW(kW, bp) {
  if (kW <= 0)           return 0;
  if (kW <= bp.colBMax)   return kW * bp.colABFactor;
  if (kW <= bp.colCMaxKW) return bp.colCBaseKW;
  return bp.colCBaseKW * (1 + bp.overCIncrementPerKW * Math.ceil(kW - bp.colCMaxKW));
}

function getRangeDemandNote(kW, bp) {
  const va = Math.round(kW * 1000);
  const vaFmt = n => `${Math.round(n).toLocaleString()} VA`;
  if (kW <= bp.colBMax)   return `${va.toLocaleString()} VA × ${bp.colABFactor * 100}% (Table 220.55 Col. B)`;
  if (kW <= bp.colCMaxKW) return `${va.toLocaleString()} VA ≤ 12,000 VA → 8,000 VA demand (Table 220.55 Col. C)`;
  const excess = Math.ceil(kW - bp.colCMaxKW);
  return `${va.toLocaleString()} VA > 12,000 VA → 8,000 VA + ${excess} × 5% (Table 220.55 Note 1)`;
}

function buildDemandNote(subtotal, table) {
  const parts = [];
  let remaining = subtotal, prevUpTo = 0;
  for (const tier of table) {
    if (remaining <= 0) break;
    const tierSize = tier.upTo !== undefined ? tier.upTo - prevUpTo : Infinity;
    const inTier   = Math.min(remaining, tierSize);
    parts.push(`${fmtVA(inTier)} × ${tier.factor * 100}%`);
    remaining -= inTier;
    if (tier.upTo !== undefined) prevUpTo = tier.upTo;
  }
  return parts.join(' + ');
}

function recommendServiceSize(amps, sizes) {
  return sizes.find(s => s >= amps) ?? sizes[sizes.length - 1];
}

function fmtVA(va)  { return `${Math.round(va).toLocaleString()} VA`; }
function fmtAmps(a) { return `${a.toFixed(1)} A`; }

// ── UI state ───────────────────────────────────────────────────────────────────

function updateDwellingContext() {
  const section = getEl('service-tool');
  if (!section) return;
  section.classList.toggle('has-existing', getEl('sl-dwelling-type')?.value === 'existing');
  section.classList.toggle('has-optional',  getEl('sl-method')?.value        === 'optional');
}

function updateShedVisuals() {
  document.querySelectorAll('.sl-load-row').forEach(row =>
    row.classList.toggle('is-shed', row.querySelector('.sl-shed')?.checked || false));
}

function updateNewLoadVisuals() {
  document.querySelectorAll('.sl-load-row').forEach(row =>
    row.classList.toggle('is-new', row.querySelector('.sl-new')?.checked || false));
}

function updatePrintSummary(inputs) {
  const el = getEl('sl-print-summary');
  if (!el) return;
  const methodLabel = inputs.method === 'standard' ? 'Standard Method (NEC 220.40–220.53)'
    : inputs.dwellingType === 'existing' ? 'Optional Method — NEC 220.83 (Existing)'
    : 'Optional Method — NEC 220.82 (New)';
  el.innerHTML = `
    ${inputs.jobName ? `<div class="sl-print-job-name">${escapeHTML(inputs.jobName)}</div>` : ''}
    <div class="sl-print-summary-grid">
      <span><strong>Dwelling:</strong> ${inputs.dwellingType === 'new' ? 'New' : 'Existing'}</span>
      <span><strong>Method:</strong> ${methodLabel}</span>
      <span><strong>Floor Area:</strong> ${inputs.sqft.toLocaleString()} sq ft</span>
      ${inputs.existingServiceA ? `<span><strong>Existing Service:</strong> ${inputs.existingServiceA}A</span>` : ''}
    </div>`;
}

// ── Rendering ──────────────────────────────────────────────────────────────────

function renderResults(fullResult, shedResult, inputs, d) {
  const container = getEl('sl-results');
  if (!container) return;

  const methodLabel = inputs.method === 'standard'
    ? 'Standard Method — NEC 220.40–220.53'
    : inputs.dwellingType === 'existing'
      ? 'Optional Method — NEC 220.83 (Existing Dwelling)'
      : 'Optional Method — NEC 220.82 (New Dwelling)';

  let adequacyHtml = '';
  if (inputs.dwellingType === 'existing' && inputs.existingServiceA > 0) {
    const ok = fullResult.totalAmps <= inputs.existingServiceA;
    adequacyHtml = `<div class="sl-adequacy sl-adequacy--${ok ? 'ok' : 'over'}">
      ${ok
        ? `✅ Existing ${inputs.existingServiceA}A service is <strong>adequate</strong> — calculated demand is ${fullResult.totalAmps.toFixed(1)}A`
        : `⚠️ Existing ${inputs.existingServiceA}A service is <strong>inadequate</strong> — calculated demand is ${fullResult.totalAmps.toFixed(1)}A`}
    </div>`;
  }

  container.innerHTML = `
    ${adequacyHtml}
    <h3 class="sl-results-group-title">Calculated Load</h3>
    ${stepsTable(fullResult.steps)}
    ${serviceCard(fullResult, shedResult, d)}`;
}


function stepsTable(steps) {
  const rows = steps.map(s => {
    const cls = [
      s.isSubtotal    && 'is-subtotal',
      s.isAdjustment  && 'is-adjustment',
      s.isSubItem     && 'is-sub-item',
      s.shed          && 'is-shed-row',
      s.nonCoincident && 'is-nc-row',
    ].filter(Boolean).join(' ');

    const vaText = s.shed           ? '<span class="sl-shed-tag">SHED</span>'
      : s.nonCoincident             ? '<span class="sl-nc-tag" title="Non-coincident load — omitted per NEC 220.60">N/C</span>'
      : (s.isSubtotal||s.isAdjustment) ? `<strong>${fmtVA(s.displayVA ?? s.va)}</strong>`
      : fmtVA(s.displayVA ?? s.va);

    const noteHtml = s.note  ? `<span class="sl-step-note">${s.note}</span>` : '';
    const newBadge = s.isNew ? `<span class="sl-new-badge" title="Newly added load — 220.83">NEW</span>` : '';

    return `<tr class="${cls}">
      <td>${s.label}${newBadge}${noteHtml}</td>
      <td class="sl-nec-col"><span class="sl-nec-badge">${s.nec}</span></td>
      <td class="sl-va-col">${vaText}</td>
    </tr>`;
  }).join('');

  return `<table class="sl-steps-table" aria-label="Load calculation steps">
    <thead><tr><th>Load / Step</th><th>NEC</th><th>Demand (VA)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ── Standard generator sizes (kW) ─────────────────────────────────────────────
const GENERATOR_SIZES_KW = [7.5, 10, 12, 14, 16, 18, 20, 22, 24, 25, 30, 35, 40, 45, 50, 60, 70, 80, 100, 125, 150, 200];

function recommendGeneratorKW(totalVA) {
  const kw = totalVA / 1000;
  return GENERATOR_SIZES_KW.find(s => s >= kw) ?? Math.ceil(kw / 5) * 5;
}

function serviceCard(result, shedResult, d) {
  let genHtml = '';
  if (shedResult) {
    const genKW   = (shedResult.totalVA / 1000).toFixed(1);
    const genAmps = shedResult.totalAmps.toFixed(1);
    const recKW   = recommendGeneratorKW(shedResult.totalVA);
    genHtml = `
      <div class="sl-gen-section">
        <div class="sl-gen-title">⚡ Generator Sizing (Shed Loads Excluded)</div>
        ${shedSummaryBadges(result, shedResult)}
        <div class="sl-service-metrics">
          <div class="sl-metric">
            <span class="sl-metric-value">${genKW} kW</span>
            <span class="sl-metric-label">Generator Load (${genAmps} A)</span>
          </div>
          <div class="sl-metric sl-metric--service">
            <span class="sl-metric-value sl-metric-value--large">${recKW} kW</span>
            <span class="sl-metric-label">Recommended Generator</span>
          </div>
        </div>
        <div class="sl-conductor-rec sl-gen-note">
          Size to 125% of calculated load for motor inrush capacity. Verify with generator manufacturer specs.
        </div>
      </div>`;
  }

  return `<div class="sl-service-card">
    <div class="sl-service-metrics">
      <div class="sl-metric"><span class="sl-metric-value">${fmtVA(result.totalVA)}</span><span class="sl-metric-label">Calculated Load</span></div>
      <div class="sl-metric"><span class="sl-metric-value">${fmtAmps(result.totalAmps)}</span><span class="sl-metric-label">At ${d.systemVoltage}V</span></div>
      <div class="sl-metric sl-metric--service">
        <span class="sl-metric-value sl-metric-value--large">${result.serviceSize}A</span>
        <span class="sl-metric-label">Recommended Service Size</span>
      </div>
    </div>
    <div class="sl-conductor-rec">
      Service entrance conductors: <strong>${result.conductorLabel}</strong>
      (THHN/THWN-2 or XHHW-2, 75°C terminal rating — Table 310.16)
    </div>
    ${genHtml}
  </div>`;
}

function shedSummaryBadges(full, shed) {
  const reduction = full.totalVA - shed.totalVA;
  const pct = full.totalVA > 0 ? (reduction / full.totalVA * 100).toFixed(0) : 0;
  return `<div class="sl-shed-badges">
    <div class="sl-shed-badge"><span class="sl-shed-badge-val">${fmtVA(reduction)}</span><span class="sl-shed-badge-label">Load Reduced</span></div>
    <div class="sl-shed-badge"><span class="sl-shed-badge-val">${pct}%</span><span class="sl-shed-badge-label">Reduction</span></div>
    <div class="sl-shed-badge"><span class="sl-shed-badge-val">${full.serviceSize}A → ${shed.serviceSize}A</span><span class="sl-shed-badge-label">Service Impact</span></div>
  </div>`;
}