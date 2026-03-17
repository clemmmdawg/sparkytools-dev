/**
 * @file theme.js
 * @description Dark/light mode toggle with system preference detection
 *
 * Strategy:
 *  - Respects prefers-color-scheme by default (no localStorage entry)
 *  - User's manual choice is stored in localStorage under "sparky-theme"
 *  - Sets data-theme="dark"|"light" on <html> to activate CSS overrides
 *  - Dispatches a custom "themechange" event so SVG visualizers can redraw
 *    with the correct CSS variable values
 */

/**
 * Returns true if dark mode is currently active, accounting for
 * the manual override first, then falling back to the OS preference.
 * @returns {boolean}
 */
function isDarkActive() {
  const saved = localStorage.getItem("sparky-theme");
  if (saved === "dark")  return true;
  if (saved === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Updates the toggle button's icon and accessible label.
 * @param {HTMLElement} btn
 * @param {boolean} dark - whether dark mode is currently active
 */
function syncButton(btn, dark) {
  const icon  = btn.querySelector(".sidebar-item-icon");
  const label = btn.querySelector(".theme-toggle-label");
  if (icon)  icon.textContent  = dark ? "☀️" : "🌙";
  if (label) label.textContent = dark ? "Light mode" : "Dark mode";
  btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  btn.setAttribute("title",      dark ? "Switch to light mode" : "Switch to dark mode");
}

/**
 * Applies the resolved theme to <html> and syncs the button.
 * Called on init and on every toggle.
 * @param {HTMLElement} btn
 * @param {boolean} dark
 */
function applyTheme(btn, dark) {
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  syncButton(btn, dark);
  // Signal SVG renderers (pull-box.js, conduit-fill.js) to redraw
  document.dispatchEvent(new CustomEvent("themechange"));
}

/**
 * Initializes the theme system.
 * Should be called once from app.js after the DOM is ready.
 */
export function initTheme() {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;

  // Apply saved or system preference immediately
  applyTheme(btn, isDarkActive());

  // Manual toggle
  btn.addEventListener("click", () => {
    const next = !isDarkActive();
    localStorage.setItem("sparky-theme", next ? "dark" : "light");
    applyTheme(btn, next);
  });

  // React to OS preference changes in real time (e.g. system switching to dark at sunset)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    // Only follow the OS change if the user has not set a manual override
    if (!localStorage.getItem("sparky-theme")) {
      applyTheme(btn, isDarkActive());
    }
  });
}