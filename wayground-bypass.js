// Wayground/Quizizz page hooks. No extension server or remote code is used.
(() => {
  'use strict';
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  const controller = window[Symbol.for('testflow.meow.controller')];
  if (!controller) throw new Error('Testflow page controller is missing');
  const marker = Symbol.for('testflow.local.wayground');
  if (window[marker]) return;
  window[marker] = true;
  controller.suppressEvents([
    'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange',
    'MSFullscreenChange', 'resize', 'contextmenu', 'copy', 'paste', 'cut'
  ]);

  const blockedTypes = new Set([
    'playerExited', 'playerResumed', 'tabSwitched', 'leftFullscreen',
    'copiedText', 'pastedText', 'rightClicked', 'windowResized', 'webExtensionUsed',
    'pasteDetected', 'windowResizeDetected', 'rightClickDetected',
    'fullscreenExitDetected', 'extensionDetected'
  ]);
  const localResult = JSON.stringify({ success: true });

  function shouldHandle(address, method, body) {
    if (!controller.enabled || String(method).toUpperCase() !== 'POST' || typeof body !== 'string') return false;
    try {
      const url = new URL(address, window.location.href);
      const allowedHost = ['wayground.com', 'quizizz.com'].some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`));
      if (!allowedHost) return false;
      const legacy = /\/createTestGameActivity\/?$/.test(url.pathname);
      const current = /\/v1\/games\/[^/]+\/player-infraction\/?$/.test(url.pathname);
      if (!legacy && !current) return false;
      const payload = JSON.parse(body);
      // Explicitly quitting a game, submitting answers, and unknown activities
      // retain their normal behavior.
      return blockedTypes.has(current ? payload?.infractionType : payload?.activityType);
    } catch { return false; }
  }

  function protectRequests() {
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = async function(input, options) {
        const request = typeof Request !== 'undefined' && input instanceof Request;
        const address = typeof input === 'string' ? input :
          input instanceof URL ? input.href : request ? input.url : '';
        const method = options?.method || (request ? input.method : 'GET');
        let body = options?.body;
        // Avoid cloning/reading ordinary requests, particularly streaming bodies.
        if (String(method).toUpperCase() === 'POST' &&
            /\/(createTestGameActivity|player-infraction)\/?(?:[?#]|$)/.test(address)) {
          try { if (body === undefined && request) body = await input.clone().text(); }
          catch { /* Unreadable requests pass through. */ }
          if (shouldHandle(address, method, body)) {
            return new Response(localResult, { status: 200,
              headers: { 'Content-Type': 'application/json' } });
          }
        }
        return originalFetch.apply(this, arguments);
      };
    }

    // Current Wayground also uses an XHR-backed HTTP client. Intercept only
    // recognized monitoring POSTs and finish them locally so its queue settles.
    const prototype = window.XMLHttpRequest?.prototype;
    if (!prototype) return;
    const original = {};
    for (const name of ['open', 'send', 'abort', 'getResponseHeader', 'getAllResponseHeaders']) original[name] = prototype[name];
    const states = new WeakMap();
    const responseFields = ['readyState', 'status', 'statusText', 'responseURL', 'response', 'responseText'];
    function clearResponse(xhr, state) {
      if (state?.mocked) for (const name of responseFields) delete xhr[name];
    }
    prototype.open = function(method, address, asynchronous = true) {
      clearResponse(this, states.get(this));
      states.set(this, { method, address: String(address), asynchronous, mocked: false });
      return original.open.apply(this, arguments);
    };
    prototype.send = function(body) {
      const state = states.get(this);
      if (state?.cancelled) throw new DOMException('Request was aborted', 'InvalidStateError');
      if (!state || !shouldHandle(state.address, state.method, body) || this.readyState !== 1) {
        return original.send.apply(this, arguments);
      }
      if (state.pending) throw new DOMException('Request already sent', 'InvalidStateError');
      const xhr = this;
      state.mocked = true;
      state.pending = true;
      state.cancelled = false;
      const complete = () => {
        if (state.cancelled || states.get(xhr) !== state) return;
        state.pending = false;
        const response = xhr.responseType === 'json' ? JSON.parse(localResult) :
          xhr.responseType === 'arraybuffer' ? new TextEncoder().encode(localResult).buffer :
          xhr.responseType === 'blob' ? new Blob([localResult], { type: 'application/json' }) : localResult;
        const fields = { readyState: 4, status: 200, statusText: 'OK',
          responseURL: new URL(state.address, window.location.href).href, response };
        for (const [name, value] of Object.entries(fields)) Object.defineProperty(xhr, name, { value, configurable: true });
        Object.defineProperty(xhr, 'responseText', { configurable: true, get() {
          if (xhr.responseType && xhr.responseType !== 'text') throw new DOMException('Response is not text', 'InvalidStateError');
          return localResult;
        } });
        for (const type of ['readystatechange', 'load', 'loadend']) xhr.dispatchEvent(new Event(type));
      };
      if (state.asynchronous === false) complete(); else Promise.resolve().then(complete);
    };
    prototype.abort = function() {
      const state = states.get(this);
      if (!state?.mocked) return original.abort.apply(this, arguments);
      state.cancelled = true;
      clearResponse(this, state);
      original.abort.apply(this, arguments);
      // The native object was opened but never sent, so native abort alone
      // leaves it OPENED. Expose the normal aborted request state instead.
      for (const [name, value] of Object.entries({ readyState: 0, status: 0,
        statusText: '', responseURL: '', response: null, responseText: '' })) {
        Object.defineProperty(this, name, { value, configurable: true });
      }
      if (state.pending) {
        state.pending = false;
        this.dispatchEvent(new Event('abort'));
        this.dispatchEvent(new Event('loadend'));
      }
    };
    prototype.getResponseHeader = function(name) {
      if (!states.get(this)?.mocked || this.readyState !== 4) return original.getResponseHeader.apply(this, arguments);
      return String(name).toLowerCase() === 'content-type' ? 'application/json' : null;
    };
    prototype.getAllResponseHeaders = function() {
      return states.get(this)?.mocked && this.readyState === 4 ? 'content-type: application/json\r\n' :
        original.getAllResponseHeaders.apply(this, arguments);
    };
  }

  let installed = false;
  controller.register(() => {
    if (installed) return;
    controller.protectFocus();
    for (const name of ['fullscreenElement', 'webkitFullscreenElement', 'webkitCurrentFullScreenElement', 'mozFullScreenElement', 'msFullscreenElement']) {
      if (name !== 'fullscreenElement' && !(name in document)) continue;
      Object.defineProperty(document, name, { get: () => document.documentElement, configurable: true });
    }
    protectRequests();
    installed = true;
  });
})();
