// Content script that listens for a message from the background to toggle the Ruhezeit overlay
(function(){
  if (window.__ruhezeit_content_listener_installed) return;
  window.__ruhezeit_content_listener_installed = true;

  let container = null;

  function createOverlay() {
    if (container) return;
    container = document.createElement('div');
    container.id = '__ruhezeit_overlay';
    container.style.position = 'fixed';
    container.style.right = '24px';
    container.style.top = '80px';
    container.style.width = '420px';
    container.style.height = '680px';
    container.style.zIndex = '2147483647';
    container.style.border = '2px dashed #000';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
    container.style.background = 'white';
    container.style.overflow = 'hidden';
    container.style.resize = 'both';

    // Add corners for dotted look
    function makeCorner(x,y){
      const c = document.createElement('div');
      c.style.position='absolute'; c.style.width='18px'; c.style.height='18px';
      c.style.borderTop='3px dotted #000'; c.style.borderLeft='3px dotted #000';
      if (x==='right') { c.style.right='-3px'; c.style.borderLeft='none'; c.style.borderRight='3px dotted #000'; }
      if (y==='bottom') { c.style.bottom='-3px'; c.style.borderTop='none'; c.style.borderBottom='3px dotted #000'; }
      if (x==='left') c.style.left='-3px'; if (y==='top') c.style.top='-3px';
      return c;
    }
    container.appendChild(makeCorner('left','top'));
    container.appendChild(makeCorner('right','top'));
    container.appendChild(makeCorner('left','bottom'));
    container.appendChild(makeCorner('right','bottom'));

  // iframe to load the extension sidepanel UI
  const iframe = document.createElement('iframe');
  const sidepanelUrl = chrome.runtime.getURL('sidepanel.html');
  iframe.src = sidepanelUrl;
    iframe.style.position='absolute'; iframe.style.right='0'; iframe.style.top='0';
    iframe.style.width='100%'; iframe.style.height='100%'; iframe.style.border='0'; iframe.style.borderRadius='10px';
    iframe.style.background='white';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
    container.appendChild(iframe);

    // Ask the background service worker to fetch the sidepanel HTML (avoids page-level fetch/CORS restrictions)
    (async () => {
      try {
        chrome.runtime.sendMessage({ type: 'fetch-sidepanel' }, (resp) => {
          if (chrome.runtime.lastError) {
            console.warn('fetch-sidepanel message failed', chrome.runtime.lastError);
            showOverlayNotice('This page prevents embedding the Ruhezeit UI. Try opening the extension on a different page.');
            return;
          }
          if (resp && resp.html) {
            iframe.srcdoc = '<base href="' + chrome.runtime.getURL('') + '">' + resp.html;
          } else {
            showOverlayNotice('Unable to load Ruhezeit UI content.');
          }
        });
      } catch (e) {
        console.warn('Could not request sidepanel HTML from background', e);
        showOverlayNotice('This page prevents embedding the Ruhezeit UI. Try opening the extension on a different page.');
      }
    })();

    // close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent='✕'; closeBtn.title='Close Ruhezeit';
    closeBtn.style.position='absolute'; closeBtn.style.left='8px'; closeBtn.style.top='8px';
    closeBtn.style.zIndex = '2147483648';
    closeBtn.style.background='rgba(0,0,0,0.7)'; closeBtn.style.color='white';
    closeBtn.style.border='none'; closeBtn.style.borderRadius='6px'; closeBtn.style.padding='4px 8px';
    closeBtn.style.cursor='pointer';
    container.appendChild(closeBtn);
    closeBtn.addEventListener('click', removeOverlay);

    // dragging (via container background) — kept for non-iframe drags
    let isDown = false; let startX=0; let startY=0; let origRight=24; let origTop=80;
    container.addEventListener('mousedown', (ev)=>{
      // don't start drag if clicking the iframe's content
      if (ev.target === iframe || iframe.contains(ev.target)) return;
      isDown = true; startX = ev.clientX; startY = ev.clientY;
      const rect = container.getBoundingClientRect(); origRight = window.innerWidth - rect.right; origTop = rect.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev)=>{
      if (!isDown) return; const dx = ev.clientX - startX; const dy = ev.clientY - startY;
      const newRight = Math.max(8, origRight - dx); const newTop = Math.max(8, origTop + dy);
      container.style.right = newRight + 'px'; container.style.top = newTop + 'px';
    });
    window.addEventListener('mouseup', ()=>{ isDown=false; });

    // Listen for postMessage drag events from the iframe (postMessage bridge)
    let iframeDragState = null;
    function onFrameMessage(ev) {
      try {
        const d = ev.data;
        if (!d || d.__ruhezeit !== true) return;
        // Only accept messages from the iframe we created
        if (ev.source !== iframe.contentWindow) return;
        if (d.type === 'drag-start') {
          iframeDragState = { lastX: d.x, lastY: d.y, rect: container.getBoundingClientRect() };
        } else if (d.type === 'drag-move' && iframeDragState) {
          // d.dx/dy represent delta in iframe coordinates — translate to container movement
          const dx = d.dx; const dy = d.dy;
          const rect = container.getBoundingClientRect();
          let origRightLocal = window.innerWidth - rect.right;
          let origTopLocal = rect.top;
          const newRight = Math.max(8, origRightLocal - dx);
          const newTop = Math.max(8, origTopLocal + dy);
          container.style.right = newRight + 'px'; container.style.top = newTop + 'px';
        } else if (d.type === 'drag-end') {
          iframeDragState = null;
        }
      } catch (e) { console.warn('onFrameMessage error', e); }
    }
    window.addEventListener('message', onFrameMessage);

    document.documentElement.appendChild(container);
  }

  function removeOverlay() {
    try { if (container) { container.remove(); container = null; } } catch(e) { console.warn(e); }
  }

  function showOverlayNotice(msg) {
    try {
      if (!container) return;
      let n = container.querySelector('.ruhezeit-notice');
      if (!n) {
        n = document.createElement('div');
        n.className = 'ruhezeit-notice';
        n.style.position = 'absolute'; n.style.left='12px'; n.style.top='12px'; n.style.right='12px';
        n.style.padding='10px'; n.style.background='rgba(255,255,255,0.95)'; n.style.border='1px solid #e2e8f0';
        n.style.borderRadius='8px'; n.style.zIndex='2147483650'; n.style.color='#111';
        container.appendChild(n);
      }
      n.textContent = msg;
    } catch (e) { console.warn(e); }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'ruhezeit:toggleOverlay') {
      console.log('Ruhezeit content-listener: toggleOverlay received');
      if (container) removeOverlay(); else createOverlay();
      sendResponse({ ok: true });
    }
  });
})();
