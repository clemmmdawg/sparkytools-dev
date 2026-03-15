/**
 * @file formatting.js
 * @description UI formatting and helper utilities
 */

/**
 * Escapes HTML special characters to prevent XSS when inserting user-supplied
 * text into innerHTML template strings.
 * @param {string} str - Raw user input
 * @returns {string} HTML-safe string
 */
export function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Returns a random hex color string suitable for <input type="color">.
 * Used to assign unique colors to conductor rows in visualizers.
 * @returns {string} Hex color (e.g., "#3fa5d2")
 */
export function randomColor() {
  const hue = Math.floor(Math.random() * 360);
  const sat = 65;
  const lgt = 50;
  
  // Convert HSL → RGB → hex
  const s = sat / 100, l = lgt / 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + hue / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Updates a status-pill element to reflect pass/fail state.
 * Colors are read from CSS custom properties.
 * 
 * @param {HTMLElement} el - The status pill DOM element
 * @param {boolean} isOver - true = error/fail, false = ok/pass
 * @param {string} okText - Text when passing
 * @param {string} errText - Text when failing
 */
export function setStatus(el, isOver, okText, errText) {
  if (!el) return;
  el.textContent = isOver ? errText : okText;
  el.style.background = isOver ? "var(--status-err-bg)" : "var(--status-ok-bg)";
  el.style.color = isOver ? "var(--status-err-text)" : "var(--status-ok-text)";
}

/**
 * Safely retrieves a DOM element by ID.
 * Logs a warning if element is missing.
 * 
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`SparkyTools: Element #${id} not found.`);
  return el;
}

/**
 * Formats a number to a specified decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string}
 */
export function formatNumber(value, decimals = 2) {
  return value.toFixed(decimals);
}

/**
 * Reads the current resolved value of a CSS custom property from :root.
 * Used by SVG renderers so they pick up the correct light/dark token at
 * draw time rather than baking in a hardcoded color.
 *
 * @param {string} name - CSS variable name including leading "--" (e.g. "--svg-box-stroke")
 * @returns {string} Trimmed string value
 */
export function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}