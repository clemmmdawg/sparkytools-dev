/**
 * @file box-fill.js
 * @description Box Fill Calculator - NEC 314.16
 * 
 * Accounts for conductors, devices (yokes), clamps, and equipment grounds
 */

import { setStatus, getEl, formatNumber } from '../utils/formatting.js';

let necData = null;

/**
 * Initializes the box fill calculator with NEC data
 * @param {Object} data - NEC data object
 */
export function init(data) {
  necData = data;

  const boxSelect = getEl("box-select");
  const boxVolume = getEl("box-volume");
  const addBoxBtn = getEl("add-box-wire-btn");

  if (boxSelect && boxVolume) {
    boxSelect.addEventListener("change", e => {
      if (e.target.value !== "custom") boxVolume.value = e.target.value;
      calculate();
    });
  }

  document.querySelectorAll("#box-volume, #box-yokes, #box-clamps, #box-grounds")
    .forEach(el => el.addEventListener("input", calculate));

  if (addBoxBtn) addBoxBtn.addEventListener("click", addBoxWire);
  addBoxWire(); // Start with one wire row
}

/**
 * Main calculation function for box fill
 */
export function calculate() {
  const boxVolEl = getEl("box-volume");
  const yokesEl = getEl("box-yokes");
  const clampsEl = getEl("box-clamps");
  const groundsEl = getEl("box-grounds");
  if (!boxVolEl || !yokesEl || !clampsEl || !groundsEl) return;

  const boxVol = parseFloat(boxVolEl.value) || 0;
  const yokes = parseInt(yokesEl.value) || 0;
  const clampVal = parseInt(clampsEl.value);
  const groundVal = parseInt(groundsEl.value);

  let totalRequired = 0;
  let largestAWG = null;

  document.querySelectorAll(".box-wire-row").forEach(row => {
    const size = parseInt(row.querySelector(".bw-size").value);
    const qty = parseInt(row.querySelector(".bw-qty").value) || 0;
    const volPer = necData.boxfill.volumePerWire[size];
    if (!volPer || qty === 0) return;

    totalRequired += qty * volPer;
    row.querySelector(".unit-vol-label").textContent = `${volPer} in³`;
    if (largestAWG === null || size < largestAWG) largestAWG = size;
  });

  // Use largest conductor's volume for deductions (fall back to #14 if no wires added)
  const unitVol = necData.boxfill.volumePerWire[largestAWG] ?? necData.boxfill.volumePerWire[14];

  // NEC 314.16(B)(2): Each device = 2× unit volume
  totalRequired += yokes * 2 * unitVol;
  // NEC 314.16(B)(3): Internal clamps = 1 allowance per group
  if (clampVal > 0) totalRequired += clampVal * unitVol;
  // NEC 314.16(B)(5): All equipment grounds = 1 allowance
  if (groundVal > 0) totalRequired += unitVol;

  const reqEl = getEl("box-req-vol");
  const remEl = getEl("box-rem-vol");
  const statusEl = getEl("box-status");

  if (reqEl) reqEl.textContent = `${formatNumber(totalRequired)} in³`;
  if (remEl) remEl.textContent = `${formatNumber(boxVol - totalRequired)} in³`;
  setStatus(statusEl, totalRequired > boxVol, "CAPACITY OK", "BOX OVERFILLED");
}

/**
 * Adds a new conductor row to the box wire list
 */
export function addBoxWire() {
  const list = getEl("box-wire-list");
  if (!list) return;

  const row = document.createElement("div");
  row.className = "box-wire-row";

  // Descending sort: larger conductors first
  const sizeOpts = Object.keys(necData.boxfill.volumePerWire)
    .sort((a, b) => Number(b) - Number(a))
    .map(s => `<option value="${s}">#${s}</option>`)
    .join("");

  row.innerHTML = `
    <select class="bw-size" aria-label="Wire size">${sizeOpts}</select>
    <input type="number" class="bw-qty" value="1" min="1" aria-label="Quantity">
    <span class="unit-vol-label" aria-live="polite"></span>
    <button class="remove-btn" title="Remove conductor" aria-label="Remove conductor">×</button>
  `;

  list.appendChild(row);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    calculate();
  });
  row.querySelectorAll("select, input").forEach(el => el.addEventListener("input", calculate));
  calculate();
}
