# ⚡ SparkyTools — Dev

> **This is the active development repository.** Features and changes are developed here before being promoted to the [stable repo](https://github.com/clemmmdawg/sparkytools). Expect work-in-progress code, breaking changes, and experimental features on the main branch.

**Free, open-source NEC electrical calculators for electricians.**

SparkyTools is a mobile-first progressive web app (PWA) that provides accurate, real-time NEC 2023 electrical calculations — no account, no tracking, no internet connection required after the first visit.

---

## Calculators

### ⚡ Residential Service Load — NEC 220
Calculates the total connected load for a dwelling unit using either the Standard Method (NEC 220.40–220.53) or the Optional Method (NEC 220.82 / 220.83).

- General lighting & receptacles at 3 VA/sq ft (NEC 220.12)
- Small appliance circuits — minimum 2 × 1,500 VA (NEC 220.52(A))
- Laundry circuits — minimum 1 × 1,500 VA (NEC 220.52(B))
- Table 220.42 demand factors on lighting/SA/laundry subtotal
- Cooking equipment with Table 220.55 demand factors
- Electric dryers — 5,000 VA minimum, Table 220.54 demand
- Fixed appliances — 75% demand factor when ≥ 4 active (NEC 220.53)
- HVAC — non-coincident load per NEC 220.60; 220.82(C) demand for Optional Method
- Custom loads at 100% nameplate (NEC 220.14)
- Load shedding mode for generator sizing
- Existing service adequacy check (NEC 220.83)
- Results: calculated VA, amps at 240 V, recommended service size, service entrance conductor per Table 310.16 (75 °C Cu)

### 🔌 Transformer — NEC 450 / 240.21(C)
Sizes overcurrent protection and conductors for single- and three-phase transformers.

- Primary and secondary full-load current
- Primary OCPD per Table 450.3(B) (125% or 167% of FLA)
- Secondary OCPD per Table 450.3(B)
- Primary conductors at 125% FLA per Table 310.16
- Secondary conductor sizing with four tap-rule options per NEC 240.21(C):
  - OCPD at secondary terminals
  - Protected by primary OCPD only (240.21(C)(1))
  - ≤ 10 ft tap (240.21(C)(2))
  - ≤ 25 ft tap (240.21(C)(3))
- SVG line diagram: primary OCPD → wire → transformer → wire → secondary OCPD

### 🔵 Conduit Fill — NEC 300.17 / Chapter 9 Table 1
Calculates conductor fill percentage for all standard raceway types.

- Conduit types: EMT, PVC-40, PVC-80, RMC, FMC, LFMC, LFNC-B
- All NEC trade sizes per conduit type
- Add/remove conductors by wire type, insulation, size, and quantity
- Fill limits: 53% (1 conductor), 31% (2 conductors), 40% (3+)
- Recommended minimum conduit size for current conductors
- SVG cross-section visualizer with color-coded wire circles

### 📉 Voltage Drop — NEC 210.19(A)(1) Informational Note
Calculates conductor voltage drop using the standard NEC formula: `VD = (K × I × D × M) / CM`

- Copper or aluminum conductors
- Voltages: 120 V, 208 V, 240 V, 277 V, 480 V
- Single-phase or three-phase
- Results: voltage loss, percentage drop, maximum run length at ≤ 3%, recommended wire size

### 📦 Box Fill — NEC 314.16
Calculates total box fill volume against box capacity.

- Standard box presets or custom volume (in³)
- Conductors with per-size volume from Table 314.16(B)
- Devices (yokes) — 2× unit volume per NEC 314.16(B)(2)
- Internal clamps — 1 unit volume per NEC 314.16(B)(3)
- Equipment grounds — 1 unit volume per NEC 314.16(B)(5)
- Pass/fail fill status with remaining volume

### 📐 Pull Box Size — NEC 314.28
Calculates the minimum pull box dimensions for conductors 4 AWG and larger.

- Straight pulls — 8× the largest conduit trade size (314.28(A)(1))
- Angle and U-pulls — 6× largest + sum of remaining conduits on same wall (314.28(A)(2))
- Add conduit entries on any of four walls
- SVG face diagram with conduit entry/exit points and dimension callouts

---

## Features

- **Works offline** — full PWA with service worker cache; after the first visit, no network connection is needed
- **Mobile-first** — 44 px minimum touch targets, responsive layout, tested on phones and tablets
- **Dark mode** — follows system preference by default, with a manual toggle; preference is remembered
- **Print / Save PDF** — the Service Load calculator has a print-optimized layout for documentation
- **No dependencies** — zero npm packages, no framework, no build step; plain HTML, CSS, and ES6 modules
- **No tracking** — no analytics, no cookies, no external calls beyond Google Fonts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Markup | HTML5, semantic elements, ARIA labels |
| Styles | CSS3 — custom properties, flexbox, grid |
| Scripts | Vanilla JavaScript — ES6 modules, no bundler |
| Visualizers | Programmatic SVG (conduit fill, pull box, transformer) |
| Offline | Service Worker — cache-first app shell, stale-while-revalidate fonts |
| PWA | Web App Manifest, installable on iOS and Android |
| Font | Inter via Google Fonts (cached offline) |
| Data | NEC 2023 tables inlined in `data-loader.js` |

---

## Getting Started

No build step required. Clone the repo and open `index.html` directly in a browser, or serve it with any static file server:

```bash
git clone https://github.com/clemmmdawg/sparkytools-dev.git
cd sparkytools-dev

# Any static server works, e.g.:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser. The service worker will cache all assets on the first load, after which the app runs fully offline.

---

## Project Structure

```
sparkytools-dev/
├── index.html                   # Single-page application shell
├── service-worker.js            # PWA offline caching
├── favicon.ico
│
├── src/
│   ├── css/
│   │   ├── base.css             # Design tokens, layout, navigation, cards
│   │   ├── conduit-fill.css
│   │   ├── box-fill.css
│   │   ├── pull-box.css
│   │   ├── service-load.css     # Includes @media print rules
│   │   └── transformer.css
│   │
│   ├── js/
│   │   ├── app.js               # Entry point — loads data, inits modules
│   │   ├── data-loader.js       # All NEC 2023 tables as JS objects
│   │   ├── calculators/         # One module per calculator
│   │   ├── ui/                  # navigation.js, theme.js
│   │   └── utils/               # formatting.js helpers
│   │
│   └── data/2023/               # NEC data JSON (reference copies)
│
├── pwa/manifest.json
└── public/icons/
```

---

## NEC Compliance Note

All calculations are based on the **NEC 2023** edition. Results are provided for reference and planning purposes only. Always verify calculations with a licensed electrician and the applicable edition of the NEC adopted in your jurisdiction. The authors assume no liability for errors or omissions.

---

## Contributing

Contributions are welcome. See [AGENTS.md](AGENTS.md) for the project architecture, coding conventions, and instructions for adding new calculators.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-calculator`)
3. Make your changes — read AGENTS.md first
4. Open a pull request

---

## License

SparkyTools is free software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See [LICENSE](LICENSE) for the full text.

In plain terms: you are free to use, modify, and distribute this software, but any modified version you make available over a network must also be released under the AGPL-3.0 with its source code available to users.

---

## Support

SparkyTools is free forever. If it saves you time on the job, a coffee keeps the lights on.

[☕ Buy me a coffee on Ko-fi](https://ko-fi.com/sparkytools)
