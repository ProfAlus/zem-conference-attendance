// ============================================================
// MODULE: Questions & Testimonies (public)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { loadAndApplyBranding } from '../core/theme.js';

const confNameEl = document.getElementById('confName');
const entriesList = document.getElementById('entriesList');
const listTitle = document.getElementById('listTitle');
const formTitle = document.getElementById('formTitle');
const contentLabel = document.getElementById('contentLabel');
const tabQuestion = document.getElementById('tabQuestion');
const tabTestimony = document.getElementById('tabTestimony');

let activeType = 'Question';

loadAndApplyBranding().then((settings) => {
  if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Questions & Testimonies`;
});

function setTab(type) {
  activeType = type;
  tabQuestion.className = type === 'Question' ? 'btn btn-primary' : 'btn btn-outline';
  tabTestimony.className = type === 'Testimony' ? 'btn btn-primary' : 'btn btn-outline';
  formTitle.textContent = type === 'Question' ? 'Ask a question' : 'Share a testimony';
  contentLabel.textContent = type === 'Question' ? 'Your question' : 'Your testimony';
  listTitle.textContent = type === 'Question' ? 'Recent questions' : 'Recent testimonies';
  loadEntries();
}

tabQuestion.addEventListener('click', () => setTab('Question'));
tabTestimony.addEventListener('click', () => setTab('Testimony'));

async function loadEntries() {
  entriesList.innerHTML = `<div style="text-align:center; padding:20px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const entries = await apiCall('getPublicEntries', { type: activeType });
    if (!entries.length) {
      entriesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comment-dots"></i><p>Nothing posted yet — be the first to share.</p></div>`;
      return;
    }
    entriesList.innerHTML = entries.map((e) => `
      <div class="card card-tight mb-4">
        <p style="margin:0 0 8px; white-space:pre-wrap;">${escapeHtml(e.content)}</p>
        <div class="text-muted" style="font-size:0.8rem;">${escapeHtml(e.name || 'Anonymous')} &middot; ${formatDate(e.date)}</div>
      </div>
    `).join('');
  } catch (err) {
    entriesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('entryName').value.trim();
  const anonymous = document.getElementById('entryAnonymous').checked;
  const content = document.getElementById('entryContent').value.trim();
  if (!content) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Submitting…';

  try {
    await apiCall('submitEntry', { type: activeType, name, anonymous, content });
    toastSuccess('Thanks — your submission will appear once reviewed.');
    document.getElementById('entryForm').reset();
  } catch (err) {
    toastError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit';
  }
});

setTab('Question');
