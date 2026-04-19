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

async function lockAllTabs() {
  const tabs = await chrome.tabs.query({});
  const existing = await chrome.storage.session.get('lockedTabUrls');
  if (!existing.lockedTabUrls) {
    const urls = tabs
      .filter(t => t.url && !t.url.startsWith(EXT_ORIGIN) && t.url !== LOCK_URL)
      .map(t => ({ id: t.id, url: t.url }));
    await chrome.storage.session.set({ lockedTabUrls: urls });
  }

  for (const tab of tabs) {
    if (!tab.url || !tab.url.startsWith(EXT_ORIGIN)) {
      try {
        await chrome.tabs.update(tab.id, { url: LOCK_URL });
      } catch (_) {
        // Tab may have closed or be unpdateable (e.g. chrome:// settings)
      }
    }
  }
}

async function unlockAndDismiss() {
  await setUnlocked(true);
  const stored = await chrome.storage.session.get('lockedTabUrls');
  const urls = stored.lockedTabUrls || [];
  const lockTabs = await chrome.tabs.query({ url: LOCK_URL });

  for (const tab of lockTabs) {
    const original = urls.find(u => u.id === tab.id);
    try {
      await chrome.tabs.update(tab.id, { url: original ? original.url : 'chrome://newtab/' });
    } catch (_) {}
  }
  await chrome.storage.session.remove('lockedTabUrls');
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
  try {
    await chrome.tabs.update(tab.id, { url: LOCK_URL });
  } catch (_) {}
});

// 5. On navigation (main frame only)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (await isUnlocked()) return;
  if (details.url && details.url.startsWith(EXT_ORIGIN)) return;
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
