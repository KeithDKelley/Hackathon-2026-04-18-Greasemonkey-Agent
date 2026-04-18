// Runs on every page load. Fetches any scripts the user has persisted for this
// URL and executes them automatically. Also listens for RUN_SCRIPT messages
// from background.js — routing execution through the content script avoids
// the host permission check that chrome.scripting.executeScript requires.

const log = (...args) => console.log("[GMA content]", ...args);
const err = (...args) => console.error("[GMA content]", ...args);

log("content script loaded on", location.href);

function runCode(code) {
  new Function(code)();
}

chrome.storage.local.get("persistedScripts", ({ persistedScripts = {} }) => {
  const scripts = persistedScripts[location.href] ?? [];
  log(`found ${scripts.length} persisted script(s) for this URL`);
  for (const code of scripts) {
    try {
      log("running persisted script:", code.slice(0, 80));
      runCode(code);
    } catch (e) {
      err("failed to run persisted script:", e);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RUN_SCRIPT") {
    log("received RUN_SCRIPT, code length:", message.code.length);
    try {
      runCode(message.code);
      log("script executed successfully");
      sendResponse({ success: true });
    } catch (e) {
      err("script threw an error:", e);
      sendResponse({ error: e.message });
    }
  }
});
