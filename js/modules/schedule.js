// ============================================================
// MODULE: Summit Schedule (public, read-only, searchable)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
let sessions = [];
let dayLabels = [];
let activeDay = 'All';

async function init() {
  try {
    const [sessionData, settings] = await Promise.all([
      apiCall('getSchedule'),
      loadAndApplyBranding(),
    ]);
    sessions = sessionData;
    dayLabels = settings?.dayLabels || [];
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Schedule`;
    buildTabs();
    render();
  } catch (err) {
    document.getElementById('scheduleList').innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function dayLabelFor(dayNumber) {
  return dayLabels[dayNumber - 1]?.label || `Day ${dayNumber}`;
}

function buildTabs() {
  const wrap = document.getElementById('dayTabs');
  const dayNumbers = [...new Set(sessions.map((s) => s.day))].sort((a, b) => a - b);
  const tabs = ['All', ...dayNumbers];
  wrap.innerHTML = tabs.map((d) => `<button class="btn btn-sm ${d === activeDay ? 'btn-primary' : 'btn-outline'}" data-day="${d}">${d === 'All' ? 'All' : dayLabelFor(d)}</button>`).join('');
  wrap.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDay = btn.dataset.day === 'All' ? 'All' : Number(btn.dataset.day);
      buildTabs();
      render();
    });
  });
}

function render() {
  const query = document.getElementById('searchBox').value.trim().toLowerCase();
  const listEl = document.getElementById('scheduleList');
  const dayNumbers = [...new Set(sessions.map((s) => s.day))].sort((a, b) => a - b);
  let anyMatch = false;

  const html = dayNumbers
    .filter((d) => activeDay === 'All' || d === activeDay)
    .map((d) => {
      const label = dayLabelFor(d);
      const rows = sessions.filter((s) => s.day === d && (!query || `${label} ${s.time} ${s.title}`.toLowerCase().includes(query)));
      if (!rows.length) return '';
      anyMatch = true;
      return `
        <div class="card mb-4">
          <h3 style="margin-bottom: 12px;">${escapeHtml(label)}</h3>
          ${rows.map((s) => `
            <div class="flex gap-3" style="padding: 8px 0; border-top: 1px solid var(--color-ink-200);">
              <div class="mono text-muted" style="min-width:130px; font-size:0.85rem; flex-shrink:0;">${escapeHtml(s.time)}</div>
              <div>${escapeHtml(s.title)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

  listEl.innerHTML = anyMatch ? html : `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>${sessions.length ? `No sessions match "${escapeHtml(query)}".` : 'No schedule has been posted yet.'}</p></div>`;
}

document.getElementById('searchBox').addEventListener('input', render);
init();
