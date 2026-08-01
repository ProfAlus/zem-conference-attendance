// ============================================================
// MODULE: Speakers (public, read-only, searchable)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, normalizeDriveUrl } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { openLightbox } from '../core/lightbox.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('speakersList');
let speakers = [];

const SOCIAL_ICONS = {
  facebook: 'fa-brands fa-facebook',
  twitter: 'fa-brands fa-x-twitter',
  instagram: 'fa-brands fa-instagram',
  linkedin: 'fa-brands fa-linkedin',
  website: 'fa-solid fa-globe',
};

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

function socialLinksHtml(s) {
  const links = Object.keys(SOCIAL_ICONS).filter((key) => s[key]);
  if (!links.length) return '';
  return `<div class="speaker-social">${links.map((key) => `
    <a href="${escapeHtml(s[key])}" target="_blank" rel="noopener" aria-label="${key}"><i class="${SOCIAL_ICONS[key]}"></i></a>
  `).join('')}</div>`;
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

  listEl.innerHTML = results.map((s, i) => `
    <div class="speaker-card mb-4">
      <div class="speaker-card-header">
        <h3>${escapeHtml(s.name)}</h3>
        ${s.title ? `<div class="speaker-title">${escapeHtml(s.title)}</div>` : ''}
        ${s.photoUrl
          ? `<img class="speaker-card-photo" data-idx="${i}" src="${escapeHtml(normalizeDriveUrl(s.photoUrl))}" alt="${escapeHtml(s.name)}" style="cursor:pointer;">`
          : `<div class="speaker-card-photo-placeholder"><i class="fa-solid fa-user"></i></div>`}
      </div>
      <div class="speaker-card-body">
        ${s.bio ? `<p>${escapeHtml(s.bio)}</p>` : `<p class="text-muted" style="font-style:italic;">No bio added yet.</p>`}
        ${socialLinksHtml(s)}
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.speaker-card-photo').forEach((img) => {
    img.addEventListener('click', () => {
      const s = results[Number(img.dataset.idx)];
      openLightbox([{ url: normalizeDriveUrl(s.photoUrl), caption: s.name }], 0);
    });
  });
}

document.getElementById('searchBox').addEventListener('input', render);
init();
