document.getElementById('open-panel').addEventListener('click', async () => {
  // Inject a draggable overlay into the current active tab containing our sidepanel UI
  try {
    const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
    const active = Array.isArray(tabs) ? tabs[0] : tabs;
    if (!active || !active.id) {
      alert('Unable to find active tab to open UI.');
      return;
    }
    // Ask the content script in the active tab to toggle the overlay
    chrome.tabs.sendMessage(active.id, { type: 'ruhezeit:toggleOverlay' }, (resp) => {
      if (chrome.runtime.lastError) {
        console.warn('sendMessage to content script failed', chrome.runtime.lastError);
        alert('Could not open overlay on this page (content script unavailable).');
      }
    });
  } catch (e) {
    console.warn('Error while requesting overlay', e);
    alert('Failed to open sidepanel overlay. See console for details.');
  }
      });
  // Add button behaviour: inject or toggle a floating in-page panel that stays while interacting with the page.
  document.getElementById('open-panel').addEventListener('click', async (ev) => {
    try {
      // Find active tab
      const tabs = await new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
      const active = Array.isArray(tabs) ? tabs[0] : tabs;
      if (!active || !active.id) {
        alert('Unable to find active tab to open UI.');
        return;
      }

      // Inject the floating panel script into the active tab. This must be done as a user gesture
      // from the popup to avoid permission/user-gesture restrictions.
      await new Promise((resolve, reject) => {
        chrome.scripting.executeScript(
          { target: { tabId: active.id }, files: ['inject-floating-panel.js'] },
          (res) => {
            if (chrome.runtime.lastError) {
              console.warn('scripting.executeScript failed', chrome.runtime.lastError);
              alert('Could not inject floating panel into this page. Some pages block extensions.');
              return reject(chrome.runtime.lastError);
            }
            resolve(res);
          }
        );
      });

      // Close the popup to give keyboard focus back to the tab (optional). The in-page floating panel will remain.
      try { window.close(); } catch (e) { /* ignore */ }
    } catch (err) {
      console.warn('Error while injecting floating panel', err);
      alert('Failed to open floating panel. See console for details.');
    }
  });
