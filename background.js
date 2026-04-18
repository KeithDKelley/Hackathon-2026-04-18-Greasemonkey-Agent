// Service worker: opens side panel on action click, routes messages between
// sidepanel and the Claude API, and executes generated scripts in the active tab.

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

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
    handleExecuteScript(message.tabId, message.code).then(sendResponse);
    return true;
  }
});

async function handleGetPageContext(tabId) {
  // TODO: extract URL, title, and truncated body text from the tab
  return { url: "", title: "", bodyText: "" };
}

async function handleCallClaude({ apiKey, messages }) {
  // TODO: POST to https://api.anthropic.com/v1/messages with the conversation
  // and return { content: "<generated JS>" } or { error: "..." }
  return { error: "Not implemented" };
}

async function handleExecuteScript(tabId, code) {
  // TODO: chrome.scripting.executeScript to inject code into the tab
  // return { success: true } or { error: "..." }
  return { error: "Not implemented" };
}
