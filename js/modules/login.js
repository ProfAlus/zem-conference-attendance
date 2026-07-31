// ============================================================
// MODULE: Login
// ============================================================

import { login, getSession } from '../core/auth.js';
import { toastError, toastSuccess, toastInfo } from '../core/toast.js';
import { loadAndApplyBranding } from '../core/theme.js';
import { confirmDialog } from '../core/modal.js';
import * as biometric from '../core/biometric.js';

loadAndApplyBranding();

if (getSession()) {
  window.location.href = 'dashboard.html';
}

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');
const biometricPane = document.getElementById('biometricPane');
const forgetDeviceWrap = document.getElementById('forgetDeviceWrap');

initBiometricUi();

async function initBiometricUi() {
  const supported = biometric.isSupported() && await biometric.isPlatformAuthenticatorAvailable();
  const enabled = biometric.isEnabledOnThisDevice();

  if (supported && enabled) {
    biometricPane.style.display = 'block';
    form.style.display = 'none';
  }
  forgetDeviceWrap.style.display = enabled ? 'block' : 'none';
}

document.getElementById('biometricUnlockBtn')?.addEventListener('click', async () => {
  const unlockBtn = document.getElementById('biometricUnlockBtn');
  unlockBtn.disabled = true;
  unlockBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Verifying…';
  try {
    const { name, passcode } = await biometric.unlockWithBiometrics();
    await login(name, passcode);
    window.location.href = 'dashboard.html';
  } catch (err) {
    toastError(err.message || 'Biometric unlock failed.');
    unlockBtn.disabled = false;
    unlockBtn.innerHTML = '<i class="fa-solid fa-fingerprint"></i> Unlock with fingerprint / Face ID';
  }
});

document.getElementById('usePasscodeInsteadLink')?.addEventListener('click', (e) => {
  e.preventDefault();
  biometricPane.style.display = 'none';
  form.style.display = 'block';
});

document.getElementById('forgetDeviceLink')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const ok = await confirmDialog('This removes the saved login and fingerprint/Face ID unlock from this device. You\u2019ll need your passcode next time.', {
    title: 'Forget this device?', confirmLabel: 'Forget device', danger: true,
  });
  if (!ok) return;
  biometric.forgetThisDevice();
  toastSuccess('Saved login removed from this device.');
  initBiometricUi();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const passcode = document.getElementById('passcode').value;
  if (!name || !passcode) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Signing in…';

  try {
    await login(name, passcode);
    await maybeOfferBiometricSetup(name, passcode);
    window.location.href = 'dashboard.html';
  } catch (err) {
    toastError(err.message || 'Invalid passcode.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign in';
  }
});

/** After a successful passcode login, offer to save it behind a biometric unlock on this device — skipped if already set up or unsupported. */
async function maybeOfferBiometricSetup(name, passcode) {
  if (biometric.isEnabledOnThisDevice()) return;
  const supported = biometric.isSupported() && await biometric.isPlatformAuthenticatorAvailable();
  if (!supported) return;

  const ok = await confirmDialog(
    'Skip typing your name and passcode next time on this device \u2014 unlock instead with your fingerprint or Face ID. This only works on this specific device, and you can remove it anytime from the sign-in screen.',
    { title: 'Enable fingerprint / Face ID unlock?', confirmLabel: 'Enable' }
  );
  if (!ok) return;

  try {
    await biometric.enableOnThisDevice(name, passcode);
    toastSuccess('Fingerprint/Face ID unlock enabled for this device.');
  } catch (err) {
    toastInfo('Could not enable biometric unlock: ' + err.message);
  }
}
