// ============================================================
// API
// Thin wrapper around fetch() for talking to the Apps Script backend.
//
// IMPORTANT: We POST as 'text/plain' with a JSON string body. This keeps
// the request a "simple request" under CORS rules (no preflight OPTIONS),
// which Apps Script web apps do not handle. Code.gs parses e.postData.contents.
//
// Every request automatically carries the current session's token (if
// any) — the server verifies it for staff/admin-only actions and ignores
// it entirely for public ones, so this is safe to always attach. We read
// it directly from localStorage here (not via auth.js) to avoid a
// circular import, since auth.js itself calls apiCall() to log in.
// ============================================================

import { CONFIG } from './config.js';

function getStoredToken() {
  try {
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);
    return raw ? JSON.parse(raw)?.token || null : null;
  } catch {
    return null;
  }
}

/**
 * Call a named backend action.
 * @param {string} action - e.g. 'register', 'checkAttendance', 'getDashboardStats'
 * @param {object} payload - action-specific data
 * @returns {Promise<any>} - the `data` field of the backend's JSON response
 */
export async function apiCall(action, payload = {}) {
  const body = JSON.stringify({ action, token: getStoredToken(), ...payload });

  let res;
  try {
    res = await fetch(CONFIG.SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Check your internet connection.', networkErr, true);
  }

  if (!res.ok) {
    throw new ApiError(`Server error (${res.status}). Please try again.`);
  }

  let json;
  try {
    json = await res.json();
  } catch (parseErr) {
    throw new ApiError('Unexpected response from server.', parseErr);
  }

  if (!json.success) {
    const rawMessage = json.message || 'Something went wrong.';

    // The session expired or was never valid — clear it and send the
    // person back to sign in, rather than showing a confusing error on
    // whatever staff page they were on.
    if (rawMessage.startsWith('AUTH_EXPIRED')) {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
      const path = location.pathname;
      const isInternalPage = !['/index.html', '/login.html', '/register.html', '/materials.html', '/schedule.html', '/hymns.html', '/speakers.html', '/gallery.html', '/voices.html', '/'].some((p) => path.endsWith(p));
      if (isInternalPage) location.href = 'login.html';
      throw new ApiError('Your session has expired — please sign in again.');
    }

    throw new ApiError(rawMessage.replace(/^AUTH_FORBIDDEN:\s*/, ''));
  }

  return json.data;
}

export class ApiError extends Error {
  constructor(message, cause, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.cause = cause;
    // True only when the request never reached the server at all (offline,
    // DNS failure, etc.) — false for a request the server actively rejected.
    this.isNetworkError = isNetworkError;
  }
}
