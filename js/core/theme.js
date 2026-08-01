// ============================================================
// THEME — applies the admin's saved accent colour and logo to
// whatever page is currently open. CSS variables are read live
// by components.css, so setting them here updates every button,
// active nav item, badge, etc. immediately — no reload needed.
// ============================================================

import { apiCall } from './api.js';
import { normalizeDriveUrl } from './utils.js';

/** Fetches settings and applies branding. Use when a page has no other reason to call getSettings. */
export async function loadAndApplyBranding() {
  let settings = null;
  try {
    settings = await apiCall('getSettings');
    applyBranding(settings);
  } catch {
    // Branding is cosmetic — never block the page over it.
  }
  return settings;
}

/** Apply branding from a settings object you already fetched (avoids a duplicate API call). */
export function applyBranding(settings) {
  if (!settings) return;
  if (settings.themeColor) setAccentColor(settings.themeColor);
  renderLogos(settings.logoUrl, settings.conferenceName);
}

function setAccentColor(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement;
  root.style.setProperty('--color-coral', hex);
  root.style.setProperty('--color-coral-dark', shade(hex, -14));
  root.style.setProperty('--color-coral-tint', tint(hex, 88));
}

/** Every brand slot in the markup is a <span data-brand-logo="sidebar|public"></span>; swap in an <img> if a logo is set. */
function renderLogos(logoUrl, conferenceName) {
  document.querySelectorAll('[data-brand-logo]').forEach((el) => {
    if (!logoUrl) return;
    // The element starts as the small circular ".dot" placeholder — that
    // class forces a fixed 10-12px circular background, which is why a
    // logo image dropped inside it used to show as a tiny image sitting
    // inside a leftover colored dot. Strip that styling before swapping in the image.
    el.classList.remove('dot');
    el.classList.add('brand-logo-slot');
    const sizeClass = el.dataset.brandLogo === 'sidebar' ? 'brand-logo-img--sidebar' : 'brand-logo-img--public';
    el.innerHTML = `<img src="${normalizeDriveUrl(logoUrl)}" alt="${escapeAttr(conferenceName || 'Conference')} logo" class="brand-logo-img ${sizeClass}">`;
  });
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}
/** Mix a colour toward black (negative percent) or white (positive percent). */
function shade(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
function tint(hex, percent) {
  return shade(hex, Math.abs(percent));
}
