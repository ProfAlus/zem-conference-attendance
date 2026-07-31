// ============================================================
// MODULE: Settings
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { openModal, confirmDialog } from '../core/modal.js';
import { escapeHtml } from '../core/utils.js';
import { applyBranding } from '../core/theme.js';

const content = renderShell('settings.html', 'Settings', 'admin');
if (content) init();

let dayLabels = [];
let conferenceDays = 3;

async function init() {
  content.innerHTML = `<div class="spinner spinner-dark" style="margin: 40px auto;"></div>`;
  let settings;
  try {
    settings = await apiCall('getSettings');
    dayLabels = settings.dayLabels || [];
    conferenceDays = settings.conferenceDays || 3;
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${err.message}</p></div>`;
    return;
  }

  content.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h3>Conference details</h3>
        <form id="settingsForm">
          <div class="field"><label for="conferenceName">Conference name</label>
            <input class="input" id="conferenceName" value="${settings.conferenceName || ''}"></div>
          <div class="field"><label for="venue">Venue / Place</label>
            <input class="input" id="venue" value="${settings.venue || ''}" placeholder="e.g. Zion Evangelical Ministries Auditorium"></div>
          <div class="flex gap-3">
            <div class="field" style="flex:1;"><label for="startDate">Start date</label>
              <input class="input" id="startDate" type="date" value="${settings.startDate || ''}"></div>
            <div class="field" style="flex:1;"><label for="conferenceDays">Number of days</label>
              <input class="input" id="conferenceDays" type="number" min="1" max="14" value="${settings.conferenceDays || 3}"></div>
          </div>
          <div class="card card-tight mb-4" style="background: ${settings.todayDayNumber ? 'var(--color-success-tint)' : 'var(--color-warning-tint)'};">
            <div style="font-size:0.85rem;">
              <i class="fa-solid ${settings.todayDayNumber ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
              ${settings.todayDayNumber
                ? `<strong>Today is ${settings.dayLabels?.[settings.todayDayNumber - 1]?.label || `Day ${settings.todayDayNumber}`}</strong> of your conference — Scanner and new registrations will auto-mark this day.`
                : settings.startDate
                  ? `<strong>Today falls outside your configured conference dates.</strong> New registrations won't auto-mark any day, and volunteers can't check anyone in until an admin fixes the Start Date/Number of days below, or this is expected if the event hasn't started yet.`
                  : `<strong>No Start Date set yet.</strong> Auto-check-in on registration and the volunteer day-lock are both inactive until you set one below.`}
            </div>
          </div>
          <div class="field" style="max-width:220px;"><label for="dailyStartTime">Daily programme start time</label>
            <input class="input" id="dailyStartTime" type="time" value="${settings.dailyStartTime || '08:00'}">
            <div class="hint">Public self-registration opens 1 hour before this time each day (currently ${settings.registrationOpensAt ? formatTime12h(settings.registrationOpensAt) : '—'}). Staff can still register people anytime via Participants → Add participant.</div>
          </div>
          <div class="field"><label for="logoUrl">Logo URL</label>
            <input class="input" id="logoUrl" value="${settings.logoUrl || ''}" placeholder="https://… (or upload a file below)"></div>
          <div class="field">
            <div class="flex gap-3" style="align-items:center;">
              ${settings.logoUrl ? `<img id="logoPreview" src="${settings.logoUrl}" alt="Current logo" style="height:44px; width:auto; border-radius:6px; border:1px solid var(--color-ink-200);">` : '<span id="logoPreview" class="text-muted" style="font-size:0.8rem;">No logo yet</span>'}
              <button type="button" class="btn btn-outline btn-sm" id="uploadLogoBtn"><i class="fa-solid fa-upload"></i> Upload logo image</button>
              <input type="file" id="logoFileInput" accept="image/*" style="display:none;">
            </div>
            <div class="hint">PNG or JPG works best. Uploads are resized automatically and saved to a "Conference Attendance Logos" folder in your Google Drive.</div>
          </div>
          <div class="field"><label for="themeColor">Theme colour</label>
            <input class="input" id="themeColor" type="color" style="height:44px; padding:4px;" value="${settings.themeColor || '#FF6B4E'}"></div>
          <div class="field">
            <label class="radio-pill" style="width:fit-content;">
              <input type="checkbox" id="selfRegEnabled" ${settings.selfRegEnabled !== false ? 'checked' : ''}>
              Enable public self-registration
            </label>
          </div>
          <button type="submit" class="btn btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save settings</button>
        </form>
      </div>

      <div class="card" style="text-align:center;">
        <h3>Public registration QR code</h3>
        <p class="text-muted">Print this and display it around the venue.</p>
        <div id="regQr" style="display:flex; justify-content:center; margin: 16px 0;"></div>
        <button class="btn btn-outline" id="downloadRegQr"><i class="fa-solid fa-download"></i> Download</button>
        <button class="btn btn-outline" id="printRegQr"><i class="fa-solid fa-print"></i> Print</button>
      </div>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Team members</h3>
          <p class="text-muted" style="margin:4px 0 0;">Each person signs in with their own name and passcode — check-ins and edits are logged against them.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addUserBtn"><i class="fa-solid fa-user-plus"></i> Add team member</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody id="usersTbody"></tbody>
        </table>
      </div>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Conference materials</h3>
          <p class="text-muted" style="margin:4px 0 0;">Schedules, slides, and resource links participants can browse on the public Materials page.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addMaterialBtn"><i class="fa-solid fa-plus"></i> Add material</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Category</th><th>Link</th><th></th></tr></thead>
          <tbody id="materialsTbody"></tbody>
        </table>
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="materials.html" target="_blank" rel="noopener">View the public Materials page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Schedule</h3>
          <p class="text-muted" style="margin:4px 0 0;">The day-by-day programme shown on the searchable Schedule page.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addSessionBtn"><i class="fa-solid fa-plus"></i> Add session</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Day</th><th>Time</th><th>Title</th><th></th></tr></thead>
          <tbody id="scheduleTbody"></tbody>
        </table>
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="schedule.html" target="_blank" rel="noopener">View the public Schedule page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Hymns</h3>
          <p class="text-muted" style="margin:4px 0 0;">The searchable hymn booklet shown on the public Hymns page.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addHymnBtn"><i class="fa-solid fa-plus"></i> Add hymn</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Title</th><th>Author</th><th></th></tr></thead>
          <tbody id="hymnsTbody"></tbody>
        </table>
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="hymns.html" target="_blank" rel="noopener">View the public Hymns page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <h3>Reuse this system for another event</h3>
      <p class="text-muted">
        Archive the current participants, attendance, and activity logs into dated backup
        sheets, then clear the live data so you can run a new conference on this same
        deployment. Your team accounts (Users) and this Settings page are kept — just
        update the Conference name / dates below afterward for the new event.
      </p>
      <div class="field" style="max-width:320px;">
        <label for="archiveLabel">Label for this archive <span class="text-muted">(optional)</span></label>
        <input class="input" id="archiveLabel" placeholder="e.g. YouthConf2026">
      </div>
      <button class="btn btn-danger" id="archiveResetBtn"><i class="fa-solid fa-box-archive"></i> Archive data &amp; start fresh</button>
    </div>
  `;

  const regUrl = new URL('register.html', window.location.href).toString();
  // eslint-disable-next-line no-undef
  new QRCode(document.getElementById('regQr'), { text: regUrl, width: 200, height: 200, colorDark: '#1B1640', colorLight: '#ffffff' });
  document.getElementById('downloadRegQr').addEventListener('click', () => {
    const canvas = document.querySelector('#regQr canvas');
    const link = document.createElement('a');
    link.download = 'registration-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
  document.getElementById('printRegQr').addEventListener('click', () => window.print());

  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const updated = await apiCall('updateSettings', collectPayload());
      applyBranding(updated);
      toastSuccess('Settings saved.');
      init(); // refresh so the "Today is Day X" diagnostic reflects any date change immediately
    } catch (err) {
      toastError(err.message);
    }
  });

  document.getElementById('uploadLogoBtn').addEventListener('click', () => {
    document.getElementById('logoFileInput').click();
  });
  document.getElementById('logoFileInput').addEventListener('change', handleLogoUpload);

  document.getElementById('archiveResetBtn').addEventListener('click', async () => {
    const ok = await confirmDialog(
      'This archives all current <strong>Participants</strong>, <strong>Attendance</strong>, and <strong>Logs</strong> data into dated backup sheets, then clears the live data for a new event. Team accounts and these settings are kept. This cannot be undone from the app — the archived data stays in your spreadsheet, but the live lists will be empty.',
      { title: 'Start a new event?', confirmLabel: 'Archive & start fresh', danger: true }
    );
    if (!ok) return;
    const label = document.getElementById('archiveLabel').value.trim();
    try {
      const result = await apiCall('archiveAndReset', { label });
      toastSuccess(result.archived.length ? `Archived to ${result.archived.length} backup sheet(s). Update the conference name/dates above for the new event.` : 'Nothing to archive — already starting fresh.');
      document.getElementById('conferenceName').focus();
    } catch (err) {
      toastError(err.message);
    }
  });

  document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
  await loadUsers();

  document.getElementById('addMaterialBtn').addEventListener('click', () => openMaterialModal());
  await loadMaterials();

  document.getElementById('addSessionBtn').addEventListener('click', () => openSessionModal());
  await loadSchedule();

  document.getElementById('addHymnBtn').addEventListener('click', () => openHymnModal());
  await loadHymns();
}

function formatTime12h(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function collectPayload() {
  return {
    conferenceName: document.getElementById('conferenceName').value.trim(),
    venue: document.getElementById('venue').value.trim(),
    startDate: document.getElementById('startDate').value,
    conferenceDays: Number(document.getElementById('conferenceDays').value) || 3,
    dailyStartTime: document.getElementById('dailyStartTime').value || '08:00',
    logoUrl: document.getElementById('logoUrl').value.trim(),
    themeColor: document.getElementById('themeColor').value,
    selfRegEnabled: document.getElementById('selfRegEnabled').checked,
  };
}

async function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toastError('Please choose an image file.'); return; }

  const btn = document.getElementById('uploadLogoBtn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-dark" style="width:14px;height:14px;border-width:2px;"></span> Uploading…';

  try {
    const { base64, mimeType } = await resizeImageToBase64(file, 500);
    const { url } = await apiCall('uploadLogo', { base64, mimeType, fileName: file.name });

    document.getElementById('logoUrl').value = url;
    const updated = await apiCall('updateSettings', collectPayload());
    applyBranding(updated);

    const preview = document.getElementById('logoPreview');
    const img = document.createElement('img');
    img.id = 'logoPreview';
    img.src = url;
    img.alt = 'Current logo';
    img.style.cssText = 'height:44px; width:auto; border-radius:6px; border:1px solid var(--color-ink-200);';
    preview.replaceWith(img);

    toastSuccess('Logo uploaded and saved.');
  } catch (err) {
    toastError(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
    e.target.value = '';
  }
}

/** Downscale an image client-side before upload, keeping the payload small and Drive tidy. */
function resizeImageToBase64(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          const scale = maxDimension / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve({ base64: canvas.toDataURL(mimeType, 0.87), mimeType });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const users = await apiCall('getUsers');
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align:center;padding:16px;">No team members yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map((u) => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-gold' : 'badge-neutral'}">${escapeHtml(u.role)}</span></td>
        <td>
          <button class="btn btn-sm btn-ghost edit-user" data-name="${escapeHtml(u.name)}" data-role="${escapeHtml(u.role)}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-ghost delete-user" data-name="${escapeHtml(u.name)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-user').forEach((btn) => {
      btn.addEventListener('click', () => openUserModal({ name: btn.dataset.name, role: btn.dataset.role }));
    });
    tbody.querySelectorAll('.delete-user').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove <strong>${escapeHtml(btn.dataset.name)}</strong> from the team?`, {
          title: 'Remove team member', confirmLabel: 'Remove', danger: true,
        });
        if (!ok) return;
        try {
          await apiCall('deleteUser', { name: btn.dataset.name });
          toastSuccess('Team member removed.');
          loadUsers();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

async function loadMaterials() {
  const tbody = document.getElementById('materialsTbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const materials = await apiCall('getMaterials');
    if (!materials.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">Nothing posted yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = materials.map((m) => `
      <tr>
        <td><strong>${escapeHtml(m.title)}</strong>${m.description ? `<br><span class="text-muted" style="font-size:0.8rem;">${escapeHtml(m.description)}</span>` : ''}</td>
        <td>${m.category ? `<span class="badge badge-neutral">${escapeHtml(m.category)}</span>` : '—'}</td>
        <td><a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" style="font-size:0.85rem;">Open link</a></td>
        <td>
          <button class="btn btn-sm btn-ghost edit-material" data-id="${escapeHtml(m.id)}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-ghost delete-material" data-id="${escapeHtml(m.id)}" data-title="${escapeHtml(m.title)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-material').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = materials.find((x) => x.id === btn.dataset.id);
        openMaterialModal(m);
      });
    });
    tbody.querySelectorAll('.delete-material').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove <strong>${escapeHtml(btn.dataset.title)}</strong> from Materials?`, {
          title: 'Remove material', confirmLabel: 'Remove', danger: true,
        });
        if (!ok) return;
        try {
          await apiCall('deleteMaterial', { id: btn.dataset.id });
          toastSuccess('Material removed.');
          loadMaterials();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

function openMaterialModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field"><label for="matTitle">Title</label>
      <input class="input" id="matTitle" value="${existing ? escapeHtml(existing.title) : ''}"></div>
    <div class="field"><label for="matDescription">Description <span class="text-muted">(optional)</span></label>
      <input class="input" id="matDescription" value="${existing ? escapeHtml(existing.description || '') : ''}"></div>
    <div class="field"><label for="matUrl">Link (URL)</label>
      <input class="input" id="matUrl" value="${existing ? escapeHtml(existing.url) : ''}" placeholder="https://…"></div>
    <div class="field"><label for="matCategory">Category <span class="text-muted">(optional, groups items together)</span></label>
      <input class="input" id="matCategory" value="${existing ? escapeHtml(existing.category || '') : ''}" placeholder="e.g. Schedule, Slides, Day 1"></div>
  `;
  openModal(isEdit ? 'Edit material' : 'Add material', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add material',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          title: document.getElementById('matTitle').value.trim(),
          description: document.getElementById('matDescription').value.trim(),
          url: document.getElementById('matUrl').value.trim(),
          category: document.getElementById('matCategory').value.trim(),
        };
        if (!payload.title || !payload.url) { toastError('Title and link are required.'); return; }

        try {
          if (isEdit) {
            await apiCall('updateMaterial', { id: existing.id, ...payload });
            toastSuccess('Material updated.');
          } else {
            await apiCall('addMaterial', payload);
            toastSuccess('Material added.');
          }
          b.remove();
          loadMaterials();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
}

async function loadSchedule() {
  const tbody = document.getElementById('scheduleTbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const sessions = await apiCall('getSchedule');
    if (!sessions.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">No sessions yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = sessions.map((s) => `
      <tr>
        <td><span class="badge badge-neutral">${escapeHtml(dayLabels[s.day - 1]?.short || `Day ${s.day}`)}</span></td>
        <td class="mono" style="font-size:0.85rem;">${escapeHtml(s.time)}</td>
        <td>${escapeHtml(s.title)}</td>
        <td>
          <button class="btn btn-sm btn-ghost edit-session" data-id="${escapeHtml(s.id)}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-ghost delete-session" data-id="${escapeHtml(s.id)}" data-title="${escapeHtml(s.title)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-session').forEach((btn) => {
      btn.addEventListener('click', () => openSessionModal(sessions.find((x) => x.id === btn.dataset.id)));
    });
    tbody.querySelectorAll('.delete-session').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove <strong>${escapeHtml(btn.dataset.title)}</strong> from the schedule?`, {
          title: 'Remove session', confirmLabel: 'Remove', danger: true,
        });
        if (!ok) return;
        try {
          await apiCall('deleteSession', { id: btn.dataset.id });
          toastSuccess('Session removed.');
          loadSchedule();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

function openSessionModal(existing = null) {
  const isEdit = !!existing;
  const dayOptions = (dayLabels.length ? dayLabels : Array.from({ length: conferenceDays }, (_, i) => ({ day: i + 1, label: `Day ${i + 1}` })))
    .map((d) => `<option value="${d.day}" ${existing?.day === d.day ? 'selected' : ''}>${escapeHtml(d.label)}</option>`).join('');
  const body = `
    <div class="field"><label for="sesDay">Day</label>
      <select class="input" id="sesDay">${dayOptions}</select></div>
    <div class="field"><label for="sesTime">Time</label>
      <input class="input" id="sesTime" value="${existing ? escapeHtml(existing.time) : ''}" placeholder="e.g. 9:00 \u2013 10:00 am"></div>
    <div class="field"><label for="sesTitle">Title</label>
      <input class="input" id="sesTitle" value="${existing ? escapeHtml(existing.title) : ''}" placeholder="e.g. Bible Study 1: Power of a Word-Guided Youth"></div>
  `;
  openModal(isEdit ? 'Edit session' : 'Add session', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add session',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          day: Number(document.getElementById('sesDay').value),
          time: document.getElementById('sesTime').value.trim(),
          title: document.getElementById('sesTitle').value.trim(),
        };
        if (!payload.time || !payload.title) { toastError('Time and title are required.'); return; }
        try {
          if (isEdit) {
            await apiCall('updateSession', { id: existing.id, ...payload });
            toastSuccess('Session updated.');
          } else {
            await apiCall('addSession', payload);
            toastSuccess('Session added.');
          }
          b.remove();
          loadSchedule();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
}

async function loadHymns() {
  const tbody = document.getElementById('hymnsTbody');
  tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const hymns = await apiCall('getHymns');
    if (!hymns.length) {
      tbody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align:center;padding:16px;">No hymns yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = hymns.map((h) => `
      <tr>
        <td><strong>${escapeHtml(h.title)}</strong></td>
        <td>${escapeHtml(h.author || '\u2014')}</td>
        <td>
          <button class="btn btn-sm btn-ghost edit-hymn" data-id="${escapeHtml(h.id)}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-ghost delete-hymn" data-id="${escapeHtml(h.id)}" data-title="${escapeHtml(h.title)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-hymn').forEach((btn) => {
      btn.addEventListener('click', () => openHymnModal(hymns.find((x) => x.id === btn.dataset.id)));
    });
    tbody.querySelectorAll('.delete-hymn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove <strong>${escapeHtml(btn.dataset.title)}</strong> from the hymn booklet?`, {
          title: 'Remove hymn', confirmLabel: 'Remove', danger: true,
        });
        if (!ok) return;
        try {
          await apiCall('deleteHymn', { id: btn.dataset.id });
          toastSuccess('Hymn removed.');
          loadHymns();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

function openHymnModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field"><label for="hymTitle">Title</label>
      <input class="input" id="hymTitle" value="${existing ? escapeHtml(existing.title) : ''}"></div>
    <div class="field"><label for="hymAuthor">Author <span class="text-muted">(optional)</span></label>
      <input class="input" id="hymAuthor" value="${existing ? escapeHtml(existing.author || '') : ''}" placeholder="e.g. Adelaide A. Pollard (1906)"></div>
    <div class="field"><label for="hymContent">Lyrics</label>
      <textarea class="input" id="hymContent" rows="10" style="font-family: var(--font-mono); font-size: 0.85rem;" placeholder="[Verse 1]&#10;Line one&#10;Line two&#10;&#10;[Refrain]&#10;Line one">${existing ? escapeHtml(existing.content || '') : ''}</textarea>
      <div class="hint">Mark each section with a line like <span class="mono">[Verse 1]</span> or <span class="mono">[Refrain]</span>, then the lines underneath it.</div>
    </div>
  `;
  openModal(isEdit ? 'Edit hymn' : 'Add hymn', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add hymn',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          title: document.getElementById('hymTitle').value.trim(),
          author: document.getElementById('hymAuthor').value.trim(),
          content: document.getElementById('hymContent').value.trim(),
        };
        if (!payload.title || !payload.content) { toastError('Title and lyrics are required.'); return; }
        try {
          if (isEdit) {
            await apiCall('updateHymn', { id: existing.id, ...payload });
            toastSuccess('Hymn updated.');
          } else {
            await apiCall('addHymn', payload);
            toastSuccess('Hymn added.');
          }
          b.remove();
          loadHymns();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
}

function openUserModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field"><label for="userName">Name</label>
      <input class="input" id="userName" value="${existing ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label for="userPasscode">Passcode ${isEdit ? '<span class="text-muted">(leave blank to keep current)</span>' : ''}</label>
      <input class="input" id="userPasscode" type="text" placeholder="At least 4 characters"></div>
    <div class="field"><label>Role</label>
      <div class="radio-group">
        <label class="radio-pill"><input type="radio" name="userRole" value="volunteer" ${!existing || existing.role === 'volunteer' ? 'checked' : ''}> Volunteer</label>
        <label class="radio-pill"><input type="radio" name="userRole" value="admin" ${existing?.role === 'admin' ? 'checked' : ''}> Admin</label>
      </div>
    </div>
  `;
  openModal(isEdit ? 'Edit team member' : 'Add team member', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add member',
      className: 'btn-primary',
      onClick: async (b) => {
        const name = document.getElementById('userName').value.trim();
        const passcode = document.getElementById('userPasscode').value.trim();
        const role = document.querySelector('input[name="userRole"]:checked').value;
        if (!name) { toastError('Name is required.'); return; }
        if (!isEdit && passcode.length < 4) { toastError('Passcode should be at least 4 characters.'); return; }

        try {
          if (isEdit) {
            await apiCall('updateUser', { originalName: existing.name, name, passcode, role });
            toastSuccess('Team member updated.');
          } else {
            await apiCall('addUser', { name, passcode, role });
            toastSuccess('Team member added.');
          }
          b.remove();
          loadUsers();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);
}
