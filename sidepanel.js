// Manages the chat UI and coordinates with background.js for Claude calls
// and script injection.

/** @type {{ role: "user" | "assistant", content: string }[]} */
const conversationHistory = [];

const messagesEl = document.getElementById("messages");
const form = document.getElementById("input-form");
const inputEl = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const noKeyBanner = document.getElementById("no-key-banner");

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get("apiKey", (result) => resolve(result.apiKey || null));
  });
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? null;
}

function appendMessage(role, content, code = null) {
  const wrapper = document.createElement("div");
  wrapper.className = `msg ${role}`;

  if (content) {
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = content;
    wrapper.appendChild(bubble);
  }

  if (code) {
    const codeBlock = document.createElement("pre");
    codeBlock.className = "code-block";
    codeBlock.textContent = code;
    wrapper.appendChild(codeBlock);

    const runBtn = document.createElement("button");
    runBtn.className = "run-btn";
    runBtn.textContent = "Run script";
    runBtn.addEventListener("click", () => runScript(code, runBtn));
    wrapper.appendChild(runBtn);
  }

  messagesEl.appendChild(wrapper);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function runScript(code, btn) {
  const tabId = await getActiveTabId();
  if (!tabId) { alert("No active tab found."); return; }

  btn.disabled = true;
  btn.textContent = "Running…";

  const response = await chrome.runtime.sendMessage({
    type: "EXECUTE_SCRIPT",
    tabId,
    code,
  });

  if (response?.error) {
    btn.textContent = "Error — retry?";
    btn.disabled = false;
    appendMessage("assistant", `Error running script: ${response.error}`);
  } else {
    btn.textContent = "Done ✓";
  }
}

async function sendMessage(userText) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    noKeyBanner.classList.remove("hidden");
    return;
  }

  conversationHistory.push({ role: "user", content: userText });
  appendMessage("user", userText);

  sendBtn.disabled = true;
  inputEl.disabled = true;

  const tabId = await getActiveTabId();
  const pageContext = await chrome.runtime.sendMessage({ type: "GET_PAGE_CONTEXT", tabId });

  const response = await chrome.runtime.sendMessage({
    type: "CALL_CLAUDE",
    apiKey,
    pageContext,
    messages: conversationHistory,
  });

  sendBtn.disabled = false;
  inputEl.disabled = false;
  inputEl.focus();

  if (response?.error) {
    appendMessage("assistant", `Error: ${response.error}`);
    return;
  }

  const generatedCode = response.content;
  conversationHistory.push({ role: "assistant", content: generatedCode });
  appendMessage("assistant", null, generatedCode);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = "";
  sendMessage(text);
});

// Shift+Enter = newline, Enter alone = submit
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

// On load, check for API key
getApiKey().then((key) => {
  if (!key) noKeyBanner.classList.remove("hidden");
});
