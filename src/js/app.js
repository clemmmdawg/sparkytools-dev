/**
 * @file app.js
 * @description Main application initialization
 * 
 * This is the entry point that:
 * - Loads NEC data
 * - Initializes all calculator modules
 * - Sets up navigation and UI
 */

import { initNavigation, initTooltips } from './ui/navigation.js';
import { initTheme } from './ui/theme.js';
import { init as initEasterEggs } from './ui/easter-eggs.js';
import * as ConduitFill from './calculators/conduit-fill.js';
import * as VoltageDrop from './calculators/voltage-drop.js';
import * as BoxFill from './calculators/box-fill.js';
import * as PullBox from './calculators/pull-box.js';
import * as ServiceLoad from './calculators/service-load.js';
import * as Transformer from './calculators/transformer.js';
import * as OhmsLaw from './calculators/ohms-law.js';
import * as PanelSchedule from './calculators/panel-schedule.js';
import * as Ampacity from './calculators/ampacity.js';
import * as Motor from './calculators/motor.js';

/**
 * Main initialization function
 */
async function init() {
  try {
    // Initialize UI immediately — navigation must run before any async work so
    // the URL hash is honoured on page load regardless of data-load timing.
    initNavigation();
    initTooltips();
    initTheme();
    initEasterEggs();

    // Load NEC data (defaults to 2023)
    const necData = await NECDataLoader.loadNECData("2023");

    // Initialize all calculators with data
    ConduitFill.init(necData);
    VoltageDrop.init(necData);
    BoxFill.init(necData);
    PullBox.init(necData);
    ServiceLoad.init(necData);
    Transformer.init(necData);
    OhmsLaw.init(necData);
    PanelSchedule.init();
    Ampacity.init(necData);
    Motor.init(necData);
    
    console.log("⚡ SparkyTools initialized successfully");

    // Register service worker for offline/PWA support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => {
          console.log('SW registered, scope:', reg.scope);

          // When a new SW is waiting (updated app), reload once it activates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
                // New version is live — prompt the user to reload
                showUpdateToast();
              }
            });
          });
        })
        .catch(err => console.warn('SW registration failed:', err));
    }
  } catch (error) {
    console.error("Failed to initialize SparkyTools:", error);
    // Show error message to user
    const container = document.querySelector('.container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--danger);">
          <h2>⚠️ Failed to Load</h2>
          <p>SparkyTools encountered an error loading NEC data.</p>
          <p>Please refresh the page or check your connection.</p>
        </div>
      `;
    }
  }
}

// Run initialization when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/**
 * Shows a subtle toast when a new version of the app has been installed.
 * Tapping "Reload" picks up the fresh cache immediately.
 */
function showUpdateToast() {
  const toast = document.createElement('div');
  toast.className = 'update-toast';

  const msg = document.createElement('span');
  msg.textContent = '⚡ SparkyTools updated!';

  const btn = document.createElement('button');
  btn.className = 'update-toast__btn';
  btn.textContent = 'Reload';
  btn.addEventListener('click', () => location.reload());

  toast.appendChild(msg);
  toast.appendChild(btn);
  document.body.appendChild(toast);

  // Auto-dismiss after 12 s in case the user ignores it
  setTimeout(() => toast.remove(), 12000);
}