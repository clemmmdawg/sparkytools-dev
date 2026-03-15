/**
 * @file pull-box.js
 * @description Pull Box Sizing Calculator - NEC 314.28
 * 
 * (A)(1) Straight pulls: min dimension ≥ 8 × largest trade size
 * (A)(2) Angle/U-pulls: min dimension ≥ 6 × largest + sum of others on same wall
 */

import { randomColor, getEl, formatNumber, getCSSVar } from '../utils/formatting.js';

let necData = null;

/**
 * Initializes the pull box calculator with NEC data
 * @param {Object} data - NEC data object
 */
export function init(data) {
  necData = data;

  const pbAddBtn = getEl("pb-add-btn");
  const pbPullType = getEl("pb-pull-type");
  const pbEntry = getEl("pb-entry-side");
  const pbCondSize = getEl("pb-conduit-size");

  // Populate conduit size dropdown
  if (pbCondSize) {
    necData.pullbox.sizeOrder.forEach(size => {
      pbCondSize.add(new Option(`${size}"`, necData.pullbox.sizes[size]));
    });
    pbCondSize.value = necData.pullbox.sizes["2"]; // Default to 2"
  }

  if (pbPullType && pbEntry) {
    pbPullType.addEventListener("change", updatePbExitOptions);
    pbEntry.addEventListener("change", updatePbExitOptions);
    updatePbExitOptions();
  }

  if (pbAddBtn) pbAddBtn.addEventListener("click", addPullBoxRun);

  // Draw the initial placeholder using CSS vars (replaces the hardcoded SVG in index.html)
  updatePullBoxVisualizer([], 0, 0);

  // Redraw SVG when theme changes so CSS-var colors are re-sampled
  document.addEventListener("themechange", calculate);
}

/**
 * Updates exit side options based on pull type and entry side
 */
function updatePbExitOptions() {
  const pullTypeEl = getEl("pb-pull-type");
  const entryEl = getEl("pb-entry-side");
  const exitEl = getEl("pb-exit-side");
  if (!pullTypeEl || !entryEl || !exitEl) return;

  const pullType = pullTypeEl.value;
  const entry = entryEl.value;

  exitEl.innerHTML = "";
  exitEl.disabled = false;

  if (pullType === "straight") {
    const opp = necData.pullbox.oppositeWall[entry];
    exitEl.add(new Option(`${necData.pullbox.sideLabels[opp]} Wall`, opp));
    exitEl.disabled = true;
  } else if (pullType === "u") {
    exitEl.add(new Option(`${necData.pullbox.sideLabels[entry]} Wall (same)`, entry));
    exitEl.disabled = true;
  } else {
    ["left", "right", "top", "bottom"]
      .filter(s => s !== entry)
      .forEach(side => exitEl.add(new Option(`${necData.pullbox.sideLabels[side]} Wall`, side)));
  }
}

/**
 * Main calculation function for pull box sizing
 */
export function calculate() {
  const rows = [...document.querySelectorAll(".pb-run-row")];
  const wEl = getEl("pb-min-width");
  const hEl = getEl("pb-min-height");
  const sEl = getEl("pb-status");

  if (rows.length === 0) {
    if (wEl) wEl.textContent = "--";
    if (hEl) hEl.textContent = "--";
    if (sEl) {
      sEl.textContent = "Add conduit runs to begin";
      sEl.style.background = "";
      sEl.style.color = "";
    }
    updatePullBoxVisualizer([], 0, 0);
    return;
  }

  const runs = rows.map(row => {
    const sizeVal = parseFloat(row.querySelector(".pb-size").value);
    const sizeOpt = row.querySelector(".pb-size").selectedOptions[0].text.replace('"', '');
    return {
      size: sizeVal,
      sizeLabel: sizeOpt,
      pullType: row.querySelector(".pb-type").value,
      entry: row.querySelector(".pb-entry").value,
      exit: row.querySelector(".pb-exit").value,
      color: row.querySelector(".color-swatch").value,
    };
  });

  let minWidth = 0;
  let minHeight = 0;
  const wallConduits = { top: [], bottom: [], left: [], right: [] };

  runs.forEach(run => {
    if (run.pullType === "straight") {
      const dim = 8 * run.size;
      if (run.entry === "left" || run.entry === "right") {
        minWidth = Math.max(minWidth, dim);
      } else {
        minHeight = Math.max(minHeight, dim);
      }
    } else if (run.pullType === "u") {
      wallConduits[run.entry].push(run.size);
      wallConduits[run.entry].push(run.size);
      const spacingDim = 6 * run.size;
      if (run.entry === "left" || run.entry === "right") {
        minHeight = Math.max(minHeight, spacingDim);
      } else {
        minWidth = Math.max(minWidth, spacingDim);
      }
    } else {
      wallConduits[run.entry].push(run.size);
      wallConduits[run.exit].push(run.size);
    }
  });

  // Apply 6× formula for each wall
  ["left", "right"].forEach(wall => {
    const conduits = wallConduits[wall];
    if (!conduits.length) return;
    const largest = Math.max(...conduits);
    const sumOthers = conduits.reduce((a, b) => a + b, 0) - largest;
    minWidth = Math.max(minWidth, 6 * largest + sumOthers);
  });

  ["top", "bottom"].forEach(wall => {
    const conduits = wallConduits[wall];
    if (!conduits.length) return;
    const largest = Math.max(...conduits);
    const sumOthers = conduits.reduce((a, b) => a + b, 0) - largest;
    minHeight = Math.max(minHeight, 6 * largest + sumOthers);
  });

  if (wEl) wEl.textContent = minWidth > 0 ? `${formatNumber(minWidth)}"` : "N/A";
  if (hEl) hEl.textContent = minHeight > 0 ? `${formatNumber(minHeight)}"` : "N/A";

  if (sEl) {
    const wStr = minWidth > 0 ? `${formatNumber(minWidth)}"` : "N/A";
    const hStr = minHeight > 0 ? `${formatNumber(minHeight)}"` : "N/A";
    sEl.textContent = `Min. Box: ${wStr} W × ${hStr} H`;
    sEl.style.background = "var(--status-ok-bg)";
    sEl.style.color = "var(--status-ok-text)";
  }

  updatePullBoxVisualizer(runs, minWidth, minHeight);
}

/**
 * Renders the pull box face diagram
 */
function updatePullBoxVisualizer(runs, minWidth, minHeight) {
  const svg = getEl("pb-svg");
  if (!svg) return;
  svg.innerHTML = "";

  // Sample CSS vars at render time so dark/light mode is always reflected
  const svgBoxFill    = getCSSVar("--svg-conduit-bg");
  const svgBoxStroke  = getCSSVar("--svg-box-stroke");
  const svgWhLabel    = getCSSVar("--svg-wh-label");
  const svgPlaceholder = getCSSVar("--svg-placeholder");
  const dimColor      = getCSSVar("--svg-dim-color");

  const ns = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    (parent || svg).appendChild(e);
    return e;
  }

  if (runs.length === 0) {
    el("text", {
      x: "150", y: "110", "text-anchor": "middle",
      "dominant-baseline": "middle", fill: svgPlaceholder,
      "font-size": "13", "font-family": "Inter, sans-serif"
    });
    svg.lastChild.textContent = "Add conduit runs to visualize";
    return;
  }

  const AREA_X = 60, AREA_Y = 28;
  const AREA_W = 185, AREA_H = 152;

  let boxW, boxH;
  const hasW = minWidth > 0, hasH = minHeight > 0;

  if (hasW && hasH) {
    const aspect = minWidth / minHeight;
    const maxAspect = AREA_W / AREA_H;
    if (aspect > maxAspect) {
      boxW = AREA_W;
      boxH = Math.max(AREA_W / aspect, AREA_H * 0.25);
    } else {
      boxH = AREA_H;
      boxW = Math.max(AREA_H * aspect, AREA_W * 0.25);
    }
  } else {
    boxW = AREA_W * 0.65;
    boxH = AREA_H * 0.65;
  }

  const boxX = AREA_X + (AREA_W - boxW) / 2;
  const boxY = AREA_Y + (AREA_H - boxH) / 2;

  el("rect", {
    x: boxX, y: boxY, width: boxW, height: boxH,
    fill: svgBoxFill, stroke: svgBoxStroke,
    "stroke-width": "2.5", rx: "3"
  });

  el("text", {
    x: boxX + boxW / 2, y: boxY + boxH / 2 - 6,
    "text-anchor": "middle", "dominant-baseline": "middle",
    fill: svgWhLabel, "font-size": "28", "font-family": "Inter, sans-serif",
    "font-weight": "800", "pointer-events": "none"
  }).textContent = "W × H";

  const wallCount = { top: 0, bottom: 0, left: 0, right: 0 };
  runs.forEach(run => {
    wallCount[run.entry]++;
    wallCount[run.exit]++;
  });

  const wallIdx = { top: 0, bottom: 0, left: 0, right: 0 };
  const KO_W = 11, KO_D = 13;

  function knockoutGeom(wall, idx, total) {
    if (wall === "left" || wall === "right") {
      const spacing = boxH / (total + 1);
      const cy = boxY + spacing * (idx + 1);
      const rx = wall === "left" ? boxX - KO_D : boxX + boxW;
      return {
        rx, ry: cy - KO_W / 2, rw: KO_D, rh: KO_W,
        wx: wall === "left" ? boxX : boxX + boxW, wy: cy
      };
    } else {
      const spacing = boxW / (total + 1);
      const cx = boxX + spacing * (idx + 1);
      const ry = wall === "top" ? boxY - KO_D : boxY + boxH;
      return {
        rx: cx - KO_W / 2, ry, rw: KO_W, rh: KO_D,
        wx: cx, wy: wall === "top" ? boxY : boxY + boxH
      };
    }
  }

  const pathsToDraw = [];

  runs.forEach(run => {
    const entryGeom = knockoutGeom(run.entry, wallIdx[run.entry]++, wallCount[run.entry]);
    const exitGeom = knockoutGeom(run.exit, wallIdx[run.exit]++, wallCount[run.exit]);

    el("rect", {
      x: entryGeom.rx, y: entryGeom.ry, width: entryGeom.rw, height: entryGeom.rh,
      fill: run.color, stroke: "rgba(0,0,0,0.3)", "stroke-width": "1", rx: "2"
    });
    el("rect", {
      x: exitGeom.rx, y: exitGeom.ry, width: exitGeom.rw, height: exitGeom.rh,
      fill: run.color, stroke: "rgba(0,0,0,0.2)", "stroke-width": "1", rx: "2",
      opacity: "0.75"
    });

    pathsToDraw.push({
      x1: entryGeom.wx, y1: entryGeom.wy,
      x2: exitGeom.wx, y2: exitGeom.wy,
      wall1: run.entry, wall2: run.exit,
      color: run.color, pullType: run.pullType
    });
  });

  pathsToDraw.forEach(p => {
    let d;
    const { x1, y1, x2, y2, wall1, wall2, pullType } = p;

    if (pullType === "straight") {
      d = `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (pullType === "u") {
      const isVertWall = wall1 === "left" || wall1 === "right";
      if (isVertWall) {
        const dip = wall1 === "left" ? boxX + boxW * 0.55 : boxX + boxW * 0.45;
        d = `M ${x1} ${y1} C ${dip} ${y1}, ${dip} ${y2}, ${x2} ${y2}`;
      } else {
        const dip = wall1 === "top" ? boxY + boxH * 0.55 : boxY + boxH * 0.45;
        d = `M ${x1} ${y1} C ${x1} ${dip}, ${x2} ${dip}, ${x2} ${y2}`;
      }
    } else {
      const tangent = {
        left: [1, 0], right: [-1, 0],
        top: [0, 1], bottom: [0, -1]
      };
      const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const k = dist * 0.45;
      const [dx1, dy1] = tangent[wall1];
      const [dx2, dy2] = tangent[wall2];
      const cp1x = x1 + dx1 * k, cp1y = y1 + dy1 * k;
      const cp2x = x2 + dx2 * k, cp2y = y2 + dy2 * k;
      d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    el("path", {
      d, fill: "none", stroke: p.color,
      "stroke-width": "2", "stroke-dasharray": "5 3",
      opacity: "0.7", "stroke-linecap": "round"
    });
  });

  // Dimension annotations
  const TICK = 4;
  const DIM_FONTSIZE = "10.5";

  if (hasW) {
    const ay = boxY + boxH + 20;
    el("line", { x1: boxX, y1: ay, x2: boxX + boxW, y2: ay, stroke: dimColor, "stroke-width": "1" });
    el("line", { x1: boxX, y1: ay - TICK, x2: boxX, y2: ay + TICK, stroke: dimColor, "stroke-width": "1" });
    el("line", { x1: boxX + boxW, y1: ay - TICK, x2: boxX + boxW, y2: ay + TICK, stroke: dimColor, "stroke-width": "1" });
    const wText = el("text", {
      x: boxX + boxW / 2, y: ay + 10, "text-anchor": "middle",
      fill: dimColor, "font-size": DIM_FONTSIZE,
      "font-family": "Inter, sans-serif", "font-weight": "700"
    });
    wText.textContent = `W = ${formatNumber(minWidth)}"`;
  }

  if (hasH) {
    const ax = boxX - 22;
    el("line", { x1: ax, y1: boxY, x2: ax, y2: boxY + boxH, stroke: dimColor, "stroke-width": "1" });
    el("line", { x1: ax - TICK, y1: boxY, x2: ax + TICK, y2: boxY, stroke: dimColor, "stroke-width": "1" });
    el("line", { x1: ax - TICK, y1: boxY + boxH, x2: ax + TICK, y2: boxY + boxH, stroke: dimColor, "stroke-width": "1" });
    const hText = el("text", {
      x: ax - 2, y: boxY + boxH / 2, "text-anchor": "middle",
      fill: dimColor, "font-size": DIM_FONTSIZE,
      "font-family": "Inter, sans-serif", "font-weight": "700",
      transform: `rotate(-90, ${ax - 2}, ${boxY + boxH / 2})`
    });
    hText.textContent = `H = ${formatNumber(minHeight)}"`;
  }
}

/**
 * Adds a new conduit run row
 */
export function addPullBoxRun() {
  const sizeEl = getEl("pb-conduit-size");
  const pullTypeEl = getEl("pb-pull-type");
  const entryEl = getEl("pb-entry-side");
  const exitEl = getEl("pb-exit-side");
  const list = getEl("pb-run-list");
  if (!sizeEl || !pullTypeEl || !entryEl || !exitEl || !list) return;

  const color = randomColor();

  const sizeOpts = necData.pullbox.sizeOrder
    .map(s => `<option value="${necData.pullbox.sizes[s]}" ${sizeEl.value == necData.pullbox.sizes[s] ? "selected" : ""}>${s}"</option>`)
    .join("");

  const pullOpts = Object.entries(necData.pullbox.pullTypeLabels)
    .map(([v, l]) => `<option value="${v}" ${v === pullTypeEl.value ? "selected" : ""}>${l}</option>`)
    .join("");

  const entryOpts = ["left", "right", "top", "bottom"]
    .map(s => `<option value="${s}" ${s === entryEl.value ? "selected" : ""}>${necData.pullbox.sideLabels[s]} Wall</option>`)
    .join("");

  const row = document.createElement("div");
  row.className = "pb-run-row";
  row.setAttribute("role", "listitem");

  row.innerHTML = `
    <input type="color" class="color-swatch" value="${color}" aria-label="Pick conduit color" title="Click to change color">
    <select class="pb-size" aria-label="Conduit size">${sizeOpts}</select>
    <select class="pb-type" aria-label="Pull type">${pullOpts}</select>
    <select class="pb-entry" aria-label="Conduit enters">${entryOpts}</select>
    <select class="pb-exit" aria-label="Conduit exits"></select>
    <button class="remove-btn" title="Remove conduit run" aria-label="Remove conduit run">×</button>
  `;

  list.appendChild(row);

  const rowSizeEl = row.querySelector(".pb-size");
  const rowTypeEl = row.querySelector(".pb-type");
  const rowEntryEl = row.querySelector(".pb-entry");
  const rowExitEl = row.querySelector(".pb-exit");

  function refreshRowExitOptions() {
    const pullType = rowTypeEl.value;
    const entry = rowEntryEl.value;

    rowExitEl.innerHTML = "";
    rowExitEl.disabled = false;

    if (pullType === "straight") {
      const opp = necData.pullbox.oppositeWall[entry];
      rowExitEl.add(new Option(`${necData.pullbox.sideLabels[opp]} Wall`, opp));
      rowExitEl.disabled = true;
    } else if (pullType === "u") {
      rowExitEl.add(new Option(`${necData.pullbox.sideLabels[entry]} Wall (same)`, entry));
      rowExitEl.disabled = true;
    } else {
      ["left", "right", "top", "bottom"]
        .filter(s => s !== entry)
        .forEach(s => rowExitEl.add(new Option(`${necData.pullbox.sideLabels[s]} Wall`, s)));
      if (exitEl.value && exitEl.value !== entry) rowExitEl.value = exitEl.value;
    }

    calculate();
  }

  rowTypeEl.addEventListener("change", refreshRowExitOptions);
  rowEntryEl.addEventListener("change", refreshRowExitOptions);
  rowSizeEl.addEventListener("change", calculate);
  rowExitEl.addEventListener("change", calculate);
  row.querySelector(".remove-btn").addEventListener("click", () => {
    row.remove();
    calculate();
  });
  row.querySelector(".color-swatch").addEventListener("input", calculate);

  refreshRowExitOptions();
}