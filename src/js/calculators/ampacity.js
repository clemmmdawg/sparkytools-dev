/**
 * @file ampacity.js
 * @description Wire Ampacity Calculator
 *
 * Implements NEC Table 310.15(B)(16) ampacity lookup with two derating steps:
 *  1. Ambient temperature correction — NEC 310.15(B)(1) (formula method)
 *  2. Bundling / conduit-fill adjustment — NEC Table 310.15(C)(1)
 */

import { getEl, setStatus } from '../utils/formatting.js';

let necData = null;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the bundling correction factor for a given number of
 * current-carrying conductors per NEC Table 310.15(C)(1).
 */
function getBundlingFactor(ccc, factors) {
  for (const row of factors) {
    if (row.max === null || ccc <= row.max) return row.factor;
  }
  return factors[factors.length - 1].factor;
}

/**
 * Temperature correction factor per NEC 310.15(B)(1) formula:
 *   CF = sqrt( (Tc - Ta) / (Tc - 30) )
 * where Tc = conductor temp rating (°C), Ta = ambient temp (°C).
 * Returns null when the ambient is ≥ the conductor rating (wire unusable).
 */
function getTempFactor(ratingC, ambientF) {
  const ambientC = (ambientF - 32) * 5 / 9;
  if (ambientC >= ratingC) return null;
  return Math.sqrt((ratingC - ambientC) / (ratingC - 30));
}

// ─── Populate size dropdown ────────────────────────────────────────────────

function populateSizes() {
  const material = getEl('amp-material');
  const sizeEl   = getEl('amp-size');
  if (!material || !sizeEl || !necData) return;

  const mat = material.value;
  const sizes = necData.ampacity.wireSizeOrder[mat];

  sizeEl.innerHTML = '';
  sizes.forEach(s => {
    const label = parseInt(s, 10) >= 250 ? `${s} kcmil` : `#${s} AWG`;
    sizeEl.add(new Option(label, s));
  });

  // Sensible defaults
  sizeEl.value = mat === 'CU' ? '12' : '10';
  calculate();
}

// ─── Main calculation ──────────────────────────────────────────────────────

export function calculate() {
  const material  = getEl('amp-material')?.value;
  const size      = getEl('amp-size')?.value;
  const tempRating = getEl('amp-temp')?.value;     // "60" | "75" | "90"
  const ambientF  = parseFloat(getEl('amp-ambient')?.value) || 86;
  const ccc       = parseInt(getEl('amp-ccc')?.value, 10)  || 3;

  // Output elements
  const baseEl      = getEl('amp-base');
  const tempFEl     = getEl('amp-temp-factor');
  const bundleFEl   = getEl('amp-bundle-factor');
  const finalEl     = getEl('amp-final');
  const statusEl    = getEl('amp-status');

  if (!material || !size || !tempRating || !necData) return;

  // 1. Base ampacity from NEC Table 310.15(B)(16)
  const baseAmp = necData.ampacity[material]?.[size]?.[tempRating];
  if (baseAmp === undefined) {
    [baseEl, tempFEl, bundleFEl, finalEl].forEach(el => { if (el) el.textContent = '--'; });
    if (statusEl) setStatus(statusEl, true, '', 'Invalid selection');
    return;
  }

  // 2. Temperature correction factor
  const tempFactor = getTempFactor(parseInt(tempRating, 10), ambientF);
  if (tempFactor === null) {
    [baseEl, tempFEl, bundleFEl, finalEl].forEach(el => { if (el) el.textContent = '--'; });
    if (statusEl) setStatus(statusEl, true, '', 'Ambient ≥ conductor rating — unusable');
    return;
  }

  // 3. Bundling / conduit-fill correction factor
  const bundleFactor = getBundlingFactor(ccc, necData.ampacity.bundlingFactors);

  // 4. Derated ampacity
  const derated = baseAmp * tempFactor * bundleFactor;

  // Update display
  if (baseEl)    baseEl.textContent    = `${baseAmp} A`;
  if (tempFEl)   tempFEl.textContent   = tempFactor.toFixed(2);
  if (bundleFEl) bundleFEl.textContent = bundleFactor.toFixed(2);
  if (finalEl)   finalEl.textContent   = `${Math.floor(derated)} A`;

  // Status: flag notable derating (final < 80% of base)
  const heavilyDerated = derated < baseAmp * 0.8;
  if (statusEl) {
    setStatus(statusEl, heavilyDerated,
      'Within Normal Range',
      'Significantly Derated — Upsize Wire');
  }
}

// ─── Init ──────────────────────────────────────────────────────────────────

export function init(data) {
  necData = data;

  const material   = getEl('amp-material');
  const sizeEl     = getEl('amp-size');
  const tempRating = getEl('amp-temp');
  const ambientEl  = getEl('amp-ambient');
  const cccEl      = getEl('amp-ccc');

  material?.addEventListener('change', () => { populateSizes(); });
  sizeEl?.addEventListener('change', calculate);
  tempRating?.addEventListener('change', calculate);
  ambientEl?.addEventListener('input', calculate);
  cccEl?.addEventListener('input', calculate);

  populateSizes();
}
