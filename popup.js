'use strict';

const stateElement = document.getElementById('state');
const toggleButton = document.getElementById('toggle-button');
const errorElement = document.getElementById('error-message');
const extension = globalThis.testflowExtension;
let enabled = null;
let busy = false;

for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = extension.getMessage(element.dataset.i18n) || element.textContent;
}
document.documentElement.lang = extension.api?.i18n?.getUILanguage?.() || 'en';
document.title = extension.getMessage('appName') || document.title;

function renderState(state) {
  enabled = state;
  stateElement.textContent = extension.getMessage(state ? 'popupEnabled' : 'popupDisabled') || (state ? 'Enabled' : 'Disabled');
  stateElement.classList.toggle('enabled', state);
  toggleButton.textContent = extension.getMessage(state ? 'popupDisable' : 'popupEnable') || (state ? 'Disable' : 'Enable');
  toggleButton.setAttribute('aria-pressed', String(state));
}

async function requestState(nextState) {
  busy = true;
  toggleButton.disabled = true;
  errorElement.hidden = true;
  try {
    const state = typeof nextState === 'boolean' ? await extension.setEnabled(nextState) : await extension.getEnabled();
    renderState(state);
  } catch (error) {
    errorElement.textContent = `${extension.getMessage('popupError') || 'Could not save settings.'} ${error.message}`;
    errorElement.hidden = false;
    if (enabled === null) {
      stateElement.textContent = extension.getMessage('popupUnavailable') || 'Settings unavailable';
      toggleButton.textContent = extension.getMessage('popupRetry') || 'Retry';
    }
    console.error('[testflow meow meow] Settings error:', error);
  } finally {
    busy = false;
    toggleButton.disabled = false;
  }
}

toggleButton.addEventListener('click', () => {
  if (busy) return;
  requestState(enabled === null ? undefined : !enabled);
});

extension.api?.storage?.onChanged?.addListener?.((changes, areaName) => {
  if (!busy && areaName === 'local' && changes.enabled) requestState();
});

requestState();
