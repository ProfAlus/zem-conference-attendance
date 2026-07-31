// ============================================================
// MODULE: Participants Manager
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess, toastInfo } from '../core/toast.js';
import { openModal, confirmDialog } from '../core/modal.js';
import { debounce, escapeHtml, formatDate } from '../core/utils.js';
import { getSession } from '../core/auth.js';
import { CONFIG } from '../core/config.js';
import { cacheParticipants, getCachedParticipants, addCachedParticipant, findCachedByPhone, queueAction, getCacheAge, onStatusChange } from '../core/offline.js';

const content = renderShell('participants.html', 'Participants', 'volunteer');
const isAdmin = getSession()?.role === 'admin';
let allParticipants = [];
let conferenceDays = 3;
let dayLabels = [];
let lastPending = 0;

if (content) init();

async function init() {
  content.innerHTML = `
    <div class="card mb-4">
      <div class="flex-wrap flex gap-3" style="align-items:flex-end;">
        <div class="field" style="margin:0; flex:2; min-width:200px;">
          <label for="search">Search</label>
          <input class="input" id="search" placeholder="Name, phone, or Registration ID">
        </div>
        <div class="field" style="margin:0; min-width:160px;">
          <label for="churchFilter">Church</label>
          <select class="input" id="churchFilter"><option value="">All churches</option></select>
        </div>
        <div class="field" style="margin:0; min-width:140px;">
          <label for="genderFilter">Gender</label>
          <select class="input" id="genderFilter">
            <option value="">All</option>
            ${CONFIG.GENDERS.map((g) => `<option value="${g}">${g}</option>`).join('')}
          </select>
        </div>
        <div class="field" style="margin:0; min-width:160px;">
          <label for="dayFilter">Attended day</label>
          <select class="input" id="dayFilter"><option value="">Any</option></select>
        </div>
        <button class="btn btn-outline" id="clearFilters">Clear</button>
      </div>
    </div>

    <div class="card">
      <div class="flex-between mb-4">
        <h3 style="margin:0;">All participants <span class="text-muted" id="countLabel"></span></h3>
        <button class="btn btn-primary btn-sm" id="addParticipantBtn"><i class="fa-solid fa-user-plus"></i> Add participant</button>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="table">
          <thead>
            <tr>
              <th>Name</th><th>Phone</th><th>Church</th><th>Gender</th><th>Age</th><th>Attendance</th><th>Registered</th><th></th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
      <div id="emptyState" style="display:none;" class="empty-state"><i class="fa-solid fa-user-slash"></i><p>No participants match these filters.</p></div>
    </div>
  `;

  try {
    const settings = await apiCall('getSettings');
    conferenceDays = settings.conferenceDays || 3;
    dayLabels = settings.dayLabels || Array.from({ length: conferenceDays }, (_, i) => ({ day: i + 1, label: `Day ${i + 1}`, short: `D${i + 1}` }));
  } catch { /* keep default */ }
  if (!dayLabels.length) {
    dayLabels = Array.from({ length: conferenceDays }, (_, i) => ({ day: i + 1, label: `Day ${i + 1}`, short: `D${i + 1}` }));
  }

  document.getElementById('dayFilter').innerHTML = '<option value="">Any</option>' +
    dayLabels.map((d) => `<option value="${d.day}">${d.label}</option>`).join('');

  document.getElementById('search').addEventListener('input', debounce(applyFilters, 250));
  document.getElementById('churchFilter').addEventListener('change', applyFilters);
  document.getElementById('genderFilter').addEventListener('change', applyFilters);
  document.getElementById('dayFilter').addEventListener('change', applyFilters);
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('search').value = '';
    document.getElementById('churchFilter').value = '';
    document.getElementById('genderFilter').value = '';
    document.getElementById('dayFilter').value = '';
    applyFilters();
  });

  document.getElementById('addParticipantBtn').addEventListener('click', () => openAddParticipantModal());

  onStatusChange((s) => {
    if (lastPending > 0 && s.pending === 0 && !s.syncing) loadParticipants();
    lastPending = s.pending;
  });

  await loadParticipants();
}

async function loadParticipants() {
  document.getElementById('tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    allParticipants = await apiCall('getParticipants');
    cacheParticipants(allParticipants);
    const churches = [...new Set(allParticipants.map((p) => p.church))].sort();
    document.getElementById('churchFilter').innerHTML = '<option value="">All churches</option>' +
      churches.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    applyFilters();
  } catch (err) {
    if (err.isNetworkError) {
      allParticipants = getCachedParticipants();
      const age = getCacheAge();
      toastInfo(`Offline — showing participant data from ${age ? new Date(age).toLocaleTimeString() : 'the last sync'}.`);
      const churches = [...new Set(allParticipants.map((p) => p.church))].sort();
      document.getElementById('churchFilter').innerHTML = '<option value="">All churches</option>' +
        churches.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      applyFilters();
      return;
    }
    toastError(err.message);
    document.getElementById('tbody').innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:24px;">${err.message}</td></tr>`;
  }
}

function applyFilters() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const church = document.getElementById('churchFilter').value;
  const gender = document.getElementById('genderFilter').value;
  const day = document.getElementById('dayFilter').value;

  const filtered = allParticipants.filter((p) => {
    if (q && !(`${p.fullName} ${p.phone} ${p.registrationId}`.toLowerCase().includes(q))) return false;
    if (church && p.church !== church) return false;
    if (gender && p.gender !== gender) return false;
    if (day && !p.attendance[Number(day) - 1]) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(list) {
  const tbody = document.getElementById('tbody');
  document.getElementById('countLabel').textContent = `(${list.length})`;
  document.getElementById('emptyState').style.display = list.length ? 'none' : 'block';
  document.getElementById('table').style.display = list.length ? 'table' : 'none';

  tbody.innerHTML = list.map((p) => `
    <tr data-id="${escapeHtml(p.registrationId)}">
      <td><strong>${escapeHtml(p.fullName)}</strong><br><span class="text-muted mono" style="font-size:0.75rem;">${escapeHtml(p.registrationId)}</span>${p._pendingSync ? ' <span class="badge badge-pending" style="font-size:0.65rem;">Pending sync</span>' : ''}</td>
      <td>${escapeHtml(p.phone)}</td>
      <td>${escapeHtml(p.church)}</td>
      <td>${escapeHtml(p.gender)}</td>
      <td>${escapeHtml(p.ageGroup)}</td>
      <td>${miniTrail(p.attendance)}</td>
      <td>${formatDate(p.registrationDate)}</td>
      <td>
        <button class="btn btn-sm btn-ghost view-btn"><i class="fa-solid fa-eye"></i></button>
        ${isAdmin ? '<button class="btn btn-sm btn-ghost edit-btn"><i class="fa-solid fa-pen"></i></button>' : ''}
        ${isAdmin ? '<button class="btn btn-sm btn-ghost delete-btn" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>' : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr').forEach((row) => {
    const id = row.dataset.id;
    const p = list.find((x) => x.registrationId === id);
    row.querySelector('.view-btn').addEventListener('click', () => viewProfile(p));
    row.querySelector('.edit-btn')?.addEventListener('click', () => editProfile(p));
    row.querySelector('.delete-btn')?.addEventListener('click', () => deleteProfile(p));
  });
}

function miniTrail(attendance) {
  return `<div class="day-trail" style="max-width:140px;">${attendance.map((present, i) => `
    <div class="node ${present ? 'done' : ''}"><div class="dot" style="width:20px;height:20px;font-size:0.6rem;">${present ? '<i class="fa-solid fa-check"></i>' : i + 1}</div></div>
    ${i < attendance.length - 1 ? `<div class="link ${present ? 'done' : ''}" style="flex:0 0 8px;margin-bottom:0;"></div>` : ''}
  `).join('')}</div>`;
}

function viewProfile(p) {
  const trailHtml = `<div class="day-trail" style="max-width:280px; margin: 12px auto;">${p.attendance.map((present, i) => `
    <div class="node ${present ? 'done' : ''}"><div class="dot">${present ? '<i class="fa-solid fa-check"></i>' : i + 1}</div><span class="label">${dayLabels[i]?.short || `Day ${i + 1}`}</span></div>
    ${i < p.attendance.length - 1 ? `<div class="link ${present ? 'done' : ''}"></div>` : ''}
  `).join('')}</div>`;

  const body = `
    <div style="text-align:center;">
      <h3>${escapeHtml(p.fullName)}</h3>
      <p class="text-muted mono">${escapeHtml(p.registrationId)}</p>
      ${trailHtml}
    </div>
    <table style="width:100%; font-size: var(--fs-sm); margin-top: 12px;">
      <tr><td class="text-muted">Address</td><td>${escapeHtml(p.address || '—')}</td></tr>
      <tr><td class="text-muted">Church</td><td>${escapeHtml(p.church)}</td></tr>
      <tr><td class="text-muted">Email</td><td>${escapeHtml(p.email || '—')}</td></tr>
      <tr><td class="text-muted">Phone</td><td>${escapeHtml(p.phone)}</td></tr>
      <tr><td class="text-muted">Gender</td><td>${escapeHtml(p.gender)}</td></tr>
      <tr><td class="text-muted">Age group</td><td>${escapeHtml(p.ageGroup)}</td></tr>
      <tr><td class="text-muted">Registered</td><td>${formatDate(p.registrationDate)} ${p.registrationTime || ''}</td></tr>
    </table>
  `;
  openModal('Participant profile', body, [
    { label: 'Close', className: 'btn-ghost', onClick: (b) => b.remove() },
  ]);
}

function editProfile(p) {
  const body = `
    <div class="field"><label>Full name</label><input class="input" id="editName" value="${escapeHtml(p.fullName)}"></div>
    <div class="field"><label>Address</label><input class="input" id="editAddress" value="${escapeHtml(p.address || '')}"></div>
    <div class="field"><label>Church</label><input class="input" id="editChurch" value="${escapeHtml(p.church)}"></div>
    <div class="field"><label>Email</label><input class="input" id="editEmail" type="email" value="${escapeHtml(p.email || '')}"></div>
    <div class="field"><label>Phone</label><input class="input" id="editPhone" value="${escapeHtml(p.phone)}"></div>
  `;
  const backdrop = openModal('Edit participant', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: 'Save changes',
      className: 'btn-primary',
      onClick: async (b) => {
        const updated = {
          registrationId: p.registrationId,
          fullName: document.getElementById('editName').value.trim(),
          address: document.getElementById('editAddress').value.trim(),
          church: document.getElementById('editChurch').value.trim(),
          email: document.getElementById('editEmail').value.trim(),
          phone: document.getElementById('editPhone').value.trim(),
        };
        try {
          await apiCall('updateParticipant', updated);
          toastSuccess('Participant updated.');
          b.remove();
          loadParticipants();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
  return backdrop;
}

function openAddParticipantModal() {
  const body = `
    <div class="field"><label for="addFullName">Full name *</label><input class="input" id="addFullName"></div>
    <div class="field"><label for="addAddress">Address</label><input class="input" id="addAddress"></div>
    <div class="field"><label for="addChurch">Church *</label><input class="input" id="addChurch"></div>
    <div class="field"><label for="addEmail">Email</label><input class="input" id="addEmail" type="email"></div>
    <div class="field"><label for="addPhone">Phone number *</label><input class="input" id="addPhone" type="tel"></div>
    <div class="field"><label>Gender *</label>
      <div class="radio-group">
        ${CONFIG.GENDERS.map((g, i) => `<label class="radio-pill"><input type="radio" name="addGender" value="${g}" ${i === 0 ? 'checked' : ''}> ${g}</label>`).join('')}
      </div>
    </div>
    <div class="field"><label>Age group *</label>
      <div class="radio-group">
        ${CONFIG.AGE_GROUPS.map((a, i) => `<label class="radio-pill"><input type="radio" name="addAgeGroup" value="${a}" ${i === 0 ? 'checked' : ''}> ${a}</label>`).join('')}
      </div>
    </div>
    <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">If this phone number is already registered, the existing record will be shown instead of creating a duplicate.</p>
  `;
  openModal('Add participant', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: 'Register',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          fullName: document.getElementById('addFullName').value.trim(),
          address: document.getElementById('addAddress').value.trim(),
          church: document.getElementById('addChurch').value.trim(),
          email: document.getElementById('addEmail').value.trim(),
          phone: document.getElementById('addPhone').value.trim(),
          gender: document.querySelector('input[name="addGender"]:checked')?.value,
          ageGroup: document.querySelector('input[name="addAgeGroup"]:checked')?.value,
          staffAssisted: true,
        };
        if (!payload.fullName || !payload.church || !payload.phone || !payload.gender || !payload.ageGroup) {
          toastError('Please fill in all required fields.');
          return;
        }
        try {
          const result = await apiCall('register', payload);
          const dayNote = result.autoCheckedInDay ? ` — marked present for ${dayLabels[result.autoCheckedInDay - 1]?.label || `Day ${result.autoCheckedInDay}`}` : '';
          toastSuccess(result.alreadyRegistered
            ? `${result.fullName} was already registered (${result.registrationId})${dayNote}.`
            : `${result.fullName} registered (${result.registrationId})${dayNote}.`);
          b.remove();
          loadParticipants();
        } catch (err) {
          if (err.isNetworkError) {
            handleOfflineRegistration(payload, b);
            return;
          }
          toastError(err.message);
        }
      },
    },
  ]);
}

/** Offline path: check the local cache for a duplicate phone, otherwise add a pending record and queue the real registration for sync. */
function handleOfflineRegistration(payload, modalBackdrop) {
  const existing = findCachedByPhone(payload.phone);
  if (existing) {
    toastInfo(`${existing.fullName} is already registered (${existing.registrationId}) — no duplicate created.`);
    modalBackdrop.remove();
    return;
  }

  const tempId = 'PENDING-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const pending = {
    registrationId: tempId,
    fullName: payload.fullName,
    address: payload.address,
    church: payload.church,
    email: payload.email,
    phone: payload.phone,
    gender: payload.gender,
    ageGroup: payload.ageGroup,
    registrationDate: new Date().toISOString().slice(0, 10),
    registrationTime: new Date().toTimeString().slice(0, 8),
    attendance: Array.from({ length: conferenceDays }, () => false),
    _pendingSync: true,
  };
  addCachedParticipant(pending);
  queueAction('register', payload);

  allParticipants = getCachedParticipants();
  applyFilters();

  toastInfo(`Offline — ${payload.fullName} saved locally and will register once back online.`);
  modalBackdrop.remove();
}

async function deleteProfile(p) {
  const ok = await confirmDialog(`Delete <strong>${escapeHtml(p.fullName)}</strong>? This also removes their attendance records.`, {
    title: 'Delete participant', confirmLabel: 'Delete', danger: true,
  });
  if (!ok) return;
  try {
    await apiCall('deleteParticipant', { registrationId: p.registrationId });
    toastSuccess('Participant deleted.');
    loadParticipants();
  } catch (err) {
    toastError(err.message);
  }
}
