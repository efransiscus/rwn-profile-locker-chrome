import { MSG } from '../src/constants.js';

const form = document.getElementById('setupForm');
const pinInput = document.getElementById('pin');
const confirmInput = document.getElementById('confirmPin');
const errorEl = document.getElementById('error');
const submitBtn = document.getElementById('submitBtn');

function showError(msg) {
  errorEl.textContent = msg;
  form.classList.remove('shake');
  void form.offsetWidth; // reflow
  form.classList.add('shake');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';

  const pin = pinInput.value.trim();
  const confirm = confirmInput.value.trim();

  if (pin !== confirm) {
    showError('PINs do not match');
    return;
  }

  submitBtn.disabled = true;
  try {
    const resp = await chrome.runtime.sendMessage({ type: MSG.SETUP_PIN, pin });
    if (resp && resp.ok) {
      chrome.tabs.update({ url: 'chrome://newtab/' });
    } else {
      showError((resp && resp.error) || 'Setup failed');
    }
  } catch (err) {
    showError(err.message || 'Setup failed');
  } finally {
    submitBtn.disabled = false;
  }
});
