import { MSG, IDLE_CHOICES } from '../src/constants.js';

const changeForm = document.getElementById('changeForm');
const currentPinInput = document.getElementById('currentPin');
const newPinInput = document.getElementById('newPin');
const confirmNewPinInput = document.getElementById('confirmNewPin');
const changeBtn = document.getElementById('changeBtn');
const changeError = document.getElementById('changeError');
const changeSuccess = document.getElementById('changeSuccess');

const idleSelect = document.getElementById('idleSelect');
const idleSuccess = document.getElementById('idleSuccess');

const lockNowBtn = document.getElementById('lockNowBtn');

function formatLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return '1 hr';
  return `${minutes / 60} hr`;
}

async function populateIdle() {
  const resp = await chrome.runtime.sendMessage({ type: MSG.GET_STATE });
  // We only need idleMinutes, but GET_STATE doesn't return it. Let's fetch directly from storage or add a message.
  // We'll query storage directly for simplicity.
  const stored = await chrome.storage.local.get('idleMinutes');
  const current = stored.idleMinutes || 120;

  for (const m of IDLE_CHOICES) {
    const opt = document.createElement('option');
    opt.value = String(m);
    opt.textContent = formatLabel(m);
    if (m === current) opt.selected = true;
    idleSelect.appendChild(opt);
  }
}

changeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  changeError.textContent = '';
  changeSuccess.textContent = '';

  const oldPin = currentPinInput.value.trim();
  const newPin = newPinInput.value.trim();
  const confirm = confirmNewPinInput.value.trim();

  if (newPin !== confirm) {
    changeError.textContent = 'New PINs do not match';
    return;
  }

  changeBtn.disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({ type: MSG.CHANGE_PIN, oldPin, newPin });
    if (resp && resp.ok) {
      changeSuccess.textContent = 'PIN changed successfully';
      currentPinInput.value = '';
      newPinInput.value = '';
      confirmNewPinInput.value = '';
    } else {
      changeError.textContent = (resp && resp.error) || 'Failed to change PIN';
    }
  } catch (err) {
    changeError.textContent = err.message || 'Failed to change PIN';
  } finally {
    changeBtn.disabled = false;
  }
});

idleSelect.addEventListener('change', async () => {
  idleSuccess.textContent = '';
  const minutes = Number(idleSelect.value);
  try {
    const resp = await chrome.runtime.sendMessage({ type: MSG.SET_IDLE, minutes });
    if (resp && resp.ok) {
      idleSuccess.textContent = 'Setting saved';
    } else {
      idleSuccess.textContent = (resp && resp.error) || 'Failed to save';
      idleSuccess.className = 'error';
    }
  } catch (err) {
    idleSuccess.textContent = err.message || 'Failed to save';
    idleSuccess.className = 'error';
  }
  setTimeout(() => { idleSuccess.textContent = ''; idleSuccess.className = 'success'; }, 2000);
});

lockNowBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: MSG.LOCK_NOW });
  } catch (_) {}
});

document.getElementById('feedbackBtn').addEventListener('click', () => {
  // Replace YOUR_FORM_ID with your actual Google Form ID after running google-form-script.gs
  window.open('https://forms.gle/ZCQj1iiAPu75LUvr7', '_blank');
});

populateIdle();
