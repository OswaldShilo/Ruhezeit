// focus-manager.js - simple focus session helper
let session = null;
let blockedList = ['twitter.com', 'facebook.com', 'reddit.com'];

export function startFocus(minutes = 25, blockList = blockedList) {
  session = { start: Date.now(), end: Date.now() + minutes * 60 * 1000, blocked: blockList.length, tabsUsed: 0 };
  // ask background to apply blocking
  try {
    chrome.runtime.sendMessage({ type: 'focus:start', minutes, blockList }, () => {
      if (chrome.runtime.lastError) console.warn('focus-manager sendMessage focus:start failed', chrome.runtime.lastError);
    });
  } catch (e) { console.warn('focus-manager sendMessage error', e); }
  return session;
}

export function stopFocus() {
  try {
    chrome.runtime.sendMessage({ type: 'focus:stop' }, () => {
      if (chrome.runtime.lastError) console.warn('focus-manager sendMessage focus:stop failed', chrome.runtime.lastError);
    });
  } catch (e) { console.warn('focus-manager sendMessage error', e); }
  session = null;
}

export function getSession() { return session; }
