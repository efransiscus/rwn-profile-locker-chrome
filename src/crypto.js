import { DEFAULTS } from './constants.js';

const textEncoder = new TextEncoder();

function bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export function generateSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(DEFAULTS.SALT_BYTES));
  return bufToB64(salt);
}

export async function deriveHash(pin, saltB64) {
  const salt = b64ToBuf(saltB64);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', textEncoder.encode(pin), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: DEFAULTS.PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bufToB64(bits);
}

export function constantTimeEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
