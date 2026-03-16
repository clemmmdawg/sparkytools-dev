/**
 * @file ohms-law.js
 * @description Ohm's Law Calculator
 *
 * Solves for all four electrical quantities (P, I, V, R) given any two inputs.
 */

const FIELDS = [
  { id: "ol-V", key: "V" },
  { id: "ol-I", key: "I" },
  { id: "ol-R", key: "R" },
  { id: "ol-P", key: "P" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const v = parseFloat(el.value);
  return (isFinite(v) && v > 0) ? v : null;
}

function fmtVal(n) {
  if (n == null) return "";
  // Use plain numeric strings — "k" suffix is rejected by type="number" inputs
  if (n >= 100) return parseFloat(n.toPrecision(4)).toString();
  return parseFloat(n.toPrecision(3)).toString();
}

/**
 * Given up to 4 quantities (null = unknown), solve for all 4.
 * Returns null if fewer than 2 valid inputs or the result contains invalid values.
 */
function solve(V, I, R, P) {
  if ([V, I, R, P].filter(v => v != null).length < 2) return null;

  let v = V, i = I, r = R, p = P;

  if (v != null && i != null) { r = r ?? v / i;           p = p ?? v * i;          }
  if (v != null && r != null) { i = i ?? v / r;           p = p ?? (v * v) / r;    }
  if (v != null && p != null) { i = i ?? p / v;           r = r ?? (v * v) / p;    }
  if (i != null && r != null) { v = v ?? i * r;           p = p ?? i * i * r;      }
  if (i != null && p != null) { v = v ?? p / i;           r = r ?? p / (i * i);    }
  if (r != null && p != null) { i = i ?? Math.sqrt(p / r); v = v ?? Math.sqrt(p * r); }

  if (![v, i, r, p].every(x => x != null && isFinite(x) && x > 0)) return null;
  return { V: v, I: i, R: r, P: p };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function showStatus(msg, cls) {
  const el = document.getElementById("ol-status");
  if (!el) return;
  el.textContent = msg;
  el.className = "ol-status " + (cls || "");
}

function clearField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = "";
  el.classList.remove("ol-derived");
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

function calculate() {
  const vals = {};
  for (const f of FIELDS) vals[f.key] = getVal(f.id);

  // Clear any previous derived highlights
  FIELDS.forEach(f => document.getElementById(f.id)?.classList.remove("ol-derived"));

  const filled = Object.values(vals).filter(v => v != null).length;
  if (filled < 2) {
    showStatus("Enter any two values, then press Calculate.", "ol-status--hint");
    return;
  }

  const result = solve(vals.V, vals.I, vals.R, vals.P);
  if (!result) {
    showStatus("Invalid combination — check your values.", "ol-status--error");
    return;
  }

  for (const f of FIELDS) {
    const el = document.getElementById(f.id);
    if (!el) continue;
    const wasDerived = vals[f.key] == null;
    el.value = fmtVal(result[f.key]);
    el.classList.toggle("ol-derived", wasDerived);
  }

  showStatus("", "");
}

function clearAll() {
  FIELDS.forEach(f => clearField(f.id));
  showStatus("", "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function init(_necData) {
  document.querySelectorAll(".ol-clear-field").forEach(btn => {
    btn.addEventListener("click", () => clearField(btn.dataset.target));
  });

  document.getElementById("ol-calc-btn")?.addEventListener("click", calculate);
  document.getElementById("ol-clear-btn")?.addEventListener("click", clearAll);

  FIELDS.forEach(f => {
    document.getElementById(f.id)
      ?.addEventListener("keydown", e => { if (e.key === "Enter") calculate(); });
  });
}
