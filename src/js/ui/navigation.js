/**
 * @file navigation.js
 * @description Handles the sticky top-bar navigation and slide-in drawer.
 *
 * Structure in index.html:
 *   .nav-bar         — sticky bar showing active tool name + hamburger button
 *   .drawer-overlay  — click-to-close dim layer (position: fixed)
 *   .drawer          — slide-in panel (position: fixed, right side)
 *     .drawer-item   — one per tool; carries data-target, data-label, data-accent
 */

/**
 * Initializes the drawer navigation.
 * Reads data-target / data-label / data-accent from each .drawer-item
 * and switches .tool-section visibility accordingly.
 */
export function initNavigation() {
  const drawerBtn   = document.getElementById('nav-drawer-btn');
  const drawerClose = document.getElementById('drawer-close');
  const overlay     = document.getElementById('drawer-overlay');
  const drawer      = document.getElementById('nav-drawer');
  const barLabel    = document.getElementById('nav-bar-label');
  const accentDot   = document.getElementById('nav-accent-dot');
  const sections    = document.querySelectorAll('.tool-section');
  const items       = document.querySelectorAll('.drawer-item');

  // Sync bar state with the initially-active drawer item
  const initialActive = document.querySelector('.drawer-item.active');
  if (initialActive) {
    _syncBar(initialActive, barLabel, accentDot);
    _syncActiveBorder(initialActive);
  }

  // ── Drawer open / close ──────────────────────────────────────────────────

  function openDrawer() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    drawerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeDrawer() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    drawerBtn.setAttribute('aria-expanded', 'false');
  }

  drawerBtn.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  // Keyboard: close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  // ── Item selection ───────────────────────────────────────────────────────

  items.forEach(item => {
    item.addEventListener('click', () => {
      const targetId = item.dataset.target;

      // Update active state
      items.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Sync top bar label + dot
      _syncBar(item, barLabel, accentDot);
      _syncActiveBorder(item);

      // Switch visible section
      sections.forEach(s => s.classList.toggle('active', s.id === targetId));

      closeDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/**
 * Updates the top-bar label and accent dot from a drawer item's dataset.
 */
function _syncBar(item, labelEl, dotEl) {
  labelEl.textContent    = item.dataset.label || '';
  dotEl.style.background = item.dataset.accent || 'var(--primary)';
}

/**
 * Updates the active drawer item's left-border color to match its accent.
 */
function _syncActiveBorder(item) {
  document.querySelectorAll('.drawer-item').forEach(i => {
    i.style.borderLeftColor = '';
  });
  item.style.borderLeftColor = item.dataset.accent || 'var(--primary)';
}


/**
 * Initializes tooltip toggle functionality for touch / keyboard accessibility.
 * Tapping a [data-tip] element toggles its .active class; tapping elsewhere closes all.
 */
export function initTooltips() {
  document.addEventListener('click', e => {
    const target = e.target.closest('[data-tip]');
    document.querySelectorAll('[data-tip].active').forEach(el => {
      if (el !== target) el.classList.remove('active');
    });
    if (target) target.classList.toggle('active');
  });
}