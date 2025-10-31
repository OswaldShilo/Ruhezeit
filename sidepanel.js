// Sidepanel UI logic with views and welcome render
const app = document.getElementById('app');

// Helper to use chrome.runtime.sendMessage with a Promise and proper lastError handling
function sendMessageAsync(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        const err = chrome.runtime.lastError;
        if (err) return reject(err);
        resolve(resp);
      });
    } catch (e) { reject(e); }
  });
}

function renderWelcome() {
  app.innerHTML = `
    <div class="view-container welcome-view">
      <header>
        <h1>Stuck in a Universe of Madness?</h1>
        <h2>Start Your Focus Session Now.</h2>
      </header>
      
      <p class="tagline">
        Ruhezeit uses AI to organize your chaos
        and protect your focus - in 10 seconds.
      </p>

      <div class="button-grid">
        <button class="btn btn-primary" data-action="triggerOrganizeTabs">
          <span class="emoji">✨</span>
          Organize My Tabs
        </button>
        <button class="btn" data-action="watchDemo">
          <span class="emoji">🎬</span>
          Watch Demo
        </button>
      </div>
    </div>
  `;
}

function initControls() {
  // Wire up any controls present in the DOM (organize, focus toggles)
  const organizeBtn = document.getElementById('organize');
  if (organizeBtn) {
    organizeBtn.addEventListener('click', async () => {
      await sendMessageAsync({ type: 'organization:run' });
      organizeBtn.textContent = 'Organizing...';
      setTimeout(() => (organizeBtn.textContent = 'Organize Tabs (Shortcut: Ctrl+Shift+Y)'), 1500);
    });
  }

  const toggleFocusBtn = document.getElementById('toggle-focus');
  if (toggleFocusBtn) {
    toggleFocusBtn.addEventListener('click', async () => {
      const resp = await sendMessageAsync({ type: 'focus:get' });
      if (!resp || !resp.session) {
        await sendMessageAsync({ type: 'focus:start', minutes: 90 });
        toggleFocusBtn.textContent = 'Stop Focus';
      } else {
        await sendMessageAsync({ type: 'focus:stop' });
        toggleFocusBtn.textContent = 'Start Focus (Shortcut: Ctrl+Shift+U)';
      }
    });
  }

  // Event delegation for data-action buttons (welcome view and others)
  app.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (action === 'triggerOrganizeTabs') {
      btn.disabled = true;
      await sendMessageAsync({ type: 'organization:run' });
      btn.disabled = false;
    } else if (action === 'watchDemo') {
      // open a demo video or show a quick modal; for now open a tab with a placeholder
      chrome.tabs.create({ url: 'https://www.youtube.com/results?search_query=ruhezeit+extension+demo' });
    }
  });
}

// Keep the focus-card population logic separate so it works regardless of view
async function handleFocusEnded(session) {
  // If the focus card exists in DOM, populate it; otherwise create a minimal card
  const focusCard = document.getElementById('focus-card');
  const aiSummaryText = document.getElementById('ai-summary-text');
  if (focusCard && aiSummaryText) {
    document.getElementById('stat-duration').textContent = Math.round(((session.end||Date.now()) - (session.start||Date.now()))/60000) + ' minutes';
    document.getElementById('stat-tabs').textContent = (session.tabsUsed || 0) + '/12';
    document.getElementById('stat-blocked').textContent = session.blocked || 0;
    try {
      const summaryResp = await window.RuhezeitAPI?.summarizeSession?.(session) || { summary: 'No AI available: summary unavailable.' };
      aiSummaryText.textContent = summaryResp.summary || summaryResp;
    } catch (e) {
      aiSummaryText.textContent = 'AI summary failed';
    }
    focusCard.hidden = false;
  } else {
    // If the structured focus summary view isn't present, render the session summary screen
    // so the user can review the session immediately.
    try {
      renderSessionSummary(session);
    } catch (e) {
      console.log('Focus ended (no focus-card present)', session, e);
    }
  }
}

// Provide a tiny global API for the sidepanel to call AI wrappers if available
window.RuhezeitAPI = {
  prompt: async (p) => {
    return await sendMessageAsync({ type: 'ai:prompt', prompt: p });
  },
  summarizeSession: async (session) => {
    return await sendMessageAsync({ type: 'ai:summarizeSession', session });
  }
};

// Listen for background messages
chrome.runtime.onMessage.addListener(async (msg) => {
  if (!msg) return;
  if (msg.type === 'focus:ended') {
    await handleFocusEnded(msg.session || {});
  } else if (msg.type === 'organization:done') {
    console.log('Organization completed for', msg.count, 'tabs');
  }
});

function navigateToPreparing() {
  app.innerHTML = `
    <div class="preparing-view" style="padding:24px; text-align:center;">
      <h3 style="margin-bottom:12px;">Preparing your focus session…</h3>
      <p style="color:rgba(0,0,0,0.6); margin-bottom:18px;">Ruhezeit is organizing tabs and setting up a distraction-free environment.</p>
      <div style="height:6px; background:rgba(0,0,0,0.06); border-radius:6px; overflow:hidden; max-width:320px; margin: 0 auto;">
        <div style="width:30%; height:6px; background:var(--accent); transition:width 1s ease;" id="prep-bar"></div>
      </div>
    </div>
  `;
  // animate progress a bit
  setTimeout(() => { const el = document.getElementById('prep-bar'); if (el) el.style.width = '80%'; }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
  // If the static sandbox HTML includes a start button, wire it up and do not overwrite the DOM
  const startBtn = document.getElementById('start-focus-btn');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      // Navigate to focus setup view (timer selection)
      renderFocusSetup();
    });
    // wire summaries and settings buttons if present
    const summariesBtn = document.getElementById('open-summaries-btn');
    const settingsBtn = document.getElementById('open-settings-btn');
    if (summariesBtn) summariesBtn.addEventListener('click', () => renderSummaries());
    if (settingsBtn) settingsBtn.addEventListener('click', () => renderSettings());
    // still init other controls if present
    initControls();
    return;
  }

  // Default to programmatic welcome view if HTML not provided
  renderWelcome();
  initControls();
});

// --- Render functions for the two new views ---
function renderFocusSetup() {
  app.innerHTML = `
    <div id="focus-setup-view" class="view-container focus-setup-view p-6 text-center flex flex-col items-center">
      <header class="mb-6 w-full">
        <blockquote class="border-l-4 border-gray-300 pl-4 italic">
          <p id="quote-text-setup" class="text-lg text-gray-700">"The key is not to prioritize what's on your schedule, but to schedule your priorities."</p>
          <cite id="quote-author-setup" class="block text-sm text-gray-500 mt-2">- Stephen Covey</cite>
        </blockquote>
      </header>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">Set Your Focus Timer</h2>
      <div class="grid grid-cols-3 gap-3 w-full max-w-sm mb-6" id="timer-buttons">
        <button data-minutes="25" class="timer-btn w-full bg-gray-100 text-gray-800 font-semibold py-3 rounded-lg border border-gray-300">25 min</button>
        <button data-minutes="50" class="timer-btn w-full bg-gray-100 text-gray-800 font-semibold py-3 rounded-lg border border-gray-300">50 min</button>
        <button data-minutes="1" class="timer-btn w-full bg-gray-100 text-gray-800 font-semibold py-3 rounded-lg border border-gray-300">1 min (Test)</button>
      </div>
      <div class="w-full max-w-xs flex flex-col gap-3">
        <button id="begin-focus-btn" class="btn btn-primary w-full bg-black text-white font-semibold py-3 px-6 text-lg rounded-lg">Begin Focus</button>
      </div>
    </div>
  `;

  // Wire up the newly injected elements
  const timerButtons = app.querySelectorAll('.timer-btn');
  const beginFocusBtn = document.getElementById('begin-focus-btn');
  const quoteTextSetup = document.getElementById('quote-text-setup');
  const quoteAuthorSetup = document.getElementById('quote-author-setup');

  // Quotes array (same as provided)
  const quotes = [
    { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
    { text: "Concentration is the root of all the higher abilities in man.", author: "Bruce Lee" },
    { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
    { text: "Simplicity is the ultiqmate sophistication.", author: "Leonardo da Vinci" },
    { text: "To be everywhere is to be nowhere.", author: "Seneca" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" }
  ];

  function updateQuote(textEl, authorEl) {
    const idx = Math.floor(Math.random() * quotes.length);
    textEl.textContent = `"${quotes[idx].text}"`;
    authorEl.textContent = `- ${quotes[idx].author}`;
  }

  let selectedDurationInSeconds = 25 * 60;

  // Timer button click: select duration and start session immediately
  timerButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      timerButtons.forEach(btn => { btn.classList.remove('bg-black','text-white'); btn.classList.add('bg-gray-100','text-gray-800'); });
      const btn = e.currentTarget;
      btn.classList.add('bg-black','text-white'); btn.classList.remove('bg-gray-100','text-gray-800');
      selectedDurationInSeconds = parseInt(btn.dataset.minutes) * 60;

      // Start organization and focus then transition to active view
      await sendMessageAsync({ type: 'organization:run' });
      await sendMessageAsync({ type: 'focus:start', minutes: Math.ceil(selectedDurationInSeconds/60) });
      renderFocusActive(selectedDurationInSeconds);
    });
  });

  // Begin focus button (uses default or last selected)
  beginFocusBtn.addEventListener('click', async () => {
    await sendMessageAsync({ type: 'organization:run' });
    await sendMessageAsync({ type: 'focus:start', minutes: Math.ceil(selectedDurationInSeconds/60) });
    renderFocusActive(selectedDurationInSeconds);
  });

  updateQuote(quoteTextSetup, quoteAuthorSetup);
}

function renderFocusActive(durationInSeconds) {
  app.innerHTML = `
    <div id="focus-active-view" class="view-container focus-active-view p-6 flex flex-col items-center">
      <header class="mb-6 w-full h-24">
        <blockquote class="border-l-4 border-gray-300 pl-4 italic">
          <p id="quote-text-active" class="text-lg text-gray-700">"Concentration is the root of all the higher abilities in man."</p>
          <cite id="quote-author-active" class="block text-sm text-gray-500 mt-2">- Bruce Lee</cite>
        </blockquote>
      </header>
      <div class="flex-grow"></div>
      <div class="text-center w-full">
        <h2 class="text-xl font-medium text-gray-600 mb-4">Time Remaining</h2>
        <div id="timer-display" class="font-mono text-6xl font-bold text-black mb-6">00:00</div>
        <button id="end-session-btn" class="btn w-full max-w-xs text-gray-600 font-medium py-3 px-6 rounded-lg hover:bg-gray-100 border border-gray-300">End Session</button>
      </div>
    </div>
  `;

  // Setup timer
  const timerDisplay = document.getElementById('timer-display');
  const endSessionBtn = document.getElementById('end-session-btn');
  const quoteTextActive = document.getElementById('quote-text-active');
  const quoteAuthorActive = document.getElementById('quote-author-active');

  const quotes = [
    { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
    { text: "Concentration is the root of all the higher abilities in man.", author: "Bruce Lee" },
    { text: "The successful warrior is the average man, with laser-like focus.", author: "Bruce Lee" },
    { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
    { text: "To be everywhere is to be nowhere.", author: "Seneca" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" }
  ];

  function updateQuoteActive() {
    const idx = Math.floor(Math.random() * quotes.length);
    quoteTextActive.textContent = `"${quotes[idx].text}"`;
    quoteAuthorActive.textContent = `- ${quotes[idx].author}`;
  }

  let remaining = durationInSeconds;
  function formatTime(seconds) {
    const mins = Math.floor(seconds/60); const secs = seconds % 60;
    return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  timerDisplay.textContent = formatTime(remaining);
  // Start timer
  const interval = setInterval(() => {
    remaining--;
    if (remaining >= 0) {
      timerDisplay.textContent = formatTime(remaining);
    } else {
      clearInterval(interval);
  // send focus end message to background (use safe async wrapper to avoid unchecked lastError)
  sendMessageAsync({ type: 'focus:stop' }).catch(() => {});
      // show session summary after background processes it
      // background will broadcast focus:ended which will trigger handleFocusEnded
    }
  }, 1000);

  updateQuoteActive();

  endSessionBtn.addEventListener('click', () => {
    clearInterval(interval);
    sendMessageAsync({ type: 'focus:stop' }).catch(() => {});
    renderFocusSetup();
  });
}

// Render session summary screen (calls AI summarizer + writer if available)
async function renderSessionSummary(session) {
  app.innerHTML = `
    <div class="view-container session-summary">
      <div class="focus-status">✅ Focus Session Complete!</div>
      <div class="stats">📊 Session Stats:<div>Duration: <span id="stat-duration-s">--</span></div><div>Tabs used: <span id="stat-tabs-s">--</span></div><div>Distractions blocked: <span id="stat-blocked-s">--</span></div></div>
      <blockquote id="session-ai-summary">Generating AI summary…</blockquote>
      <div class="actions">
        <button id="return-all-btn" class="btn">Return to All Tabs</button>
        <button id="start-another-btn" class="btn btn-primary">Start Another Session</button>
      </div>
    </div>
  `;

  document.getElementById('stat-duration-s').textContent = Math.round(((session.end||Date.now()) - (session.start||Date.now()))/60000) + ' minutes';
  document.getElementById('stat-tabs-s').textContent = (session.tabsUsed || 0) + '/12';
  document.getElementById('stat-blocked-s').textContent = session.blocked || 0;

  // Request AI summary via message bridge
  try {
    const resp = await window.RuhezeitAPI.summarizeSession(session);
    const text = resp && (resp.summary || resp) ? (resp.summary || resp) : 'No summary available.';
    document.getElementById('session-ai-summary').textContent = text;
  } catch (e) {
    document.getElementById('session-ai-summary').textContent = 'AI summary failed.';
  }

  document.getElementById('return-all-btn').addEventListener('click', async () => {
    // Uncollapse all tab groups and bring focus to first tab
    try {
      const groups = await chrome.tabGroups.query({});
      for (const g of groups) {
        await chrome.tabGroups.update(g.id, { collapsed: false });
      }
    } catch (e) { console.warn(e); }
  });

  document.getElementById('start-another-btn').addEventListener('click', () => {
    renderFocusSetup();
  });
}

// On load, attempt to resume any running session
async function tryResumeSession() {
  try {
    // If the static welcome DOM is present (start button), prefer showing the welcome view
    // rather than auto-resuming a past session summary. This avoids showing the summary as the first screen.
    if (document.getElementById('start-focus-btn')) {
      console.log('Static welcome detected — skipping resume of previous session');
      return;
    }
    const resp = await sendMessageAsync({ type: 'focus:get' });
    if (resp && resp.session) {
      const s = resp.session;
      if (s.end) {
        // session already ended — show summary
        renderSessionSummary(s);
      } else {
        // compute remaining
        const endAt = (s.start || Date.now()) + (s.minutes || s.duration || 25) * 60000;
        const remaining = Math.max(0, Math.round((endAt - Date.now())/1000));
        if (remaining > 0) {
          renderFocusActive(remaining);
        } else {
          // ended — ask background to stop and show summary
            sendMessageAsync({ type: 'focus:stop' });
        }
      }
    }
  } catch (e) {
    console.warn('tryResumeSession failed', e);
  }
}

// call resume on script load (after DOM ready)
document.addEventListener('DOMContentLoaded', tryResumeSession);

// --- Settings and Summaries UI ---
function formatDate(ts) {
  try { return new Date(ts).toLocaleString(); } catch (e) { return String(ts); }
}

async function renderSettings() {
  // load tokens if present
  const stored = await chrome.storage.local.get('ruhezeit_tokens');
  const tokens = (stored && stored.ruhezeit_tokens) || {};
  app.innerHTML = `
    <div class="view-container">
      <h2 style="font-size:18px; margin-bottom:8px;">Settings — AI Tokens</h2>
      <div style="width:100%; max-width:360px; text-align:left;">
        <label>Prompt API Token</label>
        <input id="token-prompt" type="text" value="${tokens.prompt||''}" style="width:100%; margin-bottom:8px; padding:8px;" />
        <label>Summarizer Token</label>
        <input id="token-summarizer" type="text" value="${tokens.summarizer||''}" style="width:100%; margin-bottom:8px; padding:8px;" />
        <label>Writer Token</label>
        <input id="token-writer" type="text" value="${tokens.writer||''}" style="width:100%; margin-bottom:8px; padding:8px;" />
        <label>Translator Token</label>
        <input id="token-translator" type="text" value="${tokens.translator||''}" style="width:100%; margin-bottom:8px; padding:8px;" />
        <label>Language Detector Token</label>
        <input id="token-detector" type="text" value="${tokens.detector||''}" style="width:100%; margin-bottom:12px; padding:8px;" />
        <div style="display:flex; gap:8px;">
          <button id="save-tokens" class="btn btn-primary">Save</button>
          <button id="clear-tokens" class="btn">Clear</button>
          <button id="back-from-settings" class="btn">Back</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-tokens').addEventListener('click', async () => {
    const newTokens = {
      prompt: document.getElementById('token-prompt').value.trim(),
      summarizer: document.getElementById('token-summarizer').value.trim(),
      writer: document.getElementById('token-writer').value.trim(),
      translator: document.getElementById('token-translator').value.trim(),
      detector: document.getElementById('token-detector').value.trim()
    };
    await chrome.storage.local.set({ ruhezeit_tokens: newTokens });
    // quick feedback
    document.getElementById('save-tokens').textContent = 'Saved';
    setTimeout(() => document.getElementById('save-tokens').textContent = 'Save', 1200);
  });

  document.getElementById('clear-tokens').addEventListener('click', async () => {
    await chrome.storage.local.remove('ruhezeit_tokens');
    renderSettings();
  });

  document.getElementById('back-from-settings').addEventListener('click', () => renderWelcome());
}

async function renderSummaries() {
  app.innerHTML = `
    <div class="view-container">
      <h2 style="font-size:18px; margin-bottom:8px;">Saved Summaries</h2>
      <div id="summaries-list" style="width:100%; max-width:420px; text-align:left;">
        <p>Loading…</p>
      </div>
      <div style="margin-top:12px;"><button id="back-from-summaries" class="btn">Back</button></div>
    </div>
  `;

  document.getElementById('back-from-summaries').addEventListener('click', () => renderWelcome());

  const resp = await sendMessageAsync({ type: 'ai:getSummaries' });
  const list = (resp && resp.summaries) || [];
  const container = document.getElementById('summaries-list');
  if (!list.length) {
    container.innerHTML = '<p>No saved summaries yet.</p>';
    return;
  }

  container.innerHTML = '';
  list.forEach(item => {
    const el = document.createElement('div');
    el.style.border = '1px solid #e6edf3';
    el.style.padding = '10px';
    el.style.borderRadius = '8px';
    el.style.marginBottom = '8px';
    const created = formatDate(item.created || Date.now());
    el.innerHTML = `<div style="font-size:12px;color:#6b7280;margin-bottom:6px;">${created}</div><div style="margin-bottom:8px;">${(item.summary||'').replace(/\n/g,'<br>')}</div>`;
    const actions = document.createElement('div');
    actions.style.display = 'flex'; actions.style.gap = '8px';
    const copyBtn = document.createElement('button'); copyBtn.className = 'btn'; copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => { navigator.clipboard.writeText(item.summary||''); copyBtn.textContent='Copied'; setTimeout(()=>copyBtn.textContent='Copy',900); });
    const delBtn = document.createElement('button'); delBtn.className = 'btn'; delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      await sendMessageAsync({ type: 'ai:deleteSummary', created: item.created });
      renderSummaries();
    });
    actions.appendChild(copyBtn); actions.appendChild(delBtn);
    el.appendChild(actions);
    container.appendChild(el);
  });
}
