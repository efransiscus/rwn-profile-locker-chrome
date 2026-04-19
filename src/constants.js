export const STORAGE_KEYS = {
  PIN_HASH: 'pinHash',
  PIN_SALT: 'pinSalt',
  SETUP_COMPLETE: 'setupComplete',
  IDLE_MINUTES: 'idleMinutes',
  FAILED_ATTEMPTS: 'failedAttempts',
  LOCKOUT_UNTIL: 'lockoutUntil',
  UNLOCKED: 'unlocked',           // in session storage
};

export const MSG = {
  UNLOCK_ATTEMPT: 'UNLOCK_ATTEMPT',
  LOCK_NOW: 'LOCK_NOW',
  GET_STATE: 'GET_STATE',
  SETUP_PIN: 'SETUP_PIN',
  CHANGE_PIN: 'CHANGE_PIN',
  SET_IDLE: 'SET_IDLE',
};

export const DEFAULTS = {
  IDLE_MINUTES: 120,
  MIN_PIN_LENGTH: 8,
  PBKDF2_ITERATIONS: 150_000,
  SALT_BYTES: 16,
};

export const PAGES = {
  LOCK: 'pages/lock.html',
  SETUP: 'pages/setup.html',
  OPTIONS: 'pages/options.html',
};

// Exponential lockout: attempts → seconds
export const LOCKOUT_SCHEDULE = [
  { after: 5,  seconds: 30 },
  { after: 10, seconds: 300 },
  { after: 15, seconds: 1800 },
  { after: 20, seconds: 86400 },
];

// Minutes. Shown in options dropdown in this order.
export const IDLE_CHOICES = [1, 5, 15, 30, 60, 120, 240, 480];
