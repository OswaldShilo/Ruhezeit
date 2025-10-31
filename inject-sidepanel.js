(function(){
  // Avoid injecting twice
  if (window.__ruhezeit_injected) return;
  window.__ruhezeit_injected = true;

  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('sidepanel.html');
  iframe.style.position = 'fixed';
  iframe.style.width = '420px';
  iframe.style.height = '680px';
  iframe.style.right = '24px';
  iframe.style.top = '80px';
  iframe.style.zIndex = 2147483647; // very high
  iframe.style.border = '2px dashed #000';
  iframe.style.borderRadius = '12px';
  iframe.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
  iframe.style.background = 'white';
  iframe.style.resize = 'both';
  iframe.style.overflow = 'hidden';
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');

  // Create corner handles (dotted black corners look)
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.right = '24px';
  container.style.top = '80px';
  container.style.width = iframe.style.width;
  container.style.height = iframe.style.height;
  container.style.zIndex = iframe.style.zIndex;
  container.style.cursor = 'move';

  // Add small corner decorations
  function makeCorner(x,y){
    const c = document.createElement('div');
    c.style.position='absolute';
    c.style.width='18px'; c.style.height='18px';
    c.style.borderTop='3px dotted #000'; c.style.borderLeft='3px dotted #000';
    if (x==='right') { c.style.right='-3px'; c.style.borderLeft='none'; c.style.borderRight='3px dotted #000'; }
    if (y==='bottom') { c.style.bottom='-3px'; c.style.borderTop='none'; c.style.borderBottom='3px dotted #000'; }
    if (x==='left') c.style.left='-3px'; if (y==='top') c.style.top='-3px';
    return c;
  }
  // top-left
  container.appendChild(makeCorner('left','top'));
  // top-right
  container.appendChild(makeCorner('right','top'));
  // bottom-left
  container.appendChild(makeCorner('left','bottom'));
  // bottom-right
  container.appendChild(makeCorner('right','bottom'));

  // append iframe inside container so it moves together
  iframe.style.position='absolute';
  iframe.style.right='0'; iframe.style.top='0';
  container.appendChild(iframe);

  // close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent='✕';
  closeBtn.title='Close Ruhezeit';
  closeBtn.style.position='absolute';
  closeBtn.style.left='8px';
  closeBtn.style.top='8px';
  closeBtn.style.zIndex = 2147483648;
  closeBtn.style.background='rgba(0,0,0,0.7)';
  closeBtn.style.color='white';
  closeBtn.style.border='none';
  closeBtn.style.borderRadius='6px';
  closeBtn.style.padding='4px 8px';
  closeBtn.style.cursor='pointer';
  container.appendChild(closeBtn);

  closeBtn.addEventListener('click', () => {
    try { container.remove(); window.__ruhezeit_injected = false; } catch(e){}
  });

  // Dragging
  let isDown = false; let startX=0; let startY=0; let origRight=24; let origTop=80;
  container.addEventListener('mousedown', (ev)=>{
    // ignore clicks that target iframe internals or buttons
    if (ev.target === iframe || iframe.contains(ev.target)) return;
    isDown = true;
    startX = ev.clientX; startY = ev.clientY;
    // compute current right/top in px
    const rect = container.getBoundingClientRect();
    origRight = window.innerWidth - rect.right;
    origTop = rect.top;
    ev.preventDefault();
  });
  window.addEventListener('mousemove', (ev)=>{
    if (!isDown) return;
    const dx = ev.clientX - startX; const dy = ev.clientY - startY;
    const newRight = Math.max(8, origRight - dx);
    const newTop = Math.max(8, origTop + dy);
    container.style.right = newRight + 'px';
    container.style.top = newTop + 'px';
  });
  window.addEventListener('mouseup', ()=>{ isDown=false; });

  // Append to body
  document.documentElement.appendChild(container);
})();
