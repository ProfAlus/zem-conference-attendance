// ============================================================
// MODULE: Quotes (public, read-only)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('quotesList');

async function init() {
  listEl.innerHTML = `<div style="text-align:center; padding: 40px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const [quotes, settings] = await Promise.all([
      apiCall('getQuotes'),
      loadAndApplyBranding(),
    ]);
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Quotes`;
    render(quotes);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function render(quotes) {
  if (!quotes.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-quote-left"></i><p>No quotes posted yet — check back soon.</p></div>`;
    return;
  }

  listEl.innerHTML = quotes.map((q) => `
    <div class="quote-post-wrap">
      <div class="stripe"></div>
      <div class="quote-post-card">
        <div class="quote-badge"><i class="fa-solid fa-quote-left"></i></div>
        <div class="quote-text">${escapeHtml(q.text)}</div>
        ${q.quoterName ? `
          <div class="quote-attribution">
            <div class="quote-name">${escapeHtml(q.quoterName)}</div>
            ${q.quoterRole ? `<div class="quote-role">${escapeHtml(q.quoterRole)}</div>` : ''}
          </div>
        ` : `
          <div class="quote-attribution">
            <div class="quote-role">${formatDate(q.date)}</div>
          </div>
        `}
      </div>
    </div>
  `).join('');
}

init();
