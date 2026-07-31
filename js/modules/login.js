// ============================================================
// MODULE: Login
// ============================================================

import { login, getSession } from '../core/auth.js';
import { toastError } from '../core/toast.js';
import { loadAndApplyBranding } from '../core/theme.js';

loadAndApplyBranding();

if (getSession()) {
  window.location.href = 'dashboard.html';
}

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const passcode = document.getElementById('passcode').value;
  if (!name || !passcode) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Signing in…';

  try {
    await login(name, passcode);
    window.location.href = 'dashboard.html';
  } catch (err) {
    toastError(err.message || 'Invalid passcode.');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign in';
  }
});
