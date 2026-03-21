/**
 * @file easter-eggs.js
 * @description Fun easter eggs for SparkyTools
 *
 * Trigger: type "420.69" into any number input on any calculator.
 * Effect:  Mike Holt slams onto the screen from below, holds 2.5 s,
 *          then retreats. Click / tap anywhere dismisses early.
 */

const TRIGGER_VALUE = "420.69";
const HOLD_MS       = 2500;

/* ── Inject styles once ─────────────────────────────────────────── */
function injectStyles() {
  if (document.getElementById("ee-styles")) return;
  const style = document.createElement("style");
  style.id = "ee-styles";
  style.textContent = `
@keyframes ee-slam {
  0%   { bottom: -110%; transform-origin: bottom center; transform: scaleX(1)   scaleY(1);   }
  62%  { bottom: 0;     transform-origin: bottom center; transform: scaleX(1.06) scaleY(0.9); }
  76%  { bottom: 0;     transform-origin: bottom center; transform: scaleX(0.97) scaleY(1.04); }
  88%  { bottom: 0;     transform-origin: bottom center; transform: scaleX(1.01) scaleY(0.98); }
  100% { bottom: 0;     transform-origin: bottom center; transform: scaleX(1)   scaleY(1);   }
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
  animation: ee-slam 0.5s cubic-bezier(0.15, 0, 0.2, 1) forwards;
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

  const img = document.createElement("img");
  img.id  = "ee-holt";
  img.src = "img/holtsmash.png";
  img.alt = "Mike Holt Smash!";

  if (rect) {
    img.style.left  = `${rect.left}px`;
    img.style.width = `${rect.width}px`;
  } else {
    img.style.left      = "50%";
    img.style.width     = "80vw";
    img.style.transform = "translateX(-50%)";
  }

  document.body.appendChild(img);

  // Force reflow so the browser commits the off-screen start position
  // eslint-disable-next-line no-unused-expressions
  img.offsetHeight;

  img.classList.add("ee-entering");
  img.addEventListener("animationend", onSlamEnd, { once: true });

  document.addEventListener("pointerdown", dismissEarly, { once: true });
}

function onSlamEnd() {
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
  new Image().src = "img/holtsmash.png";
  document.addEventListener("input", onInput);
}
