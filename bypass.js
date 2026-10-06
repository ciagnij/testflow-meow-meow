// Testportal: retain the original extension's clock-freezing behavior.
// The page controller applies it after receiving the local enable preference.
(() => {
  'use strict';
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  function install() {
    const marker = Symbol.for('testflow.local.testportal');
    if (window[marker]) return;

    try {
      const OriginalDate = window.Date;
      const originalDateNow = OriginalDate.now.bind(OriginalDate);
      // Native performance.now requires its performance receiver.
      const originalPerformanceNow = performance.now.bind(performance);
      let isFocused = document.hidden !== true;
      let lastDateTime = originalDateNow();
      let lastPerformanceTime = originalPerformanceNow();

      function controlledDateNow() {
        if (isFocused) lastDateTime = originalDateNow();
        return lastDateTime;
      }

      function controlledPerformanceNow() {
        if (isFocused) lastPerformanceTime = originalPerformanceNow();
        return lastPerformanceTime;
      }

      // A Proxy preserves Date.prototype, Date.parse, Date.UTC, instanceof,
      // explicit constructor arguments, and Date()'s string return type.
      window.Date = new Proxy(OriginalDate, {
        get(target, property, receiver) {
          if (property === 'now') return controlledDateNow;
          return Reflect.get(target, property, receiver);
        },
        apply() {
          return new OriginalDate(controlledDateNow()).toString();
        },
        construct(target, args, newTarget) {
          return Reflect.construct(target, args.length ? args : [controlledDateNow()], newTarget);
        }
      });

      Object.defineProperty(performance, 'now', {
        value: controlledPerformanceNow,
        configurable: true,
        writable: true
      });

      function pauseClock() {
        if (!isFocused) return;
        // Capture the time at the transition, even if the page hasn't read it recently.
        lastDateTime = originalDateNow();
        lastPerformanceTime = originalPerformanceNow();
        isFocused = false;
      }
      function resumeClock() { isFocused = document.hidden !== true; }
      window.addEventListener('blur', pauseClock, true);
      window.addEventListener('focus', resumeClock, true);
      // Mobile app/tab switches may change visibility without emitting blur.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseClock(); else resumeClock();
      }, true);
      window.addEventListener('pagehide', pauseClock, true);
      window.addEventListener('pageshow', resumeClock, true);
      window[marker] = true;
    } catch (error) {
      console.error('[Testflow Local] Could not apply Testportal changes:', error);
    }
  }
  const controller = window[Symbol.for('testflow.meow.controller')];
  if (controller) controller.register(install); else install();
})();
