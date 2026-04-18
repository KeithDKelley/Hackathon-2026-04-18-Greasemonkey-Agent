// Runs on every page load. Fetches any scripts the user has persisted for this
// URL and executes them automatically. Also listens for RUN_SCRIPT messages
// from background.js — routing execution through the content script avoids
// the host permission check that chrome.scripting.executeScript requires.

function runCode(code) {
  new Function(code)();
}

chrome.storage.local.get("persistedScripts", ({ persistedScripts = {} }) => {
  const scripts = persistedScripts[location.href] ?? [];
  for (const code of scripts) {
    try {
      runCode(code);
    } catch (err) {
      console.error("[Greasemonkey Agent] Failed to run persisted script:", err);
    }
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "RUN_SCRIPT") {
    try {
      runCode(message.code);
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  }
});
