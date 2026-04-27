import { MSG, PAGES, STORAGE_KEYS } from './constants.js';
import {
  getSetupComplete,
  setupPin,
  verifyPin,
  changePin,
  isUnlocked,
  setUnlocked,
  getIdleMinutes,
  setIdleMinutes,
  getLockoutRemaining,
  getFailedAttempts,
} from './state.js';

const EXT_ORIGIN = chrome.runtime.getURL('');
const LOCK_URL = chrome.runtime.getURL(PAGES.LOCK);

function isChromeExtensionsUrl(url) {
  return url && (url === 'chrome://extensions' || url.startsWith('chrome://extensions/'));
}

async function lockAllTabs() {
  const tabs = await chrome.tabs.query({});
  // Clear legacy mapping; each lock page now carries its own return URL.
  await chrome.storage.session.remove('lockedTabUrls');

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith(EXT_ORIGIN)) continue;
    if (isChromeExtensionsUrl(tab.url)) {
      try { await chrome.tabs.remove(tab.id); } catch (_) {}
      continue;
    }
    try {
      const lockUrl = new URL(LOCK_URL);
      lockUrl.searchParams.set('returnUrl', tab.url);
      await chrome.tabs.update(tab.id, { url: lockUrl.toString() });
    } catch (_) {}
  }
}

async function unlockAndDismiss() {
  await setUnlocked(true);
  await chrome.storage.session.remove('lockedTabUrls');

  const allTabs = await chrome.tabs.query({});
  const lockTabs = allTabs.filter(t => t.url && t.url.startsWith(LOCK_URL));

  for (const tab of lockTabs) {
    let returnUrl = 'chrome://newtab/';
    try {
      const url = new URL(tab.url);
      const encoded = url.searchParams.get('returnUrl');
      if (encoded) returnUrl = encoded;
    } catch (_) {}
    try {
      await chrome.tabs.update(tab.id, { url: returnUrl });
    } catch (_) {}
  }
}

// 1. On install: open setup if not done
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.storage.session.remove(STORAGE_KEYS.UNLOCKED);
  if (details.reason === 'install') {
    const setup = await getSetupComplete();
    if (!setup) {
      chrome.tabs.create({ url: chrome.runtime.getURL(PAGES.SETUP) });
    }
  }
});

// 2. On SW startup
(async () => {
  const session = await chrome.storage.session.get(['swStarted']);
  const isFreshStart = !session.swStarted;
  await chrome.storage.session.set({ swStarted: true });
  if (isFreshStart) {
    await chrome.storage.session.remove(STORAGE_KEYS.UNLOCKED);
  }
  const setup = await getSetupComplete();
  const unlocked = await isUnlocked();
  if (setup && !unlocked) {
    await lockAllTabs();
  }
})();

// 3. On browser startup
chrome.runtime.onStartup.addListener(async () => {
  await setUnlocked(false);
  await lockAllTabs();
});

// 4. On tab created
chrome.tabs.onCreated.addListener(async (tab) => {
  if (await isUnlocked()) return;
  if (tab.pendingUrl && tab.pendingUrl.startsWith(EXT_ORIGIN)) return;
  if (tab.url && tab.url.startsWith(EXT_ORIGIN)) return;
  if (tab.pendingUrl && isChromeExtensionsUrl(tab.pendingUrl)) {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
    return;
  }
  if (tab.url && isChromeExtensionsUrl(tab.url)) {
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
    return;
  }
  try {
    await chrome.tabs.update(tab.id, { url: LOCK_URL });
  } catch (_) {}
});

// 5. On navigation (main frame only)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (await isUnlocked()) return;
  if (details.url && details.url.startsWith(EXT_ORIGIN)) return;
  if (details.url && isChromeExtensionsUrl(details.url)) {
    try { await chrome.tabs.remove(details.tabId); } catch (_) {}
    return;
  }
  try {
    await chrome.tabs.update(details.tabId, { url: LOCK_URL });
  } catch (_) {}
});

// 6. Toolbar click
chrome.action.onClicked.addListener(async () => {
  await setUnlocked(false);
  await lockAllTabs();
});

// 7. Message dispatch
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
  return true;
});

async function handleMessage(message) {
  const { type } = message;

  if (type === MSG.GET_STATE) {
    const setupComplete = await getSetupComplete();
    const unlocked = await isUnlocked();
    const lockoutSeconds = await getLockoutRemaining();
    const failedAttempts = await getFailedAttempts();
    return { setupComplete, unlocked, lockoutSeconds, failedAttempts };
  }

  if (type === MSG.UNLOCK_ATTEMPT) {
    const result = await verifyPin(message.pin);
    if (result.ok) {
      await unlockAndDismiss();
    }
    const failedAttempts = await getFailedAttempts();
    return { ok: result.ok, lockoutSeconds: result.lockoutSeconds, failedAttempts, error: result.ok ? undefined : (result.lockoutSeconds ? 'Too many attempts' : 'Incorrect PIN') };
  }

  if (type === MSG.SETUP_PIN) {
    await setupPin(message.pin);
    return { ok: true };
  }

  if (type === MSG.CHANGE_PIN) {
    const ok = await changePin(message.oldPin, message.newPin);
    return { ok };
  }

  if (type === MSG.SET_IDLE) {
    await setIdleMinutes(message.minutes);
    return { ok: true };
  }

  if (type === MSG.LOCK_NOW) {
    await setUnlocked(false);
    await lockAllTabs();
    return { ok: true };
  }

  return { ok: false, error: 'Unknown message type' };
}

// 8. Idle alarm
chrome.alarms.create('idleCheck', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'idleCheck') return;
  const idleMinutes = await getIdleMinutes();
  const state = await chrome.idle.queryState(idleMinutes * 60);
  if (state === 'idle' || state === 'locked') {
    if (await isUnlocked()) {
      await setUnlocked(false);
      await lockAllTabs();
    }
  }
});
