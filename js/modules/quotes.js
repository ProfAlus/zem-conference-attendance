// ============================================================
// MODULE: Quotes (public, read-only)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { openModal } from '../core/modal.js';

const confNameEl = document.getElementById('confName');
const listEl = document.getElementById('quotesList');
let currentQuotes = [];

const TRUNCATE_AT = 220;

async function init() {
  listEl.innerHTML = `<div style="text-align:center; padding: 40px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const [quotes, settings] = await Promise.all([
      apiCall('getQuotes'),
      loadAndApplyBranding(),
    ]);
    currentQuotes = quotes;
    if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Quotes`;
    render(quotes);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function truncated(text) {
  if (text.length <= TRUNCATE_AT) return { shown: text, isTruncated: false };
  return { shown: text.slice(0, TRUNCATE_AT).trim() + '\u2026', isTruncated: true };
}

function openReadMoreModal(quote) {
  const body = `
    <div class="quote-text" style="margin-bottom: 16px;">${escapeHtml(quote.text)}</div>
    ${quote.quoterName ? `
      <div class="quote-attribution" style="border-top:none; padding-top:0;">
        <div class="quote-name">${escapeHtml(quote.quoterName)}</div>
        ${quote.quoterRole ? `<div class="quote-role">${escapeHtml(quote.quoterRole)}</div>` : ''}
      </div>
    ` : ''}
  `;
  openModal('Full quote', body, [
    { label: 'Close', className: 'btn-ghost', onClick: (b) => b.remove() },
  ]);
}

function render(quotes) {
  if (!quotes.length) {
    listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-quote-left"></i><p>No quotes posted yet — check back soon.</p></div>`;
    return;
  }

  listEl.innerHTML = quotes.map((q) => {
    const { shown, isTruncated } = truncated(q.text);
    return `
    <div class="quote-post-wrap">
      <div class="stripe"></div>
      <div class="quote-post-card">
        <div class="quote-badge"><i class="fa-solid fa-quote-left"></i></div>
        <div class="quote-text">${escapeHtml(shown)}</div>
        ${isTruncated ? `<button class="voice-readmore" data-readmore="${escapeHtml(q.id)}">Read full quote</button>` : ''}
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
  `;
  }).join('');

  listEl.querySelectorAll('button[data-readmore]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quote = currentQuotes.find((x) => x.id === btn.dataset.readmore);
      if (quote) openReadMoreModal(quote);
    });
  });
}

init();
