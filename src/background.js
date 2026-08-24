importScripts("shared/defaults.js", "shared/storage.js", "shared/messages.js");

let writeQueue = Promise.resolve();

function enqueueWrite(operation) {
  writeQueue = writeQueue.catch(() => undefined).then(operation);
  return writeQueue;
}

const services = {
  getSettings: () => FCC.getSettings(),
  updateSettings: (changes) => enqueueWrite(() => FCC.updateSettings(changes)),
  resetSettings: () => enqueueWrite(() => FCC.resetSettings()),
  getStats: () => FCC.getStats(),
  resetStats: () => enqueueWrite(() => FCC.resetStats()),
  // Chrome storage has no transactions, so all writes share one queue.
  incrementStats: (counts) => enqueueWrite(() => FCC.incrementStats(counts)),
};

chrome.runtime.onInstalled.addListener(() => {
  enqueueWrite(() => FCC.ensureStorage()).catch((error) =>
    console.error("Storage setup failed", error),
  );
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const result = FCC.handleMessage(message, services);
  if (result === undefined) return false;

  result
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
