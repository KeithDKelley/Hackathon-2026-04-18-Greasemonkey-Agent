// Background page: routes messages between sidepanel and the Claude API,
// and executes generated scripts in the active tab.

const log = (...args) => console.log("[GMA background]", ...args);
const err = (...args) => console.error("[GMA background]", ...args);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  log("received message", message.type, message);

  if (message.type === "GET_PAGE_CONTEXT") {
    handleGetPageContext(message.tabId).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (message.type === "CALL_CLAUDE") {
    handleCallClaude(message).then(sendResponse);
    return true;
  }

  if (message.type === "EXECUTE_SCRIPT") {
    handleExecuteScript(message.tabId, message.url, message.code).then(sendResponse);
    return true;
  }
});

async function handleGetPageContext(_tabId) {
  // TODO: extract URL, title, and truncated body text from the tab
  return { url: "", title: "", bodyText: "" };
}

async function handleCallClaude({ apiKey, messages, pageContext }) {
  const system = `You are a browser script generator. The user describes a change they want on the current page and you output ONLY valid JavaScript — no markdown, no explanation, no code fences. The code runs directly in the page context.

Current page: ${pageContext.title} — ${pageContext.url}
Page text (truncated): ${pageContext.bodyText}`;

  log("calling Claude API, message count:", messages.length);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1024, system, messages }),
  });

  log("Claude API response status:", response.status);

  if (!response.ok) {
    const body = await response.text();
    err("Claude API error:", response.status, body);
    return { error: `API error ${response.status}: ${body}` };
  }

  const data = await response.json();
  const content = data.content[0].text;
  log("Claude response length:", content.length, "chars");
  return { content };
}

async function handleExecuteScript(tabId, url, code) {
  log("executing script on tab", tabId, url, "code length:", code.length);

  // Prefer routing through the content script. If it isn't loaded (tab opened
  // before the extension was installed/reloaded), fall back to tabs.executeScript.
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "RUN_SCRIPT", code });
    log("RUN_SCRIPT response:", response);
    if (response?.error) {
      err("script execution error from content script:", response.error);
      return { error: response.error };
    }
  } catch (e) {
    log("content script not available, falling back to tabs.executeScript:", e.message);
    try {
      // Inject via <script> tag so code runs in page context, not isolated world
      const inject = `(function(){var s=document.createElement('script');s.textContent=${JSON.stringify(code)};document.documentElement.appendChild(s);s.remove();})()`;
      await chrome.tabs.executeScript(tabId, { code: inject });
      log("tabs.executeScript fallback succeeded");
    } catch (e2) {
      err("tabs.executeScript fallback also failed:", e2.message);
      return { error: e2.message };
    }
  }

  // Persist script so content.js auto-runs it on future page loads
  const { persistedScripts = {} } = await chrome.storage.local.get("persistedScripts");
  persistedScripts[url] = [...(persistedScripts[url] ?? []), code];
  await chrome.storage.local.set({ persistedScripts });
  log("persisted script for", url, "— total scripts for this URL:", persistedScripts[url].length);

  return { success: true };
}
