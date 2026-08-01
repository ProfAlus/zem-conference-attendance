// ============================================================
// MODULE: Photo Gallery (public, read-only)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, normalizeDriveUrl } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { openLightbox } from '../core/lightbox.js';

const confNameEl = document.getElementById('confName');
const gridEl = document.getElementById('galleryGrid');
const tabsEl = document.getElementById('categoryTabs');
let images = [];
let activeCategory = 'All';

async function init() {
  gridEl.innerHTML = `<div style="text-align:center; padding: 40px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const [imageData, settings] = await Promise.all([
      apiCall('getGalleryImages'),
      loadAndApplyBranding(),
    ]);
    images = imageData;
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Photo Gallery`;
    buildTabs();
    render();
  } catch (err) {
    gridEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function buildTabs() {
  const categories = ['All', ...new Set(images.map((img) => img.category).filter(Boolean))];
  if (categories.length <= 1) { tabsEl.innerHTML = ''; return; }
  tabsEl.innerHTML = categories.map((c) => `<button class="btn btn-sm ${c === activeCategory ? 'btn-primary' : 'btn-outline'}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  tabsEl.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.cat;
      buildTabs();
      render();
    });
  });
}

function render() {
  if (!images.length) {
    gridEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-images"></i><p>No photos posted yet — check back soon.</p></div>`;
    return;
  }
  const filtered = activeCategory === 'All' ? images : images.filter((img) => img.category === activeCategory);
  if (!filtered.length) {
    gridEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-images"></i><p>No photos in this category yet.</p></div>`;
    return;
  }

  gridEl.innerHTML = filtered.map((img, i) => `
    <div class="gallery-thumb" data-idx="${i}">
      <img src="${escapeHtml(normalizeDriveUrl(img.imageUrl))}" alt="${escapeHtml(img.caption || '')}" loading="lazy">
      ${img.caption ? `<div class="gallery-thumb-caption">${escapeHtml(img.caption)}</div>` : ''}
    </div>
  `).join('');

  const lightboxImages = filtered.map((img) => ({ url: normalizeDriveUrl(img.imageUrl), caption: img.caption }));
  gridEl.querySelectorAll('.gallery-thumb').forEach((el) => {
    el.addEventListener('click', () => openLightbox(lightboxImages, Number(el.dataset.idx)));
  });
}

init();
