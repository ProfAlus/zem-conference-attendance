// ============================================================
// MODULE: Conference Materials (public, read-only)
// ============================================================

import { CONFIG } from '../core/config.js';
import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('materialsList');
let todayDayNumber = null;

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
    const [materials] = await Promise.all([
      apiCall('getMaterials'),
      loadAndApplyBranding().then((settings) => {
        if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Materials`;
        todayDayNumber = settings?.todayDayNumber ?? null;
      }),
    ]);
    render(materials);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
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
