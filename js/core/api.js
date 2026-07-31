// ============================================================
// API
// Thin wrapper around fetch() for talking to the Apps Script backend.
//
// IMPORTANT: We POST as 'text/plain' with a JSON string body. This keeps
// the request a "simple request" under CORS rules (no preflight OPTIONS),
// which Apps Script web apps do not handle. Code.gs parses e.postData.contents.
// ============================================================

import { CONFIG } from './config.js';

/**
 * Call a named backend action.
 * @param {string} action - e.g. 'register', 'checkAttendance', 'getDashboardStats'
 * @param {object} payload - action-specific data
 * @returns {Promise<any>} - the `data` field of the backend's JSON response
 */
export async function apiCall(action, payload = {}) {
  const body = JSON.stringify({ action, ...payload });

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
    throw new ApiError(json.message || 'Something went wrong.');
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
