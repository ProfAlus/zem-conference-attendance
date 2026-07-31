// ============================================================
// MODULE: Public Registration
// ============================================================

import { CONFIG } from '../core/config.js';
import { apiCall } from '../core/api.js';
import { toastError, toastSuccess, toastInfo } from '../core/toast.js';
import { escapeHtml, getQueryParams } from '../core/utils.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { queueAction, initAutoSync, registerServiceWorker } from '../core/offline.js';

registerServiceWorker();
initAutoSync();

const els = {
  confName: document.getElementById('confName'),
  formStep: document.getElementById('formStep'),
  successStep: document.getElementById('successStep'),
  regForm: document.getElementById('regForm'),
  lookupForm: document.getElementById('lookupForm'),
  lookupLink: document.getElementById('lookupLink'),
  backToFormLink: document.getElementById('backToFormLink'),
  submitBtn: document.getElementById('submitBtn'),
  genderGroup: document.getElementById('genderGroup'),
  ageGroup: document.getElementById('ageGroup'),
  successName: document.getElementById('successName'),
  successRegId: document.getElementById('successRegId'),
  statusBadge: document.getElementById('statusBadge'),
  qrCanvas: document.getElementById('qrCanvas'),
  dupWarning: document.getElementById('dupWarning'),
  downloadBtn: document.getElementById('downloadBtn'),
  printBtn: document.getElementById('printBtn'),
  registerAnotherLink: document.getElementById('registerAnotherLink'),
  offlinePendingStep: document.getElementById('offlinePendingStep'),
  offlineName: document.getElementById('offlineName'),
  offlineRegisterAnotherLink: document.getElementById('offlineRegisterAnotherLink'),
  closedNotice: document.getElementById('closedNotice'),
  closedMessage: document.getElementById('closedMessage'),
  autoCheckinBadge: document.getElementById('autoCheckinBadge'),
  autoCheckinText: document.getElementById('autoCheckinText'),
};

let dayLabels = [];

// Build radio pill groups
function buildRadioGroup(container, name, options) {
  container.innerHTML = options.map((opt, i) => `
    <label class="radio-pill">
      <input type="radio" name="${name}" value="${opt}" ${i === 0 ? '' : ''} required>
      ${opt}
    </label>`).join('');
}
buildRadioGroup(els.genderGroup, 'gender', CONFIG.GENDERS);
buildRadioGroup(els.ageGroup, 'ageGroup', CONFIG.AGE_GROUPS);

els.confName.textContent = CONFIG.DEFAULTS.conferenceName;
loadAndApplyBranding().then((settings) => {
  if (settings?.conferenceName) els.confName.textContent = settings.conferenceName;
  dayLabels = settings?.dayLabels || [];
  applyRegistrationWindow(settings);
});

function applyRegistrationWindow(settings) {
  if (!settings || cameForLookup) return;
  const closed = settings.selfRegEnabled === false || settings.registrationOpenNow === false;
  els.regForm.style.display = closed ? 'none' : 'block';
  els.closedNotice.style.display = closed ? 'block' : 'none';
  if (closed) {
    els.closedMessage.textContent = settings.selfRegEnabled === false
      ? 'Self-registration is currently closed. Please see a volunteer to register.'
      : `Registration opens at ${formatTime12h(settings.registrationOpensAt)} each day.`;
  }
}

function formatTime12h(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// Re-check every minute so the form appears automatically the moment the
// daily window opens, without anyone needing to refresh the page.
setInterval(() => {
  apiCall('getSettings').then(applyRegistrationWindow).catch(() => {});
}, 60000);

// Toggle to lookup form
els.lookupLink.addEventListener('click', (e) => {
  e.preventDefault();
  els.regForm.style.display = 'none';
  els.lookupForm.style.display = 'block';
});
els.backToFormLink.addEventListener('click', (e) => {
  e.preventDefault();
  els.lookupForm.style.display = 'none';
  els.regForm.style.display = 'block';
});

// Arriving via a "Find my QR code" link (e.g. from materials.html) opens straight to lookup.
const cameForLookup = getQueryParams().lookup === '1';
if (cameForLookup) {
  els.regForm.style.display = 'none';
  els.lookupForm.style.display = 'block';
}

// --- Submit registration ---
els.regForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(els.regForm);
  const payload = {
    fullName: fd.get('fullName')?.trim(),
    address: fd.get('address')?.trim() || '',
    church: fd.get('church')?.trim(),
    email: fd.get('email')?.trim() || '',
    phone: fd.get('phone')?.trim(),
    gender: fd.get('gender'),
    ageGroup: fd.get('ageGroup'),
  };

  if (!payload.fullName || !payload.phone || !payload.church || !payload.gender || !payload.ageGroup) {
    toastError('Please fill in all required fields.');
    return;
  }

  setLoading(true);
  try {
    const data = await apiCall('register', payload);
    showSuccess(data, !data.alreadyRegistered);
  } catch (err) {
    if (err.isNetworkError) {
      queueAction('register', payload);
      showOfflinePending(payload.fullName);
    } else {
      toastError(err.message);
    }
  } finally {
    setLoading(false);
  }
});

// --- Lookup existing registration by phone ---
els.lookupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('lookupPhone').value.trim();
  if (!phone) return;
  setLoading(true, els.lookupForm.querySelector('button'));
  try {
    const data = await apiCall('findByPhone', { phone });
    showSuccess(data, false);
  } catch (err) {
    toastError(err.message);
  } finally {
    setLoading(false, els.lookupForm.querySelector('button'));
  }
});

function setLoading(isLoading, btn = els.submitBtn) {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading
    ? '<span class="spinner spinner-dark" style="width:16px;height:16px;border-width:2px;"></span> Please wait…'
    : btn.dataset.originalHtml || btn.innerHTML;
  if (!isLoading && btn.dataset.originalHtml) btn.innerHTML = btn.dataset.originalHtml;
  if (isLoading && !btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;
}

function showSuccess(data, isNew = true) {
  els.formStep.style.display = 'none';
  els.successStep.style.display = 'block';
  els.successName.textContent = data.fullName;
  els.successRegId.textContent = data.registrationId;

  els.statusBadge.innerHTML = isNew
    ? '<i class="fa-solid fa-circle-check"></i> Registration complete'
    : '<i class="fa-solid fa-rotate"></i> Welcome back — already registered';

  els.dupWarning.style.display = data.possibleDuplicate ? 'block' : 'none';

  if (data.autoCheckedInDay) {
    const label = dayLabels[data.autoCheckedInDay - 1]?.label || `Day ${data.autoCheckedInDay}`;
    els.autoCheckinText.textContent = `You're marked present for ${label}`;
    els.autoCheckinBadge.style.display = 'inline-flex';
  } else {
    els.autoCheckinBadge.style.display = 'none';
  }

  els.qrCanvas.innerHTML = '';
  // eslint-disable-next-line no-undef
  new QRCode(els.qrCanvas, {
    text: data.registrationId,
    width: 200,
    height: 200,
    colorDark: '#1B1640',
    colorLight: '#ffffff',
  });

  toastSuccess(isNew ? 'You are registered!' : 'Found your registration.');

  const printTag = document.getElementById('printTag');
  printTag.innerHTML = `<h2>${escapeHtml(data.fullName)}</h2><p>${escapeHtml(data.registrationId)}</p>`;
}

function showOfflinePending(fullName) {
  els.formStep.style.display = 'none';
  els.offlinePendingStep.style.display = 'block';
  els.offlineName.textContent = fullName;
  toastInfo('No connection — saved on this device and will register automatically once online.');
}

els.offlineRegisterAnotherLink.addEventListener('click', (e) => {
  e.preventDefault();
  els.offlinePendingStep.style.display = 'none';
  els.formStep.style.display = 'block';
  els.regForm.reset();
});

els.downloadBtn.addEventListener('click', () => {
  const canvas = els.qrCanvas.querySelector('canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `${els.successRegId.textContent}-qr.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

els.printBtn.addEventListener('click', () => window.print());

els.registerAnotherLink.addEventListener('click', (e) => {
  e.preventDefault();
  els.successStep.style.display = 'none';
  els.formStep.style.display = 'block';
  els.regForm.reset();
  els.lookupForm.reset();
});
