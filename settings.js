const keyInput = document.getElementById("api-key");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");

// Pre-fill with existing key (masked via input type=password)
chrome.storage.local.get("apiKey", (result) => {
  if (result.apiKey) keyInput.value = result.apiKey;
});

saveBtn.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) { statusEl.textContent = "Key cannot be empty."; statusEl.style.color = "#d93025"; return; }
  chrome.storage.local.set({ apiKey: key }, () => {
    statusEl.textContent = "Saved!";
    statusEl.style.color = "#34a853";
    setTimeout(() => { statusEl.textContent = ""; }, 2000);
  });
});
