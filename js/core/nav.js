// ============================================================
// NAV — renders the sidebar + topbar shell used on every
// internal (non-public) page, and enforces auth.
// ============================================================

import { getSession, requireAuth, logout } from './auth.js';
import { loadAndApplyBranding } from './theme.js';
import { initAutoSync, onStatusChange, syncQueue, getStatus, registerServiceWorker } from './offline.js';

const NAV_ITEMS = [
  { href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard', role: 'volunteer' },
  { href: 'scanner.html', icon: 'fa-qrcode', label: 'Attendance Scanner', role: 'volunteer' },
  { href: 'participants.html', icon: 'fa-users', label: 'Participants', role: 'volunteer' },
  { href: 'reports.html', icon: 'fa-file-lines', label: 'Reports', role: 'admin' },
  { href: 'materials.html', icon: 'fa-folder-open', label: 'Conference Materials', role: 'volunteer', external: true },
  { href: 'settings.html', icon: 'fa-gear', label: 'Settings', role: 'admin' },
];

/**
 * Renders the app shell. Call at the top of every internal page.
 * @param {string} activePage - filename of the current page, e.g. 'dashboard.html'
 * @param {string} pageTitle - shown in the topbar
 * @param {'volunteer'|'admin'} minRole
 * @returns {HTMLElement} the .page-content element to render page body into
 */
export function renderShell(activePage, pageTitle, minRole = 'volunteer') {
  const session = requireAuth(minRole);
  if (!session) return null;

  const items = NAV_ITEMS.filter((i) => i.role !== 'admin' || session.role === 'admin');

  document.body.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <button class="sidebar-close no-print" id="sidebarClose" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
        <div class="brand"><span class="dot" data-brand-logo="sidebar"></span> Conference<br>Attendance</div>
        <nav>
          ${items.map((i) => `
            <a href="${i.href}" class="${i.href === activePage ? 'active' : ''}" ${i.external ? 'target="_blank" rel="noopener"' : ''}>
              <i class="fa-solid ${i.icon}"></i> ${i.label}
            </a>`).join('')}
        </nav>
        <div class="sidebar-footer">
          Signed in as <strong style="color:#fff">${session.name}</strong> (${session.role})<br>
          <a href="#" id="logoutLink" style="color: var(--color-coral)">Log out</a>
          <div class="sync-status" id="syncStatus" title="Click to sync now"></div>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebarOverlay"></div>
      <div class="main-area">
        <header class="topbar">
          <div class="flex" style="align-items:center; gap: 12px;">
            <button class="btn btn-icon menu-toggle" id="menuToggle" aria-label="Toggle menu"><i class="fa-solid fa-bars"></i></button>
            <h2 style="margin:0; font-size: 1.15rem;">${pageTitle}</h2>
          </div>
          <div class="text-muted" style="font-size: 0.85rem;" id="topbarDate"></div>
        </header>
        <main class="page-content" id="pageContent"></main>
      </div>
    </div>
  `;

  document.getElementById('topbarDate').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); logout(); });

  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const openSidebar = () => { sidebar.classList.add('open'); overlay.classList.add('active'); };
  const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); };

  document.getElementById('menuToggle').addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);
  sidebar.querySelectorAll('nav a').forEach((a) => a.addEventListener('click', closeSidebar));

  loadAndApplyBranding();
  registerServiceWorker();

  const statusEl = document.getElementById('syncStatus');
  const renderStatus = (s) => {
    statusEl.classList.toggle('offline', !s.online || s.pending > 0);
    if (s.syncing) {
      statusEl.innerHTML = `<span class="dot-status"></span> Syncing…`;
    } else if (!s.online) {
      statusEl.innerHTML = `<span class="dot-status"></span> Offline${s.pending ? ` — ${s.pending} pending` : ''}`;
    } else if (s.pending) {
      statusEl.innerHTML = `<span class="dot-status"></span> ${s.pending} pending — tap to sync`;
    } else {
      statusEl.innerHTML = `<span class="dot-status"></span> Online`;
    }
  };
  onStatusChange(renderStatus);
  renderStatus(getStatus());
  statusEl.addEventListener('click', () => syncQueue());
  initAutoSync();

  return document.getElementById('pageContent');
}
