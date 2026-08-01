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
    <div class="speaker-card mb-4">
      <div class="speaker-card-header">
        <h3>${escapeHtml(s.name)}</h3>
        ${s.title ? `<div class="speaker-title">${escapeHtml(s.title)}</div>` : ''}
        ${s.photoUrl
          ? `<img class="speaker-card-photo" src="${escapeHtml(s.photoUrl)}" alt="${escapeHtml(s.name)}">`
          : `<div class="speaker-card-photo-placeholder"><i class="fa-solid fa-user"></i></div>`}
      </div>
      <div class="speaker-card-body">
        ${s.bio ? `<p>${escapeHtml(s.bio)}</p>` : `<p class="text-muted" style="font-style:italic;">No bio added yet.</p>`}
      </div>
    </div>
  `).join('');
}

document.getElementById('searchBox').addEventListener('input', render);
init();
