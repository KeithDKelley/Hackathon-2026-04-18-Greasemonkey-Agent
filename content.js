// Runs on every page load. Fetches any scripts the user has persisted for this
// URL and executes them automatically.

const currentUrl = location.href;

chrome.storage.local.get("persistedScripts", ({ persistedScripts = {} }) => {
  const scripts = persistedScripts[currentUrl] ?? [];
  for (const code of scripts) {
    try {
      new Function(code)();
    } catch (err) {
      console.error("[Greasemonkey Agent] Failed to run persisted script:", err);
    }
  }
});
