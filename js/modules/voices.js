// ============================================================
// MODULE: Questions & Testimonies (public)
// ============================================================

import { apiCall } from '../core/api.js';
import { escapeHtml, formatDate } from '../core/utils.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { openModal } from '../core/modal.js';

const confNameEl = document.getElementById('confName');
const entriesList = document.getElementById('entriesList');
const listTitle = document.getElementById('listTitle');
const formTitle = document.getElementById('formTitle');
const contentLabel = document.getElementById('contentLabel');
const tabQuestion = document.getElementById('tabQuestion');
const tabTestimony = document.getElementById('tabTestimony');
const entryForm = document.getElementById('entryForm');
const formClosedNotice = document.getElementById('formClosedNotice');
const formClosedMessage = document.getElementById('formClosedMessage');

let activeType = 'Question';
let currentSettings = null;
let currentEntries = [];

const TRUNCATE_AT = 220;
const AVATAR_COLORS = ['#FF6B4E', '#159895', '#F2B705', '#1B1640', '#93690f', '#6B6785'];

const REACTIONS = [
  { key: 'like', icon: '\u{1F44D}', label: 'Like' },
  { key: 'love', icon: '\u2764\uFE0F', label: 'Love' },
  { key: 'amen', icon: '\u{1F64F}', label: 'Amen' },
  { key: 'helpful', icon: '\u{1F4A1}', label: 'Insightful' },
  { key: 'fire', icon: '\u{1F525}', label: 'Powerful' },
];

loadAndApplyBranding().then((settings) => {
  currentSettings = settings;
  if (settings?.conferenceName) confNameEl.textContent = `${settings.conferenceName} — Questions & Testimonies`;
  applyFormAvailability();
});

function applyFormAvailability() {
  if (!currentSettings) return; // settings not loaded yet — leave the form visible rather than flash a false "closed" state
  const enabled = activeType === 'Question' ? currentSettings.questionsFormEnabled !== false : currentSettings.testimoniesFormEnabled !== false;
  entryForm.style.display = enabled ? 'block' : 'none';
  formClosedNotice.style.display = enabled ? 'none' : 'block';
  formClosedMessage.textContent = activeType === 'Question'
    ? 'Question submissions are currently closed — you can still browse what\u2019s been shared below.'
    : 'Testimony submissions are currently closed — you can still browse what\u2019s been shared below.';

  const autoApprove = activeType === 'Question' ? currentSettings.autoApproveQuestions : currentSettings.autoApproveTestimonies;
  document.getElementById('reviewNotice').textContent = autoApprove
    ? 'Your submission will appear below right away.'
    : 'Submissions are reviewed before appearing below.';
}

function setTab(type) {
  activeType = type;
  tabQuestion.className = type === 'Question' ? 'btn btn-primary' : 'btn btn-outline';
  tabTestimony.className = type === 'Testimony' ? 'btn btn-primary' : 'btn btn-outline';
  formTitle.textContent = type === 'Question' ? 'Ask a question' : 'Share a testimony';
  contentLabel.textContent = type === 'Question' ? 'Your question' : 'Your testimony';
  listTitle.textContent = type === 'Question' ? 'Recent questions' : 'Recent testimonies';
  applyFormAvailability();
  loadEntries(); // always shows existing approved entries, regardless of whether the form is open
}

tabQuestion.addEventListener('click', () => setTab('Question'));
tabTestimony.addEventListener('click', () => setTab('Testimony'));

// One reaction per entry per device, tracked locally — not foolproof (clearing
// storage or switching devices resets it), but reasonable friction for an
// event app with no participant login to tie reactions to.
function hasReacted(id, reactionKey) {
  return localStorage.getItem(`cams_reacted_${id}_${reactionKey}`) === '1';
}
function markReacted(id, reactionKey) {
  localStorage.setItem(`cams_reacted_${id}_${reactionKey}`, '1');
}

/** Deterministic color + initials from a name, so the same person always gets the same avatar. */
function initialsAvatar(name) {
  const clean = (name || 'Anonymous').trim();
  const parts = clean.split(/\s+/);
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'A';
  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  const color = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return { initials, color };
}

function reactionsHtml(e) {
  return `
    <div class="flex gap-2 flex-wrap mt-4" data-reactions="${escapeHtml(e.id)}">
      ${REACTIONS.map((r) => `
        <button class="btn btn-sm ${hasReacted(e.id, r.key) ? 'btn-primary' : 'btn-outline'}" data-id="${escapeHtml(e.id)}" data-reaction="${r.key}" ${hasReacted(e.id, r.key) ? 'disabled' : ''}>
          ${r.icon} <span class="react-count">${e[r.key + 'Count'] || 0}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function truncated(text) {
  if (text.length <= TRUNCATE_AT) return { shown: text, isTruncated: false };
  return { shown: text.slice(0, TRUNCATE_AT).trim() + '\u2026', isTruncated: true };
}

function testimonyCardHtml(e) {
  const { initials, color } = initialsAvatar(e.name);
  const { shown, isTruncated } = truncated(e.content);
  return `
    <div class="testimony-card">
      <div class="quote-mark">&ldquo;</div>
      <p style="margin:0; white-space:pre-wrap;" data-full="${isTruncated ? escapeHtml(e.id) : ''}">${escapeHtml(shown)}</p>
      ${isTruncated ? `<button class="voice-readmore" data-readmore="${escapeHtml(e.id)}">Read full testimony</button>` : ''}
      <div class="voice-footer">
        <div class="voice-avatar" style="background:${color};">${initials}</div>
        <div>
          <div class="voice-name">${escapeHtml(e.name || 'Anonymous')}</div>
          <div class="voice-date">${formatDate(e.date)}</div>
        </div>
      </div>
      ${reactionsHtml(e)}
    </div>
  `;
}

function questionCardHtml(e) {
  const { shown, isTruncated } = truncated(e.content);
  return `
    <div class="question-card">
      <div class="qmark-icon">?</div>
      <div class="q-label">Question</div>
      <div class="qbody">
        <p style="margin:0; white-space:pre-wrap;">${escapeHtml(shown)}</p>
        ${isTruncated ? `<button class="voice-readmore" data-readmore="${escapeHtml(e.id)}">Read full question</button>` : ''}
      </div>
      <div class="voice-header">
        <div class="voice-avatar"><i class="fa-solid fa-user" style="font-size:0.65rem;"></i></div>
        <div>
          <div class="voice-name">${escapeHtml(e.name || 'Anonymous')}</div>
          <div class="voice-date">${formatDate(e.date)}</div>
        </div>
      </div>
      ${e.reply ? `
        <div class="reply-box">
          <div style="font-weight:600; font-size:0.8rem; color: var(--color-coral); margin-bottom:4px;"><i class="fa-solid fa-reply"></i> Response${e.repliedBy ? ` from ${escapeHtml(e.repliedBy)}` : ''}</div>
          <p style="margin:0; white-space:pre-wrap; font-size:0.9rem;">${escapeHtml(e.reply)}</p>
        </div>
      ` : ''}
      ${reactionsHtml(e)}
    </div>
  `;
}

function openReadMoreModal(entry) {
  const body = `<p style="white-space:pre-wrap; margin:0;">${escapeHtml(entry.content)}</p>`;
  openModal(entry.type === 'Testimony' ? 'Full testimony' : 'Full question', body, [
    { label: 'Close', className: 'btn-ghost', onClick: (b) => b.remove() },
  ]);
}

async function loadEntries() {
  entriesList.innerHTML = `<div style="text-align:center; padding:20px 0;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const entries = await apiCall('getPublicEntries', { type: activeType });
    currentEntries = entries;
    if (!entries.length) {
      entriesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-comment-dots"></i><p>Nothing posted yet — be the first to share.</p></div>`;
      return;
    }
    entriesList.innerHTML = `<div class="voices-grid">${entries.map((e) =>
      activeType === 'Testimony' ? testimonyCardHtml(e) : questionCardHtml(e)
    ).join('')}</div>`;

    entriesList.querySelectorAll('button[data-reaction]').forEach((btn) => {
      btn.addEventListener('click', () => handleReact(btn));
    });
    entriesList.querySelectorAll('button[data-readmore]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = currentEntries.find((x) => x.id === btn.dataset.readmore);
        if (entry) openReadMoreModal(entry);
      });
    });
  } catch (err) {
    entriesList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${escapeHtml(err.message)}</p></div>`;
  }
}

async function handleReact(btn) {
  const id = btn.dataset.id;
  const reaction = btn.dataset.reaction;
  if (hasReacted(id, reaction)) return;

  btn.disabled = true;
  try {
    const { count } = await apiCall('reactToEntry', { id, reaction });
    btn.querySelector('.react-count').textContent = count;
    btn.classList.remove('btn-outline');
    btn.classList.add('btn-primary');
    markReacted(id, reaction);
  } catch (err) {
    btn.disabled = false;
    toastError(err.message);
  }
}

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('entryName').value.trim();
  const content = document.getElementById('entryContent').value.trim();
  if (!name) { toastError('Please enter your name.'); return; }
  if (!content) return;

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Submitting…';

  try {
    const result = await apiCall('submitEntry', { type: activeType, name, content });
    toastSuccess(result.autoApproved ? 'Thanks — your submission is live below!' : 'Thanks — your submission will appear once reviewed.');
    document.getElementById('entryForm').reset();
    loadEntries();
  } catch (err) {
    toastError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit';
  }
});

setTab('Question');
