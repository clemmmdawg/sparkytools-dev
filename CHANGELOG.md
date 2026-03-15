# Changelog

All notable changes to SparkyTools are documented in this file.

---

## [10.7.0] - 2026-03-15 - Transformer Calculator

### Added
- **Transformer Calculator** — New calculator module (`src/js/calculators/transformer.js`) for single-phase and three-phase dry-type transformer sizing per the NEC.
  - **Inputs:** Phase (1Ø / 3Ø), primary voltage (dropdown: 480 / 240 / 208 V L-L), secondary voltage (dropdown: 480 / 240 / 208 V L-L + 120 / 277 V L-N), kVA rating, secondary OCPD location (tap rule).
  - **Live results:** Primary and secondary FLA, turns ratio, primary OCPD (T450.3(B)), secondary OCPD (T450.3(B)), primary conductor size (T310.16), secondary conductor size (T310.16 + tap rule). All results update on every input change — no Calculate button required.
  - **L-N voltage handling** — 120 V and 277 V secondary options correctly treated as single-phase regardless of primary phase selection.
  - **NEC T450.3(B) OCPD** — Primary-only protection at 125% (FLA ≥ 9 A) or 167% (FLA < 9 A); secondary OCPD at same thresholds; primary-with-secondary-protection option at 250% primary FLA. All values snapped to next standard size per NEC 240.6(A).
  - **NEC 240.21(C) secondary tap rules** — Four options: OCPD at secondary terminals, protected by primary OCPD only (C)(1), ≤ 10 ft tap (C)(2), ≤ 25 ft tap (C)(3). Each option computes the correct minimum secondary conductor ampacity and shows a plain-English code note.
  - **Conductor sizing** — Primary conductors at 125% FLA per NEC 450.3; secondary conductors at the greater of 125% FLA or the tap rule minimum. All sized from NEC T310.16, 75°C Cu THWN in conduit.
  - **Line diagram** — Simplified SVG schematic showing: Primary OCPD → primary wire label + FLA → transformer symbol (with coil bumps, voltage labels, kVA/phase tag) → secondary wire label + FLA → Secondary OCPD. Secondary OCPD box dims when the primary-only tap rule removes the requirement. Dark-mode aware via CSS custom properties.
- **`src/css/transformer.css`** — Dedicated stylesheet matching existing card, metric, and section-title patterns.
- **Transformer drawer item** — Added to the navigation drawer between "Service Sizing" and "Conduit Fill."
- **`src/css/transformer.css`** linked in `index.html` `<head>`.
- **`Transformer.init()`** called from `app.js`.

### Deferred to future release
- Grounding electrode conductor (T250.66), system bonding jumper (250.28), and equipment grounding conductor (T250.122) sizing — planned for a future revision alongside similar additions to the Service Load calculator.
- Delta/wye winding configuration selector.

---

## [10.6.0] - 2026-03-15 - Drawer Navigation & About Page

### Added
- **Slide-in drawer navigation** — Replaced the horizontal pill-strip nav with a sticky top bar + right-side drawer pattern (Option C from `test-nav.html` prototype).
  - **`.nav-bar`** — Sticky bar showing the active calculator name with a colored accent dot and a hamburger menu button. Always visible; never scrolls off screen.
  - **`.drawer`** — Fixed-position slide-in panel (right side) listing all calculators grouped into "NEC Calculators" and "App." Closes on item selection, overlay click, or Escape key.
  - **`.drawer-overlay`** — Semi-transparent dim layer behind the open drawer; click-to-close.
  - Each `drawer-item` carries `data-target`, `data-label`, and `data-accent` attributes so the top bar and left-border color sync to the active calculator automatically.
  - Keyboard accessible: Escape closes the drawer; all buttons reachable by Tab.
- **About section** — New `#about-tool` calculator section accessible from the drawer.
  - **Donation card** — "Buy Me a Coffee" button linking to Ko-fi (TODO: swap placeholder URL).
  - **License card** — Links to GNU AGPL v3 license and source repository (TODO: swap placeholder repo URL).
  - **Disclaimer** — Moved from the site footer into the About section.
- **`navigation.js` rewritten** — `initNavigation()` updated for the drawer model. Handles open/close, active state sync, accent dot color, and active border color per-item.

### Changed
- **Site footer simplified** — Disclaimer text removed (now in About section); footer reduced to the one-line tagline.
- **Print styles updated** — `service-load.css` print hide list updated from `.tool-nav` → `.nav-bar`, `.drawer-overlay`, `.drawer`.
- **`base.css`** — Old `.tool-nav` / `.nav-item` rules replaced with `.nav-bar`, `.nav-bar-btn`, `.drawer`, `.drawer-item`, and all associated styles. New `.about-*` styles added.

### Removed
- **`.tool-nav` / `.nav-item`** — Horizontal scrolling pill nav removed from HTML and CSS.
- **Footer disclaimer** — Consolidated into the About section; footer is now a single-line credit.

---

## [0.9.0] - 2026-03-12 - Service Load Refinements

### Fixed
- **Cooking equipment not appearing in shed results** — `hasShedLoads()` was not checking `cookingLoads`, so `shedResult` was never computed when only cooking loads were shed. Both `runStandard` and `runOptional` also skipped the entire cooking block when all cooking was shed; they now always render sub-items for every cooking row.
- **SHED badges not showing on consolidated table** — All step objects used `shed: ex(load)` for display, which always evaluates to `false` in the full-load table (since `ex` returns false when not excluding). Changed to `shed: load.shed` throughout `runStandard`, `runOptional`, `computeHVAC`, and `computeHVACOptional` so SHED badges render correctly.
- **Duplicate `@media print` block** — Two separate print blocks in `service-load.css` merged into one, with a unified hide list.
- **Navigation visible in print preview** — `.tool-nav` added to the print hide list (was previously only suppressed via the stale `.nav-tabs` selector).
- **Dead space above print header** — Print block now zeroes out the `.container` flex gap and removes `#service-tool`'s top padding and colored border, eliminating the blank space above the `SparkyTools — Residential Service Load Calculation` title without affecting the browser's native page margin.
- **`sl-auto-info` section removed** — `updateAutoLoadsDisplay()` and its call in `calculate()` removed from `service-load.js`; associated HTML and CSS rules cleaned up.

### Added
- **Consolidated results view** — "Total Calculated Load" and "After Load Shedding" results merged into a single table and service card. All loads appear in one table with SHED badges inline; no separate second table.
- **Generator recommendations** — When any loads are shed, a generator sizing section appears inside the `sl-service-card` showing calculated generator load in kW (amps in parentheses), a recommended generator size snapped to standard residential kW ratings (7.5–200 kW), and a note about sizing to 125% for motor inrush.
- **`recommendGeneratorKW()`** — New helper that snaps a VA load to the nearest standard generator kW size.
- **`GENERATOR_SIZES_KW` constant** — Standard residential/light commercial generator size array.
- **Inline NEC reference tooltips** — All service load fieldset labels updated to use `data-tip` on `<span class="sl-nec-ref">` badges rather than on the `<label>` element itself. Tooltips added or improved for: Dwelling Type, Calculation Method, Dwelling Area, Small Appliance, Laundry, Cooking, Dryers, Fixed Appliances, HVAC, and Custom Loads.
- **Card header title** — Service load section heading updated to "Residential Service and Generator Sizing".

### Changed
- **Default calculator tab** — Service Sizing is now the default active tab on load (was Conduit Fill).
- **Print summary** — Laundry Circuits and SA Circuits removed from the print-only input summary; now shows only Dwelling, Method, Floor Area, and (conditionally) Existing Service.
- **Site header** — `<h1>` changed from `⚡ SparkyTools` to `Sparky ⚡ Tools`.
- **Header tagline** — Shortened to "Free tools for electricians."
- **Button labels** — Cooking button changed to "+ Add Cooking Equipment"; dryer button to "+ Add Electric Dryer".
- **Footer branding** — "SparkyTools v10" → "Sparky Tools"; tagline changed to "Free as in freedom. Free as in beer."
- **License** — Changed from WTFPL to GNU AGPL v3. Footer updated with link to `https://www.gnu.org/licenses/agpl-3.0.html` and note "Source code must remain open."
- **`sl-gen-section` CSS** — New styles for the generator sizing block inside the service card. Old `.sl-shed-section`, `.sl-shed-subtitle`, and `.sl-service-card--shed` rules removed.
- **`serviceCard()` signature** — Now receives `shedResult` as second argument instead of an `isShed` boolean.
- **`renderResults()`** — Renders one table only; generator section folded into `serviceCard()`.

### Data / Infrastructure
- **NEC data inlined into `data-loader.js`** — All five JSON datasets (conduit, conductors, boxfill, pullbox, serviceLoad) embedded directly as object literals. Eliminates all network fetch requests; works on any host including Playcode.io which returned 403 for `.json` files in subdirectories.
- **`nec-data.js` script tag removed** from `index.html` (file still exists in `src/data/2023/` but is no longer loaded).
- **`data-loader.js` exports** — Added `window.NECDataLoader` assignment alongside the existing CommonJS export.
- **Service worker** bumped to cache version `sparkytools-v0.9.0`.

### Optional Method 220.82(C) HVAC Rewrite (`service-load.js`)
- **Bug: HVAC was included in `allLoads`** and subject to the 220.82(B) two-tier demand factor — it should be added after. Fixed.
- **Bug: Electric resistance heating demand factors not applied** — 65% for fewer than 4 units, 40% for 4 or more units, per 220.82(C)(4)/(5). Now correctly applied.
- **Bug: Heat pump heating not distinguished from resistance heating** — Heat pumps at 100% per 220.82(C)(2), resistance heating at 65%/40%. Detection via `typeName.toLowerCase().includes('heat pump')`.
- **New `computeHVACOptional(hvacLoads, ex)` function** — Groups loads into cooling, heat pump heating, and resistance heating; selects the group with the largest nameplate total; applies that group's demand factor; shows losing groups as non-coincident sub-items.

---

## [10.4.0] - 2026-03-12 - CSS Split & Service Load Fixes

### Changed
- **CSS split into 5 files** — Monolithic `src/css/styles.css` split into: `base.css` (global tokens, layout, shared components), `conduit-fill.css`, `box-fill.css`, `pull-box.css`, `service-load.css`. `index.html` updated with five `<link>` tags. Service worker cache manifest updated; `CACHE_VERSION` bumped to `v10.4.0`.

### Fixed
- **HVAC double/triple counting in optional method** — Non-coincident load steps were carrying their full `va` value and being summed in `allLoads.reduce()`. Fixed by setting `va: 0` on non-coincident steps and `va: 0` on the HVAC summary step (display-only). Also removed the `isStandard` parameter from `computeHVAC`.
- **Electric heating demand factor** — `electricHeatFactor` corrected to `1.0` in the NEC data; vestigial `heatFactor`, `heatingBase`, and `adjVA` variables removed. Heating is now always shown at nameplate VA (100%) per NEC 220.51.
- **Browser compatibility** — Removed `color-mix()` CSS function calls that failed in older Safari and Firefox; replaced with equivalent flat color values.

### Added
- **Cooking equipment dynamic rows** — Static range/cooktop/oven inputs replaced with a repeatable row system. `COOKING_TYPES`: Range/Cooktop, Wall Oven, Cooktop, Custom. Rows wire up the same auto-fill + custom name pattern as Fixed Appliances. `collectInputs` now reads `cookingLoads` instead of `rangeW`/`ovenW`. Standard method applies Table 220.55 demand across all active cooking VA combined; optional method folds cooking into the 220.82(B) pool.
- **EV Charger fieldset removed** — Section removed from `index.html`; `evChargerW` removed from `collectInputs` and both `runStandard`/`runOptional`.
- **Clear button** — "↺ Clear" button added next to Print; `clearCalculator()` resets all static inputs and empties all dynamic lists.
- **Two-line load row layout** — `.sl-load-row` now stacks inputs on top and controls (Shed / New / ✕) in a separate row below with a distinct `--surface-inset` background, preventing wrapping on mobile.

---

## [10.3.0] - 2026-03-11 - Service Load Refactor

### Changed
- **All load units changed from W to VA** — All step label strings, input `sl-unit` spans, and aria-labels changed from "W" / "watts" to "VA". Default values updated (dryer: 5,500 VA; HVAC: first-option default).
- **Fixed appliance auto-fill** — `FIXED_TYPES` changed from a string array to objects with `name` and `defaultVA`. Selecting a type from the dropdown now auto-fills the VA input; remains manually editable.
- **HVAC auto-fill** — Same pattern: `HVAC_OPTIONS` gained `defaultVA`; type change auto-fills the VA input.
- **`input[type="text"]` unified styling** — Added to the base `select, input[type="number"]` rule and `:focus` rule so text inputs (custom names) match the height, border, and color of all other inputs.

### Fixed
- **Print-only header not rendering** — `sl-print-header` display fix in `@media print`.

---

## [10.2.0] - 2026-03-10 - Service Load Calculator (Initial Build)

### Added
- **Residential Service Load Calculator** — Full NEC Article 220 implementation added as a new tab ("Service Sizing").
  - **Standard Method (NEC 220.40–220.53)** — General lighting/receptacles (220.12, 3 VA/sq ft), small appliance circuits (220.52(A), min 2 × 1,500 VA), laundry circuits (220.52(B), min 1 × 1,500 VA), Table 220.42 demand on lighting subtotal, cooking equipment via Table 220.55, electric dryers via 220.54 (5,000 VA minimum, multi-dryer Table 220.54 factors), fixed appliances via 220.53 (75% demand when ≥4 active), HVAC non-coincident load via 220.60.
  - **Optional Method (NEC 220.82 / 220.83)** — New dwellings use 220.82 (first 10,000 VA × 100%, remainder × 40%); existing dwellings use 220.83 (first 8,000 VA × 100%, remainder × 40%). "New Load" toggle on each row for 220.83 documentation.
  - **Load shedding** — Each dynamic row has a "Shed" checkbox. A separate "After Load Shedding" result section shows the reduced load and recommended generator/ATS size.
  - **Existing service adequacy check** — Existing service amperage input; result shows ✅/⚠️ adequacy against calculated demand.
  - **Dynamic repeatable rows** — Add/remove rows for: cooking equipment, electric dryers, fixed appliances (with dropdown of common types and Custom option), HVAC units (cooling/heating with type select).
  - **Stepper controls** for small appliance and laundry circuit counts.
  - **Step-by-step results table** — Every load, demand factor, and subtotal shown with NEC reference badges. Non-coincident HVAC load shown as N/C (not SHED).
  - **Service card** — Calculated VA, amps at 240V, recommended service size, and service entrance conductor sizing (Table 310.16, 75°C terminals).
  - **Print layout** — `@media print` hides all input fieldsets, nav, and controls; shows a print-only header, brief input summary, and results only.
  - **`src/js/calculators/service-load.js`** — New calculator module.
  - **`src/data/2023/serviceLoad` data** — Demand tables, conductor sizes, standard service sizes added to `data-loader.js` inline data.

### Changed
- **`+/−` stepper component** — New `.sl-stepper` pattern (decrement button, readonly number input, increment button) used for SA and laundry circuit counts.
- **NEC reference badges** — `.sl-nec-ref` inline badge component added to fieldset legends throughout the service tool.

---

## [10.1.0] - 2026-03-10 - Dark Mode, PWA & UI Cleanup

### Added
- **Dark mode** — Full light/dark theme system. Automatic detection via `prefers-color-scheme`; manual override via theme toggle button (bottom-left corner). Preference persisted in `localStorage('sparky-theme')`. `data-theme` attribute on `<html>` controls active theme. Dispatches `themechange` custom event so SVG renderers redraw.
  - New CSS custom properties: `--svg-box-bg`, `--svg-box-stroke`, `--svg-conduit-bg`, `--svg-dim-color`, `--svg-empty-text`, `--nav-bg`, and dark overrides for all existing tokens.
  - `src/js/ui/theme.js` — New module handling initialization, toggle, and OS preference sync.
- **Progressive Web App (PWA)**
  - `pwa/manifest.json` — App name, standalone display, brand colors, SVG icon.
  - `img/bolt.png` — Lightning bolt app icon on brand dark background.
  - `pwa/service-worker.js` — Cache-first strategy for app assets; stale-while-revalidate for Google Fonts. `skipWaiting` + `clients.claim()` for immediate activation. Graceful per-asset fallback via `Promise.allSettled`.
  - PWA meta tags added to `index.html` — `<link rel="manifest">`, iOS `apple-mobile-web-app-*` meta, `apple-touch-icon`, `theme-color`.
  - Service worker registration in `app.js` with `updatefound` listener.
  - Update toast — `showUpdateToast()` renders a bottom-right notification with a Reload button when a new SW version activates.
- **`getCSSVar(name)`** — New utility in `formatting.js`; reads a CSS custom property from `:root` at call time, used by SVG renderers to stay in sync with the active theme.

### Changed
- **SVG colors use CSS variables** — Conduit ring `fill`/`stroke` converted from inline SVG attributes to `.conduit-ring` CSS class. Pull box visualizer reads `getCSSVar()` for all five dynamic colors at draw time.
- **`.footer-disclaimer` renamed to `.footer-notice`** — Avoids false-positive matches by ad-blocker filter lists (uBlock Origin hides elements with "disclaimer" in the class name).
- **`index.html` cleanup** — Tailwind CDN script tag removed. Section visibility changed from inline `style="display:none"` to CSS class `.tool-section` (hidden) / `.active` (shown). Navigation JS updated to toggle `.active` class instead of `style.display`.
- **CSS custom properties** — Added `--surface-row`, `--surface-inset`, `--divider`, `--warn-bg/border/text` to `:root`; replaced scattered hardcoded `#f8f9fa`, `#eee`, `#fff8e1` values with tokens.
- **Input height** — `42px` → `44px` per AGENT_GUIDE minimum touch target spec.
- **Pull box status pill reset** — `#eee` hardcoded color replaced with `""` (clears inline style, defers to CSS class).



## [10.0.0] - 2025-03-09 - Phase 1 Complete

### 🎉 Major Refactor: Modular Architecture

This release completes **Phase 1** of the project plan, transforming SparkyTools from a monolithic codebase into a properly modularized, maintainable application.

### Added

#### New Directory Structure
- Created `src/js/calculators/` directory for calculator modules
- Created `src/js/ui/` directory for UI components
- Created `src/js/utils/` directory for shared utilities
- Created `src/css/` directory for stylesheets
- Created `src/data/2023/` directory for NEC data tables

#### New Modules
- **src/js/calculators/conduit-fill.js** - Conduit fill calculator logic (extracted from monolithic script.js)
- **src/js/calculators/voltage-drop.js** - Voltage drop calculator logic
- **src/js/calculators/box-fill.js** - Box fill calculator logic
- **src/js/calculators/pull-box.js** - Pull box sizing calculator logic
- **src/js/ui/navigation.js** - Navigation and tooltip handling
- **src/js/utils/formatting.js** - Shared formatting utilities (randomColor, setStatus, getEl, formatNumber)
- **src/js/data-loader.js** - Central NEC data loading with caching
- **src/js/app.js** - Main application entry point and initialization

#### NEC Data Files (JSON)
- **src/data/2023/conduit.json** - Conduit internal areas (NEC Chapter 9, Table 4)
  - All conduit types: EMT, PVC-40, PVC-80, RMC, FMC, LFMC, LFNC-B
  - Trade sizes and fill limit rules
  
- **src/data/2023/conductors.json** - Conductor data (NEC Chapter 9, Tables 5 & 8)
  - Wire cross-section areas for all insulation types
  - Circular mil values
  - K factors for voltage drop calculations
  - Phase multipliers
  
- **src/data/2023/boxfill.json** - Box fill volume allowances (NEC 314.16)
  - Volume per conductor by AWG size
  
- **src/data/2023/pullbox.json** - Pull box sizing data (NEC 314.28)
  - Trade sizes and dimensional data
  - Pull type configurations

#### Documentation
- **README.md** - Comprehensive project overview and usage guide
- **CHANGELOG.md** - This file, documenting all changes

### Changed

#### Code Organization
- **Removed monolithic script.js** (1000+ lines) 
- **Split into 11 focused modules** averaging 100-250 lines each
- Each calculator now has clear separation of concerns
- Improved code readability and maintainability

#### Data Management
- **Externalized all NEC data** from JavaScript to JSON files
- Implemented central data loader with caching
- Made NEC values easier to verify and update
- Prepared foundation for multi-version NEC support (2020, 2023, 2026)

#### File Paths
- Moved `style.css` → `src/css/styles.css`
- Updated `index.html` to reference new file locations
- All source files now organized under `src/` directory

### Improved

#### Code Quality
- Added comprehensive JSDoc comments to all functions
- Improved function naming and parameter clarity
- Reduced code duplication through shared utilities
- Better error handling in data loader

#### Maintainability
- Each calculator can now be modified independently
- NEC data changes require only JSON updates (no code changes)
- Clear module boundaries make testing easier
- Follows project structure defined in REPO_STRUCTURE.md

#### Developer Experience
- Modular imports make dependencies explicit
- ES6 module system for better code splitting
- Easier to understand and contribute to codebase
- AI agents can now safely modify individual modules

### Technical Details

#### Module Pattern
- **Calculators**: Export `init(data)` and `calculate()` functions
- **UI Components**: Export initialization functions
- **Utils**: Export pure utility functions
- **Data Loader**: IIFE pattern returning public API

#### Dependency Flow
```
index.html
  ├── data-loader.js (IIFE, creates NECDataLoader global)
  └── app.js (ES6 module)
       ├── navigation.js
       ├── conduit-fill.js
       ├── voltage-drop.js
       ├── box-fill.js
       ├── pull-box.js
       └── formatting.js
```

### Migration Notes

#### For Users
- **No breaking changes** - All calculators work exactly as before
- Same UI, same functionality, same results
- May notice slightly faster load times due to better caching

#### For Developers/Contributors
- Old `script.js` is now split across multiple modules
- Import the module you need to modify
- Follow patterns in AGENT_GUIDE.md
- NEC data now lives in JSON files under `src/data/`

### Testing Performed

✅ All four calculators tested and verified:
- Conduit fill calculations match original
- Voltage drop calculations match original  
- Box fill calculations match original
- Pull box sizing calculations match original

✅ UI functionality verified:
- Navigation between tools works
- Tooltips function correctly
- All input controls responsive
- Mobile layout intact

✅ Code quality checks:
- No console errors
- All modules load correctly
- Data caching works as expected
- Cross-module dependencies resolved

### Files Changed

#### New Files (11 JS modules + 4 JSON + 2 docs)
- src/js/calculators/conduit-fill.js
- src/js/calculators/voltage-drop.js
- src/js/calculators/box-fill.js
- src/js/calculators/pull-box.js
- src/js/ui/navigation.js
- src/js/utils/formatting.js
- src/js/data-loader.js
- src/js/app.js
- src/data/2023/conduit.json
- src/data/2023/conductors.json
- src/data/2023/boxfill.json
- src/data/2023/pullbox.json
- README.md
- CHANGELOG.md

#### Modified Files
- index.html (updated script references and CSS path)

#### Moved Files
- style.css → src/css/styles.css

#### Removed Files
- script.js (replaced by modular architecture)

### Next Steps (Phase 2)

See PROJECT_PLAN.md for upcoming features:
- Ampacity Calculator
- Motor FLA Calculator  
- Conduit Bend Calculator
- Grounding Electrode Conductor Calculator
- Service Load Calculator

---

## [9.0.0] - Previous Version

The version before Phase 1 refactor. Featured:
- Single monolithic script.js file
- All NEC data embedded in JavaScript
- All four calculators functional
- Mobile-responsive design
- SVG visualizers for conduit fill and pull boxes

---

## Development Philosophy

SparkyTools follows semantic versioning:
- **Major version** (X.0.0): Breaking changes or major milestones (Phase completions)
- **Minor version** (0.X.0): New features or calculators
- **Patch version** (0.0.X): Bug fixes and improvements

Each phase completion increments the major version by 1.