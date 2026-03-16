/**
 * @file transformer.js
 * @description Transformer Calculator
 *
 * Given kVA, primary voltage, secondary voltage (and inferred phase) the
 * calculator provides live results for:
 *   - Primary and secondary full-load current
 *   - Primary OCPD per NEC T450.3(B)
 *   - Secondary OCPD per NEC T450.3(B)
 *   - Primary conductor size per NEC T310.16 (75°C Cu THWN)
 *   - Secondary conductor size per NEC T310.16 (75°C Cu THWN)
 *   - Secondary conductor tap rule per NEC 240.21(C)
 *
 * Phase is inferred from primary voltage (480 V / 208 V → 3Ø; 240 V → 1Ø).
 * A small toggle badge on the transformer symbol lets users override the 240 V
 * default to 3Ø when needed (e.g. 240 V delta systems).
 *
 * Results update live on every input change.
 */

import { getEl } from '../utils/formatting.js';

// ─────────────────────────────────────────────────────────────────────────────
// NEC Tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NEC T310.16 — 75°C Cu THWN allowable ampacity in conduit
 */
const AMPACITY = {
  "14":  20, "12":  25, "10":  35,  "8":  50,
   "6":  65,  "4":  85,  "3": 100,  "2": 115,
   "1": 130,"1/0": 150,"2/0": 175,"3/0": 200,
 "4/0": 230,"250": 255,"300": 285,"350": 310,
 "400": 335,"500": 380,"600": 420,"750": 475,
};

const WIRE_ORDER = [
  "14","12","10","8","6","4","3","2","1",
  "1/0","2/0","3/0","4/0","250","300","350","400","500","600","750",
];

/** NEC 240.6(A) standard OCPD ratings */
const STD_OCPD = [
  15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
  100, 110, 125, 150, 175, 200, 225, 250, 300, 350,
  400, 450, 500, 600, 700, 800, 1000, 1200,
];

// ─────────────────────────────────────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Next standard OCPD at or above `amps`. */
function nextOCPD(amps) {
  return STD_OCPD.find(s => s >= amps) ?? null;
}

/** Smallest conductor whose 75°C ampacity ≥ `amps`. */
function minWire(amps) {
  return WIRE_ORDER.find(w => (AMPACITY[w] ?? 0) >= amps) ?? null;
}

/** Format number — strip trailing zeros, cap at `dp` decimal places. */
function fmt(v, dp = 1) {
  if (v == null || isNaN(v)) return "—";
  return parseFloat(v.toFixed(dp)).toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Voltage options
// ─────────────────────────────────────────────────────────────────────────────

const PRI_VOLTAGES = [
  { label: "480 V  (L-L)", value: 480 },
  { label: "240 V  (L-L)", value: 240 },
  { label: "208 V  (L-L)", value: 208 },
];

const SEC_VOLTAGES = [
  { label: "480 V  (L-L)", value: 480 },
  { label: "240 V  (L-L)", value: 240 },
  { label: "208 V  (L-L)", value: 208 },
  { label: "120 V  (L-N)", value: 120, ln: true },
  { label: "277 V  (L-N)", value: 277, ln: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// Phase inference
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phase override state — null means auto (follow inferPhase).
 * Only relevant when primary voltage is 240 V.
 * @type {"1"|"3"|null}
 */
let phaseOverride = null;

/**
 * Returns the effective phase for the current primary voltage.
 * - 480 V / 208 V → always "3" (three-phase)
 * - 240 V → "1" by default; respects phaseOverride when set
 * @param {number} vpri
 * @returns {"1"|"3"}
 */
function getPhase(vpri) {
  if (vpri === 480 || vpri === 208) return "3";
  if (vpri === 240 && phaseOverride) return phaseOverride;
  return "1";
}

// ─────────────────────────────────────────────────────────────────────────────
// Core calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} kva
 * @param {number} vpri   - primary line voltage
 * @param {number} vsec   - secondary line (or L-N) voltage
 * @param {"1"|"3"} phase - "1" = single-phase, "3" = three-phase
 * @param {boolean} secLN - true if secondary is an L-N value
 * @param {string}  tap   - secondary tap rule key
 * @returns {object} result
 */
function calculate(kva, vpri, vsec, phase, secLN, tap) {
  const sqrt3 = Math.sqrt(3);

  // Primary current — always uses selected phase
  const priFactor = phase === "3" ? (vpri * sqrt3) : vpri;
  const ipri = (kva * 1000) / priFactor;

  // Secondary current — L-N voltages are inherently single-phase
  const secFactor = (!secLN && phase === "3") ? (vsec * sqrt3) : vsec;
  const isec = (kva * 1000) / secFactor;

  const ratio = vpri / vsec;

  // ── NEC T450.3(B) OCPD ───────────────────────────────────────────────────
  const priPct       = ipri >= 9 ? 1.25 : 1.67;
  const priOCPD      = nextOCPD(ipri * priPct);

  const secPct       = isec >= 9 ? 1.25 : 1.67;
  const secOCPD      = nextOCPD(isec * secPct);

  // Primary OCPD when secondary is also protected: up to 250%
  const priOCPD_ws   = nextOCPD(ipri * 2.5);

  // ── T310.16 Conductors ───────────────────────────────────────────────────
  // Primary: sized at 125% of FLA
  const priWireAmps  = ipri * 1.25;
  const priWire      = minWire(priWireAmps);

  // Secondary: depends on tap rule
  let secWireAmps = isec * 1.25;
  let tapNote = "";

  switch (tap) {
    case "at-terminals":
      secWireAmps = isec * 1.25;
      tapNote     = `OCPD at secondary terminals — conductors sized ≥ 125% of secondary FLA (${fmt(isec)} A × 125% = ${fmt(secWireAmps)} A min).`;
      break;

    case "primary-ocpd":
      {
        const reflected = priOCPD != null ? priOCPD / ratio : isec * 1.25;
        secWireAmps = Math.max(isec * 1.25, reflected);
        tapNote = `Protected by primary OCPD [NEC 240.21(C)(1)] — no secondary OCPD required at transformer. Secondary conductor ampacity ≥ primary OCPD (${priOCPD} A) ÷ turns ratio (${fmt(ratio, 2)}) = ${fmt(reflected)} A.`;
      }
      break;

    case "10ft":
      {
        const tenPct = (priOCPD_ws ?? 0) * 0.10;
        secWireAmps  = Math.max(isec, tenPct);
        tapNote = `≤ 10 ft tap [NEC 240.21(C)(2)] — conductor ampacity ≥ 1/10 of primary OCPD (${priOCPD_ws} A × 10% = ${fmt(tenPct)} A). Must be in raceway, no splices, terminate in a single OCPD.`;
      }
      break;

    case "25ft":
      {
        const priAmp   = priWire ? (AMPACITY[priWire] ?? ipri) : ipri;
        const oneThird = priAmp / 3;
        secWireAmps    = Math.max(isec, oneThird);
        tapNote = `≤ 25 ft tap [NEC 240.21(C)(3)] — conductor ampacity ≥ ⅓ of primary conductor ampacity (${priAmp} A ÷ 3 = ${fmt(oneThird)} A). Must be in raceway, protected from physical damage, terminate in a single OCPD.`;
      }
      break;
  }

  const secWire = minWire(secWireAmps);

  return {
    ipri, isec, ratio,
    priPct: ipri >= 9 ? "125%" : "167%",
    secPct: isec >= 9 ? "125%" : "167%",
    priOCPD, priOCPD_ws,
    secOCPD: tap === "primary-ocpd" ? null : secOCPD,
    secOCPDLabel: tap === "primary-ocpd" ? "Not required" : (secOCPD ? `${secOCPD} A` : "—"),
    priWire, priWireAmps,
    secWire, secWireAmps,
    tapNote,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DOM helpers
// ─────────────────────────────────────────────────────────────────────────────

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showResults(on) {
  const el = getEl("tc-results");
  if (el) el.classList.toggle("visible", on);
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual diagram updates
// ─────────────────────────────────────────────────────────────────────────────

/** Update voltage labels and kVA/phase labels on the transformer symbol. */
function updateVisualLabels(kva, vpri, vsec, phase) {
  setText("tc-vis-vpri", vpri ? `${vpri} V` : "—");
  setText("tc-vis-vsec", vsec ? `${vsec} V` : "—");
  setText("tc-vis-kva",  kva  ? `${kva} kVA` : "—");

  // Phase badge
  const badge = document.getElementById("tc-vis-phase");
  if (badge) {
    badge.textContent = phase === "3" ? "3Ø" : "1Ø";
    const is240 = vpri === 240;
    badge.classList.toggle("tc-vis-phase--toggle", is240);
    badge.disabled = !is240;
  }
}

/** Populate wire sizes, required amps, and FLA labels on the diagram. */
function updateVisualResults(r) {
  // Primary OCPD
  setText("tc-vis-pri-ocpd", r.priOCPD != null ? `${r.priOCPD} A` : "—");
  // Primary wire
  setText("tc-vis-pri-wire-size", r.priWire ? `#${r.priWire} AWG Cu THWN` : "—");
  setText("tc-vis-pri-wire-req",  r.priWire ? `${fmt(r.priWireAmps)} A req.` : "");
  setText("tc-vis-pri-fla",       `${fmt(r.ipri, 2)} A FLA`);
  // Secondary OCPD
  const secBox = document.getElementById("tc-vis-sec-ocpd-box");
  if (secBox) secBox.classList.toggle("tc-vis-ocpd--dim", r.secOCPD == null);
  setText("tc-vis-sec-ocpd", r.secOCPD != null ? `${r.secOCPD} A` : "N/A");
  // Secondary wire
  setText("tc-vis-sec-wire-size", r.secWire ? `#${r.secWire} AWG Cu THWN` : "—");
  setText("tc-vis-sec-wire-req",  r.secWire ? `${fmt(r.secWireAmps)} A req.` : "");
  setText("tc-vis-sec-fla",       `${fmt(r.isec, 2)} A FLA`);
}

/** Reset all computed labels on the diagram back to placeholder dashes. */
function clearVisualResults() {
  setText("tc-vis-pri-ocpd", "—");
  setText("tc-vis-pri-wire-size", "—");
  setText("tc-vis-pri-wire-req",  "");
  setText("tc-vis-pri-fla",       "—");
  setText("tc-vis-sec-ocpd", "—");
  setText("tc-vis-sec-wire-size", "—");
  setText("tc-vis-sec-wire-req",  "");
  setText("tc-vis-sec-fla",       "—");
  const secBox = document.getElementById("tc-vis-sec-ocpd-box");
  if (secBox) secBox.classList.remove("tc-vis-ocpd--dim");
}

// ─────────────────────────────────────────────────────────────────────────────
// Render results cards
// ─────────────────────────────────────────────────────────────────────────────

function renderResults(r) {
  // Currents
  setText("tc-ipri",  r.ipri  != null ? `${fmt(r.ipri,  2)} A` : "—");
  setText("tc-isec",  r.isec  != null ? `${fmt(r.isec,  2)} A` : "—");
  setText("tc-ratio", r.ratio != null ? `${fmt(r.ratio, 3)} : 1` : "—");

  // OCPD
  setText("tc-pri-ocpd",      r.priOCPD   != null ? `${r.priOCPD} A` : "—");
  setText("tc-pri-ocpd-pct",  r.priPct);
  setText("tc-pri-ocpd-pct2", r.priPct);
  setText("tc-sec-ocpd",      r.secOCPDLabel);
  setText("tc-sec-ocpd-pct",  r.secOCPD != null ? r.secPct : "—");
  setText("tc-pri-ocpd-ws",   r.priOCPD_ws != null ? `${r.priOCPD_ws} A` : "—");

  // Conductors
  setText("tc-pri-wire",      r.priWire ? `#${r.priWire} AWG Cu THWN` : "—");
  setText("tc-pri-wire-amps", r.priWire ? `${AMPACITY[r.priWire]} A rated  /  ${fmt(r.priWireAmps)} A req.` : "—");
  setText("tc-sec-wire",      r.secWire ? `#${r.secWire} AWG Cu THWN` : "—");
  setText("tc-sec-wire-amps", r.secWire ? `${AMPACITY[r.secWire]} A rated  /  ${fmt(r.secWireAmps)} A req.` : "—");
  setText("tc-tap-note", r.tapNote);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tap descriptions
// ─────────────────────────────────────────────────────────────────────────────

const TAP_DESCS = {
  "at-terminals": "OCPD installed at the transformer secondary terminals. Most common installation. [NEC 450.3, T450.3(B)]",
  "primary-ocpd": "Secondary conductors run from the transformer to a remote panelboard and are protected solely by the primary OCPD — no OCPD at the transformer secondary is required. [NEC 240.21(C)(1)]",
  "10ft":         "Secondary conductors extend ≤ 10 ft from the transformer. Must be in raceway, no splices, terminate in a single OCPD. [NEC 240.21(C)(2)]",
  "25ft":         "Secondary conductors extend ≤ 25 ft from the transformer. Must be in raceway, protected from physical damage, no splices, terminate in a single OCPD. [NEC 240.21(C)(3)]",
};

function updateTapDesc(tap) {
  setText("tc-tap-desc", TAP_DESCS[tap] ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Update — called on every input change
// ─────────────────────────────────────────────────────────────────────────────

function update() {
  const vpri   = parseFloat(document.getElementById("tc-vpri")?.value);
  const vsecEl = document.getElementById("tc-vsec");
  const vsec   = parseFloat(vsecEl?.value);
  const kva    = parseFloat(document.getElementById("tc-kva")?.value);
  const tap    = document.getElementById("tc-tap-option")?.value ?? "at-terminals";

  // Reset phase override whenever the primary voltage moves away from 240 V
  if (vpri !== 240) phaseOverride = null;
  const phase = getPhase(vpri);

  // Determine if selected secondary voltage is L-N
  const selectedSecOpt = vsecEl?.options[vsecEl.selectedIndex];
  const secLN = selectedSecOpt?.dataset.ln === "true";

  // Mark kVA field error if empty/invalid
  const kvaEl = document.getElementById("tc-kva");
  if (kvaEl) kvaEl.classList.toggle("tc-error", !kva || kva <= 0);

  // Always update static visual labels
  updateVisualLabels(kva || null, vpri || null, vsec || null, phase);

  const valid = kva > 0 && vpri > 0 && vsec > 0;
  if (valid) {
    const r = calculate(kva, vpri, vsec, phase, secLN, tap);
    renderResults(r);
    updateVisualResults(r);
    showResults(true);
  } else {
    clearVisualResults();
    showResults(false);
  }

  updateTapDesc(tap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function init(_necData) {
  // Populate primary voltage dropdown
  const vpriSel = getEl("tc-vpri");
  if (vpriSel) {
    PRI_VOLTAGES.forEach(v => {
      const o = document.createElement("option");
      o.value = v.value;
      o.textContent = v.label;
      vpriSel.appendChild(o);
    });
    vpriSel.value = "480";
  }

  // Populate secondary voltage dropdown
  const vsecSel = getEl("tc-vsec");
  if (vsecSel) {
    SEC_VOLTAGES.forEach(v => {
      const o = document.createElement("option");
      o.value = v.value;
      o.textContent = v.label;
      if (v.ln) o.dataset.ln = "true";
      vsecSel.appendChild(o);
    });
    vsecSel.value = "208";
  }

  // Wire up all inputs for live updates
  ["tc-kva", "tc-vpri", "tc-vsec", "tc-tap-option"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", update);
    document.getElementById(id)?.addEventListener("input",  update);
  });

  // Phase toggle badge (only active for 240 V primary)
  document.getElementById("tc-vis-phase")?.addEventListener("click", () => {
    const vpri = parseFloat(document.getElementById("tc-vpri")?.value);
    if (vpri !== 240) return;
    phaseOverride = getPhase(vpri) === "1" ? "3" : "1";
    update();
  });

  // Initial state (no kVA entered yet)
  updateVisualLabels(null, 480, 208, "3");
  updateTapDesc("at-terminals");
}
