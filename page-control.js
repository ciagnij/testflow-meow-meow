// This controller runs in the page's MAIN world. The isolated content script
// sends the local preference; no website receives access to extension storage.
(() => {
  'use strict';
  // If a mobile browser ignores world: MAIN, don't acknowledge from its isolated world.
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  const key = Symbol.for('testflow.meow.controller');
  if (window[key]) return;
  const installers = [];
  let enabled = false;

  window[key] = {
    register(install) {
      installers.push(install);
      if (enabled) install();
    }
  };

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || data?.channel !== 'testflow-meow-v1' ||
        data.type !== 'configure' || typeof data.enabled !== 'boolean' ||
        typeof data.token !== 'string') return;

    enabled = data.enabled;
    if (enabled) for (const install of installers) install();
    // Acknowledging only after an installer is present avoids a startup race.
    if (installers.length > 0) {
      window.postMessage({ channel: 'testflow-meow-v1', type: 'ready', token: data.token }, '*');
    }
  });
})();
