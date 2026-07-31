// ============================================================
// OFFLINE
// A local cache of the last-synced participant list, plus a
// queue of actions (check-ins, walk-up registrations) taken
// while offline. Both auto-sync once the connection returns.
//
// Why this is safe to replay blindly:
//  - checkAttendance never overwrites an existing mark, so
//    replaying it twice is harmless.
//  - register() is keyed on phone number server-side, so if the
//    same person somehow gets queued twice, the second sync just
//    returns the existing record instead of duplicating it.
// ============================================================

import { apiCall } from './api.js';
import { toastSuccess, toastWarning } from './toast.js';

const KEYS = {
  PARTICIPANTS_CACHE: 'cams_offline_participants',
  QUEUE: 'cams_offline_queue',
};

let syncing = false;
const listeners = new Set();

export function onStatusChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((fn) => fn(getStatus()));
}

export function getStatus() {
  return { online: navigator.onLine, pending: getQueueSnapshot().length, syncing };
}

// ---------- Participant cache ----------
// Powers offline search on the Scanner and offline duplicate
// checks for walk-up registration. Only ever populated on
// staff-authenticated pages (Scanner, Participants) — never on
// the public registration page, so the full roster (names,
// phones) never ends up in a random visitor's browser storage.

export function cacheParticipants(list) {
  try {
    localStorage.setItem(KEYS.PARTICIPANTS_CACHE, JSON.stringify({ list, cachedAt: Date.now() }));
  } catch {
    // Storage full or unavailable — offline lookups just won't have this batch. Non-fatal.
  }
}

export function getCachedParticipants() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.PARTICIPANTS_CACHE) || 'null');
    return raw ? raw.list : [];
  } catch {
    return [];
  }
}

export function getCacheAge() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.PARTICIPANTS_CACHE) || 'null');
    return raw ? raw.cachedAt : null;
  } catch {
    return null;
  }
}

/** Mutate one cached participant in place (e.g. mark a day attended) and persist. */
export function patchCachedParticipant(registrationId, patchFn) {
  const list = getCachedParticipants();
  const idx = list.findIndex((p) => p.registrationId === registrationId);
  if (idx !== -1) {
    patchFn(list[idx]);
    cacheParticipants(list);
  }
  return idx !== -1 ? list[idx] : null;
}

export function addCachedParticipant(participant) {
  const list = getCachedParticipants();
  list.push(participant);
  cacheParticipants(list);
}

/** Simple client-side equivalent of ParticipantService.search(), for offline lookups. */
export function searchCachedParticipants(query, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const normQ = q.replace(/[^\d]/g, '').replace(/^0+/, '');
  return getCachedParticipants()
    .filter((p) => {
      const normPhone = String(p.phone || '').replace(/[^\d]/g, '').replace(/^0+/, '');
      return p.fullName?.toLowerCase().includes(q) ||
        (normQ && normPhone.includes(normQ)) ||
        p.registrationId?.toLowerCase().includes(q);
    })
    .slice(0, limit);
}

export function findCachedByPhone(phone) {
  const normTarget = String(phone || '').replace(/[^\d]/g, '').replace(/^0+/, '');
  if (!normTarget) return null;
  return getCachedParticipants().find((p) => {
    const norm = String(p.phone || '').replace(/[^\d]/g, '').replace(/^0+/, '');
    return norm === normTarget;
  }) || null;
}

// ---------- Queue ----------

function getQueueSnapshot() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.QUEUE) || '[]');
  } catch {
    return [];
  }
}
function saveQueue(q) {
  localStorage.setItem(KEYS.QUEUE, JSON.stringify(q));
  notify();
}

export function queueAction(action, payload) {
  const q = getQueueSnapshot();
  const item = {
    id: 'pending-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    action,
    payload,
    queuedAt: Date.now(),
  };
  q.push(item);
  saveQueue(q);
  return item;
}

/** Replay every queued action against the live backend. Stops at the first network failure and keeps the rest queued. */
export async function syncQueue() {
  if (syncing) return { synced: 0, failed: 0 };
  const queue = getQueueSnapshot();
  if (!queue.length) return { synced: 0, failed: 0 };

  syncing = true;
  notify();
  let synced = 0;
  let failed = 0;
  let remaining = [];

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      await apiCall(item.action, item.payload);
      synced++;
    } catch (err) {
      if (err.isNetworkError) {
        remaining = queue.slice(i); // still offline — keep this and everything after it queued
        break;
      }
      failed++; // a genuine server-side rejection — drop it rather than retry forever
    }
  }

  saveQueue(remaining);
  syncing = false;
  notify();

  if (synced) toastSuccess(`Synced ${synced} offline ${synced === 1 ? 'action' : 'actions'}.`);
  if (failed) toastWarning(`${failed} offline ${failed === 1 ? 'action' : 'actions'} could not be synced — check Participants for anything missing.`);

  return { synced, failed };
}

export function initAutoSync() {
  window.addEventListener('online', () => syncQueue());
  window.addEventListener('offline', notify);
  setInterval(() => { if (navigator.onLine) syncQueue(); }, 30000);
  notify();
  if (navigator.onLine) syncQueue();
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Offline caching just won't be available this session — the app
    // still works fully online, so this is never treated as fatal.
  });
}
