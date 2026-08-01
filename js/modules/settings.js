// ============================================================
// MODULE: Settings
// ============================================================

import { renderShell } from '../core/nav.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess } from '../core/toast.js';
import { openModal, confirmDialog } from '../core/modal.js';
import { escapeHtml, normalizeDriveUrl, formatDate } from '../core/utils.js';
import { applyBranding } from '../core/theme.js';
import { getSession } from '../core/auth.js';

const content = renderShell('settings.html', 'Settings', 'admin');
if (content) init();

let dayLabels = [];

const BANNER_THEME_OPTIONS = [
  { key: 'midnight-gold', label: 'Midnight Gold', bg1: '#0a0817', bg2: '#2b0d14', accent: '#F2B705' },
  { key: 'ocean-teal', label: 'Ocean Teal', bg1: '#062b2b', bg2: '#0a4a4a', accent: '#2dd4bf' },
  { key: 'royal-purple', label: 'Royal Purple', bg1: '#1a0b2e', bg2: '#3b0764', accent: '#c084fc' },
  { key: 'sunset-coral', label: 'Sunset Coral', bg1: '#3d0f0f', bg2: '#7a1f0d', accent: '#FF6B4E' },
];
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
                ? `<strong>Today is ${settings.dayLabels?.[settings.todayDayNumber - 1]?.label || `Day ${settings.todayDayNumber}`}</strong> of your conference — ${settings.registrationOpenNow ? 'registration and volunteer check-in are open now.' : `registration and volunteer check-in open at ${formatTime12h(settings.registrationOpensAt)} today.`}`
                : settings.startDate
                  ? `<strong>Today falls outside your configured conference dates.</strong> New registrations won't auto-mark any day, and volunteers can't check anyone in until an admin fixes the Start Date/Number of days below, or this is expected if the event hasn't started yet.`
                  : `<strong>No Start Date set yet.</strong> Auto-check-in on registration and the volunteer day-lock are both inactive until you set one below.`}
            </div>
          </div>
          <div class="field" style="max-width:220px;"><label for="dailyStartTime">Daily programme start time</label>
            <input class="input" id="dailyStartTime" type="time" value="${settings.dailyStartTime || '08:00'}">
          </div>
          <div class="field" style="max-width:220px;"><label for="windowMinutes">Window before start (minutes)</label>
            <input class="input" id="windowMinutes" type="number" min="0" max="720" value="${settings.windowMinutes ?? 60}">
            <div class="hint">Registration and volunteer check-in both open this many minutes before the daily start time (currently ${settings.registrationOpensAt ? formatTime12h(settings.registrationOpensAt) : '—'}), and stay open the rest of that day. See the staff toggle below for whether "Add participant" bypasses this.</div>
          </div>
          <div class="field"><label for="logoUrl">Logo URL</label>
            <input class="input" id="logoUrl" value="${settings.logoUrl || ''}" placeholder="https://… (or upload a file below)"></div>
          <div class="field">
            <div class="flex gap-3" style="align-items:center;">
              ${settings.logoUrl ? `<img id="logoPreview" src="${normalizeDriveUrl(settings.logoUrl)}" alt="Current logo" style="height:44px; width:auto; border-radius:6px; border:1px solid var(--color-ink-200);">` : '<span id="logoPreview" class="text-muted" style="font-size:0.8rem;">No logo yet</span>'}
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
          <div class="field">
            <label class="radio-pill" style="width:fit-content;">
              <input type="checkbox" id="staffBypassWindow" ${settings.staffBypassWindow !== false ? 'checked' : ''}>
              Staff can register participants anytime (Add participant bypasses the window)
            </label>
            <div class="hint">Turn this off to make staff-assisted registrations respect the same registration window as the public form, instead of always being allowed.</div>
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
          <h3 style="margin:0;">Event banner (materials.html)</h3>
          <p class="text-muted" style="margin:4px 0 0;">Animated hero banner shown at the top of the public Materials page.</p>
        </div>
      </div>
      <form id="bannerForm">
        <div class="field">
          <label class="radio-pill" style="width:fit-content;">
            <input type="checkbox" id="bannerEnabled" ${settings.bannerEnabled !== false ? 'checked' : ''}>
            Show event banner
          </label>
        </div>
        <div class="field">
          <label for="bannerLiveMessage">Message shown while the conference is ongoing</label>
          <input class="input" id="bannerLiveMessage" value="${escapeHtml(settings.bannerLiveMessage || '')}" placeholder="We're live right now — join us!">
          <div class="hint">
            Uses your Start Date / Daily Start Time / Number of Days above to know which state to show:
            a countdown before the conference starts, this message while it's ongoing, and nothing at all once the last day has ended.
          </div>
        </div>
        <div class="field">
          <label>Colour theme</label>
          <div class="flex gap-3 flex-wrap" id="bannerThemeSwatches">
            ${BANNER_THEME_OPTIONS.map((t) => `
              <label class="banner-swatch-option">
                <input type="radio" name="bannerThemeRadio" value="${t.key}" ${settings.bannerTheme === t.key || (!settings.bannerTheme && t.key === 'midnight-gold') ? 'checked' : ''}>
                <span class="banner-swatch" style="background: linear-gradient(135deg, ${t.bg1}, ${t.bg2});"><span style="background:${t.accent};"></span></span>
                <span class="banner-swatch-label">${t.label}</span>
              </label>
            `).join('')}
            <label class="banner-swatch-option">
              <input type="radio" name="bannerThemeRadio" value="custom" ${settings.bannerTheme === 'custom' ? 'checked' : ''}>
              <span class="banner-swatch banner-swatch--custom"><i class="fa-solid fa-palette"></i></span>
              <span class="banner-swatch-label">Custom</span>
            </label>
          </div>
        </div>
        <div class="field" id="bannerCustomColors" style="display:${settings.bannerTheme === 'custom' ? 'flex' : 'none'}; gap:20px; flex-wrap:wrap;">
          <div><label for="bannerCustomBg1">Background start</label><br><input type="color" id="bannerCustomBg1" value="${settings.bannerCustomBg1 || '#0a0817'}" style="width:56px; height:36px; padding:2px; border-radius:6px;"></div>
          <div><label for="bannerCustomBg2">Background end</label><br><input type="color" id="bannerCustomBg2" value="${settings.bannerCustomBg2 || '#2b0d14'}" style="width:56px; height:36px; padding:2px; border-radius:6px;"></div>
          <div><label for="bannerCustomAccent">Accent (text &amp; highlights)</label><br><input type="color" id="bannerCustomAccent" value="${settings.bannerCustomAccent || '#F2B705'}" style="width:56px; height:36px; padding:2px; border-radius:6px;"></div>
        </div>
        <button type="submit" class="btn btn-primary mt-4"><i class="fa-solid fa-floppy-disk"></i> Save banner settings</button>
      </form>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="materials.html" target="_blank" rel="noopener">Preview the Materials page &rarr;</a>
      </p>
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
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Speakers</h3>
          <p class="text-muted" style="margin:4px 0 0;">Speaker profiles with photo and bio, shown on the public Speakers page.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addSpeakerBtn"><i class="fa-solid fa-plus"></i> Add speaker</button>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th></th><th>Name</th><th>Title</th><th></th></tr></thead>
          <tbody id="speakersTbody"></tbody>
        </table>
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="speakers.html" target="_blank" rel="noopener">View the public Speakers page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Photo gallery</h3>
          <p class="text-muted" style="margin:4px 0 0;">Event highlight photos shown with a lightbox on the public Gallery page.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="addGalleryBtn"><i class="fa-solid fa-plus"></i> Add photo</button>
      </div>
      <div id="galleryThumbGrid" class="gallery-grid mb-4" style="grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));"></div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:8px;">
        <a href="gallery.html" target="_blank" rel="noopener">View the public Gallery page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <div class="flex-between mb-4">
        <div>
          <h3 style="margin:0;">Questions &amp; testimonies</h3>
          <p class="text-muted" style="margin:4px 0 0;">Every submission starts hidden — review and show the ones you want public, and choose whether each name is shown.</p>
        </div>
      </div>
      <div class="flex gap-4 flex-wrap mb-4">
        <label class="radio-pill" style="width:fit-content;">
          <input type="checkbox" id="questionsFormEnabled" ${settings.questionsFormEnabled !== false ? 'checked' : ''}>
          Accepting new questions
        </label>
        <label class="radio-pill" style="width:fit-content;">
          <input type="checkbox" id="testimoniesFormEnabled" ${settings.testimoniesFormEnabled !== false ? 'checked' : ''}>
          Accepting new testimonies
        </label>
      </div>
      <div class="flex gap-4 flex-wrap mb-4">
        <label class="radio-pill" style="width:fit-content;">
          <input type="checkbox" id="autoApproveQuestions" ${settings.autoApproveQuestions ? 'checked' : ''}>
          Auto-approve questions
        </label>
        <label class="radio-pill" style="width:fit-content;">
          <input type="checkbox" id="autoApproveTestimonies" ${settings.autoApproveTestimonies ? 'checked' : ''}>
          Auto-approve testimonies
        </label>
      </div>
      <p class="text-muted" style="font-size:0.8rem; margin-top:-8px; margin-bottom:16px;">
        Turning a form off only hides that submission form on the public page — previously approved entries keep displaying either way.
        Auto-approve skips the moderation queue for that type — submissions go live the instant they're sent, name shown by default. You can still flip Anonymous or Show on any entry afterward from the table below.
      </p>
      <p class="text-muted" style="font-size:0.8rem; margin-top:-8px; margin-bottom:16px;">
        Turning a form off only hides that submission form on the public page — previously approved entries keep displaying either way.
        Auto-approve skips the moderation queue for that type — submissions go live the instant they're sent, name shown by default. You can still flip Anonymous or Show on any entry afterward from the tables below.
      </p>
      <p class="text-muted" style="font-size:0.8rem;">
        <a href="voices.html" target="_blank" rel="noopener">View the public Questions &amp; Testimonies page &rarr;</a>
      </p>
    </div>

    <div class="card mt-6">
      <h3 style="margin-bottom:4px;">Questions</h3>
      <p class="text-muted" style="margin:0 0 16px;">Questions can always be replied to.</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Content</th><th>Visible</th><th>Anonymous</th><th>Reactions</th><th>Reply</th><th></th></tr></thead>
          <tbody id="questionsTbody"></tbody>
        </table>
      </div>
    </div>

    <div class="card mt-6">
      <h3 style="margin-bottom:4px;">Testimonies</h3>
      <p class="text-muted" style="margin:0 0 16px;">Reply is off by default for testimonies — turn on "Allow reply" for a specific one before you can respond to it.</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Content</th><th>Visible</th><th>Anonymous</th><th>Reactions</th><th>Allow reply</th><th>Reply</th><th></th></tr></thead>
          <tbody id="testimoniesTbody"></tbody>
        </table>
      </div>
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

  document.querySelectorAll('input[name="bannerThemeRadio"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.getElementById('bannerCustomColors').style.display = radio.value === 'custom' && radio.checked ? 'flex' : 'none';
    });
  });
  document.getElementById('bannerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedTheme = document.querySelector('input[name="bannerThemeRadio"]:checked')?.value || 'midnight-gold';
    const payload = {
      bannerEnabled: document.getElementById('bannerEnabled').checked,
      bannerLiveMessage: document.getElementById('bannerLiveMessage').value.trim(),
      bannerTheme: selectedTheme,
    };
    if (selectedTheme === 'custom') {
      payload.bannerCustomBg1 = document.getElementById('bannerCustomBg1').value;
      payload.bannerCustomBg2 = document.getElementById('bannerCustomBg2').value;
      payload.bannerCustomAccent = document.getElementById('bannerCustomAccent').value;
    }
    try {
      await apiCall('updateSettings', payload);
      toastSuccess('Banner settings saved.');
    } catch (err) {
      toastError(err.message);
    }
  });

  document.getElementById('addMaterialBtn').addEventListener('click', () => openMaterialModal());
  await loadMaterials();

  document.getElementById('addSessionBtn').addEventListener('click', () => openSessionModal());
  await loadSchedule();

  document.getElementById('addHymnBtn').addEventListener('click', () => openHymnModal());
  await loadHymns();

  document.getElementById('addSpeakerBtn').addEventListener('click', () => openSpeakerModal());
  await loadSpeakers();

  document.getElementById('addGalleryBtn').addEventListener('click', () => openGalleryModal());
  await loadGallery();

  document.getElementById('questionsFormEnabled').addEventListener('change', async (e) => {
    try {
      await apiCall('updateSettings', { questionsFormEnabled: e.target.checked });
      toastSuccess(e.target.checked ? 'Question submissions are open.' : 'Question submissions are closed — existing ones still show.');
    } catch (err) {
      toastError(err.message);
      e.target.checked = !e.target.checked;
    }
  });
  document.getElementById('testimoniesFormEnabled').addEventListener('change', async (e) => {
    try {
      await apiCall('updateSettings', { testimoniesFormEnabled: e.target.checked });
      toastSuccess(e.target.checked ? 'Testimony submissions are open.' : 'Testimony submissions are closed — existing ones still show.');
    } catch (err) {
      toastError(err.message);
      e.target.checked = !e.target.checked;
    }
  });
  document.getElementById('autoApproveQuestions').addEventListener('change', async (e) => {
    try {
      await apiCall('updateSettings', { autoApproveQuestions: e.target.checked });
      toastSuccess(e.target.checked ? 'Questions now auto-approve.' : 'Questions now go through moderation.');
    } catch (err) {
      toastError(err.message);
      e.target.checked = !e.target.checked;
    }
  });
  document.getElementById('autoApproveTestimonies').addEventListener('change', async (e) => {
    try {
      await apiCall('updateSettings', { autoApproveTestimonies: e.target.checked });
      toastSuccess(e.target.checked ? 'Testimonies now auto-approve.' : 'Testimonies now go through moderation.');
    } catch (err) {
      toastError(err.message);
      e.target.checked = !e.target.checked;
    }
  });

  await loadSubmissions();
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
    windowMinutes: Number(document.getElementById('windowMinutes').value) || 60,
    logoUrl: document.getElementById('logoUrl').value.trim(),
    themeColor: document.getElementById('themeColor').value,
    selfRegEnabled: document.getElementById('selfRegEnabled').checked,
    staffBypassWindow: document.getElementById('staffBypassWindow').checked,
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

async function loadSpeakers() {
  const tbody = document.getElementById('speakersTbody');
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const speakers = await apiCall('getSpeakers');
    if (!speakers.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">No speakers yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = speakers.map((s) => `
      <tr>
        <td>${s.photoUrl ? `<img src="${escapeHtml(normalizeDriveUrl(s.photoUrl))}" alt="" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--color-coral-tint);display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-user" style="font-size:0.7rem;color:var(--color-coral);"></i></div>`}</td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.title || '\u2014')}</td>
        <td>
          <button class="btn btn-sm btn-ghost edit-speaker" data-id="${escapeHtml(s.id)}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-ghost delete-speaker" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.edit-speaker').forEach((btn) => {
      btn.addEventListener('click', () => openSpeakerModal(speakers.find((x) => x.id === btn.dataset.id)));
    });
    tbody.querySelectorAll('.delete-speaker').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove <strong>${escapeHtml(btn.dataset.name)}</strong> from Speakers?`, {
          title: 'Remove speaker', confirmLabel: 'Remove', danger: true,
        });
        if (!ok) return;
        try {
          await apiCall('deleteSpeaker', { id: btn.dataset.id });
          toastSuccess('Speaker removed.');
          loadSpeakers();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

function openSpeakerModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field"><label for="spkName">Name</label>
      <input class="input" id="spkName" value="${existing ? escapeHtml(existing.name) : ''}"></div>
    <div class="field"><label for="spkTitle">Title / role <span class="text-muted">(optional)</span></label>
      <input class="input" id="spkTitle" value="${existing ? escapeHtml(existing.title || '') : ''}" placeholder="e.g. Keynote Speaker, Youth Pastor"></div>
    <div class="field"><label for="spkBio">Bio <span class="text-muted">(optional)</span></label>
      <textarea class="input" id="spkBio" rows="5">${existing ? escapeHtml(existing.bio || '') : ''}</textarea>
    </div>
    <div class="field">
      <label>Photo <span class="text-muted">(optional)</span></label>
      <div class="flex gap-3" style="align-items:center;">
        ${existing?.photoUrl ? `<img id="spkPhotoPreview" src="${escapeHtml(normalizeDriveUrl(existing.photoUrl))}" alt="" style="height:44px;width:44px;border-radius:50%;object-fit:cover;border:1px solid var(--color-ink-200);">` : '<span id="spkPhotoPreview" class="text-muted" style="font-size:0.8rem;">No photo yet</span>'}
        <button type="button" class="btn btn-outline btn-sm" id="spkUploadBtn"><i class="fa-solid fa-upload"></i> Upload photo</button>
        <input type="file" id="spkFileInput" accept="image/*" style="display:none;">
      </div>
      <input class="input mt-4" id="spkPhotoUrl" value="${existing ? escapeHtml(existing.photoUrl || '') : ''}" placeholder="Or paste an image URL">
    </div>
    <div class="field">
      <label>Social links <span class="text-muted">(all optional)</span></label>
      <input class="input mb-4" id="spkFacebook" value="${existing ? escapeHtml(existing.facebook || '') : ''}" placeholder="Facebook URL">
      <input class="input mb-4" id="spkTwitter" value="${existing ? escapeHtml(existing.twitter || '') : ''}" placeholder="Twitter / X URL">
      <input class="input mb-4" id="spkInstagram" value="${existing ? escapeHtml(existing.instagram || '') : ''}" placeholder="Instagram URL">
      <input class="input mb-4" id="spkLinkedin" value="${existing ? escapeHtml(existing.linkedin || '') : ''}" placeholder="LinkedIn URL">
      <input class="input" id="spkWebsite" value="${existing ? escapeHtml(existing.website || '') : ''}" placeholder="Website URL">
    </div>
  `;
  const backdrop = openModal(isEdit ? 'Edit speaker' : 'Add speaker', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add speaker',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          name: document.getElementById('spkName').value.trim(),
          title: document.getElementById('spkTitle').value.trim(),
          bio: document.getElementById('spkBio').value.trim(),
          photoUrl: document.getElementById('spkPhotoUrl').value.trim(),
          facebook: document.getElementById('spkFacebook').value.trim(),
          twitter: document.getElementById('spkTwitter').value.trim(),
          instagram: document.getElementById('spkInstagram').value.trim(),
          linkedin: document.getElementById('spkLinkedin').value.trim(),
          website: document.getElementById('spkWebsite').value.trim(),
        };
        if (!payload.name) { toastError('Name is required.'); return; }
        try {
          if (isEdit) {
            await apiCall('updateSpeaker', { id: existing.id, ...payload });
            toastSuccess('Speaker updated.');
          } else {
            await apiCall('addSpeaker', payload);
            toastSuccess('Speaker added.');
          }
          b.remove();
          loadSpeakers();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);

  backdrop.querySelector('#spkUploadBtn').addEventListener('click', () => backdrop.querySelector('#spkFileInput').click());
  backdrop.querySelector('#spkFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toastError('Please choose an image file.'); return; }

    const uploadBtn = backdrop.querySelector('#spkUploadBtn');
    const original = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner spinner-dark" style="width:14px;height:14px;border-width:2px;"></span> Uploading…';
    try {
      const { base64, mimeType } = await resizeImageToBase64(file, 400);
      const { url } = await apiCall('uploadLogo', { base64, mimeType, fileName: file.name });
      backdrop.querySelector('#spkPhotoUrl').value = url;
      const preview = backdrop.querySelector('#spkPhotoPreview');
      const img = document.createElement('img');
      img.id = 'spkPhotoPreview';
      img.src = url;
      img.style.cssText = 'height:44px;width:44px;border-radius:50%;object-fit:cover;border:1px solid var(--color-ink-200);';
      preview.replaceWith(img);
      toastSuccess('Photo uploaded.');
    } catch (err) {
      toastError(err.message);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = original;
      e.target.value = '';
    }
  });
}

async function loadGallery() {
  const grid = document.getElementById('galleryThumbGrid');
  grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:16px;"><span class="spinner spinner-dark"></span></div>`;
  try {
    const images = await apiCall('getGalleryImages');
    if (!images.length) {
      grid.innerHTML = `<div class="text-muted" style="grid-column:1/-1; padding:8px 0;">No photos yet.</div>`;
      return;
    }
    grid.innerHTML = images.map((img) => `
      <div class="gallery-thumb" data-id="${escapeHtml(img.id)}" style="aspect-ratio:1/1;">
        <img src="${escapeHtml(normalizeDriveUrl(img.imageUrl))}" alt="">
        <div style="position:absolute; top:4px; right:4px; display:flex; gap:4px;">
          <button class="btn btn-sm btn-ghost edit-gallery" data-id="${escapeHtml(img.id)}" style="background:rgba(255,255,255,0.9); width:26px; height:26px; padding:0;"><i class="fa-solid fa-pen" style="font-size:0.7rem;"></i></button>
          <button class="btn btn-sm btn-ghost delete-gallery" data-id="${escapeHtml(img.id)}" style="background:rgba(255,255,255,0.9); width:26px; height:26px; padding:0; color:var(--color-danger);"><i class="fa-solid fa-trash" style="font-size:0.7rem;"></i></button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.edit-gallery').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openGalleryModal(images.find((x) => x.id === btn.dataset.id));
      });
    });
    grid.querySelectorAll('.delete-gallery').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog('Remove this photo from the gallery?', { title: 'Remove photo', confirmLabel: 'Remove', danger: true });
        if (!ok) return;
        try {
          await apiCall('deleteGalleryImage', { id: btn.dataset.id });
          toastSuccess('Photo removed.');
          loadGallery();
        } catch (err) {
          toastError(err.message);
        }
      });
    });
  } catch (err) {
    grid.innerHTML = `<div class="text-muted" style="grid-column:1/-1;">${err.message}</div>`;
  }
}

function openGalleryModal(existing = null) {
  const isEdit = !!existing;
  const body = `
    <div class="field">
      <label>Photo</label>
      <div class="flex gap-3" style="align-items:center;">
        ${existing?.imageUrl ? `<img id="galPhotoPreview" src="${escapeHtml(normalizeDriveUrl(existing.imageUrl))}" alt="" style="height:56px;width:56px;border-radius:8px;object-fit:cover;border:1px solid var(--color-ink-200);">` : '<span id="galPhotoPreview" class="text-muted" style="font-size:0.8rem;">No photo yet</span>'}
        <button type="button" class="btn btn-outline btn-sm" id="galUploadBtn"><i class="fa-solid fa-upload"></i> Upload photo</button>
        <input type="file" id="galFileInput" accept="image/*" style="display:none;">
      </div>
      <input class="input mt-4" id="galImageUrl" value="${existing ? escapeHtml(existing.imageUrl || '') : ''}" placeholder="Or paste an image URL">
    </div>
    <div class="field"><label for="galCaption">Caption <span class="text-muted">(optional)</span></label>
      <input class="input" id="galCaption" value="${existing ? escapeHtml(existing.caption || '') : ''}"></div>
    <div class="field"><label for="galCategory">Category <span class="text-muted">(optional, groups photos together)</span></label>
      <input class="input" id="galCategory" value="${existing ? escapeHtml(existing.category || '') : ''}" placeholder="e.g. Bible Study, Discussions, Worship"></div>
  `;
  const backdrop = openModal(isEdit ? 'Edit photo' : 'Add photo', body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: isEdit ? 'Save changes' : 'Add photo',
      className: 'btn-primary',
      onClick: async (b) => {
        const payload = {
          imageUrl: document.getElementById('galImageUrl').value.trim(),
          caption: document.getElementById('galCaption').value.trim(),
          category: document.getElementById('galCategory').value.trim(),
        };
        if (!payload.imageUrl) { toastError('Please upload a photo or paste an image URL.'); return; }
        try {
          if (isEdit) {
            await apiCall('updateGalleryImage', { id: existing.id, ...payload });
            toastSuccess('Photo updated.');
          } else {
            await apiCall('addGalleryImage', payload);
            toastSuccess('Photo added.');
          }
          b.remove();
          loadGallery();
        } catch (err) {
          toastError(err.message);
        }
      },
    },
  ]);

  backdrop.querySelector('#galUploadBtn').addEventListener('click', () => backdrop.querySelector('#galFileInput').click());
  backdrop.querySelector('#galFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toastError('Please choose an image file.'); return; }

    const uploadBtn = backdrop.querySelector('#galUploadBtn');
    const original = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner spinner-dark" style="width:14px;height:14px;border-width:2px;"></span> Uploading…';
    try {
      const { base64, mimeType } = await resizeImageToBase64(file, 1200);
      const { url } = await apiCall('uploadLogo', { base64, mimeType, fileName: file.name });
      backdrop.querySelector('#galImageUrl').value = url;
      const preview = backdrop.querySelector('#galPhotoPreview');
      const img = document.createElement('img');
      img.id = 'galPhotoPreview';
      img.src = url;
      img.style.cssText = 'height:56px;width:56px;border-radius:8px;object-fit:cover;border:1px solid var(--color-ink-200);';
      preview.replaceWith(img);
      toastSuccess('Photo uploaded.');
    } catch (err) {
      toastError(err.message);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = original;
      e.target.value = '';
    }
  });
}

async function loadSubmissions() {
  const qTbody = document.getElementById('questionsTbody');
  const tTbody = document.getElementById('testimoniesTbody');
  qTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  tTbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:16px;"><span class="spinner spinner-dark"></span></td></tr>`;
  try {
    const entries = await apiCall('getAllEntries');
    const questions = entries.filter((e) => e.type === 'Question');
    const testimonies = entries.filter((e) => e.type === 'Testimony');
    renderQuestionsTable(questions);
    renderTestimoniesTable(testimonies);
  } catch (err) {
    qTbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
    tTbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:16px;">${err.message}</td></tr>`;
  }
}

function entryPreview(e) {
  return escapeHtml(e.content.length > 120 ? e.content.slice(0, 120) + '\u2026' : e.content);
}

function wireCommonToggles(tbody) {
  tbody.querySelectorAll('.toggle-visible').forEach((cb) => {
    cb.addEventListener('change', async () => {
      try {
        await apiCall('updateSubmission', { id: cb.dataset.id, visible: cb.checked });
        toastSuccess(cb.checked ? 'Now showing publicly.' : 'Hidden from public view.');
      } catch (err) {
        toastError(err.message);
        cb.checked = !cb.checked;
      }
    });
  });
  tbody.querySelectorAll('.toggle-anonymous').forEach((cb) => {
    cb.addEventListener('change', async () => {
      try {
        await apiCall('updateSubmission', { id: cb.dataset.id, anonymous: cb.checked });
        toastSuccess(cb.checked ? 'Name will be hidden.' : 'Name will be shown.');
      } catch (err) {
        toastError(err.message);
        cb.checked = !cb.checked;
      }
    });
  });
  tbody.querySelectorAll('.toggle-reactions').forEach((cb) => {
    cb.addEventListener('change', async () => {
      try {
        await apiCall('updateSubmission', { id: cb.dataset.id, reactionsEnabled: cb.checked });
        toastSuccess(cb.checked ? 'Reactions enabled for this entry.' : 'Reactions turned off for this entry.');
      } catch (err) {
        toastError(err.message);
        cb.checked = !cb.checked;
      }
    });
  });
  tbody.querySelectorAll('.delete-submission').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog('Permanently delete this submission?', { title: 'Delete submission', confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      try {
        await apiCall('deleteSubmission', { id: btn.dataset.id });
        toastSuccess('Submission deleted.');
        loadSubmissions();
      } catch (err) {
        toastError(err.message);
      }
    });
  });
}

function renderQuestionsTable(questions) {
  const tbody = document.getElementById('questionsTbody');
  if (!questions.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:16px;">No questions yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = questions.map((e) => `
    <tr>
      <td>${escapeHtml(e.name || '\u2014')}</td>
      <td style="max-width:220px; white-space:normal;">${entryPreview(e)}</td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-visible" data-id="${escapeHtml(e.id)}" ${e.visible ? 'checked' : ''}> Show</label></td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-anonymous" data-id="${escapeHtml(e.id)}" ${e.anonymous ? 'checked' : ''}> Anon</label></td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-reactions" data-id="${escapeHtml(e.id)}" ${e.reactionsEnabled !== false ? 'checked' : ''}> On</label></td>
      <td><button class="btn btn-sm ${e.reply ? 'btn-outline' : 'btn-primary'} reply-btn" data-id="${escapeHtml(e.id)}"><i class="fa-solid fa-reply"></i> ${e.reply ? 'Edit reply' : 'Reply'}</button></td>
      <td><button class="btn btn-sm btn-ghost delete-submission" data-id="${escapeHtml(e.id)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.reply-btn').forEach((btn) => {
    btn.addEventListener('click', () => openReplyModal(questions.find((x) => x.id === btn.dataset.id)));
  });
  wireCommonToggles(tbody);
}

function renderTestimoniesTable(testimonies) {
  const tbody = document.getElementById('testimoniesTbody');
  if (!testimonies.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-muted" style="text-align:center;padding:16px;">No testimonies yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = testimonies.map((e) => `
    <tr>
      <td>${escapeHtml(e.name || '\u2014')}</td>
      <td style="max-width:200px; white-space:normal;">${entryPreview(e)}</td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-visible" data-id="${escapeHtml(e.id)}" ${e.visible ? 'checked' : ''}> Show</label></td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-anonymous" data-id="${escapeHtml(e.id)}" ${e.anonymous ? 'checked' : ''}> Anon</label></td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-reactions" data-id="${escapeHtml(e.id)}" ${e.reactionsEnabled !== false ? 'checked' : ''}> On</label></td>
      <td><label class="radio-pill" style="width:fit-content;"><input type="checkbox" class="toggle-reply-enabled" data-id="${escapeHtml(e.id)}" ${e.replyEnabled ? 'checked' : ''}> Allow</label></td>
      <td>
        ${e.replyEnabled
          ? `<button class="btn btn-sm ${e.reply ? 'btn-outline' : 'btn-primary'} reply-btn" data-id="${escapeHtml(e.id)}"><i class="fa-solid fa-reply"></i> ${e.reply ? 'Edit reply' : 'Reply'}</button>`
          : '<span class="text-muted" style="font-size:0.8rem;">Turn on Allow first</span>'}
      </td>
      <td><button class="btn btn-sm btn-ghost delete-submission" data-id="${escapeHtml(e.id)}" style="color:var(--color-danger);"><i class="fa-solid fa-trash"></i></button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.reply-btn').forEach((btn) => {
    btn.addEventListener('click', () => openReplyModal(testimonies.find((x) => x.id === btn.dataset.id)));
  });
  tbody.querySelectorAll('.toggle-reply-enabled').forEach((cb) => {
    cb.addEventListener('change', async () => {
      try {
        await apiCall('updateSubmission', { id: cb.dataset.id, replyEnabled: cb.checked });
        toastSuccess(cb.checked ? 'Reply enabled for this testimony.' : 'Reply disabled for this testimony.');
        loadSubmissions(); // refresh so the Reply button appears/disappears correctly
      } catch (err) {
        toastError(err.message);
        cb.checked = !cb.checked;
      }
    });
  });
  wireCommonToggles(tbody);
}

function openReplyModal(entry) {
  const body = `
    <div class="card card-tight mb-4" style="background: var(--color-cream-100);">
      <p style="margin:0; white-space:pre-wrap; font-size:0.9rem;">${escapeHtml(entry.content)}</p>
      <div class="text-muted" style="font-size:0.75rem; margin-top:6px;">${escapeHtml(entry.name || 'Anonymous')}</div>
    </div>
    <div class="field"><label for="replyText">Your response</label>
      <textarea class="input" id="replyText" rows="5" placeholder="This will show publicly under the ${entry.type === 'Testimony' ? 'testimony' : 'question'} once it's shown.">${escapeHtml(entry.reply || '')}</textarea>
    </div>
    <div class="field">
      <label class="radio-pill" style="width:fit-content;">
        <input type="checkbox" id="replyAnonymous" ${entry.replyAnonymous ? 'checked' : ''}>
        Show as "Admin" instead of my name
      </label>
    </div>
  `;
  openModal(`Reply to ${entry.type === 'Testimony' ? 'testimony' : 'question'}`, body, [
    { label: 'Cancel', className: 'btn-ghost', onClick: (b) => b.remove() },
    {
      label: 'Save reply',
      className: 'btn-primary',
      onClick: async (b) => {
        const reply = document.getElementById('replyText').value.trim();
        const replyAnonymous = document.getElementById('replyAnonymous').checked;
        try {
          await apiCall('replyToEntry', { id: entry.id, reply, repliedBy: getSession()?.name || '', replyAnonymous });
          toastSuccess('Reply saved.');
          b.remove();
          loadSubmissions();
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
