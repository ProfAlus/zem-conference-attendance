// ============================================================
// MODULE: Quote Manager (internal — volunteers and admins)
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { openModal, confirmDialog } from '../core/modal.js';
import { escapeHtml, formatDate } from '../core/utils.js';

const content = renderShell('quote-manager.html', 'Quotes', 'volunteer');
if (content) init();

async function init() {
  content.innerHTML = `
    <div class="flex-between mb-4">
      <div>
        <h3 style="margin:0;">Post a quote</h3>
        <p class="text-muted" style="margin:4px 0 0;">Share something memorable from a session — shows immediately on the public Quotes page, no review needed.</p>
      </div>
      <button class="btn btn-primary btn-sm" id="addQuoteBtn"><i class="fa-solid fa-plus"></i> Post quote</button>
    </div>
    <div id="quotesList"></div>
    <p class="text-muted" style="font-size:0.8rem; margin-top:16px;">
      <a href="quotes.html" target="_blank" rel="noopener">View the public Quotes page &rarr;</a>
    </p>
  `;

  document.getElementById('addQuoteBtn').addEventListener('click', () => openQuoteModal());
  await loadQuotes();
}

async function loadQuotes() {
  const list = document.getElementById('quotesList');
  list.innerHTML = `<div style="text-align:center; padding:24px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const quotes = await apiCall('getQuotes');
    if (!quotes.length) {
      list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-quote-left"></i><p>No quotes posted yet.</p></div>`;
      return;
    }
    list.innerHTML = quotes.map((q) => `
      <div class="card card-tight mb-4">
        <p style="margin:0 0 10px; white-space:pre-wrap;">${escapeHtml(q.text)}</p>
        <div class="flex-between">
          <div class="text-muted" style="font-size:0.8rem;">
            ${q.quoterName ? `<strong>${escapeHtml(q.quoterName)}</strong>${q.quoterRole ? ` · ${escapeHtml(q.quoterRole)}` : ''} &middot; ` : ''}
            Posted by ${escapeHtml(q.postedBy || 'staff')} &middot; ${formatDate(q.date)}
          </div>
          <div>
            <button class="btn btn-sm btn-ghost edit-quote" data-id="${escapeHtml(q.id)}"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-ghost delete-quote" data-id="${escapeHtml(q.id)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.edit-quote').forEach((btn) => {
      btn.addEventListener('click', () => openQuoteModal(quotes.find((x) => x.id === btn.dataset.id)));
    });
    list.querySelectorAll('.delete-quote').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog('Delete this quote?', { title: 'Delete quote', confirmLabel: 'Delete', danger: true });
        if (!ok) return;
        try {
          await apiCall('deleteQuote', { id: btn.dataset.id });
          toastSuccess('Quote deleted.');
          loadQuotes();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function openQuoteModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field"><label for="quoText">Quote</label>
      <textarea class="input" id="quoText" rows="4">${existing ? escapeHtml(existing.text) : ''}</textarea>
    </div>
    <div class="field"><label for="quoName">Attributed to <span class="text-muted">(optional)</span></label>
      <input class="input" id="quoName" value="${existing ? escapeHtml(existing.quoterName || '') : ''}" placeholder="e.g. Rev. Sola Jegede"></div>
    <div class="field"><label for="quoRole">Their role <span class="text-muted">(optional)</span></label>
      <input class="input" id="quoRole" value="${existing ? escapeHtml(existing.quoterRole || '') : ''}" placeholder="e.g. Team Leader, ZEM"></div>
  `;
  openModal(isEdit ? 'Edit quote' : 'Post a quote', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Post quote',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          text: document.getElementById('quoText').value.trim(),
          quoterName: document.getElementById('quoName').value.trim(),
          quoterRole: document.getElementById('quoRole').value.trim(),
        };
        if (!payload.text) { toastError('Quote text is required.'); return; }
        try {
          if (isEdit) {
            await apiCall('updateQuote', { id: existing.id, ...payload });
            toastSuccess('Quote updated.');
          } else {
            await apiCall('addQuote', payload);
            toastSuccess('Quote posted.');
          }
          b.remove();
          loadQuotes();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
}
