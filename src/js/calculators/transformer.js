/**
 * @file transformer.js
 * @description Transformer Calculator
 *
 * Given kVA, primary voltage, secondary voltage, and phase the calculator
 * provides live results for:
 *   - Primary and secondary full-load current
 *   - Primary OCPD per NEC T450.3(B)
 *   - Secondary OCPD per NEC T450.3(B)
 *   - Primary conductor size per NEC T310.16 (75°C Cu THWN)
 *   - Secondary conductor size per NEC T310.16 (75°C Cu THWN)
 *   - Secondary conductor tap rule per NEC 240.21(C)
 *
 * Results update live on every input change.
 */

import { getEl, getCSSVar } from '../utils/formatting.js';

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
  // Primary-only protection: ≤125% (FLA ≥ 9A) or ≤167% (FLA < 9A)
  const priPct       = ipri >= 9 ? 1.25 : 1.67;
  const priOCPD      = nextOCPD(ipri * priPct);

  // Secondary OCPD: ≤125% (FLA ≥ 9A) or ≤167% (FLA < 9A)
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
  let secWireLabel = "";

  switch (tap) {
    case "at-terminals":
      secWireAmps  = isec * 1.25;
      tapNote      = `OCPD at secondary terminals — conductors sized ≥ 125% of secondary FLA (${fmt(isec)} A × 125% = ${fmt(secWireAmps)} A min).`;
      break;

    case "primary-ocpd":
      // 240.21(C)(1): secondary conductor ampacity × (Vsec/Vpri) ≥ primary OCPD rating
      // → sec conductor ampacity ≥ primary OCPD ÷ ratio = priOCPD × (Vsec/Vpri)
      {
        const reflected = priOCPD != null ? priOCPD / ratio : isec * 1.25;
        secWireAmps = Math.max(isec * 1.25, reflected);
        tapNote = `Protected by primary OCPD [NEC 240.21(C)(1)] — no secondary OCPD required at transformer. Secondary conductor ampacity ≥ primary OCPD (${priOCPD} A) ÷ turns ratio (${fmt(ratio, 2)}) = ${fmt(reflected)} A.`;
        secWireLabel = "No OCPD req.";
      }
      break;

    case "10ft":
      // 240.21(C)(2): conductor ampacity ≥ 1/10 of primary OCPD, single OCPD at far end
      {
        const tenPct = (priOCPD_ws ?? 0) * 0.10;
        secWireAmps  = Math.max(isec, tenPct);
        tapNote = `≤ 10 ft tap [NEC 240.21(C)(2)] — conductor ampacity ≥ 1/10 of primary OCPD (${priOCPD_ws} A × 10% = ${fmt(tenPct)} A). Must be in raceway, no splices, terminate in a single OCPD.`;
      }
      break;

    case "25ft":
      // 240.21(C)(3): conductor ampacity ≥ 1/3 of primary conductor ampacity
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
    secWireLabel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Line Diagram
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Draws a simplified line diagram:
 * [Pri OCPD] ─── [Pri Wire] ─── [Transformer] ─── [Sec Wire] ─── [Sec OCPD]
 */
function drawDiagram(r, kva, vpri, vsec, phase) {
  const svg = getEl("tc-svg");
  if (!svg) return;
  svg.innerHTML = "";

  const stroke      = getCSSVar("--svg-box-stroke");
  const dim         = getCSSVar("--svg-dim-color");
  const surfaceFill = getCSSVar("--svg-conduit-bg");
  const accentPri   = getCSSVar("--accent-blue").trim()  || "#5291cf";
  const accentSec   = getCSSVar("--accent-green").trim() || "#27ae60";
  const accentRed   = getCSSVar("--accent-red").trim()   || "#c0392b";
  const textColor   = stroke;

  const ns = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    (parent ?? svg).appendChild(e);
    return e;
  }

  const W = 560, H = 160;
  const midY = 62; // wire centerline

  // ── Zones (x centers) ────────────────────────────────────────────────────
  const Z = {
    priOCPD:  62,
    priWire:  168,
    xfmr:     280,
    secWire:  392,
    secOCPD:  498,
  };

  // Helper: add text with wrapping at a fixed width
  function label(lines, cx, y, color, size = "10", weight = "400", anchor = "middle") {
    lines.forEach((line, i) => {
      el("text", {
        x: cx, y: y + i * 13,
        fill: color,
        "font-size": size,
        "font-weight": weight,
        "font-family": "Inter, sans-serif",
        "text-anchor": anchor,
        "dominant-baseline": "auto",
      }).textContent = line;
    });
  }

  // ── Horizontal wire lines ─────────────────────────────────────────────────
  // Pri OCPD right edge → Pri wire left edge
  function hline(x1, x2, y, color, w = 1.8) {
    el("line", { x1, y1: y, x2, y2: y, stroke: color, "stroke-width": w, "stroke-linecap": "round" });
  }

  // Line: pri OCPD box right → xfmr left
  hline(Z.priOCPD + 22, Z.xfmr - 30, midY, accentPri);
  // Line: xfmr right → sec OCPD box left
  hline(Z.xfmr + 30, Z.secOCPD - 22, midY, accentSec);

  // ── Primary OCPD box ──────────────────────────────────────────────────────
  const bw = 44, bh = 28;
  el("rect", {
    x: Z.priOCPD - bw / 2, y: midY - bh / 2,
    width: bw, height: bh,
    fill: surfaceFill, stroke: accentRed,
    "stroke-width": "2", rx: "5",
  });
  label(["OCPD"], Z.priOCPD, midY - 6, accentRed, "9.5", "700");
  label([r ? `${r.priOCPD} A` : "—"], Z.priOCPD, midY + 7, accentRed, "9.5", "700");

  // Primary OCPD bottom label
  label(["Primary", "OCPD"], Z.priOCPD, midY + bh / 2 + 8, dim, "9");

  // ── Primary wire label ────────────────────────────────────────────────────
  const wireY = midY - 16;
  label(
    r && r.priWire ? [`#${r.priWire} AWG`, "Cu THWN"] : ["—"],
    Z.priWire, wireY, accentPri, "9.5", "600"
  );
  label([r ? `${fmt(r.priWireAmps)} A req.` : ""], Z.priWire, wireY + 26, dim, "8.5");

  // ── Transformer box ───────────────────────────────────────────────────────
  const tw = 60, th = 44;
  el("rect", {
    x: Z.xfmr - tw / 2, y: midY - th / 2,
    width: tw, height: th,
    fill: surfaceFill, stroke,
    "stroke-width": "2", rx: "6",
  });
  // Coil bumps on primary side (3 bumps, left of center line)
  const coilCX = Z.xfmr - 11, coilTop = midY - 14, coilBtm = midY + 14;
  const bumpR = (coilBtm - coilTop) / 6;
  let d = `M ${coilCX},${coilTop}`;
  for (let i = 0; i < 3; i++) {
    d += ` A ${bumpR} ${bumpR} 0 0 1 ${coilCX},${coilTop + bumpR * 2 * (i + 1)}`;
  }
  el("path", { d, stroke: accentPri, "stroke-width": "1.8", fill: "none" });

  // Center divider line
  el("line", {
    x1: Z.xfmr, y1: midY - th / 2 + 4,
    x2: Z.xfmr, y2: midY + th / 2 - 4,
    stroke: dim, "stroke-width": "1", "stroke-dasharray": "3 2",
  });

  // Coil bumps on secondary side (3 bumps, right of center line)
  const coilCX2 = Z.xfmr + 11;
  let d2 = `M ${coilCX2},${coilTop}`;
  for (let i = 0; i < 3; i++) {
    d2 += ` A ${bumpR} ${bumpR} 0 0 0 ${coilCX2},${coilTop + bumpR * 2 * (i + 1)}`;
  }
  el("path", { d: d2, stroke: accentSec, "stroke-width": "1.8", fill: "none" });

  // Transformer labels below box
  const kvaStr  = kva  ? `${kva} kVA`  : "— kVA";
  const phaseStr = phase === "3" ? "3Ø" : "1Ø";
  label([kvaStr, phaseStr], Z.xfmr, midY + th / 2 + 10, textColor, "9.5", "700");

  // Voltage labels above transformer
  const vpriStr = vpri ? `${vpri} V` : "—";
  const vsecStr = vsec ? `${vsec} V` : "—";
  label([vpriStr], Z.xfmr - 18, midY - th / 2 - 14, accentPri, "9.5", "600");
  label([vsecStr], Z.xfmr + 18, midY - th / 2 - 14, accentSec, "9.5", "600");

  // ── Secondary wire label ──────────────────────────────────────────────────
  label(
    r && r.secWire ? [`#${r.secWire} AWG`, "Cu THWN"] : ["—"],
    Z.secWire, wireY, accentSec, "9.5", "600"
  );
  label([r ? `${fmt(r.secWireAmps)} A req.` : ""], Z.secWire, wireY + 26, dim, "8.5");

  // ── Secondary OCPD box ────────────────────────────────────────────────────
  const secOCPDText = r
    ? (r.secOCPD != null ? `${r.secOCPD} A` : "N/A")
    : "—";
  const secOCPDColor = (r && r.secOCPD == null) ? dim : accentRed;

  el("rect", {
    x: Z.secOCPD - bw / 2, y: midY - bh / 2,
    width: bw, height: bh,
    fill: surfaceFill, stroke: secOCPDColor,
    "stroke-width": "2", rx: "5",
  });
  label(["OCPD"], Z.secOCPD, midY - 6, secOCPDColor, "9.5", "700");
  label([secOCPDText], Z.secOCPD, midY + 7, secOCPDColor, "9.5", "700");

  label(["Secondary", "OCPD"], Z.secOCPD, midY + bh / 2 + 8, dim, "9");

  // ── FLA labels below wire line ────────────────────────────────────────────
  const flaY = midY + 44;
  label(
    r ? [`${fmt(r.ipri, 2)} A FLA`] : ["—"],
    Z.priWire, flaY, accentPri, "9"
  );
  label(
    r ? [`${fmt(r.isec, 2)} A FLA`] : ["—"],
    Z.secWire, flaY, accentSec, "9"
  );
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
// Render
// ─────────────────────────────────────────────────────────────────────────────

function renderResults(r) {
  // Currents
  setText("tc-ipri", r.ipri != null ? `${fmt(r.ipri, 2)} A` : "—");
  setText("tc-isec", r.isec != null ? `${fmt(r.isec, 2)} A` : "—");
  setText("tc-ratio", r.ratio != null ? `${fmt(r.ratio, 3)} : 1` : "—");

  // OCPD
  setText("tc-pri-ocpd",     r.priOCPD   != null ? `${r.priOCPD} A`  : "—");
  setText("tc-pri-ocpd-pct", r.priPct);
  setText("tc-pri-ocpd-pct2", r.priPct);
  setText("tc-sec-ocpd",    r.secOCPDLabel);
  setText("tc-sec-ocpd-pct", r.secOCPD != null ? r.secPct : "—");
  setText("tc-pri-ocpd-ws", r.priOCPD_ws != null ? `${r.priOCPD_ws} A` : "—");

  // Conductors
  setText("tc-pri-wire",      r.priWire ? `#${r.priWire} AWG Cu THWN` : "—");
  setText("tc-pri-wire-amps", r.priWire ? `${AMPACITY[r.priWire]} A rated  /  ${fmt(r.priWireAmps)} A req.` : "—");
  setText("tc-sec-wire",      r.secWire ? `#${r.secWire} AWG Cu THWN` : "—");
  setText("tc-sec-wire-amps", r.secWire ? `${AMPACITY[r.secWire]} A rated  /  ${fmt(r.secWireAmps)} A req.` : "—");
  setText("tc-tap-note", r.tapNote);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update — called on every input change
// ─────────────────────────────────────────────────────────────────────────────

function update() {
  const kva   = parseFloat(document.getElementById("tc-kva")?.value);
  const vpri  = parseFloat(document.getElementById("tc-vpri")?.value);
  const vsecEl = document.getElementById("tc-vsec");
  const vsec  = parseFloat(vsecEl?.value);
  const phase = document.getElementById("tc-phase")?.value ?? "1";
  const tap   = document.getElementById("tc-tap-option")?.value ?? "at-terminals";

  // Determine if selected secondary voltage is L-N
  const selectedSecOpt = vsecEl?.options[vsecEl.selectedIndex];
  const secLN = selectedSecOpt?.dataset.ln === "true";

  // Mark kva field error if empty/invalid
  const kvaEl = document.getElementById("tc-kva");
  if (kvaEl) kvaEl.classList.toggle("tc-error", !kva || kva <= 0);

  const valid = kva > 0 && vpri > 0 && vsec > 0;

  if (valid) {
    const r = calculate(kva, vpri, vsec, phase, secLN, tap);
    renderResults(r);
    drawDiagram(r, kva, vpri, vsec, phase);
    showResults(true);
  } else {
    drawDiagram(null, kva || null, vpri || null, vsec || null, phase);
    showResults(false);
  }

  // Update tap description
  updateTapDesc(tap);
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
    vpriSel.value = "480"; // default: 480V primary
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
    vsecSel.value = "208"; // default: 208V secondary
  }

  // Wire up all inputs for live updates
  ["tc-kva", "tc-vpri", "tc-vsec", "tc-phase", "tc-tap-option"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", update);
    document.getElementById(id)?.addEventListener("input", update);
  });

  // Redraw on theme change
  document.addEventListener("themechange", update);

  // Initial draw (blank — no kVA entered yet)
  drawDiagram(null, 480, 208, "1");
  updateTapDesc("at-terminals");
}