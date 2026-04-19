import { MSG } from '../src/constants.js';

document.getElementById('lockBtn').addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: MSG.LOCK_NOW });
  } catch (_) {}
  window.close();
});

document.getElementById('optionsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});
