// Runs on supported pages in the isolated extension world, without a worker.
(() => {
  'use strict';
  const extension = globalThis.testflowExtension;
  const hostname = window.location.hostname;
  const inDomain = domain => hostname === domain || hostname.endsWith(`.${domain}`);
  const pageScript = ['testportal.pl', 'testportal.net'].some(inDomain) ? 'bypass.js' :
    ['wayground.com', 'quizizz.com'].some(inDomain) ? 'wayground-bypass.js' : null;
  if (!pageScript) return;

  const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  let acknowledged = false;
  let timer;

  function onMessage(event) {
    if (event.source !== window || event.data?.channel !== 'testflow-meow-v1' ||
        event.data.type !== 'ready' || event.data.token !== token) return;
    acknowledged = true;
    clearTimeout(timer);
    window.removeEventListener('message', onMessage);
  }

  function configure(enabled) {
    window.postMessage({ channel: 'testflow-meow-v1', type: 'configure', token, enabled }, '*');
  }

  async function appendScript(file) {
    // document_start can precede creation of the document element in mobile engines.
    if (!document.documentElement) {
      await new Promise(resolve => {
        const observer = new MutationObserver(() => {
          if (!document.documentElement) return;
          observer.disconnect();
          resolve();
        });
        observer.observe(document, { childList: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = extension.api.runtime.getURL(file);
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { script.remove(); reject(new Error(`Could not load ${file}. Check site permissions and CSP.`)); };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  async function start() {
    const enabled = await extension.getEnabled();
    if (!enabled) return; // MAIN scripts stay dormant on disabled page loads.
    window.addEventListener('message', onMessage);
    configure(true);
    // Modern browsers use static MAIN scripts. Older mobile implementations
    // can instead load the same bundled files with ordinary script elements.
    timer = setTimeout(async () => {
      if (acknowledged) return;
      try {
        await appendScript('page-control.js');
        await appendScript(pageScript);
        configure(true);
      } catch (error) {
        window.removeEventListener('message', onMessage);
        console.error('[testflow meow meow] Page injection failed:', error);
      }
    }, 100);
  }

  start().catch(error => console.error('[testflow meow meow] Could not read local settings:', error));
})();
