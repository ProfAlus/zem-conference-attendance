// ============================================================
// BIOMETRIC — lets a volunteer/admin unlock the login screen
// with their device's fingerprint/Face ID instead of retyping
// their name + passcode every time.
//
// HOW THIS ACTUALLY WORKS (read this before assuming it's full
// server-verified biometric auth — it deliberately isn't):
//
//   1. After a normal name+passcode login, the device can offer
//      to "remember" that login for next time.
//   2. If accepted: we generate a random AES-GCM encryption key
//      (via the Web Crypto API), store that key in IndexedDB as
//      non-extractable, and use it to encrypt the name+passcode,
//      which we save in localStorage as ciphertext.
//   3. We also register a WebAuthn platform credential (the
//      browser's own fingerprint/Face ID prompt) purely as a
//      GATE — next time, the person must pass that biometric
//      prompt before our code will even attempt to fetch the key
//      and decrypt the saved login.
//
// This is the same security model as a phone's saved-password
// autofill with biometric unlock (banking apps, password
// managers) — genuinely more resistant to casual snooping than
// plaintext storage, and it requires the device's own biometric
// sensor to proceed. It is NOT the same as the server
// cryptographically verifying a fingerprint — Apps Script has no
// practical way to do real WebAuthn signature verification, so
// this is a device-local convenience layer, not a stronger
// identity proof to the backend. Someone with full access to an
// already-unlocked device's browser dev tools could still extract
// the saved login. Treat it like "remember me," not like a vault.
// ============================================================

const VAULT_KEY = 'cams_biometric_vault'; // { iv, ciphertext } as base64 strings
const CRED_ID_KEY = 'cams_biometric_credential_id';
const DB_NAME = 'cams-biometric';
const STORE_NAME = 'keys';

export function isSupported() {
  return !!(window.PublicKeyCredential && window.crypto?.subtle && window.indexedDB);
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isEnabledOnThisDevice() {
  return !!localStorage.getItem(CRED_ID_KEY);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveKey(cryptoKey) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(cryptoKey, 'aesKey');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function loadKey() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('aesKey');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromB64(str) {
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}
function randomBytes(len) {
  return crypto.getRandomValues(new Uint8Array(len));
}

/**
 * Called right after a successful passcode login. Registers a platform
 * WebAuthn credential (triggers the biometric prompt) and, on success,
 * encrypts + saves the login for next time.
 */
export async function enableOnThisDevice(name, passcode) {
  const userId = randomBytes(16);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32), // not sent anywhere to verify — this is a local-only gate, see file header
      rp: { name: 'Conference Attendance', id: location.hostname },
      user: { id: userId, name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  });
  if (!credential) throw new Error('Biometric setup was cancelled.');

  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify({ name, passcode }));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);

  await saveKey(aesKey);
  localStorage.setItem(VAULT_KEY, JSON.stringify({ iv: toB64(iv), ciphertext: toB64(ciphertext) }));
  localStorage.setItem(CRED_ID_KEY, toB64(credential.rawId));
}

/** Prompts the biometric sensor, then decrypts and returns the saved { name, passcode }, or throws if cancelled/unavailable. */
export async function unlockWithBiometrics() {
  const credId = localStorage.getItem(CRED_ID_KEY);
  const vaultRaw = localStorage.getItem(VAULT_KEY);
  if (!credId || !vaultRaw) throw new Error('Biometric unlock isn\u2019t set up on this device.');

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: fromB64(credId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error('Biometric unlock was cancelled.');

  const aesKey = await loadKey();
  if (!aesKey) throw new Error('Saved login not found on this device — please sign in with your passcode once.');

  const vault = JSON.parse(vaultRaw);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(vault.iv) },
    aesKey,
    fromB64(vault.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

/** Removes the saved login and credential from this device — use when signing out of a shared device. */
export function forgetThisDevice() {
  localStorage.removeItem(VAULT_KEY);
  localStorage.removeItem(CRED_ID_KEY);
  indexedDB.deleteDatabase(DB_NAME);
}
