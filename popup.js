'use strict';

const stateElement = document.getElementById('state');
const toggleButton = document.getElementById('toggle-button');
const errorElement = document.getElementById('error-message');
let enabled = null;
let busy = false;

for (const element of document.querySelectorAll('[data-i18n]')) {
  element.textContent = chrome.i18n.getMessage(element.dataset.i18n);
}
document.documentElement.lang = chrome.i18n.getUILanguage();
document.title = chrome.i18n.getMessage('appName');

function renderState(state) {
  enabled = state;
  stateElement.textContent = chrome.i18n.getMessage(state ? 'popupEnabled' : 'popupDisabled');
  stateElement.classList.toggle('enabled', state);
  toggleButton.textContent = chrome.i18n.getMessage(state ? 'popupDisable' : 'popupEnable');
  toggleButton.setAttribute('aria-pressed', String(state));
}

async function requestState(message) {
  busy = true;
  toggleButton.disabled = true;
  errorElement.hidden = true;
  try {
    const response = await chrome.runtime.sendMessage(message);
    if (!response?.ok || typeof response.enabled !== 'boolean') {
      throw new Error(response?.error || 'No state returned');
    }
    renderState(response.enabled);
  } catch (error) {
    errorElement.textContent = chrome.i18n.getMessage('popupError');
    errorElement.hidden = false;
    if (enabled === null) {
      stateElement.textContent = chrome.i18n.getMessage('popupUnavailable');
      toggleButton.textContent = chrome.i18n.getMessage('popupRetry');
    }
    console.error('[Testflow Local] Settings error:', error);
  } finally {
    busy = false;
    toggleButton.disabled = false;
  }
}

toggleButton.addEventListener('click', () => {
  if (busy) return;
  requestState(enabled === null ? { type: 'GET_STATE' } : { type: 'SET_ENABLED', enabled: !enabled });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!busy && areaName === 'local' && changes.enabled) requestState({ type: 'GET_STATE' });
});

requestState({ type: 'GET_STATE' });
