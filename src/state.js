import { STORAGE_KEYS, DEFAULTS, LOCKOUT_SCHEDULE } from './constants.js';
import { generateSalt, deriveHash, constantTimeEquals } from './crypto.js';

const TRIVIAL_PINS = new Set([
  '12345678',
  '00000000',
  '11111111',
  '87654321',
]);

function validatePin(pin) {
  if (typeof pin !== 'string') throw new Error('PIN must be a string');
  if (!/^\d+$/.test(pin)) throw new Error('PIN must contain only digits');
  if (pin.length < DEFAULTS.MIN_PIN_LENGTH) throw new Error(`PIN must be at least ${DEFAULTS.MIN_PIN_LENGTH} digits`);
  if (TRIVIAL_PINS.has(pin)) throw new Error('PIN is too common. Choose a different PIN.');
}

async function getLocal(key) {
  const res = await chrome.storage.local.get(key);
  return res[key];
}

async function setLocal(obj) {
  await chrome.storage.local.set(obj);
}

async function getSession(key) {
  const res = await chrome.storage.session.get(key);
  return res[key];
}

async function setSession(obj) {
  await chrome.storage.session.set(obj);
}

export async function getSetupComplete() {
  return !!(await getLocal(STORAGE_KEYS.SETUP_COMPLETE));
}

export async function setupPin(pin) {
  if (await getSetupComplete()) throw new Error('PIN is already set up');
  validatePin(pin);
  const salt = generateSalt();
  const hash = await deriveHash(pin, salt);
  await setLocal({
    [STORAGE_KEYS.PIN_HASH]: hash,
    [STORAGE_KEYS.PIN_SALT]: salt,
    [STORAGE_KEYS.SETUP_COMPLETE]: true,
    [STORAGE_KEYS.FAILED_ATTEMPTS]: 0,
    [STORAGE_KEYS.LOCKOUT_UNTIL]: 0,
  });
  await setSession({ [STORAGE_KEYS.UNLOCKED]: true });
  return true;
}

export async function verifyPin(pin) {
  const lockoutUntil = await getLocal(STORAGE_KEYS.LOCKOUT_UNTIL) || 0;
  const now = Date.now();
  if (now < lockoutUntil) {
    return { ok: false, lockoutSeconds: Math.ceil((lockoutUntil - now) / 1000) };
  }

  const hash = await getLocal(STORAGE_KEYS.PIN_HASH);
  const salt = await getLocal(STORAGE_KEYS.PIN_SALT);
  if (!hash || !salt) return { ok: false };

  const inputHash = await deriveHash(pin, salt);
  if (constantTimeEquals(inputHash, hash)) {
    await setLocal({ [STORAGE_KEYS.FAILED_ATTEMPTS]: 0, [STORAGE_KEYS.LOCKOUT_UNTIL]: 0 });
    await setSession({ [STORAGE_KEYS.UNLOCKED]: true });
    return { ok: true };
  }

  let failed = (await getLocal(STORAGE_KEYS.FAILED_ATTEMPTS) || 0) + 1;
  await setLocal({ [STORAGE_KEYS.FAILED_ATTEMPTS]: failed });

  for (const entry of LOCKOUT_SCHEDULE) {
    if (failed >= entry.after) {
      await setLocal({ [STORAGE_KEYS.LOCKOUT_UNTIL]: now + entry.seconds * 1000 });
    }
  }

  const remaining = await getLockoutRemaining();
  return { ok: false, lockoutSeconds: remaining > 0 ? remaining : undefined };
}

export async function changePin(oldPin, newPin) {
  const result = await verifyPin(oldPin);
  if (!result.ok) return false;

  validatePin(newPin);
  const salt = generateSalt();
  const hash = await deriveHash(newPin, salt);
  await setLocal({
    [STORAGE_KEYS.PIN_HASH]: hash,
    [STORAGE_KEYS.PIN_SALT]: salt,
    [STORAGE_KEYS.FAILED_ATTEMPTS]: 0,
    [STORAGE_KEYS.LOCKOUT_UNTIL]: 0,
  });
  return true;
}

export async function isUnlocked() {
  return !!(await getSession(STORAGE_KEYS.UNLOCKED));
}

export async function setUnlocked(v) {
  await setSession({ [STORAGE_KEYS.UNLOCKED]: !!v });
}

export async function getIdleMinutes() {
  const val = await getLocal(STORAGE_KEYS.IDLE_MINUTES);
  return typeof val === 'number' ? val : DEFAULTS.IDLE_MINUTES;
}

export async function setIdleMinutes(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) throw new Error('Invalid idle minutes');
  await setLocal({ [STORAGE_KEYS.IDLE_MINUTES]: num });
}

export async function getFailedAttempts() {
  return (await getLocal(STORAGE_KEYS.FAILED_ATTEMPTS)) || 0;
}

export async function resetFailedAttempts() {
  await setLocal({ [STORAGE_KEYS.FAILED_ATTEMPTS]: 0, [STORAGE_KEYS.LOCKOUT_UNTIL]: 0 });
}

export async function getLockoutRemaining() {
  const lockoutUntil = await getLocal(STORAGE_KEYS.LOCKOUT_UNTIL) || 0;
  const now = Date.now();
  return Math.max(0, Math.ceil((lockoutUntil - now) / 1000));
}
