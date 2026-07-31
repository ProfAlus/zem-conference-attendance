// ============================================================
// MODULE: Speakers (public, read-only, searchable)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('speakersList');
let speakers = [];

async function init() {
  listEl.innerHTML = `<div style="text-align:center; padding: 40px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const [speakerData, settings] = await Promise.all([
      apiCall('getSpeakers'),
      loadAndApplyBranding(),
    ]);
    speakers = speakerData;
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Speakers`;
    render();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function render() {
  const query = document.getElementById('searchBox').value.trim().toLowerCase();
  const results = speakers.filter((s) => !query || `${s.name} ${s.title} ${s.bio}`.toLowerCase().includes(query));

  if (!speakers.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-users"></i><p>Speaker profiles haven't been posted yet — check back soon.</p></div>`;
    return;
  }
  if (!results.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No speakers match "${escapeHtml(query)}".</p></div>`;
    return;
  }

  listEl.innerHTML = results.map((s) => `
    <div class="card mb-4" style="display:flex; gap:18px; align-items:flex-start;">
      ${s.photoUrl
        ? `<img src="${escapeHtml(s.photoUrl)}" alt="${escapeHtml(s.name)}" style="width:84px; height:84px; border-radius:50%; object-fit:cover; flex-shrink:0; border:2px solid var(--color-ink-200);">`
        : `<div style="width:84px; height:84px; border-radius:50%; background: var(--color-coral-tint); display:flex; align-items:center; justify-content:center; flex-shrink:0;"><i class="fa-solid fa-user" style="color: var(--color-coral); font-size:1.8rem;"></i></div>`}
      <div style="min-width:0;">
        <h3 style="margin-bottom:2px;">${escapeHtml(s.name)}</h3>
        ${s.title ? `<div class="text-muted" style="font-weight:600; font-size:0.9rem; margin-bottom:10px;">${escapeHtml(s.title)}</div>` : ''}
        ${s.bio ? `<p style="margin:0; white-space:pre-wrap;">${escapeHtml(s.bio)}</p>` : ''}
      </div>
    </div>
  `).join('');
}

document.getElementById('searchBox').addEventListener('input', render);
init();
