// MAIN-world controller. Preferences arrive from the isolated extension script.
(() => {
  'use strict';
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  const key = Symbol.for('testflow.meow.controller');
  if (window[key]) return;
  const installers = [];
  let enabled = false;
  let focusProtected = false;

  // Register before page listeners even though reading storage is asynchronous.
  // Only page focus events are suppressed; input focus events remain untouched.
  function suppressEvents(names, pageFocusOnly = false) {
    for (const name of names) {
      window.addEventListener(name, event => {
        if (!enabled) return;
        if (pageFocusOnly && event.target !== window && event.target !== document) return;
        event.stopImmediatePropagation();
        // Preserve default clipboard and context-menu actions.
      }, true);
    }
  }
  suppressEvents(['blur', 'focus', 'focusin', 'focusout'], true);
  suppressEvents(['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'pageshow']);

  function protectFocus() {
    if (focusProtected) return;
    for (const [name, value] of [
      ['hidden', false], ['visibilityState', 'visible'],
      ['webkitHidden', false], ['webkitVisibilityState', 'visible']
    ]) {
      if (name.startsWith('webkit') && !(name in document)) continue;
      Object.defineProperty(document, name, { get: () => value, configurable: true });
    }
    const originalHasFocus = document.hasFocus;
    if (typeof originalHasFocus !== 'function') throw new Error('document.hasFocus is unavailable');
    // Testportal checks that hasFocus is native. A callable Proxy retains native
    // Function.prototype.toString behavior without replacing that global method.
    Object.defineProperty(document, 'hasFocus', {
      value: new Proxy(originalHasFocus, { apply: () => true }),
      configurable: true, writable: true
    });
    focusProtected = true;
  }

  window[key] = {
    get enabled() { return enabled; },
    protectFocus,
    suppressEvents,
    register(install) {
      installers.push(install);
      if (enabled) install();
    }
  };

  window.addEventListener('message', event => {
    const data = event.data;
    if (event.source !== window || data?.channel !== 'testflow-meow-v1' ||
        data.type !== 'configure' || typeof data.enabled !== 'boolean' ||
        typeof data.token !== 'string' || installers.length === 0) return;
    try {
      // Preferences require a reload, so a second message never removes only
      // some of the installed patches.
      if (!data.enabled) return;
      enabled = true;
      for (const install of installers) install();
      window.postMessage({ channel: 'testflow-meow-v1', type: 'ready', token: data.token }, '*');
    } catch (error) {
      enabled = false;
      window.postMessage({ channel: 'testflow-meow-v1', type: 'failed', token: data.token,
        error: String(error.message || error) }, '*');
      console.error('[testflow meow meow] Page setup failed:', error);
    }
  });
})();
