// ============================================================
// MODULE: Attendance Scanner (QR + Manual)
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess, toastWarning, toastInfo } from '../core/toast.js';
import { debounce, escapeHtml } from '../core/utils.js';
import { getSession } from '../core/auth.js';
import { cacheParticipants, getCachedParticipants, patchCachedParticipant, searchCachedParticipants, queueAction, getCacheAge } from '../core/offline.js';

const content = renderShell('scanner.html', 'Attendance Scanner', 'volunteer');
if (content) init();

let currentDay = Number(localStorage.getItem('cams_scan_day') || 1);
let conferenceDays = 3;
let dayLabels = [];
let todayDayNumber = null;
let startDateSet = false;
let windowOpenNow = true;
let windowOpensAt = null;
let checkInBlocked = false;
let html5QrCode = null;
let scanning = false;
let lastScanTime = 0;
const role = getSession()?.role;

async function init() {
  content.innerHTML = `
    <div class="flex-between mb-4 flex-wrap gap-3">
      <div class="field" style="margin:0;" id="daySelectorWrap"></div>
      <div class="flex gap-2">
        <button class="btn btn-outline" id="tabScan"><i class="fa-solid fa-qrcode"></i> Scan QR</button>
        <button class="btn btn-ghost" id="tabManual"><i class="fa-solid fa-keyboard"></i> Manual search</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card" id="scanPane">
        <h3>Point camera at participant's QR code</h3>
        <div id="qrReader" style="border-radius: var(--radius-md); overflow:hidden;"></div>
        <p class="text-muted mt-4" style="font-size:0.85rem;"><i class="fa-solid fa-circle-info"></i> If the camera isn't available, switch to Manual search.</p>
      </div>

      <div class="card" id="manualPane" style="display:none;">
        <h3>Search participant</h3>
        <input class="input" id="manualSearch" placeholder="Search by name, phone, or Registration ID">
        <div id="manualResults" class="mt-4"></div>
      </div>

      <div class="card" id="resultPane">
        <h3>Result</h3>
        <div id="resultBody" class="empty-state">
          <i class="fa-solid fa-hand-pointer"></i>
          <p>Scan or search to check a participant in.</p>
        </div>
      </div>
    </div>
  `;

  // Day selector
  try {
    const settings = await apiCall('getSettings');
    conferenceDays = settings.conferenceDays || 3;
    dayLabels = settings.dayLabels || [];
    todayDayNumber = settings.todayDayNumber;
    startDateSet = !!settings.startDate;
    windowOpenNow = settings.registrationOpenNow;
    windowOpensAt = settings.registrationOpensAt;
  } catch { /* fall back to default of 3 */ }
  if (!dayLabels.length) {
    dayLabels = Array.from({ length: conferenceDays }, (_, i) => ({ day: i + 1, label: `Day ${i + 1}`, short: `D${i + 1}` }));
  }

  // Refresh the offline participant cache whenever we're actually online,
  // so Manual search and check-in still work if the connection drops later.
  try {
    const list = await apiCall('getParticipants');
    cacheParticipants(list);
  } catch {
    const age = getCacheAge();
    if (age) toastInfo(`Offline — using participant data from ${new Date(age).toLocaleTimeString()}.`);
  }

  renderDaySelector();

  // Tabs
  const scanPane = document.getElementById('scanPane');
  const manualPane = document.getElementById('manualPane');
  document.getElementById('tabScan').addEventListener('click', () => {
    manualPane.style.display = 'none';
    scanPane.style.display = 'block';
    startScanner();
  });
  document.getElementById('tabManual').addEventListener('click', () => {
    scanPane.style.display = 'none';
    manualPane.style.display = 'block';
    stopScanner();
  });

  document.getElementById('manualSearch').addEventListener('input', debounce(runManualSearch, 350));

  startScanner();
}

/**
 * Volunteers are locked to today's actual conference day — this is what
 * stops a participant from talking someone into backdating a day they
 * missed. Admins keep the full dropdown so they can correct mistakes.
 */
function renderDaySelector() {
  const wrap = document.getElementById('daySelectorWrap');

  if (role === 'admin') {
    if (todayDayNumber && !localStorage.getItem('cams_scan_day')) currentDay = todayDayNumber;
    wrap.innerHTML = `
      <label for="daySelect">Checking in for <span class="text-muted" style="font-weight:400;">(admin override)</span></label>
      <select class="input" id="daySelect" style="width:auto;"></select>
    `;
    const daySelect = document.getElementById('daySelect');
    daySelect.innerHTML = dayLabels.map((d) => `<option value="${d.day}" ${d.day === currentDay ? 'selected' : ''}>${d.label}</option>`).join('');
    daySelect.addEventListener('change', () => {
      currentDay = Number(daySelect.value);
      localStorage.setItem('cams_scan_day', currentDay);
    });
    return;
  }

  // Day-lock only activates once a Start Date is configured in Settings —
  // otherwise volunteers get the normal dropdown too, same as admin, rather
  // than being blocked entirely over an incomplete Settings page.
  if (!startDateSet) {
    wrap.innerHTML = `
      <label for="daySelect">Checking in for</label>
      <select class="input" id="daySelect" style="width:auto;"></select>
    `;
    const daySelect = document.getElementById('daySelect');
    daySelect.innerHTML = dayLabels.map((d) => `<option value="${d.day}" ${d.day === currentDay ? 'selected' : ''}>${d.label}</option>`).join('');
    daySelect.addEventListener('change', () => {
      currentDay = Number(daySelect.value);
      localStorage.setItem('cams_scan_day', currentDay);
    });
    checkInBlocked = false;
    return;
  }

  // Volunteer: locked, no choice.
  if (!todayDayNumber) {
    checkInBlocked = true;
    wrap.innerHTML = `
      <label>Checking in for</label>
      <div class="badge badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> Today is outside the conference dates</div>
    `;
    return;
  }
  checkInBlocked = false;
  currentDay = todayDayNumber;
  const today = dayLabels[todayDayNumber - 1];

  if (!windowOpenNow) {
    checkInBlocked = true;
    wrap.innerHTML = `
      <label>Checking in for</label>
      <div class="badge badge-warning"><i class="fa-solid fa-clock"></i> ${today?.label || `Day ${todayDayNumber}`} — opens at ${formatTime12h(windowOpensAt)}</div>
    `;
    return;
  }

  wrap.innerHTML = `
    <label>Checking in for</label>
    <div class="badge badge-neutral"><i class="fa-solid fa-lock"></i> ${today?.label || `Day ${todayDayNumber}`}</div>
  `;
}

function formatTime12h(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function startScanner() {
  if (scanning) return;
  // eslint-disable-next-line no-undef
  html5QrCode = new Html5Qrcode('qrReader');
  scanning = true;
  html5QrCode.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: 220 },
    (decodedText) => onScanSuccess(decodedText),
    () => {} // ignore per-frame scan failures
  ).catch(() => {
    document.getElementById('qrReader').innerHTML = `
      <div class="empty-state"><i class="fa-solid fa-video-slash"></i>
      <p>Camera unavailable. Use Manual search instead, or check browser camera permissions.</p></div>`;
    scanning = false;
  });
}

function stopScanner() {
  if (html5QrCode && scanning) {
    html5QrCode.stop().catch(() => {});
    scanning = false;
  }
}

async function onScanSuccess(registrationId) {
  const now = Date.now();
  if (now - lastScanTime < 2000) return; // debounce rapid repeat scans
  lastScanTime = now;
  await checkIn(registrationId.trim());
}

async function runManualSearch() {
  const q = document.getElementById('manualSearch').value.trim();
  const results = document.getElementById('manualResults');
  if (!q) { results.innerHTML = ''; return; }
  results.innerHTML = '<div class="spinner spinner-dark" style="margin: 12px auto;"></div>';

  let matches;
  try {
    matches = await apiCall('searchParticipants', { query: q, limit: 8 });
  } catch (err) {
    if (!err.isNetworkError) {
      results.innerHTML = `<p class="text-muted">${err.message}</p>`;
      return;
    }
    matches = searchCachedParticipants(q, 8); // offline fallback
  }

  if (!matches.length) {
    results.innerHTML = '<p class="text-muted">No matches found.</p>';
    return;
  }
  results.innerHTML = matches.map((p) => `
    <div class="flex-between" style="padding: 10px 0; border-bottom: 1px solid var(--color-ink-200);">
      <div>
        <strong>${escapeHtml(p.fullName)}</strong><br>
        <span class="text-muted mono" style="font-size:0.8rem;">${escapeHtml(p.registrationId)} · ${escapeHtml(p.phone)}</span>
      </div>
      <button class="btn btn-sm btn-primary" data-id="${escapeHtml(p.registrationId)}">Check in</button>
    </div>
  `).join('');
  results.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', () => checkIn(btn.dataset.id));
  });
}

async function checkIn(registrationId) {
  const resultBody = document.getElementById('resultBody');

  if (checkInBlocked) {
    const msg = !windowOpenNow
      ? `Check-in for today opens at ${formatTime12h(windowOpensAt)} — an admin can override if needed.`
      : 'Today is outside the conference dates — an admin needs to check people in.';
    resultBody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${msg}</p></div>`;
    toastError(msg);
    return;
  }

  resultBody.innerHTML = '<div class="spinner spinner-dark" style="margin: 20px auto;"></div>';
  try {
    const data = await apiCall('checkAttendance', { registrationId, day: currentDay, performedBy: getSession()?.name, role });
    renderResult(data);
    if (data.alreadyCheckedInToday) {
      toastWarning('Already checked in today.');
    } else {
      toastSuccess(`${data.fullName} checked in for ${dayLabels[currentDay - 1]?.label || `Day ${currentDay}`}.`);
    }
  } catch (err) {
    if (err.isNetworkError) {
      checkInOffline(registrationId, resultBody);
      return;
    }
    resultBody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-xmark"></i><p>${err.message}</p></div>`;
    toastError(err.message);
  }
}

/** Offline path: mark attendance in the local cache and queue it for sync, since the server call couldn't reach the network. */
function checkInOffline(registrationId, resultBody) {
  const cached = getCachedParticipants().find((p) => p.registrationId === registrationId);
  if (!cached) {
    resultBody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-wifi"></i><p>Offline and this participant isn't in the last-synced list. Reconnect to search the full roster.</p></div>`;
    toastError("Offline — participant not found in cached data.");
    return;
  }

  const dayIdx = currentDay - 1;
  if (cached.attendance[dayIdx]) {
    renderResult(cached, true);
    toastWarning('Already checked in for this day (from offline data).');
    return;
  }

  const updated = patchCachedParticipant(registrationId, (p) => { p.attendance[dayIdx] = true; });
  queueAction('checkAttendance', { registrationId, day: currentDay, performedBy: getSession()?.name, role });
  renderResult(updated, false, true);
  toastWarning(`Offline — ${updated.fullName} marked for ${dayLabels[dayIdx]?.label || `Day ${currentDay}`}. Will sync automatically.`);
}

function renderResult(data, alreadyOffline = false, pendingSync = false) {
  const resultBody = document.getElementById('resultBody');
  const trail = data.attendance.map((present, i) => `
    <div class="node ${present ? 'done' : ''}">
      <div class="dot">${present ? '<i class="fa-solid fa-check"></i>' : i + 1}</div>
      <span class="label">${dayLabels[i]?.short || `Day ${i + 1}`}</span>
    </div>
    ${i < data.attendance.length - 1 ? `<div class="link ${present ? 'done' : ''}"></div>` : ''}
  `).join('');

  let statusBadge = '<div class="badge badge-success" style="margin-bottom:12px;"><i class="fa-solid fa-circle-check"></i> Checked in</div>';
  if (alreadyOffline || data.alreadyCheckedInToday) {
    statusBadge = '<div class="badge badge-warning" style="margin-bottom:12px;"><i class="fa-solid fa-clock-rotate-left"></i> Already checked in</div>';
  } else if (pendingSync) {
    statusBadge = '<div class="badge badge-pending" style="margin-bottom:12px;"><i class="fa-solid fa-cloud-arrow-up"></i> Checked in — pending sync</div>';
  }

  resultBody.innerHTML = `
    <div style="text-align:center;">
      <h3>${escapeHtml(data.fullName)}</h3>
      <p class="text-muted mono">${escapeHtml(data.registrationId)} · ${escapeHtml(data.church)}</p>
      ${statusBadge}
      <div class="day-trail" style="max-width:280px; margin: 0 auto;">${trail}</div>
    </div>
  `;
}
