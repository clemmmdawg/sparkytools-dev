/**
 * @file voltage-drop.js
 * @description Voltage Drop Calculator - NEC 210.19(A)(1) Informational Note
 * 
 * Formula: VD = (K × I × D × M) / CM
 * Recommendation: ≤3% for branch circuits
 */

import { setStatus, getEl, formatNumber } from '../utils/formatting.js';

let necData = null;

/**
 * Initializes the voltage drop calculator with NEC data
 * @param {Object} data - NEC data object
 */
export function init(data) {
  necData = data;

  const vdMaterial = getEl("vd-material");
  const vdSize = getEl("vd-size");

  if (vdMaterial && vdSize) {
    const populateVdSizes = () => {
      const isAL = vdMaterial.value === "AL";
      vdSize.innerHTML = "";
      necData.conductors.wireSizeOrder.forEach(s => {
        // Skip #14 for aluminum (not valid for most circuits)
        if (isAL && s === "14") return;
        vdSize.add(new Option(`#${s}`, s));
      });
      // Default to common branch-circuit size
      vdSize.value = isAL ? "10" : "12";
      calculate();
    };

    vdMaterial.addEventListener("change", populateVdSizes);
    document.querySelectorAll("#vd-size, #vd-voltage, #vd-phase, #vd-amps, #vd-dist")
      .forEach(el => el.addEventListener("input", calculate));
    populateVdSizes();
  }
}

/**
 * Main calculation function for voltage drop
 */
export function calculate() {
  const materialEl = getEl("vd-material");
  const sizeEl = getEl("vd-size");
  const voltageEl = getEl("vd-voltage");
  const phaseEl = getEl("vd-phase");
  const ampsEl = getEl("vd-amps");
  const distEl = getEl("vd-dist");
  if (!materialEl || !sizeEl || !voltageEl || !phaseEl || !ampsEl || !distEl) return;

  const material = materialEl.value;
  const size = sizeEl.value;
  const voltage = parseFloat(voltageEl.value);
  const M = necData.conductors.phaseMultiplier[phaseEl.value];
  const amps = parseFloat(ampsEl.value) || 0;
  const dist = parseFloat(distEl.value) || 0;

  const K = necData.conductors.kFactors[material];
  const CM = necData.conductors.circularMils[size];
  if (!CM || !M) return;

  // Calculate voltage drop
  const drop = (M * K * amps * dist) / CM;
  const dropPercent = voltage ? (drop / voltage) * 100 : 0;

  const totalEl = getEl("vd-total");
  const percentEl = getEl("vd-percent");
  const statusEl = getEl("vd-status");

  if (totalEl) totalEl.textContent = `${formatNumber(drop)} V`;
  if (percentEl) percentEl.textContent = `${formatNumber(dropPercent)}%`;
  setStatus(statusEl, dropPercent > 3, "WITHIN NEC RECOMMENDATION (≤3%)", "EXCEEDS 3% RECOMMENDATION");

  // Max length at ≤3% drop
  const maxLengthEl = getEl("vd-max-length");
  if (maxLengthEl) {
    if (amps > 0 && voltage > 0) {
      const maxLen = (0.03 * voltage * CM) / (M * K * amps);
      maxLengthEl.textContent = `${Math.floor(maxLen)} ft`;
    } else {
      maxLengthEl.textContent = "-- ft";
    }
  }

  // Recommended wire size
  const recSizeEl = getEl("vd-rec-size");
  if (recSizeEl) {
    if (amps > 0 && dist > 0 && voltage > 0) {
      const cmMin = (M * K * amps * dist) / (0.03 * voltage);
      const isAL = material === "AL";

      const rec = necData.conductors.wireSizeOrder.find(s => {
        if (isAL && s === "14") return false;
        return (necData.conductors.circularMils[s] ?? 0) >= cmMin;
      });

      recSizeEl.textContent = rec ? `#${rec}` : "Too large";
      const selectedIdx = necData.conductors.wireSizeOrder.indexOf(size);
      const recommendIdx = rec ? necData.conductors.wireSizeOrder.indexOf(rec) : Infinity;
      recSizeEl.style.color = recommendIdx > selectedIdx ? "var(--danger)" : "var(--success)";
    } else {
      recSizeEl.textContent = "--";
      recSizeEl.style.color = "";
    }
  }
}
