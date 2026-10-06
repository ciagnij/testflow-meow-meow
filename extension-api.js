// Some mobile browsers expose callback-style chrome APIs; others expose
// Promise-style browser APIs. Settings never depend on a background worker.
(() => {
  'use strict';
  const promiseApi = globalThis.browser?.storage?.local ? globalThis.browser : null;
  const api = promiseApi || globalThis.chrome;

  function storageCall(method, value) {
    return new Promise((resolve, reject) => {
      const area = api?.storage?.local;
      if (typeof area?.[method] !== 'function') {
        reject(new Error('This browser does not expose extension storage.'));
        return;
      }

      let settled = false;
      const timer = setTimeout(() => finish(new Error('Extension storage did not respond.')), 5000);
      function finish(error, result) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error); else resolve(result);
      }

      try {
        const result = promiseApi ? area[method](value) : area[method](value, result => {
          const error = api.runtime?.lastError;
          finish(error ? new Error(error.message) : null, result);
        });
        // Also handle browsers that return a Promise from the chrome namespace.
        if (result?.then) result.then(value => finish(null, value), error => finish(error));
      } catch (error) {
        finish(error);
      }
    });
  }

  globalThis.testflowExtension = {
    api,
    async getEnabled() {
      const settings = await storageCall('get', 'enabled');
      if (!settings || typeof settings !== 'object') throw new Error('Invalid storage response.');
      // An unset preference means enabled, without requiring an installation event.
      return settings.enabled !== false;
    },
    async setEnabled(enabled) {
      if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean');
      await storageCall('set', { enabled });
      return enabled;
    },
    getMessage(key) {
      return api?.i18n?.getMessage?.(key) || '';
    }
  };
})();
