// Testportal polls document.hasFocus(), including while another mobile app is
// open. Keep the page focused without modifying Date or its exam countdown.
(() => {
  'use strict';
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  const controller = window[Symbol.for('testflow.meow.controller')];
  if (!controller) throw new Error('Testflow page controller is missing');
  controller.register(() => controller.protectFocus());
})();
