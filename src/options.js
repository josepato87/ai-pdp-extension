const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const useMockEl = document.getElementById("useMock");
const statusEl = document.getElementById("status");

async function load() {
  const { OPENAI_API_KEY, MODEL, USE_MOCK } = await chrome.storage.local.get(["OPENAI_API_KEY", "MODEL", "USE_MOCK"]);
  if (OPENAI_API_KEY) apiKeyEl.value = OPENAI_API_KEY;
  if (MODEL) modelEl.value = MODEL;
  useMockEl.checked = !!USE_MOCK;
}

async function save() {
  await chrome.storage.local.set({
    OPENAI_API_KEY: apiKeyEl.value.trim(),
    MODEL: modelEl.value.trim() || "gpt-4o-mini",
    USE_MOCK: !!useMockEl.checked
  });
  statusEl.textContent = "Saved.";
  setTimeout(() => statusEl.textContent = "", 1500);
}

document.getElementById("save").addEventListener("click", save);
load();