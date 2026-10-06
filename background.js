// All state lives in this browser. No accounts, remote checks, or device IDs.
const CONTENT_SCRIPTS = [
  {
    id: 'testflow-local-testportal',
    matches: ['*://*.testportal.pl/*', '*://*.testportal.net/*'],
    js: ['bypass.js'],
    runAt: 'document_start',
    world: 'MAIN',
    persistAcrossSessions: true,
    allFrames: false
  },
  {
    id: 'testflow-local-wayground',
    matches: ['*://*.wayground.com/*', '*://*.quizizz.com/*'],
    js: ['wayground-bypass.js'],
    runAt: 'document_start',
    world: 'MAIN',
    persistAcrossSessions: true,
    allFrames: false
  }
];

// Serialize installation, startup, storage changes, and popup commands.
// A rejected operation must not prevent the next command from running.
let pendingOperation = Promise.resolve();

function enqueue(operation) {
  const result = pendingOperation.then(operation);
  pendingOperation = result.catch(() => {});
  return result;
}

async function updateContentScripts(enabled) {
  const ids = CONTENT_SCRIPTS.map(script => script.id);
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids });

  if (!enabled) {
    if (registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: registered.map(script => script.id) });
    }
    return;
  }

  const existingIds = new Set(registered.map(script => script.id));
  const missing = CONTENT_SCRIPTS.filter(script => !existingIds.has(script.id));
  const existing = CONTENT_SCRIPTS.filter(script => existingIds.has(script.id));
  if (existing.length > 0) await chrome.scripting.updateContentScripts(existing);
  if (missing.length > 0) await chrome.scripting.registerContentScripts(missing);
}

async function initialize() {
  const settings = await chrome.storage.local.get('enabled');
  const enabled = typeof settings.enabled === 'boolean' ? settings.enabled : true;
  await updateContentScripts(enabled);
  if (settings.enabled !== enabled) await chrome.storage.local.set({ enabled });
  // Remove obsolete values when reloading this edition over an earlier one.
  await chrome.storage.local.remove(['activation', 'deviceId']);
  return { enabled };
}

async function setEnabled(enabled) {
  if (typeof enabled !== 'boolean') throw new TypeError('enabled must be a boolean');
  const previous = await chrome.storage.local.get('enabled');
  await updateContentScripts(enabled);
  try {
    await chrome.storage.local.set({ enabled });
  } catch (error) {
    await updateContentScripts(previous.enabled !== false);
    throw error;
  }
  return { enabled };
}

function synchronize() {
  enqueue(initialize).catch(error => {
    console.error('[Testflow Local] Could not configure content scripts:', error);
  });
}

chrome.runtime.onInstalled.addListener(synchronize);
chrome.runtime.onStartup.addListener(synchronize);
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.enabled) synchronize();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only extension pages may change settings; the website scripts have no API access.
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  if (!message || !['GET_STATE', 'SET_ENABLED'].includes(message.type)) return false;

  enqueue(() => message.type === 'GET_STATE' ? initialize() : setEnabled(message.enabled))
    .then(state => sendResponse({ ok: true, ...state }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

// Also repair registration after an unpacked-extension reload or worker restart.
synchronize();
