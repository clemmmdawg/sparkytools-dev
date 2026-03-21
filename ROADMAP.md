# ⚡ SparkyTools – Roadmap

## Vision
SparkyTools will become the **most useful free NEC calculator toolkit available online** — used daily by electricians in the field. It should work reliably on mobile devices, function offline as an installable PWA, and produce results that are accurate enough to trust on the job.

## Design Goals
- **Mobile-first** — every control and result must be usable on a phone one-handed
- **No build step, no dependencies** — vanilla JS, works by opening `index.html`
- **NEC-accurate** — every calculation cites its code reference; nothing is guesswork
- **Fast** — calculations run instantly; no spinners, no network requests
- **Open** — AGPL v3; source stays open

## Target Users
Electricians, electrical contractors, inspectors, apprentices, and engineers who need quick NEC references in the field.

---

## Priority Legend
- `P0` — Must have / foundational
- `P1` — High value, next up
- `P2` — Solid additions, planned
- `P3` — Long-term / nice to have
- `P4` — Fun / non-critical
- ✅ — Complete

---

## P0 – Foundation

- ✅ **Modular JS architecture** — `script.js` split into calculator modules, UI modules, and shared utils under `src/js/`
- ✅ **NEC data externalized** — all table values live in `data-loader.js` (inlined for zero-fetch hosting compatibility); no NEC constants in logic files
- ✅ **CSS split into 5 files** — `base.css`, `conduit-fill.css`, `box-fill.css`, `pull-box.css`, `service-load.css`
- ✅ **HTML & CSS cleanup** — Tailwind CDN removed; inline styles replaced with CSS classes; all hardcoded colors moved to custom properties (`--surface-row`, `--surface-inset`, `--divider`, `--warn-*`)
- ✅ **Progressive Web App** — `manifest.json`, service worker (cache-first, offline capable), SVG app icon, iOS meta tags, update toast on new version
- ✅ **Dark mode** — system preference detection, manual toggle, `localStorage` persistence, SVG renderers redraw on theme change

---

## P1 – UI & UX

- ✅ **Mobile input sizing** — all inputs ≥ 44px height
- ✅ **Dark/light theme toggle** — fixed bottom-left button, persists across sessions
- ✅ **Drawer navigation** — sticky top bar + slide-in drawer replaces horizontal scroll strip; groups calculators, scales to any number of tools
- ✅ **About page** — donation link, license info, disclaimer; accessible from the drawer
- **Result panel status colors** — green/yellow/red on conduit fill and box fill status pills (partially done via `.status-pill`; formalize the thresholds)
- **Calculator tab icons** — emoji or SVG icon already in drawer; ensure consistent iconography across all views
- **Copy Result button** — clipboard API to copy formatted calculation output as plain text
- **Ohm's Law / Power Wheel** — ✅ Complete (see P2 entry below)

---

## P2 – New Calculators

### ✅ Residential Service Load (NEC 220)
Standard Method (220.40–220.53) and Optional Method (220.82/220.83). Dynamic rows for cooking, dryers, fixed appliances, HVAC, and custom loads. Load shedding with generator sizing. Existing service adequacy check. Print layout.

**Added in v1.0.0:**
- Neutral conductor sizing per NEC 220.61(A)/(B)(1) — cooking/dryer demand at 70% per Table 220.55/220.54; conductor from Table 310.16.
- Grounding electrode conductor per NEC 250.66, Table 250.66 — sized to the recommended service amperage.

**Planned additions (future revision):**
- System bonding jumper (250.28) and equipment grounding conductor (T250.122).

### ✅ Transformer Calculator (NEC 450, 310, 240.21)
Single-phase and three-phase transformer sizing. Primary/secondary FLA, turns ratio, OCPD per T450.3(B), conductor sizing per T310.16 (75°C Cu THWN). Secondary tap rule per NEC 240.21(C) with four options. Live SVG line diagram. L-N secondary voltages handled correctly.

**Planned additions (future revision):**
- Grounding electrode conductor (T250.66), system bonding jumper (250.28), EGC (T250.122).
- Delta/wye winding configuration selector with schematic.

### ✅ Ohm's Law / Power Wheel
Solve for any one of **P, I, E, R** given any two known values. DC and single-phase AC. The classic "power wheel" reference every apprentice memorizes.

Reference: Ohm's Law (V = IR), Power Law (P = IV)

### ✅ Panel Schedule
Document and analyze a residential or light-commercial loadcenter. Circuit types: standard, tandem, complex (3- and 4-pole), Empty, Spare. Per-slot circuit numbers, phase (A/B/C) spine, wire/conduit per slot. Mobile tab layout (left/right sides). Full print layout.

### Ampacity Calculator (NEC 310.16)
Adjusted ampacity for a conductor given load and installation conditions.

Inputs: conductor size (AWG/kcmil), material (CU/AL), insulation type, ambient temperature (°C), number of current-carrying conductors in raceway
Outputs: base ampacity, temperature correction factor, bundling adjustment factor, final adjusted ampacity
Reference: NEC 310.16, Table 310.15(B)(1) (temp correction), Table 310.15(C)(1) (bundling)

### Motor Circuit Calculator (NEC 430)
Full motor circuit sizing in one tool — more useful than FLA alone.

Inputs: motor HP, voltage, phase (1Ø / 3Ø), service factor
Outputs: FLA (Tables 430.248/430.250), minimum conductor size (430.22, 125% FLA), max OCPD size (430.52, Table 430.52), overload protection size (430.32)

### Conduit Bend Calculator
Field layout math for offsets and saddles.

Inputs: offset height, bend angle (10° / 22.5° / 30° / 45° / 60°)
Outputs: distance between bends (offset × multiplier), shrink amount
Reference: standard offset multiplier and shrink factor tables

---

## P3 – Larger Features

### Motor Short-Circuit / Fault Current Estimator
Given service transformer kVA, impedance, and wire run to the panel, estimate available fault current at the panel. Used to verify the AIC rating of breakers and disconnects is sufficient.

Inputs: transformer kVA, %Z, primary voltage, secondary voltage, conductor size and length from transformer to panel
Output: estimated available fault current (kA)

### AFCI / GFCI Requirement Lookup (NEC 210.8, 210.12)
Room-by-room checklist of where AFCI and GFCI protection is required per the 2023 NEC. Gets asked constantly on rough-in inspections.

Inputs: room/location type
Output: required protection type with NEC reference

### NEC Version Support
Data layer support for NEC 2020 and NEC 2023 (2026 when published). Version selector in the UI loads the appropriate dataset. Most useful for jurisdictions still on older editions.

---

## P4 – Easter Eggs

### 🥚 Mike Holt Smash
Trigger a surprise animation when the user enters the Konami code (↑ ↑ ↓ ↓ ← → ← → B A) anywhere on the page.

- Page shakes briefly (CSS keyframe on `body`)
- Mike Holt crashes in from off-screen, holds 2–3 seconds, retreats
- Click/tap anywhere dismisses early
- Works in both light and dark mode
- Lives in `src/js/ui/easter-eggs.js`, imported in `app.js`
- Image asset in `public/images/`
- Zero impact on calculator functionality