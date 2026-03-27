/**
 * @file motor.js
 * @description Motor Circuit Calculator — NEC 430
 *
 * Tables used:
 *   T430.248 — Single-phase AC motor full-load current
 *   T430.250 — Three-phase AC motor full-load current
 *   T430.52  — Maximum OCPD ratings (% of FLA by motor/device type)
 *
 * NEC references:
 *   430.22  — Branch-circuit conductors: min 125% FLA
 *   T430.52 — Max OCPD percentage ratings
 *   430.32  — Overload protection: max 125% (SF ≥ 1.15) or 115% (SF < 1.15)
 *   240.6(A) — Standard OCPD sizes (round up)
 */

import { getEl } from '../utils/formatting.js';

// ─────────────────────────────────────────────────────────────────────────────
// NEC Tables
// ─────────────────────────────────────────────────────────────────────────────

/** NEC T430.248 — Single-Phase AC Motor FLA by voltage */
const TABLE_248 = {
  "115": { "1/6":4.4, "1/4":5.8, "1/3":7.2, "1/2":9.8, "3/4":13.8, "1":16,  "1.5":20,   "2":24,   "3":34,   "5":56,   "7.5":80,  "10":100  },
  "200": { "1/6":2.5, "1/4":3.3, "1/3":4.1, "1/2":5.6, "3/4":7.9,  "1":9.2, "1.5":11.5, "2":13.8, "3":19.6, "5":32.2, "7.5":46,  "10":57.5 },
  "208": { "1/6":2.4, "1/4":3.2, "1/3":4.0, "1/2":5.4, "3/4":7.6,  "1":8.8, "1.5":11.0, "2":13.2, "3":18.7, "5":30.8, "7.5":44,  "10":55   },
  "230": { "1/6":2.2, "1/4":2.9, "1/3":3.6, "1/2":4.9, "3/4":6.9,  "1":8,   "1.5":10,   "2":12,   "3":17,   "5":28,   "7.5":40,  "10":50   },
};
const HP_ORDER_1PH  = ["1/6","1/4","1/3","1/2","3/4","1","1.5","2","3","5","7.5","10"];
const VOLTAGES_1PH  = [115, 200, 208, 230];

/** NEC T430.250 — Three-Phase AC Motor FLA by voltage */
const TABLE_250 = {
  "200": { "1/2":2.5, "3/4":3.7, "1":4.8, "1.5":6.9,  "2":7.8,  "3":11,   "5":17.5, "7.5":25.3, "10":32.2, "15":48.3, "20":62,  "25":78.2, "30":92,  "40":120, "50":150, "60":177, "75":221, "100":285, "125":359, "150":414, "200":552 },
  "208": { "1/2":2.4, "3/4":3.5, "1":4.6, "1.5":6.6,  "2":7.5,  "3":10.6, "5":16.7, "7.5":24.2, "10":30.8, "15":46.2, "20":59.4,"25":74.8, "30":88,  "40":114, "50":143, "60":169, "75":211, "100":273, "125":343, "150":396, "200":528 },
  "230": { "1/2":2.2, "3/4":3.2, "1":4.2, "1.5":6.0,  "2":6.8,  "3":9.6,  "5":15.2, "7.5":22,   "10":28,   "15":42,   "20":54,  "25":68,   "30":80,  "40":104, "50":130, "60":154, "75":192, "100":248, "125":312, "150":360, "200":480 },
  "460": { "1/2":1.1, "3/4":1.6, "1":2.1, "1.5":3.0,  "2":3.4,  "3":4.8,  "5":7.6,  "7.5":11,   "10":14,   "15":21,   "20":27,  "25":34,   "30":40,  "40":52,  "50":65,  "60":77,  "75":96,  "100":124, "125":156, "150":180, "200":240 },
};
const HP_ORDER_3PH  = ["1/2","3/4","1","1.5","2","3","5","7.5","10","15","20","25","30","40","50","60","75","100","125","150","200"];
const VOLTAGES_3PH  = [200, 208, 230, 460];

/**
 * NEC T430.52 — Maximum OCPD rating as % of FLA.
 * Key: motor type (SC = squirrel-cage, WR = wound-rotor)
 * Sub-key: device type (NTD, DE, ITC, ITB)
 */
const TABLE_452 = {
  SC: { NTD: 300, DE: 175, ITC: 800, ITB: 250 },
  WR: { NTD: 150, DE: 150, ITC: 800, ITB: 150 },
};

/** NEC T310.16 — 75°C Cu THWN allowable ampacity in conduit */
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
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Next standard OCPD at or above `amps`. */
function nextOCPD(amps) { return STD_OCPD.find(s => s >= amps) ?? null; }

/** Smallest conductor whose 75°C ampacity ≥ `amps`. */
function minWire(amps)  { return WIRE_ORDER.find(w => (AMPACITY[w] ?? 0) >= amps) ?? null; }

/** Format number — strip trailing zeros, cap at `dp` decimal places. */
function fmt(v, dp = 1) {
  if (v == null || isNaN(v)) return "—";
  return parseFloat(v.toFixed(dp)).toString();
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} fla       - Full-load amps from NEC table
 * @param {string} motorType - "SC" or "WR"
 * @param {string} ocpdType  - "NTD" | "DE" | "ITC" | "ITB"
 * @returns {object}
 */
function calculate(fla, motorType, ocpdType) {
  // NEC 430.22 — Branch-circuit conductor: min 125% FLA
  const condAmps = fla * 1.25;
  const conductor = minWire(condAmps);

  // NEC T430.52 — Maximum OCPD (% of FLA, round up to next standard size)
  const ocpdPct  = TABLE_452[motorType][ocpdType];
  const ocpdAmps = fla * (ocpdPct / 100);
  const ocpd     = nextOCPD(ocpdAmps);

  // NEC 430.32 — Overload relay maximum trip setting
  const olAmps_125 = fla * 1.25; // motors with SF ≥ 1.15 or temp rise ≤ 40°C
  const olAmps_115 = fla * 1.15; // all others (SF < 1.15)

  return {
    fla,
    condAmps,
    conductor,
    condRated: conductor ? AMPACITY[conductor] : null,
    ocpdPct,
    ocpdAmps,
    ocpd,
    olAmps_125,
    olAmps_115,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Populate dropdowns based on phase selection
// ─────────────────────────────────────────────────────────────────────────────

function populateVoltageAndHP() {
  const phase     = document.getElementById("mc-phase")?.value ?? "3";
  const voltageEl = document.getElementById("mc-voltage");
  const hpEl      = document.getElementById("mc-hp");
  if (!voltageEl || !hpEl) return;

  const prevVoltage = voltageEl.value;
  const prevHP      = hpEl.value;

  const voltages = phase === "1" ? VOLTAGES_1PH : VOLTAGES_3PH;
  const hpOrder  = phase === "1" ? HP_ORDER_1PH  : HP_ORDER_3PH;

  voltageEl.innerHTML = voltages
    .map(v => `<option value="${v}"${String(v) === prevVoltage ? " selected" : ""}>${v} V</option>`)
    .join("");
  // Default to 460 V for 3Ø, 115 V for 1Ø when previous voltage isn't valid
  if (!voltages.includes(parseInt(prevVoltage))) {
    voltageEl.value = phase === "1" ? "115" : "460";
  }

  hpEl.innerHTML = hpOrder
    .map(hp => `<option value="${hp}"${hp === prevHP ? " selected" : ""}>${hp} HP</option>`)
    .join("");
  if (!hpOrder.includes(prevHP)) hpEl.value = "5";
}

// ─────────────────────────────────────────────────────────────────────────────
// Update — called on every input change
// ─────────────────────────────────────────────────────────────────────────────

function update() {
  const phase     = document.getElementById("mc-phase")?.value;
  const voltage   = document.getElementById("mc-voltage")?.value;
  const hp        = document.getElementById("mc-hp")?.value;
  const motorType = document.getElementById("mc-motor-type")?.value ?? "SC";
  const ocpdType  = document.getElementById("mc-ocpd-type")?.value ?? "NTD";

  if (!phase || !voltage || !hp) return;

  const table = phase === "1" ? TABLE_248 : TABLE_250;
  const fla   = table[voltage]?.[hp];

  if (!fla) {
    setText("mc-fla", "—");
    getEl("mc-results")?.classList.remove("visible");
    return;
  }

  const r = calculate(fla, motorType, ocpdType);

  // FLA banner
  setText("mc-fla", `${fmt(fla, 1)} A`);

  // Conductor card
  setText("mc-cond-wire",  r.conductor ? `#${r.conductor} AWG Cu THWN` : "—");
  setText("mc-cond-rated", r.condRated ? `${r.condRated} A` : "—");
  setText("mc-cond-req",   `${fmt(r.condAmps)} A min.`);

  // OCPD card
  setText("mc-ocpd-val",        r.ocpd ? `${r.ocpd} A` : "—");
  setText("mc-ocpd-calc",       `${fmt(r.ocpdAmps)} A (${r.ocpdPct}% × FLA)`);
  const ocpdSel = document.getElementById("mc-ocpd-type");
  setText("mc-ocpd-type-label", ocpdSel?.options[ocpdSel.selectedIndex]?.text ?? "");

  // Overload card
  setText("mc-ol-125", `≤ ${fmt(r.olAmps_125)} A`);
  setText("mc-ol-115", `≤ ${fmt(r.olAmps_115)} A`);

  getEl("mc-results")?.classList.add("visible");
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

export function init(_necData) {
  if (!getEl("mc-phase")) return; // section not in DOM

  populateVoltageAndHP();

  document.getElementById("mc-phase")?.addEventListener("change", () => {
    populateVoltageAndHP();
    update();
  });

  ["mc-voltage", "mc-hp", "mc-motor-type", "mc-ocpd-type"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", update);
  });

  update();
}
