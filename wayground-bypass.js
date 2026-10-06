// Wayground/Quizizz: retain the original event, visibility, fullscreen,
// and activity-report behavior. This file never initiates a network request.
(() => {
  'use strict';
  const marker = Symbol.for('testflow.local.wayground');
  if (window[marker]) return;

  try {
    const stopEvent = event => event.stopImmediatePropagation();
    window.addEventListener('blur', stopEvent, true);
    window.addEventListener('focus', stopEvent, true);
    document.addEventListener('visibilitychange', stopEvent, true);

    Object.defineProperties(document, {
      visibilityState: { value: 'visible', configurable: true },
      hidden: { value: false, configurable: true },
      fullscreenElement: { get: () => document.documentElement, configurable: true }
    });

    function blockEvent(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    for (const eventName of [
      'fullscreenchange', 'webkitfullscreenchange', 'resize',
      'contextmenu', 'copy', 'paste', 'cut'
    ]) {
      window.addEventListener(eventName, blockEvent, true);
    }

    const originalFetch = window.fetch;
    const blockedActivityTypes = new Set([
      'playerExited', 'playerResumed', 'tabSwitched', 'leftFullscreen',
      'copiedText', 'pastedText', 'rightClicked', 'windowResized', 'webExtensionUsed'
    ]);

    window.fetch = async function(input, options) {
      // Only inspect this one activity endpoint. All other page requests pass through.
      const address = typeof input === 'string' ? input :
        input instanceof URL ? input.href : input instanceof Request ? input.url : '';

      if (address.includes('createTestGameActivity')) {
        try {
          const body = options?.body ?? (input instanceof Request ? await input.clone().text() : null);
          if (typeof body === 'string' && blockedActivityTypes.has(JSON.parse(body)?.activityType)) {
            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        } catch {
          // Unknown body formats and invalid JSON keep their original behavior.
        }
      }

      return originalFetch.apply(this, arguments);
    };
    window[marker] = true;
  } catch (error) {
    console.error('[Testflow Local] Could not apply Wayground changes:', error);
  }
})();
