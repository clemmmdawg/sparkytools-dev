/**
 * @file ohms-law.js
 * @description Ohm's Law / Power Wheel Calculator
 *
 * Solves for all four electrical quantities (P, I, V, R) given any two inputs.
 * Features an interactive SVG power wheel showing formulas for each variable pair.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Wheel geometry constants
// ─────────────────────────────────────────────────────────────────────────────

const CX = 160, CY = 160;        // SVG center
const R_INNER   = 70;            // inner circle (input overlay area)
const R_FORMULA = 116;           // formula ring outer edge
const R_LABEL   = 156;           // label ring outer edge

// Quadrant definitions (start angle, color class, label)
// Angles in degrees, 0 = right (3 o'clock), going clockwise
// Layout: P=top-left (225°-315°), I=top-right (315°-45°), R=bottom-right (45°-135°), V=bottom-left (135°-225°)
const QUADS = [
  { id: "P", label: "WATTS",  cls: "ow-seg-p", start: 225, end: 315 },
  { id: "I", label: "AMPS",   cls: "ow-seg-i", start: 315, end: 45  },
  { id: "R", label: "OHMS",   cls: "ow-seg-r", start: 45,  end: 135 },
  { id: "V", label: "VOLTS",  cls: "ow-seg-v", start: 135, end: 225 },
];

// Formulas for each quadrant (3 segments each, evenly dividing the 90° quadrant)
// formulas[quadId] = [formula at +0°, +30°, +60°] within the quadrant
const FORMULAS = {
  P: ["V² / R", "V × I", "I² × R"],
  I: ["V / R",  "P / V", "√(P/R)"],
  R: ["V / I",  "V²/ P", "P / I²"],
  V: ["I × R",  "P / I", "√(P×R)"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

function deg2rad(d) { return d * Math.PI / 180; }

/** Polar to cartesian from SVG center */
function polar(r, deg) {
  const rad = deg2rad(deg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Build an SVG arc-sector path string */
function sectorPath(rInner, rOuter, startDeg, endDeg) {
  const p1 = polar(rOuter, startDeg);
  const p2 = polar(rOuter, endDeg);
  const p3 = polar(rInner, endDeg);
  const p4 = polar(rInner, startDeg);
  const large = (endDeg - startDeg + 360) % 360 > 180 ? 1 : 0;
  return [
    `M ${p1.x},${p1.y}`,
    `A ${rOuter},${rOuter} 0 ${large},1 ${p2.x},${p2.y}`,
    `L ${p3.x},${p3.y}`,
    `A ${rInner},${rInner} 0 ${large},0 ${p4.x},${p4.y}`,
    "Z"
  ].join(" ");
}

/** Normalise angle into [0, 360) */
function normDeg(d) { return ((d % 360) + 360) % 360; }

// ─────────────────────────────────────────────────────────────────────────────
// SVG wheel construction
// ─────────────────────────────────────────────────────────────────────────────

function buildWheel() {
  const svg = document.getElementById("ow-svg");
  if (!svg) return;

  // Clear any previously generated content (keep <defs> if present)
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const ns = "http://www.w3.org/2000/svg";

  function el(tag, attrs, text) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ── Formula segments (inner ring: R_INNER → R_FORMULA) ──
  for (const quad of QUADS) {
    const span   = normDeg(quad.end - quad.start);  // should be 90
    const segSpan = span / 3;
    for (let i = 0; i < 3; i++) {
      const s = normDeg(quad.start + i * segSpan);
      const e = normDeg(quad.start + (i + 1) * segSpan);

      // Sector background
      const path = el("path", {
        d:     sectorPath(R_INNER + 2, R_FORMULA - 1, s, e),
        class: `ow-formula-seg ${quad.cls}`,
      });
      svg.appendChild(path);

      // Formula text — placed at arc midpoint
      const midDeg = normDeg(s + segSpan / 2);
      const rText  = (R_INNER + 2 + R_FORMULA - 1) / 2;
      const pos    = polar(rText, midDeg);

      // Rotate text to follow arc; flip if in lower half so it's never upside-down
      let rot = midDeg;
      const normMid = normDeg(midDeg);
      if (normMid > 90 && normMid < 270) rot += 180;

      const txt = el("text", {
        x:         pos.x,
        y:         pos.y,
        class:     "ow-formula-text",
        transform: `rotate(${rot},${pos.x},${pos.y})`,
        "text-anchor":    "middle",
        "dominant-baseline": "central",
      }, FORMULAS[quad.id][i]);
      svg.appendChild(txt);
    }
  }

  // ── Label segments (outer ring: R_FORMULA → R_LABEL) ──
  for (const quad of QUADS) {
    const s = quad.start;
    const e = quad.end;
    const path = el("path", {
      d:     sectorPath(R_FORMULA, R_LABEL, s, e),
      class: `ow-label-seg ${quad.cls}`,
    });
    svg.appendChild(path);

    // Label text at arc midpoint
    const midDeg = normDeg(s + normDeg(e - s) / 2);
    const rText  = (R_FORMULA + R_LABEL) / 2;
    const pos    = polar(rText, midDeg);

    let rot = midDeg;
    const normMid = normDeg(midDeg);
    if (normMid > 90 && normMid < 270) rot += 180;

    // Quantity letter
    const letter = el("text", {
      x:         pos.x,
      y:         pos.y - 7,
      class:     `ow-label-letter ${quad.cls}`,
      transform: `rotate(${rot},${pos.x},${pos.y})`,
      "text-anchor":    "middle",
      "dominant-baseline": "central",
    }, quad.id);
    svg.appendChild(letter);

    // Unit label
    const unit = el("text", {
      x:         pos.x,
      y:         pos.y + 7,
      class:     "ow-label-unit",
      transform: `rotate(${rot},${pos.x},${pos.y})`,
      "text-anchor":    "middle",
      "dominant-baseline": "central",
    }, quad.label);
    svg.appendChild(unit);
  }

  // ── Inner circle (white/card-bg disc to create ring effect) ──
  svg.appendChild(el("circle", {
    cx: CX, cy: CY, r: R_INNER,
    class: "ow-inner-circle",
  }));

  // ── Thin spoke dividers between quadrants ──
  for (const quad of QUADS) {
    const p1 = polar(R_INNER + 2, quad.start);
    const p2 = polar(R_LABEL,      quad.start);
    svg.appendChild(el("line", {
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      class: "ow-spoke",
    }));
  }

  // ── Center dot ──
  svg.appendChild(el("circle", {
    cx: CX, cy: CY, r: 3,
    class: "ow-center-dot",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given exactly 2 of the 4 quantities (P, I, V, R), solve for all 4.
 * Returns null if fewer than 2 are provided or values are invalid.
 */
function solve(P, I, V, R) {
  const vals = [P, I, V, R].filter(v => v != null && isFinite(v) && v > 0);
  if (vals.length < 2) return null;

  let p = P, i = I, v = V, r = R;

  // Derive missing from whichever pair exists
  if (p != null && i != null) { v = v ?? p / i;          r = r ?? p / (i * i);    }
  if (p != null && v != null) { i = i ?? p / v;          r = r ?? (v * v) / p;    }
  if (p != null && r != null) { i = i ?? Math.sqrt(p/r); v = v ?? Math.sqrt(p*r); }
  if (i != null && v != null) { p = p ?? i * v;          r = r ?? v / i;          }
  if (i != null && r != null) { v = v ?? i * r;          p = p ?? i * i * r;      }
  if (v != null && r != null) { i = i ?? v / r;          p = p ?? (v * v) / r;    }

  // Validate all derived values are positive finite numbers
  if (![p, i, v, r].every(x => x != null && isFinite(x) && x > 0)) return null;

  return { P: p, I: i, V: v, R: r };
}

function fmtVal(n) {
  if (n == null) return "—";
  if (n >= 1000) return (n / 1000).toPrecision(4).replace(/\.?0+$/, "") + "k";
  if (n >= 100)  return n.toPrecision(4).replace(/\.?0+$/, "");
  if (n >= 10)   return n.toPrecision(3).replace(/\.?0+$/, "");
  return n.toPrecision(3).replace(/\.?0+$/, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_IDS = ["ow-P", "ow-I", "ow-V", "ow-R"];

function getInputVal(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const v = parseFloat(el.value);
  return (isFinite(v) && v > 0) ? v : null;
}

function setInputVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  // Only set if not already a user-typed value (i.e., it was empty)
  if (el.dataset.derived === "true" || el.value === "") {
    el.value = val != null ? fmtVal(val) : "";
    el.dataset.derived = val != null ? "true" : "false";
  }
}

function markError(id, hasError) {
  const el = document.getElementById(id);
  if (el) el.classList.toggle("ow-error", hasError);
}

function calculate() {
  const P = getInputVal("ow-P");
  const I = getInputVal("ow-I");
  const V = getInputVal("ow-V");
  const R = getInputVal("ow-R");

  const filled = [P, I, V, R].filter(v => v != null).length;

  // Clear previous error states
  INPUT_IDS.forEach(id => markError(id, false));

  if (filled < 2) {
    showStatus("Enter any two values, then click Calculate.", "ow-status--hint");
    return;
  }

  const result = solve(P, I, V, R);
  if (!result) {
    showStatus("Check your values — the combination may be invalid.", "ow-status--error");
    INPUT_IDS.forEach(id => {
      if (getInputVal(id) != null) markError(id, true);
    });
    return;
  }

  // Fill in derived values
  const ids = { P: "ow-P", I: "ow-I", V: "ow-V", R: "ow-R" };
  for (const [key, id] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (!el) continue;
    // Mark previously empty fields as derived
    if (el.value === "" || el.dataset.derived === "true") {
      el.value = fmtVal(result[key]);
      el.dataset.derived = "true";
    }
  }

  showStatus("", "");
}

function clearAll() {
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.derived = "false";
      el.classList.remove("ow-error");
    }
  });
  showStatus("", "");
}

function showStatus(msg, cls) {
  const el = document.getElementById("ow-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "ow-status " + (cls || "");
}

// When user types in a field, clear its derived flag
function onInput(e) {
  e.target.dataset.derived = "false";
  e.target.classList.remove("ow-error");
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function init(_necData) {
  buildWheel();

  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", onInput);
  });

  const calcBtn  = document.getElementById("ow-calc-btn");
  const clearBtn = document.getElementById("ow-clear-btn");
  if (calcBtn)  calcBtn.addEventListener("click", calculate);
  if (clearBtn) clearBtn.addEventListener("click", clearAll);

  // Allow Enter key to trigger calculate
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("keydown", e => { if (e.key === "Enter") calculate(); });
  });
}
