/**
 * @file navigation.js
 * @description Handles the collapsible sidebar navigation.
 *
 * Structure in index.html:
 *   .sidebar          — sticky left rail (desktop) / left-edge overlay (mobile)
 *   .sidebar-pin-btn  — header toggle button; expands/collapses on desktop
 *   .sidebar-item     — one per tool; carries data-target, data-hash, data-label, data-accent
 *   .nav-bar          — mobile-only sticky top bar with hamburger button
 *   .drawer-overlay   — click-to-close dim layer (mobile only)
 *
 * Desktop behaviour:
 *   The sidebar is a sticky icon rail (56 px) that the user can pin open to
 *   220 px via the header button.  Pin state persists in localStorage.
 *
 * Mobile behaviour:
 *   The sidebar slides in from the left as a full-panel overlay triggered by
 *   the hamburger button in the top bar.
 *
 * Hash routing:
 *   Each sidebar item has a data-hash attribute (e.g. "service", "about").
 *   Navigating to index.html#transformer opens that section directly, and
 *   clicking an item updates the URL hash so links are bookmarkable.
 *   Browser back/forward navigation is supported via the hashchange event.
 */

/**
 * Initialises the sidebar navigation.
 */
export function initNavigation() {
  const sidebar   = document.getElementById('sidebar');
  const pinBtn    = document.getElementById('sidebar-pin');
  const drawerBtn = document.getElementById('nav-drawer-btn');
  const overlay   = document.getElementById('drawer-overlay');
  const barLabel  = document.getElementById('nav-bar-label');
  const accentDot = document.getElementById('nav-accent-dot');
  const sections  = document.querySelectorAll('.tool-section');
  const items     = document.querySelectorAll('.sidebar-item:not(.theme-toggle)');

  // ── Activate a section by its sidebar item ──────────────────────────────

  function activateItem(item) {
    items.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    _syncBar(item, barLabel, accentDot);
    _syncActiveBorder(item);
    sections.forEach(s => s.classList.toggle('active', s.id === item.dataset.target));
  }

  // ── Hash routing ─────────────────────────────────────────────────────────

  function activateHash(hash) {
    const slug  = hash.replace(/^#/, '');
    const match = [...items].find(i => i.dataset.hash === slug);
    if (match) activateItem(match);
  }

  if (location.hash) {
    activateHash(location.hash);
  } else {
    const initialActive = document.querySelector('.sidebar-item.active');
    if (initialActive) {
      _syncBar(initialActive, barLabel, accentDot);
      _syncActiveBorder(initialActive);
    }
  }

  window.addEventListener('hashchange', () => activateHash(location.hash));

  // ── Mobile: open / close sidebar as overlay ──────────────────────────────

  function openSidebar() {
    overlay.classList.add('open');
    sidebar.classList.add('open');
    drawerBtn.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    drawerBtn.setAttribute('aria-expanded', 'false');
  }

  drawerBtn.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });

  overlay.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  // ── Desktop: pin (expand / collapse) sidebar ─────────────────────────────

  const STORAGE_KEY = 'sparky-sidebar-pinned';

  function setSidebarExpanded(expanded) {
    sidebar.classList.toggle('sidebar--expanded', expanded);
    pinBtn.setAttribute('aria-label', expanded ? 'Collapse sidebar' : 'Expand sidebar');
    pinBtn.setAttribute('title',      expanded ? 'Collapse sidebar' : 'Expand sidebar');
    localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0');
  }

  // Restore saved pin state (default: collapsed)
  setSidebarExpanded(localStorage.getItem(STORAGE_KEY) === '1');

  pinBtn.addEventListener('click', () => {
    setSidebarExpanded(!sidebar.classList.contains('sidebar--expanded'));
  });

  // ── Item selection ────────────────────────────────────────────────────────

  items.forEach(item => {
    item.addEventListener('click', () => {
      activateItem(item);
      if (item.dataset.hash) {
        history.pushState(null, '', '#' + item.dataset.hash);
      }
      closeSidebar(); // no-op on desktop (sidebar never has .open there)
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/**
 * Updates the mobile top-bar label and accent dot from a sidebar item's dataset.
 */
function _syncBar(item, labelEl, dotEl) {
  if (labelEl) labelEl.textContent    = item.dataset.label || '';
  if (dotEl)   dotEl.style.background = item.dataset.accent || 'var(--primary)';
}

/**
 * Updates the active sidebar item's left-border color to match its accent.
 */
function _syncActiveBorder(item) {
  document.querySelectorAll('.sidebar-item').forEach(i => {
    i.style.borderLeftColor = '';
  });
  item.style.borderLeftColor = item.dataset.accent || 'var(--primary)';
}


/**
 * Initialises tooltip toggle functionality for touch / keyboard accessibility.
 * Tapping a [data-tip] element toggles its .active class; tapping elsewhere closes all.
 *
 * Uses capture phase so the handler fires before the browser processes label clicks.
 * Without this, tapping a [data-tip] badge inside a <label for="..."> would bubble
 * up to the label and open the associated select/input on mobile.
 */
export function initTooltips() {
  document.addEventListener('click', e => {
    const target = e.target.closest('[data-tip]');
    document.querySelectorAll('[data-tip].active').forEach(el => {
      if (el !== target) el.classList.remove('active');
    });
    if (target) {
      e.preventDefault(); // prevent label from forwarding click to its associated control
      target.classList.toggle('active');
    }
  }, { capture: true });
}
