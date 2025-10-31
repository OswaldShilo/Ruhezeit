// background service worker for Ruhezeit
console.log('Ruhezeit background service worker loaded');

// Simple in-memory focus session state for the service worker lifecycle.
let focusSession = null;
let blockedSites = new Set();
const STORAGE_KEY = 'ruhezeit_focus_session';
const SUMMARIES_KEY = 'ruhezeit_session_summaries';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Ruhezeit installed');
});

// Handle keyboard commands (defined in manifest.commands)
chrome.commands.onCommand.addListener((command) => {
  console.log('Command:', command);
  if (command === 'tab_organize') {
    runTabOrganization();
    return;
  }

  if (command === 'start_focus') {
    if (!focusSession) startFocusSession(25); else stopFocusSession();
    return;
  }

  if (command === 'toggle_panel') {
    // Toggle the floating in-page panel in the active tab.
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const active = Array.isArray(tabs) ? tabs[0] : tabs;
        if (!active || !active.id) return;
        chrome.scripting.executeScript(
          { target: { tabId: active.id }, files: ['inject-floating-panel.js'] },
          (res) => {
            if (chrome.runtime.lastError) console.warn('toggle_panel scripting.executeScript failed', chrome.runtime.lastError);
          }
        );
      } catch (e) {
        console.warn('toggle_panel command handler error', e);
      }
    })();
    return;
  }
});

// Query tabs, categorize and create groups (basic heuristic + AI hints via message)
async function runTabOrganization() {
  try {
    const tabs = await chrome.tabs.query({});
    // Simple heuristic grouping by domain
    const groups = {};
    for (const t of tabs) {
      try {
        const url = new URL(t.url || '');
        const domain = url.hostname.replace('www.', '');
        (groups[domain] ||= []).push(t.id);
      } catch (e) {
        (groups['OTHER'] ||= []).push(t.id);
      }
    }

    // Determine how many groups to create based on tabs count
    const tabsCount = tabs.length;
    let maxGroups = 3;
    if (tabsCount > 10 && tabsCount <= 20) maxGroups = 5;
    else if (tabsCount > 20) maxGroups = 7;

    // Sort domains by number of tabs and pick top N
    const domainEntries = Object.entries(groups)
      .map(([k, v]) => [k, v])
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, maxGroups);

    // Define a palette of distinct group colors (supported Chrome color names)
    const palette = ['blue', 'green', 'yellow', 'red', 'purple', 'cyan', 'orange'];

    for (let i = 0; i < domainEntries.length; i++) {
      const [domain, tabIds] = domainEntries[i];
      // Titles should be capitalized / uppercased as requested
      const title = String(domain).toUpperCase();
      const color = palette[i % palette.length] || pickColorForDomain(domain);
      try {
        const groupId = await chrome.tabs.group({ tabIds });
        await chrome.tabGroups.update(groupId, { title, color, collapsed: false });
      } catch (e) {
        console.warn('Failed to create/update tab group for', domain, e);
      }
    }

    // Notify side panel
    chrome.runtime.sendMessage({ type: 'organization:done', count: tabs.length });
  } catch (err) {
    console.error('runTabOrganization error', err);
  }
}

function pickColorForDomain(domain) {
  // map simple categories to colors (work: blue, research: green, misc: grey)
  if (/github|gitlab|git/.test(domain)) return 'blue';
  if (/arxiv|pdf|research|doi|ieee/.test(domain)) return 'green';
  if (/news|reddit|twitter|facebook|instagram/.test(domain)) return 'yellow';
  return 'grey';
}

// Focus session control: add webRequest blocking for distracting sites
// Focus session control: use declarativeNetRequest dynamic rules for blocking (MV3)
function buildDnrRules(blockList, baseId) {
  // Build simple block rules for main_frame requests containing the domain
  return blockList.map((domain, i) => ({
    id: baseId + i,
    priority: 1,
    action: { type: 'block' },
    condition: { urlFilter: domain, resourceTypes: ['main_frame'] }
  }));
}

function startFocusSession(minutes = 25, blockList = ['twitter.com', 'facebook.com', 'reddit.com']) {
  if (focusSession) return;
  // choose a deterministic base id for rules (timestamp-based)
  const baseId = Math.floor(Date.now() / 1000) % 100000 + 1000;
  const ruleIds = blockList.map((_, i) => baseId + i);
  focusSession = { start: Date.now(), minutes, blocked: blockList.length, tabsUsed: 0, ruleIds };
  // persist to storage so UI can resume
  try { chrome.storage.local.set({ [STORAGE_KEY]: focusSession }); } catch (e) {}

  // create DNR rules
  try {
    const rules = buildDnrRules(blockList, baseId);
    chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules, removeRuleIds: [] }, () => {
      if (chrome.runtime.lastError) console.warn('updateDynamicRules add error', chrome.runtime.lastError);
    });
  } catch (e) {
    console.warn('declarativeNetRequest update failed', e);
  }

  // Broadcast session started
  chrome.runtime.sendMessage({ type: 'focus:started', session: focusSession });
  console.log('Focus started', focusSession);
}

function stopFocusSession() {
  if (!focusSession) return;
  focusSession.end = Date.now();
  // persist final session
  try { chrome.storage.local.set({ [STORAGE_KEY]: focusSession }); } catch (e) {}

  // remove dynamic rules if present
  try {
    const removeIds = Array.isArray(focusSession.ruleIds) ? focusSession.ruleIds : [];
    if (removeIds.length) {
      chrome.declarativeNetRequest.updateDynamicRules({ addRules: [], removeRuleIds: removeIds }, () => {
        if (chrome.runtime.lastError) console.warn('updateDynamicRules remove error', chrome.runtime.lastError);
      });
    }
  } catch (e) {
    console.warn('declarativeNetRequest remove failed', e);
  }

  // Broadcast summary request to side panel; let it call AI summarizers
  chrome.runtime.sendMessage({ type: 'focus:ended', session: focusSession });

  // Optionally generate and store a lightweight summary now (fallback if sidepanel not open)
  (async () => {
    try {
      const summary = await generateSessionSummary(focusSession);
      // save to storage list
      const stored = await chrome.storage.local.get(SUMMARIES_KEY) || {};
      const list = Array.isArray(stored[SUMMARIES_KEY]) ? stored[SUMMARIES_KEY] : [];
      list.unshift({ session: focusSession, summary, created: Date.now() });
      await chrome.storage.local.set({ [SUMMARIES_KEY]: list });
    } catch (e) {
      console.warn('Failed to auto-generate session summary', e);
    }
  })();

  focusSession = null;
  blockedSites.clear();
}

// Listen to messages from sidepanel or other parts
// Keep the message port open for async responses by returning true and using an async IIFE
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.type === 'focus:start') {
        startFocusSession(msg.minutes || 25, msg.blockList || ['twitter.com', 'facebook.com', 'reddit.com']);
        sendResponse({ ok: true });
        return;
      } else if (msg && msg.type === 'focus:stop') {
        stopFocusSession();
        sendResponse({ ok: true });
        return;
      } else if (msg && msg.type === 'organization:run') {
        runTabOrganization();
        sendResponse({ ok: true });
        return;
      }

      if (msg && msg.type === 'focus:get') {
        if (focusSession) { sendResponse({ session: focusSession }); return; }
        const stored = await chrome.storage.local.get(STORAGE_KEY);
        sendResponse({ session: stored && stored[STORAGE_KEY] ? stored[STORAGE_KEY] : null });
        return;
      }

      if (msg && msg.type === 'ai:summarizeSession') {
        const session = msg.session;
        const summary = await generateSessionSummary(session);
        const stored = await chrome.storage.local.get(SUMMARIES_KEY) || {};
        const existing = Array.isArray(stored[SUMMARIES_KEY]) ? stored[SUMMARIES_KEY] : [];
        existing.unshift({ session, summary, created: Date.now() });
        await chrome.storage.local.set({ [SUMMARIES_KEY]: existing });
        sendResponse({ summary });
        return;
      }

      if (msg && msg.type === 'ai:getSummaries') {
        const data = await chrome.storage.local.get(SUMMARIES_KEY) || {};
        sendResponse({ summaries: Array.isArray(data[SUMMARIES_KEY]) ? data[SUMMARIES_KEY] : [] });
        return;
      }

      if (msg && msg.type === 'fetch-sidepanel') {
        try {
          const url = chrome.runtime.getURL('sidepanel.html');
          const resp = await fetch(url);
          const text = resp.ok ? await resp.text() : null;
          sendResponse({ html: text });
        } catch (e) {
          console.error('fetch-sidepanel failed', e);
          sendResponse({ html: null, error: String(e) });
        }
        return;
      }
      
      if (msg && msg.type === 'ai:deleteSummary') {
        const created = msg.created;
        try {
          const data = await chrome.storage.local.get(SUMMARIES_KEY) || {};
          const list = Array.isArray(data[SUMMARIES_KEY]) ? data[SUMMARIES_KEY] : [];
          const filtered = list.filter(it => it.created !== created);
          await chrome.storage.local.set({ [SUMMARIES_KEY]: filtered });
          sendResponse({ ok: true });
          return;
        } catch (e) {
          console.error('deleteSummary failed', e);
          sendResponse({ error: String(e) });
          return;
        }
      }
    } catch (e) {
      console.error('background onMessage handler error', e);
      try { sendResponse({ error: String(e) }); } catch (ex) { console.error('failed to sendResponse', ex); }
    }
  })();
  return true;
});

// When the user clicks the extension action, inject the draggable overlay into the active tab
// No action.onClicked injection behavior — popup UI is provided via action.default_popup (sidepanel.html)

// Helper: try built-in summarizer, fallback to simple extraction
async function generateSessionSummary(session) {
  try {
    const tabs = await chrome.tabs.query({});
    const topTitles = tabs.slice(0, 8).map(t => t.title || t.url).join('\n');
    if (chrome?.summarizer?.summarize) {
      const resp = await chrome.summarizer.summarize({ text: topTitles });
      return resp?.summary || resp;
    }
    return `Session covered: ${tabs.slice(0,5).map(t => t.title || t.url).join('; ')}`;
  } catch (e) {
    console.warn('generateSessionSummary failed', e);
    return 'No summary available.';
  }
}
