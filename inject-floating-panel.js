// inject-floating-panel.js
// Injects a draggable floating panel into the current page that loads the extension's `sidepanel.html`.
// This script is safe to run multiple times; it will toggle the panel if already present.

(function () {
  if (window.__ruhezeitFloatingInjected) return;
  window.__ruhezeitFloatingInjected = true;

  const ID = '__ruhezeit_floating_container';

  function createPanel() {
    if (document.getElementById(ID)) return;

    const container = document.createElement('div');
    container.id = ID;
    Object.assign(container.style, {
      position: 'fixed',
      right: '24px',
      top: '80px',
      width: '420px',
      height: '560px',
      zIndex: 2147483647,
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '12px',
      overflow: 'hidden',
      // subtle outer shadow so the dotted box feels elevated but not heavy
      boxShadow: '0 12px 30px rgba(0,0,0,0.10)'
    });

    // Shell that holds a dotted inner box and an iframe inside it
    // Make the floating panel visually just the dotted box (no large header).
    const inner = document.createElement('div');
    Object.assign(inner.style, {
      margin: '0',
      width: '400px',
      height: '300px',
      background: '#fff',
      borderRadius: '12px',
      border: '2px dashed rgba(0,0,0,0.12)',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      // create a subtle elevated edge between the box and the page
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      outline: '1px solid rgba(0,0,0,0.03)'
    });

    // Small drag handle inside the dotted box (top-left) and a close button (top-right)
    const handle = document.createElement('div');
    handle.id = '__ruhezeit_floating_handle';
    Object.assign(handle.style, {
      width: '36px',
      height: '28px',
      position: 'absolute',
      left: '8px',
      top: '8px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.04)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'grab',
      userSelect: 'none'
    });
    handle.title = 'Drag';

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      right: '8px',
      top: '6px',
      border: 'none',
      background: 'transparent',
      fontSize: '14px',
      cursor: 'pointer',
      padding: '6px'
    });
    closeBtn.title = 'Close panel';
    closeBtn.addEventListener('click', () => {
      container.remove();
    });

    // iframe to load the extension UI inside the dotted box
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: '0',
      background: 'transparent',
      flex: '1 1 auto'
    });

    // Try to load the extension page directly. If blocked, fetch and use srcdoc.
    try {
      iframe.src = chrome.runtime.getURL('sidepanel.html');
      // Some pages block embedding extension pages; if iframe fails to load, try fetch fallback.
      iframe.addEventListener('error', async () => {
        try {
          const url = chrome.runtime.getURL('sidepanel.html');
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch failed');
          const html = await res.text();
          iframe.removeAttribute('src');
          iframe.srcdoc = html;
        } catch (e) {
          showFailNotice(inner);
        }
      }, { once: true });
    } catch (e) {
      // If direct assignment throws, attempt fetch
      (async () => {
        try {
          const url = chrome.runtime.getURL('sidepanel.html');
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch failed');
          const html = await res.text();
          iframe.srcdoc = html;
        } catch (err) {
          showFailNotice(inner);
        }
      })();
    }

    inner.appendChild(iframe);
    container.appendChild(inner);
    document.body.appendChild(container);

    // Make draggable by the small handle; user can still interact with iframe content.
    makeDraggable(container, handle);
  }

  function showFailNotice(parent) {
    const notice = document.createElement('div');
    notice.textContent = 'Unable to embed extension UI on this page.';
    Object.assign(notice.style, {
      padding: '16px',
      color: '#333',
      textAlign: 'center'
    });
    // remove existing iframe if any
    const existing = parent.querySelector('iframe');
    if (existing) existing.remove();
    parent.appendChild(notice);
  }

  function makeDraggable(container, handle) {
    let dragging = false;
    let startX = 0, startY = 0, origX = 0, origY = 0;

    function onDown(e) {
      e.preventDefault();
      dragging = true;
      const rect = container.getBoundingClientRect();
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startY = (e.touches ? e.touches[0].clientY : e.clientY);
      origX = rect.left;
      origY = rect.top;
      handle.style.cursor = 'grabbing';
    }

    function onMove(e) {
      if (!dragging) return;
      const clientX = (e.touches ? e.touches[0].clientX : e.clientX);
      const clientY = (e.touches ? e.touches[0].clientY : e.clientY);
      const dx = clientX - startX;
      const dy = clientY - startY;
      container.style.left = Math.max(8, origX + dx) + 'px';
      container.style.top = Math.max(8, origY + dy) + 'px';
      container.style.right = 'auto';
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = 'grab';
    }

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  // Toggle panel if exists
  function togglePanel() {
    const existing = document.getElementById(ID);
    if (existing) {
      existing.remove();
    } else {
      createPanel();
    }
  }

  // Expose a simple window API so popup/background can toggle
  window.__ruhezeit = window.__ruhezeit || {};
  window.__ruhezeit.toggleFloatingPanel = togglePanel;

  // If this script was executed as a one-off (via executeScript), create panel immediately
  try { createPanel(); } catch (e) { console.error('Ruhezeit inject error', e); }
})();
