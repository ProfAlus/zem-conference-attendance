// ============================================================
// MODULE: Conference Materials (public, read-only)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('materialsList');
let todayDayNumber = null;
let countdownTimer = null;

confNameEl.textContent = 'Conference Materials';

const CATEGORY_ICONS = {
  schedule: 'fa-calendar-days',
  slides: 'fa-display',
  video: 'fa-circle-play',
  audio: 'fa-headphones',
  document: 'fa-file-lines',
};
function iconFor(category) {
  const key = (category || '').toLowerCase();
  return CATEGORY_ICONS[key] || 'fa-link';
}

async function init() {
  try {
    const [materials, settings] = await Promise.all([
      apiCall('getMaterials'),
      loadAndApplyBranding(),
    ]);
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Materials`;
    todayDayNumber = settings?.todayDayNumber ?? null;
    applyBanner(settings);
    render(materials);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

// ============================================================
// EVENT BANNER — admin-configurable via Settings -> Event Banner.
// Colours are applied as CSS custom properties (see components.css),
// and the countdown/live/concluded state is computed from the same
// Start Date / Daily Start Time / Number of Days already used
// everywhere else, so there's nothing to keep in sync separately.
// ============================================================

const BANNER_THEMES = {
  'midnight-gold': { bg1: '#0a0817', bg2: '#2b0d14', accent: '#F2B705' },
  'ocean-teal': { bg1: '#062b2b', bg2: '#0a4a4a', accent: '#2dd4bf' },
  'royal-purple': { bg1: '#1a0b2e', bg2: '#3b0764', accent: '#c084fc' },
  'sunset-coral': { bg1: '#3d0f0f', bg2: '#7a1f0d', accent: '#FF6B4E' },
};

function hexToRgbString(hex) {
  const clean = (hex || '#F2B705').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16) || 0xF2B705;
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function applyBanner(settings) {
  const banner = document.getElementById('eventBanner');
  if (!banner) return;

  if (settings?.bannerEnabled === false) {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = '';

  const theme = settings.bannerTheme === 'custom'
    ? { bg1: settings.bannerCustomBg1, bg2: settings.bannerCustomBg2, accent: settings.bannerCustomAccent }
    : (BANNER_THEMES[settings.bannerTheme] || BANNER_THEMES['midnight-gold']);
  banner.style.setProperty('--banner-bg1', theme.bg1);
  banner.style.setProperty('--banner-bg2', theme.bg2);
  banner.style.setProperty('--banner-accent', theme.accent);
  banner.style.setProperty('--banner-accent-rgb', hexToRgbString(theme.accent));

  startCountdown(settings);
}

/** 'countdown' (before start) | 'live' (during) | 'concluded' (after) | 'unknown' (no dates configured) */
function computeBannerState(settings) {
  if (!settings.startDate) return 'unknown';
  const start = new Date(`${settings.startDate}T${settings.dailyStartTime || '08:00'}:00`);
  if (isNaN(start.getTime())) return 'unknown';
  const end = new Date(start);
  end.setDate(end.getDate() + Math.max(0, (settings.conferenceDays || 1) - 1));
  end.setHours(23, 59, 59, 999);

  const now = new Date();
  if (now < start) return 'countdown';
  if (now <= end) return 'live';
  return 'concluded';
}

function startCountdown(settings) {
  const container = document.getElementById('eventCountdown');
  if (!container) return;
  if (countdownTimer) clearInterval(countdownTimer);

  const state = computeBannerState(settings);

  if (state === 'concluded' || state === 'unknown') {
    container.innerHTML = ''; // nothing shown once concluded, or if dates aren't set up yet
    return;
  }

  if (state === 'live') {
    container.innerHTML = `<div class="cd-live"><i class="fa-solid fa-tower-broadcast"></i> ${escapeHtml(settings.bannerLiveMessage || 'We\u2019re live right now!')}</div>`;
    return;
  }

  // state === 'countdown'
  container.innerHTML = `
    <div class="cd-unit"><span class="cd-num" id="cdDays">--</span><span class="cd-label">Days</span></div>
    <div class="cd-unit"><span class="cd-num" id="cdHours">--</span><span class="cd-label">Hrs</span></div>
    <div class="cd-unit"><span class="cd-num" id="cdMins">--</span><span class="cd-label">Min</span></div>
    <div class="cd-unit"><span class="cd-num" id="cdSecs">--</span><span class="cd-label">Sec</span></div>
  `;
  const target = new Date(`${settings.startDate}T${settings.dailyStartTime || '08:00'}:00`);
  const els = {
    days: document.getElementById('cdDays'),
    hours: document.getElementById('cdHours'),
    mins: document.getElementById('cdMins'),
    secs: document.getElementById('cdSecs'),
  };

  function tick() {
    const diff = target.getTime() - Date.now();
    if (diff <= 0) {
      startCountdown(settings); // flips over to the 'live' state cleanly
      return;
    }
    const totalSecs = Math.floor(diff / 1000);
    els.days.textContent = String(Math.floor(totalSecs / 86400));
    els.hours.textContent = String(Math.floor((totalSecs % 86400) / 3600)).padStart(2, '0');
    els.mins.textContent = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
    els.secs.textContent = String(totalSecs % 60).padStart(2, '0');
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function render(materials) {
  if (!materials.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>Nothing has been posted here yet — check back soon.</p></div>`;
    return;
  }

  // Group by category, with uncategorized items first under "General".
  const groups = {};
  materials.forEach((m) => {
    const cat = m.category || 'General';
    (groups[cat] = groups[cat] || []).push(m);
  });

  // If a category is named like "Day 2" and that's today's actual conference
  // day, pin it to the top with a "Today" badge — helps returning
  // participants find today's materials without hunting through older days.
  const categoryNames = Object.keys(groups);
  const todayCategory = todayDayNumber
    ? categoryNames.find((cat) => {
        const match = cat.match(/^day\s*0*(\d+)$/i);
        return match && Number(match[1]) === todayDayNumber;
      })
    : null;
  const orderedCategories = todayCategory
    ? [todayCategory, ...categoryNames.filter((c) => c !== todayCategory)]
    : categoryNames;

  listEl.innerHTML = orderedCategories.map((cat) => `
    <div class="mb-4">
      <h3 style="margin-bottom: 12px;">${escapeHtml(cat)} ${cat === todayCategory ? '<span class="badge badge-success" style="vertical-align:middle;">Today</span>' : ''}</h3>
      <div class="grid-2">
        ${groups[cat].map((m) => `
          <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="card" style="text-decoration:none; display:flex; gap:14px; align-items:flex-start;">
            <div style="width:40px; height:40px; border-radius:10px; background: var(--color-coral-tint); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fa-solid ${iconFor(m.category)}" style="color: var(--color-coral); font-size:1.1rem;"></i>
            </div>
            <div style="min-width:0;">
              <div style="font-weight:600; color: var(--color-ink-900);">${escapeHtml(m.title)}</div>
              ${m.description ? `<div class="text-muted" style="font-size:0.85rem; margin-top:2px;">${escapeHtml(m.description)}</div>` : ''}
            </div>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');
}

init();
