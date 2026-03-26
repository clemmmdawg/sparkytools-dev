/**
 * @file conduit-fill.js
 * @description Conduit Fill Calculator - NEC 300.17 / Chapter 9, Table 1
 * 
 * Fill limits: 53% (1 wire), 31% (2 wires), 40% (3+ wires)
 */

import { randomColor, setStatus, getEl, formatNumber } from '../utils/formatting.js';

let necData = null;

/**
 * Initializes the conduit fill calculator with NEC data
 * @param {Object} data - NEC data object
 */
export function init(data) {
  necData = data;
  
  const addWireBtn = getEl("add-wire-btn");
  const typeSelect = getEl("conduit-type");
  const sizeSelect = getEl("conduit-size");

  if (addWireBtn) addWireBtn.addEventListener("click", addWireRow);

  if (typeSelect && sizeSelect) {
    // Populate conduit type dropdown
    Object.keys(necData.conduit).forEach(type => {
      if (type !== 'sizes' && type !== 'fillLimits') {
        typeSelect.add(new Option(type, type));
      }
    });

    typeSelect.addEventListener("change", () => {
      const previousSize = sizeSelect.options[sizeSelect.selectedIndex]?.text ?? "";
      const sizes = necData.conduit[typeSelect.value];
      sizeSelect.innerHTML = "";

      necData.conduit.sizes.forEach(size => {
        if (!sizes[size]) return;
        const opt = new Option(`${size}"`, sizes[size]);
        if (`${size}"` === previousSize) opt.selected = true;
        sizeSelect.add(opt);
      });

      calculate();
    });

    sizeSelect.addEventListener("change", calculate);
    typeSelect.dispatchEvent(new Event("change"));
  }

  addWireRow(); // Start with one conductor row
}

/**
 * Main calculation function for conduit fill
 */
export function calculate() {
  const conduitSizeEl = getEl("conduit-size");
  const conduitTypeEl = getEl("conduit-type");
  if (!conduitSizeEl || !conduitTypeEl) return;

  const conduitArea = parseFloat(conduitSizeEl.value);
  const conduitType = conduitTypeEl.value;
  let totalWireArea = 0;
  let totalQty = 0;
  const wireEntries = [];

  document.querySelectorAll(".wire-row").forEach(row => {
    const type = row.querySelector(".w-type").value;
    const construct = row.querySelector(".w-const").value;
    const size = row.querySelector(".w-size").value;
    const qty = parseInt(row.querySelector(".w-qty").value) || 0;
    const area = necData.conductors.wireData[type]?.[construct]?.[size];

    if (area && qty > 0) {
      totalWireArea += area * qty;
      totalQty += qty;
      wireEntries.push({ area, qty, color: row.dataset.color });
    }
  });

  // NEC Chapter 9, Table 1: fill limits
  const fillLimit = totalQty === 1 ? 53 : totalQty === 2 ? 31 : 40;
  const fillPct = conduitArea ? (totalWireArea / conduitArea) * 100 : 0;
  const isOver = fillPct > fillLimit;

  // Update fill meter bar
  const bar = getEl("fill-bar");
  if (bar) {
    bar.style.width = `${Math.min(fillPct, 100)}%`;
    bar.style.background = isOver ? "var(--danger)" : "var(--success)";
  }

  const fillPercentEl = getEl("fill-percent");
  if (fillPercentEl) fillPercentEl.textContent = `${formatNumber(fillPct, 1)}%`;

  // Update status pill
  const statusEl = getEl("status-box");
  if (statusEl) {
    if (totalQty === 0) {
      statusEl.textContent = "Add Wires to Begin";
      statusEl.style.background = "";
      statusEl.style.color = "";
    } else {
      setStatus(statusEl, isOver, `GOOD (Limit ${fillLimit}%)`, `OVERFILL (Limit ${fillLimit}%)`);
    }
  }

  updateConduitRecommendation(totalWireArea, totalQty, conduitType, fillLimit);
  updateConduitVisualizer(conduitArea, wireEntries);
}

/**
 * Finds the minimum conduit size that can contain all conductors
 */
function updateConduitRecommendation(totalWireArea, totalQty, currentType, fillLimit) {
  const display = getEl("min-size-recommend");
  const typeLabel = getEl("current-type-label");
  const sizeEl = getEl("conduit-size");
  if (!display || !typeLabel || !sizeEl) return;

  const typeData = necData.conduit[currentType];
  let bestFit = "Too Large";

  typeLabel.textContent = currentType;

  for (const size of necData.conduit.sizes) {
    if (!typeData[size]) continue;
    if (typeData[size] * (fillLimit / 100) >= totalWireArea) {
      bestFit = `${size}"`;
      break;
    }
  }

  display.textContent = bestFit;

  const selectedLabel = sizeEl.options[sizeEl.selectedIndex]?.text.replace('"', "") ?? "";
  const selectedIndex = necData.conduit.sizes.indexOf(selectedLabel);
  const recommendIndex = necData.conduit.sizes.indexOf(bestFit.replace('"', ""));

  display.style.color = selectedIndex < recommendIndex ? "var(--danger)" : "var(--success)";
}

/**
 * Renders conductors in the SVG cross-section visualizer
 */
function updateConduitVisualizer(conduitArea, wireEntries) {
  const group = getEl("wire-group");
  if (!group) return;
  group.innerHTML = "";
  if (!conduitArea || wireEntries.length === 0) return;

  const svgRadius = 46;
  const conduitRadius = Math.sqrt(conduitArea / Math.PI);
  const scale = svgRadius / conduitRadius;
  const cx = 50, cy = 50;

  const wires = [];
  wireEntries.forEach(({ area, qty, color }) => {
    const r = Math.sqrt(area / Math.PI) * scale;
    for (let i = 0; i < qty; i++) wires.push({ r, color });
  });
  wires.sort((a, b) => b.r - a.r);

  const placed = [];
  const ANGLE_STEP = 0.1;
  const MIN_DIST_STEP = 0.5;
  const MAX_ITERATIONS = 9000;

  wires.forEach(wire => {
    let didPlace = false;
    let angle = 0;
    let dist = 0;
    let iterations = 0;

    while (!didPlace && dist <= svgRadius + wire.r) {
      if (++iterations > MAX_ITERATIONS) break;

      const x = cx + dist * Math.cos(angle);
      const y = cy + dist * Math.sin(angle);

      const fromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const withinConduit = fromCenter + wire.r <= svgRadius;
      const noOverlap = placed.every(
        p => Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) >= wire.r + p.r
      );

      if (withinConduit && noOverlap) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", wire.r);
        circle.setAttribute("fill", wire.color);
        circle.style.stroke = "rgba(0,0,0,0.15)";
        circle.style.strokeWidth = "0.4";
        group.appendChild(circle);
        placed.push({ x, y, r: wire.r });
        didPlace = true;
      }

      angle += ANGLE_STEP;
      if (angle > Math.PI * 2) {
        angle -= Math.PI * 2;
        dist += Math.max(wire.r * 0.4, MIN_DIST_STEP);
      }
    }
  });
}

/**
 * Adds a new conductor row to the wire list
 */
export function addWireRow() {
  const list = getEl("wire-list");
  if (!list) return;

  const row = document.createElement("div");
  const color = randomColor();
  row.className = "wire-row";
  row.dataset.color = color;

  const typeOptions = Object.keys(necData.conductors.wireData)
    .map(t => `<option value="${t}">${t}</option>`)
    .join("");

  row.innerHTML = `
    <input type="color" class="color-swatch" value="${color}" aria-label="Pick conductor color" title="Click to change color">
    <select class="w-type" aria-label="Wire type">${typeOptions}</select>
    <select class="w-const" aria-label="Construction">
      <option value="stranded">Stranded</option>
      <option value="solid">Solid</option>
    </select>
    <select class="w-size" aria-label="Wire size"></select>
    <input type="number" class="w-qty" value="3" min="1" aria-label="Quantity">
    <button class="remove-btn" title="Remove conductor" aria-label="Remove conductor">×</button>
  `;

  list.appendChild(row);

  const updateSizes = () => {
    const type = row.querySelector(".w-type").value;
    const constEl = row.querySelector(".w-const");
    const construct = constEl.value;
    const sizeSelect = row.querySelector(".w-size");
    const currentSize = sizeSelect.value;

    const hasSolid = !!necData.conductors.wireData[type].solid;
    row.querySelector('.w-const option[value="solid"]').disabled = !hasSolid;
    if (!hasSolid && construct === "solid") constEl.value = "stranded";

    const available = necData.conductors.wireData[type][constEl.value];
    sizeSelect.innerHTML = necData.conductors.wireSizeOrder
      .filter(s => available[s] !== undefined)
      .map(s => `<option value="${s}" ${s === currentSize ? "selected" : ""}>#${s}</option>`)
      .join("");

    calculate();
  };

  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    calculate();
  });
  row.querySelectorAll("select, input").forEach(el => el.addEventListener("input", updateSizes));
  row.querySelector(".color-swatch").addEventListener("input", e => {
    row.dataset.color = e.target.value;
    calculate();
  });

  updateSizes();
}