import { MSG, LOCKOUT_SCHEDULE } from '../src/constants.js';

const form = document.getElementById('unlockForm');
const pinInput = document.getElementById('pin');
const errorEl = document.getElementById('error');
const countdownEl = document.getElementById('countdown');
const unlockBtn = document.getElementById('unlockBtn');
const card = document.getElementById('card');

let countdownInterval = null;

function showError(msg) {
  errorEl.textContent = msg;
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  countdownEl.textContent = '';
}

function startCountdown(seconds) {
  clearCountdown();
  let remaining = seconds;
  pinInput.disabled = true;
  unlockBtn.disabled = true;

  function tick() {
    if (remaining <= 0) {
      clearCountdown();
      pinInput.disabled = false;
      unlockBtn.disabled = false;
      pinInput.focus();
      return;
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    countdownEl.textContent = `Locked out. Try again in ${m > 0 ? m + 'm ' : ''}${s}s`;
    remaining--;
  }

  tick();
  countdownInterval = setInterval(tick, 1000);
}

function attemptsNote(failed) {
  for (const entry of LOCKOUT_SCHEDULE) {
    const remaining = entry.after - failed;
    if (remaining > 0 && remaining <= 3) {
      return `${remaining} attempt${remaining === 1 ? '' : 's'} remaining before ${entry.seconds >= 60 ? Math.ceil(entry.seconds / 60) + ' min' : entry.seconds + 's'} lockout`;
    }
  }
  return '';
}

async function init() {
  errorEl.textContent = '';
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
  } catch (e) {
    resp = null;
  }

  if (!resp) {
    showError('Unable to reach extension');
    return;
  }

  if (resp.unlocked) {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');
    chrome.tabs.update({ url: returnUrl || 'chrome://newtab/' });
    return;
  }

  if (!resp.setupComplete) {
    window.location.replace(chrome.runtime.getURL('pages/setup.html'));
    return;
  }

  if (resp.lockoutSeconds > 0) {
    startCountdown(resp.lockoutSeconds);
  } else {
    pinInput.disabled = false;
    unlockBtn.disabled = false;
    pinInput.focus();
  }

  if (resp.lockoutSeconds <= 0 && resp.failedAttempts > 0) {
    const note = attemptsNote(resp.failedAttempts);
    if (note) {
      countdownEl.textContent = note;
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const pin = pinInput.value.trim();
  if (!pin) return;

  unlockBtn.disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({ type: MSG.UNLOCK_ATTEMPT, pin });
    if (resp && resp.ok) {
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      chrome.tabs.update({ url: returnUrl || 'chrome://newtab/' });
    } else {
      pinInput.value = '';
      const note = resp && resp.lockoutSeconds > 0
        ? `Locked out. Try again in ${resp.lockoutSeconds}s`
        : attemptsNote(resp && resp.failedAttempts ? resp.failedAttempts : 0);
      showError((resp && resp.error) || 'Incorrect PIN');
      if (note) countdownEl.textContent = note;

      if (resp && resp.lockoutSeconds > 0) {
        startCountdown(resp.lockoutSeconds);
      } else {
        unlockBtn.disabled = false;
        pinInput.focus();
      }
    }
  } catch (err) {
    showError(err.message || 'Unlock failed');
    unlockBtn.disabled = false;
  }
});

init();
