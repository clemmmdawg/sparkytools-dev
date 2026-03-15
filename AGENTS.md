# AGENTS.md — SparkyTools AI Agent Guide

Welcome to SparkyTools. Read this document in full before touching any code.
It reflects the actual current state of the project as of v10.7.0.

> **Supersedes:** `AGENT_GUIDE.md` and `REPO_STRUCTURE.md` (both outdated — ignore them).

---

## What Is SparkyTools?

SparkyTools is a **free, open-source, mobile-first NEC electrical calculator PWA**.
It runs entirely in the browser with no build step, no framework, and no backend.
The target user is an electrician on a job site using their phone.

- **License:** GNU AGPL v3 — source must stay open if distributed or hosted
- **Stack:** Vanilla JS (ES6 modules), plain CSS (custom properties), SVG for visualizers
- **No:** React, Vue, TypeScript, Webpack, npm, Tailwind, or any external runtime dependency
- **Hosting:** Works by opening `index.html` directly; also deployable as a PWA

---

## File Map

```
sparkytools/
│
├── index.html                  # Single-page app — all calculator sections live here
├── service-worker.js           # PWA cache-first service worker
│
├── src/
│   ├── css/
│   │   ├── base.css            # Global tokens, layout, nav, cards, shared components
│   │   ├── conduit-fill.css
│   │   ├── box-fill.css
│   │   ├── pull-box.css
│   │   ├── service-load.css    # Also contains all @media print rules
│   │   └── transformer.css
│   │
│   └── js/
│       ├── app.js              # Entry point — imports and inits all modules
│       ├── data-loader.js      # IIFE; all NEC table data inlined as object literals
│       │
│       ├── calculators/
│       │   ├── conduit-fill.js
│       │   ├── voltage-drop.js
│       │   ├── box-fill.js
│       │   ├── pull-box.js
│       │   ├── service-load.js # Largest calculator; Standard + Optional NEC 220 methods
│       │   └── transformer.js
│       │
│       ├── ui/
│       │   ├── navigation.js   # Drawer open/close, active state, top-bar sync
│       │   └── theme.js        # Light/dark toggle, localStorage, dispatches "themechange"
│       │
│       └── utils/
│           └── formatting.js   # getEl(), getCSSVar(), setStatus(), formatNumber(), randomColor()
│
├── pwa/
│   └── manifest.json
│
├── public/
│   └── icons/icon.svg
│
├── AGENTS.md                   # ← You are here
├── CHANGELOG.md                # Full version history
└── ROADMAP.md                  # Vision, priorities, planned calculators
```

**Files you can safely ignore:** `AGENT_GUIDE.md`, `REPO_STRUCTURE.md`, `CALCULATION_SPEC.md`,
`test-nav.html`, `index.html.bak`, `src/css/styles.css` (legacy), `src/data/2023/` (legacy JSON,
superseded by inlined data in `data-loader.js`).

---

## Architecture Overview

### Navigation

The app uses a **sticky top bar + slide-in drawer** pattern (introduced in v10.6.0).

- `.nav-bar` — sticky bar showing active tool name + hamburger button. Always visible.
- `.drawer` — fixed-position right-side panel listing all calculators.
- `.drawer-item` — one per calculator section; carries `data-target`, `data-label`, `data-accent`.
- `navigation.js` reads those data attributes and wires everything up — no hardcoded labels in JS.

When you add a new calculator you must add a `<button class="drawer-item">` to the drawer in
`index.html`. That is the only registration step required.

### Calculator Sections

Each calculator is a `<section id="[tool]-tool" class="card tool-section">` inside `.container` in
`index.html`. CSS class `.tool-section` hides it by default; `navigation.js` adds `.active` to the
selected one.

The **About** section (`#about-tool`) follows the same pattern — it's just a regular tool section
accessible from the drawer.

### Data

All NEC table data is **inlined in `data-loader.js`** as a plain object literal (no JSON fetch).
This was necessary because some hosting environments (e.g. Playcode.io) return 403 on `.json` files
in subdirectories.

`data-loader.js` exposes `window.NECDataLoader` (loaded via a plain `<script>` tag before `app.js`).
`app.js` calls `await NECDataLoader.loadNECData("2023")` and passes the result to every calculator's
`init(necData)` function.

If you add new NEC data (e.g. for a new calculator), add it as a new key in the object literal
inside `data-loader.js`. Do **not** create new JSON files under `src/data/` — that pattern is
deprecated.

### Theme

`theme.js` sets `data-theme="dark"|"light"` on `<html>` and dispatches a `"themechange"` custom
event on `document`. SVG-drawing functions listen for this event and call `getCSSVar()` at draw
time to pick up the correct token values. Always do the same in any new SVG renderer.

---

## CSS Patterns

### Design Tokens (defined in `base.css` `:root`)

Key tokens you'll use constantly:

```
--primary         text / icon color
--card-bg         card background
--surface-inset   inset panel / fieldset background
--surface-row     alternating row background
--border          input/card border
--divider         thin separator lines
--text-muted      secondary/helper text
--danger          red error state
--accent-blue     Conduit Fill / Transformer accent
--accent-yellow   Voltage Drop accent
--accent-green    Box Fill accent
--accent-orange   Pull Box accent
--accent-red      Service Load accent
--svg-box-stroke  SVG element stroke color (theme-aware)
--svg-conduit-bg  SVG fill for boxes/conduit rings
--svg-dim-color   SVG dimension labels
--svg-placeholder SVG empty-state text
```

### Card Colors

Each tool section gets a colored top border via a modifier class on `.card`:

```html
<section class="card card--blue tool-section">   <!-- Transformer, Conduit Fill -->
<section class="card card--yellow tool-section"> <!-- Voltage Drop -->
<section class="card card--green tool-section">  <!-- Box Fill -->
<section class="card card--orange tool-section"> <!-- Pull Box -->
<section class="card card--red tool-section">    <!-- Service Load -->
```

### Result Cards

Use this pattern for result panels (see `transformer.css` and `service-load.css`):

```html
<div class="tc-card tc-card--ocpd">
  <div class="tc-card-title">🔴 Section Name</div>
  <div class="tc-metrics">
    <div class="tc-metric">
      <div class="tc-metric-value tc-metric-value--lg" id="some-id">—</div>
      <div class="tc-metric-label">Label Text</div>
    </div>
  </div>
  <div class="tc-card-note">Code reference note here.</div>
</div>
```

The service load calculator uses an older variant (`sl-service-card`, `sl-metric`) — use the `tc-*`
pattern for any new calculator.

### NEC Reference Badges

```html
<span class="tc-nec-ref" data-tip="Tooltip text explaining the code section.">NEC 450.3</span>
```

Place these inline in `<label>` elements. `initTooltips()` in `navigation.js` handles tap-to-show
on mobile automatically for anything with `data-tip`.

---

## JavaScript Patterns

### Module Structure

Every calculator follows this pattern:

```js
// Minimal imports — only what's needed
import { getEl, getCSSVar } from '../utils/formatting.js';

// NEC tables embedded in the module (not fetched)
const MY_TABLE = { ... };

// init() receives necData from data-loader but can ignore it if self-contained
export function init(necData) {
  // wire up inputs, set initial state, draw blank diagram
}
```

Calculators that need live updates (like `transformer.js`) wire all inputs to a single `update()`
function. Calculators that need a button click (like `service-load.js`) wire a `calculate()` call
to the button.

### Utility Functions (`formatting.js`)

| Function | Usage |
|---|---|
| `getEl(id)` | Safe `getElementById` with a console warning on miss |
| `getCSSVar(name)` | Read a CSS custom property at call time (use in SVG renderers) |
| `setStatus(el, isOver, okText, errText)` | Update a status pill element |
| `formatNumber(value, decimals)` | Round to N decimal places |
| `randomColor()` | HSL→hex, used for conductor row colors in visualizers |

### SVG Renderers

All SVG is built programmatically via `document.createElementNS`. Follow the pattern in
`pull-box.js` or `transformer.js`:

1. Clear `svg.innerHTML = ""` at the top of every draw call.
2. Sample all CSS tokens via `getCSSVar()` at the top of every draw call — never cache them.
3. Listen for `"themechange"` on `document` and redraw.
4. Use a local `el(tag, attrs, parent)` helper to reduce verbosity.

---

## How to Add a New Calculator

1. **Create `src/js/calculators/[name].js`** — export `init(necData)`.

2. **Create `src/css/[name].css`** — prefix all classes with a 2–3 letter namespace (e.g. `tc-`
   for transformer, `sl-` for service load) to avoid collisions.

3. **Add `<link rel="stylesheet">` in `index.html` `<head>`.**

4. **Add the `<section id="[name]-tool">` block** inside `.container` in `index.html`. Copy the
   comment block + section header pattern from an existing tool.

5. **Add a drawer item** in the `<nav class="drawer">` block at the bottom of `index.html`:

   ```html
   <button class="drawer-item"
           data-target="[name]-tool"
           data-label="Human-Readable Name"
           data-accent="var(--accent-blue)">
     <span class="drawer-item-icon">🔧</span>Name
   </button>
   ```

6. **Import and call `init()` in `app.js`:**

   ```js
   import * as MyCalc from './calculators/my-calc.js';
   // ...inside init():
   MyCalc.init(necData);
   ```

7. **Update `CHANGELOG.md`** with the new version entry.

8. **Update `ROADMAP.md`** to mark the calculator ✅.

9. **Bump the service worker cache version** in `service-worker.js` so returning PWA users pick
   up the new files.

---

## Critical Rules

### Always read before writing

Read the relevant existing files before making any changes. The patterns in `service-load.js`,
`transformer.js`, `base.css`, and `navigation.js` were deliberately chosen — don't invent new
patterns without a good reason.

### NEC accuracy is non-negotiable

Every calculated value must cite its NEC code section in a comment and in the UI. If you're
unsure about a calculation, say so — do not guess. Wrong NEC calculations are worse than no
calculator at all.

### Mobile first

- All touch targets ≥ 44px tall
- Test every layout at 360px wide
- No hover-only interactions; anything that needs a tooltip must use `data-tip`
- No horizontal overflow inside `.container`

### No external dependencies at runtime

Do not add `<script src="...cdn...">` tags, `import` from npm packages, or fetch from external
APIs. The app must work fully offline after the first load.

### One CSS file per calculator

Do not put new calculator styles in `base.css`. Put them in their own file and `<link>` it.
`base.css` is for shared tokens, layout, cards, nav, and theme — not calculator-specific UI.

### Don't touch unrelated files

If you're building the Motor Circuit Calculator, you should not be editing `service-load.js` or
`conduit-fill.css`. Scope your changes to the files your task requires.

### Print styles live in `service-load.css`

The `@media print` block that hides the nav, drawer, and non-service-load sections lives at the
bottom of `service-load.css`. If the hide list needs updating (e.g. a new UI element appears in
print), edit that block — don't create a second print block elsewhere.

---

## What's Next (from ROADMAP.md)

Top candidates for the next calculator build:

1. **Ohm's Law / Power Wheel** — P1 priority; small, self-contained, no NEC tables required.
   Solve for any of P / I / E / R given any two known values.

2. **Ampacity Calculator (NEC 310.16)** — Given conductor size, material, insulation, ambient
   temp, and number of CCC in raceway, output adjusted ampacity with correction factors.

3. **Motor Circuit Calculator (NEC 430)** — HP, voltage, phase → FLA, minimum conductor,
   max OCPD, overload protection size.

**Planned additions to existing calculators:**

- **Transformer:** Grounding electrode conductor (T250.66), system bonding jumper (250.28), EGC
  (T250.122), and delta/wye winding configuration selector.
- **Service Load:** Same grounding/bonding additions.

See `ROADMAP.md` for full priority list and scope notes.

---

## Quick Reference: NEC Sections Used

| Calculator | Key NEC References |
|---|---|
| Conduit Fill | 300.17, Ch. 9 Table 1, Ch. 9 Tables 4 & 5 |
| Voltage Drop | 210.19(A)(1) Informational Note |
| Box Fill | 314.16, T314.16(B) |
| Pull Box | 314.28 |
| Service Load | 220.12, 220.40–220.53, 220.52, 220.54–220.55, 220.60, 220.82, 220.83 |
| Transformer | T450.3(B), T310.16, 240.6(A), 240.21(C) |
| (Planned) Ampacity | T310.16, T310.15(B)(1), T310.15(C)(1) |
| (Planned) Motor | T430.248, T430.250, 430.22, 430.52, T430.52, 430.32 |
| (Planned) GEC | T250.66, T250.122, 250.28 |