/**
 * @file easter-eggs.js
 * @description Fun easter eggs for SparkyTools
 *
 * Trigger: type "420.69" into any number input on any calculator.
 * Effect:  Page shakes while Mike Holt slides up from the bottom (same
 *          frame), fills the width of the active tool section, holds
 *          2.5 s, then retreats. Click / tap anywhere dismisses early.
 */

const TRIGGER_VALUE = "420.69";
const HOLD_MS       = 2500;

/* ── Inject styles once ─────────────────────────────────────────── */
function injectStyles() {
  if (document.getElementById("ee-styles")) return;
  const style = document.createElement("style");
  style.id = "ee-styles";
  style.textContent = `
@keyframes ee-shake {
  0%,100% { transform: translate(0,0) rotate(0deg); }
  10%      { transform: translate(-6px, 3px) rotate(-1.5deg); }
  20%      { transform: translate(6px, -3px) rotate(1.5deg); }
  30%      { transform: translate(-5px, 5px) rotate(-1deg); }
  40%      { transform: translate(5px, -2px) rotate(1deg); }
  50%      { transform: translate(-4px, 4px) rotate(-0.5deg); }
  60%      { transform: translate(4px, -4px) rotate(0.5deg); }
  70%      { transform: translate(-3px, 2px) rotate(-0.5deg); }
  80%      { transform: translate(3px, -3px) rotate(0deg); }
  90%      { transform: translate(-2px, 2px) rotate(0deg); }
}

body.ee-shaking {
  animation: ee-shake 0.55s ease-in-out;
}

@keyframes ee-slide-in {
  from { bottom: -110%; }
  to   { bottom: 0; }
}

@keyframes ee-slide-out {
  from { bottom: 0; }
  to   { bottom: -110%; }
}

#ee-holt {
  position:       fixed;
  bottom:         -110%;
  z-index:        9999;
  cursor:         pointer;
  pointer-events: auto;
  filter:         drop-shadow(0 -8px 32px rgba(0,0,0,0.6));
  display:        block;
}

#ee-holt.ee-entering {
  animation: ee-slide-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

#ee-holt.ee-exiting {
  animation: ee-slide-out 0.4s cubic-bezier(0.64, 0, 0.78, 0) forwards;
}
`;
  document.head.appendChild(style);
}

/* ── State ───────────────────────────────────────────────────────── */
let active    = false;
let holdTimer = null;

/* ── Measure the active tool section ────────────────────────────── */
function getSectionRect() {
  const section = document.querySelector(".tool-section.active")
               || document.querySelector(".tool-section");
  return section ? section.getBoundingClientRect() : null;
}

/* ── Animation sequence ─────────────────────────────────────────── */
function triggerSmash() {
  if (active) return;
  active = true;

  injectStyles();

  const rect = getSectionRect();

  // Create image element — position & size match the active section
  const img = document.createElement("img");
  img.id  = "ee-holt";
  img.src = "img/holtsmash.png";
  img.alt = "Mike Holt Smash!";

  if (rect) {
    img.style.left  = `${rect.left}px`;
    img.style.width = `${rect.width}px`;
  } else {
    // Fallback: center at 80vw
    img.style.left      = "50%";
    img.style.width     = "80vw";
    img.style.transform = "translateX(-50%)";
  }

  document.body.appendChild(img);

  // Force a reflow so the browser commits the off-screen start position,
  // then start shake + slide-in on the very same frame.
  // eslint-disable-next-line no-unused-expressions
  img.offsetHeight;

  document.body.classList.add("ee-shaking");
  img.classList.add("ee-entering");

  document.body.addEventListener(
    "animationend",
    (e) => { if (e.target === document.body) document.body.classList.remove("ee-shaking"); },
    { once: true }
  );

  img.addEventListener("animationend", onSlideInEnd, { once: true });

  // Click/tap to dismiss early
  document.addEventListener("pointerdown", dismissEarly, { once: true });
}

function onSlideInEnd() {
  const img = document.getElementById("ee-holt");
  if (!img) return;
  img.classList.remove("ee-entering");
  img.style.bottom = "0";
  holdTimer = setTimeout(retreat, HOLD_MS);
}

function dismissEarly() {
  if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  retreat();
}

function retreat() {
  document.removeEventListener("pointerdown", dismissEarly);

  const img = document.getElementById("ee-holt");
  if (!img) { active = false; return; }

  img.style.bottom = "";
  img.classList.add("ee-exiting");
  img.addEventListener(
    "animationend",
    () => { img.remove(); active = false; },
    { once: true }
  );
}

/* ── Input listener ──────────────────────────────────────────────── */
function onInput(e) {
  const el = e.target;
  if (el.tagName !== "INPUT" || el.type !== "number") return;
  if (el.value === TRIGGER_VALUE) triggerSmash();
}

/* ── Public API ──────────────────────────────────────────────────── */
export function init() {
  document.addEventListener("input", onInput);
}
