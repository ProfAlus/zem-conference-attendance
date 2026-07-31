// ============================================================
// AUTH — simple role-based session, backed by a passcode check
// on the server (see AttendanceService.gs > login()).
//
// This is intentionally lightweight: a youth-conference volunteer
// team, not a bank. Roles: 'admin' and 'volunteer'.
// ============================================================

import { CONFIG } from './config.js';
import { apiCall } from './api.js';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION) || 'null');
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
}

export function isLoggedIn() {
  return !!getSession();
}

export function hasRole(role) {
  const s = getSession();
  return s && (s.role === role || s.role === 'admin'); // admin can access volunteer views too
}

/** Redirect to login.html if not authenticated, or if role doesn't qualify. */
export function requireAuth(minRole = 'volunteer') {
  const s = getSession();
  if (!s) {
    window.location.href = 'login.html';
    return null;
  }
  if (minRole === 'admin' && s.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return null;
  }
  return s;
}

export async function login(name, passcode) {
  const data = await apiCall('login', { name, passcode });
  setSession({ role: data.role, name: data.name });
  return data;
}

export function logout() {
  clearSession();
  window.location.href = 'login.html';
}
