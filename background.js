// Service worker: opens side panel on action click, routes messages between
// sidepanel and the Claude API, and executes generated scripts in the active tab.

// Chrome: open the side panel on toolbar click. Firefox opens the sidebar
// automatically via sidebar_action and doesn't have chrome.sidePanel.
if (chrome.sidePanel) {
  chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ tabId: tab.id });
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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

  if (!response.ok) return { error: `API error ${response.status}: ${await response.text()}` };
  const data = await response.json();
  return { content: data.content[0].text };
}

async function handleExecuteScript(tabId, url, code) {
  // Route through the content script (already injected on all pages) to avoid
  // the host permission check that chrome.scripting.executeScript requires.
  const response = await chrome.tabs.sendMessage(tabId, { type: "RUN_SCRIPT", code });
  if (response?.error) return { error: response.error };

  // Persist script so content.js auto-runs it on future page loads
  const { persistedScripts = {} } = await chrome.storage.local.get("persistedScripts");
  persistedScripts[url] = [...(persistedScripts[url] ?? []), code];
  await chrome.storage.local.set({ persistedScripts });

  return { success: true };
}
