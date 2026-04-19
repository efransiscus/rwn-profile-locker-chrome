# rwn Profile Lock

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Chrome Manifest V3 extension that PIN-locks the Chrome profile it is installed in.

**Open source:** [github.com/efransiscus/rwn-profile-locker-chrome](https://github.com/efransiscus/rwn-profile-locker-chrome)

## Feedback

Found a bug or have a suggestion? Send feedback via our Google Form:
**[Submit Feedback](https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform)**

To set up your own form, run `google-form-script.gs` in [Google Apps Script](https://script.google.com) and replace `YOUR_FORM_ID` in the extension code with your form's ID.

## What it does

- PIN-locks your Chrome profile with an 8-digit (or longer) numeric PIN.
- Shows a full-tab lock screen on every tab while locked.
- Auto-locks on browser restart.
- Auto-locks after user-configurable idle time (default 2 hours).
- Manual lock via toolbar click.
- Rate-limits wrong PIN attempts with exponential lockout.
- Hashes the PIN with PBKDF2-SHA256 (150k iterations) and a random 16-byte salt.

## What it does NOT do

This extension is a **simple guard**, not a hardened lock.

- It does **not** block agents with OS-level control from disabling the extension via `chrome://extensions`.
- It does **not** block agents with DevTools Protocol access from manipulating extension storage directly.
- It does **not** block agents reading `chrome.storage.local` with a debugger attached.
- It does **not** block agents running in a separate Chrome profile or a separate browser entirely.

## Recommended defense-in-depth

1. Run AI browser agents in Chrome's **Guest profile** or a dedicated secondary profile — never the locked profile.
2. Optional: run agents under a different OS user or in a VM.

## Installation

1. Open `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** → select the `chrome-profile-lock/` folder
4. The extension appears in the list. Note the ID shown under the name.
5. First-run setup page opens automatically. Set your 8-digit PIN.
6. Pin the extension to the toolbar (puzzle-piece icon → pin) for easy manual lock.

**Surviving Chrome updates:** loading unpacked persists across updates. If Chrome ever disables it (rare — usually after a crash recovery), re-enable from `chrome://extensions`.

**Backup your code folder.** If you delete the folder, the extension will error on next Chrome launch. Keep it somewhere stable.

## No PIN recovery

If you forget your PIN there is **no recovery**. Remove and re-add the extension to reset. All extension data will be wiped.

## Known limitations

1. Does not apply to Chrome's Guest profile — by design, that is the "no password" path.
2. Does not apply to Incognito unless user explicitly enables the extension there.
3. Brief window (~500ms) at Chrome launch before the service worker activates — tabs from restored session may flash visible content.
4. Can be disabled from `chrome://extensions` by any user or agent that navigates there. This is an accepted tradeoff for a personal-use, non-enterprise setup.
5. DevTools on the lock page can inspect extension storage. Storage holds only the PIN *hash* (not reversible), but an attacker with DevTools could set `unlocked = true` in session storage and bypass. This is the fundamental limit of extension-layer security.
6. Idle auto-lock is based on OS input signals. Agents that emulate real mouse/keyboard will keep the session "active" and will not trigger idle lock. Agents that drive Chrome via CDP will trigger it.
7. If you forget your PIN there is no recovery. Remove and re-add the extension to reset.
