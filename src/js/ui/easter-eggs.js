/**
 * @file easter-eggs.js
 * @description Fun easter eggs for SparkyTools
 *
 * Trigger: type "420.69" into any number input on any calculator.
 * Effect:  Page shakes, Mike Holt crashes in from the bottom, holds 2–3 s,
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
  from { bottom: -120%; }
  to   { bottom: 0; }
}

@keyframes ee-slide-out {
  from { bottom: 0; }
  to   { bottom: -120%; }
}

#ee-holt {
  position:   fixed;
  left:       50%;
  bottom:     -120%;
  transform:  translateX(-50%);
  z-index:    9999;
  cursor:     pointer;
  max-width:  min(380px, 80vw);
  width:      min(380px, 80vw);
  pointer-events: auto;
  filter:     drop-shadow(0 -8px 24px rgba(0,0,0,0.55));
}

#ee-holt.ee-entering {
  animation: ee-slide-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

#ee-holt.ee-exiting {
  animation: ee-slide-out 0.4s cubic-bezier(0.64, 0, 0.78, 0) forwards;
}
`;
  document.head.appendChild(style);
}

/* ── State ───────────────────────────────────────────────────────── */
let active     = false;
let holdTimer  = null;

/* ── Animation sequence ─────────────────────────────────────────── */
function triggerSmash() {
  if (active) return;
  active = true;

  injectStyles();

  // Create image element
  const img = document.createElement("img");
  img.id  = "ee-holt";
  img.src = "img/holtsmash.png";
  img.alt = "Mike Holt Smash!";
  document.body.appendChild(img);

  // Shake the page
  document.body.classList.add("ee-shaking");
  document.body.addEventListener(
    "animationend",
    () => document.body.classList.remove("ee-shaking"),
    { once: true }
  );

  // Slide in
  requestAnimationFrame(() => {
    img.classList.add("ee-entering");
  });

  img.addEventListener("animationend", onSlideInEnd, { once: true });

  // Click/tap to dismiss early
  document.addEventListener("pointerdown", dismissEarly, { once: true });
}

function onSlideInEnd() {
  const img = document.getElementById("ee-holt");
  if (!img) return;
  // Remove slide-in class so the element stays visible at bottom:0
  img.classList.remove("ee-entering");
  img.style.bottom = "0";

  // Auto-dismiss after hold period
  holdTimer = setTimeout(retreat, HOLD_MS);
}

function dismissEarly() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  retreat();
}

function retreat() {
  // Remove the early-dismiss listener if still pending
  document.removeEventListener("pointerdown", dismissEarly);

  const img = document.getElementById("ee-holt");
  if (!img) { active = false; return; }

  img.style.bottom = "";
  img.classList.add("ee-exiting");
  img.addEventListener(
    "animationend",
    () => {
      img.remove();
      active = false;
    },
    { once: true }
  );
}

/* ── Input listener ──────────────────────────────────────────────── */
function onInput(e) {
  const el = e.target;
  if (el.tagName !== "INPUT" || el.type !== "number") return;
  if (el.value === TRIGGER_VALUE) {
    triggerSmash();
  }
}

/* ── Public API ──────────────────────────────────────────────────── */
export function init() {
  document.addEventListener("input", onInput);
}
