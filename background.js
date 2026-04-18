// Background page: routes messages between sidepanel and the Claude API,
// and executes generated scripts in the active tab via MV2 tabs.executeScript.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_CONTEXT") {
    handleGetPageContext(message.tabId).then(sendResponse);
    return true;
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
  // Wrap the user code to capture console.log output and return result/error.
  // Uses eval so the code runs in the page's own scope (same as Greasemonkey).
  const wrapped = `(function() {
    var _logs = [];
    var _origLog = console.log.bind(console);
    console.log = function() {
      var args = Array.prototype.slice.call(arguments);
      _logs.push(args.map(String).join(' '));
      _origLog.apply(console, args);
    };
    var _result, _error;
    try { _result = eval(${JSON.stringify(code)}); }
    catch(e) { _error = e.message; }
    finally { console.log = _origLog; }
    return ({ result: _result, error: _error, logs: _logs });
  })()`;

  return new Promise((resolve) => {
    chrome.tabs.executeScript(tabId, { code: wrapped }, (results) => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message });
        return;
      }

      const result = results && results[0];
      if (result && result.error) {
        resolve({ error: result.error });
        return;
      }

      // Persist script so content.js auto-runs it on future page loads
      chrome.storage.local.get("persistedScripts", (data) => {
        const persistedScripts = data.persistedScripts || {};
        persistedScripts[url] = (persistedScripts[url] || []).concat(code);
        chrome.storage.local.set({ persistedScripts }, () => resolve({ success: true }));
      });
    });
  });
}
