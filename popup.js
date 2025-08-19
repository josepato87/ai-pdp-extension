const statusEl = document.getElementById("status");
const runBtn = document.getElementById("run");
const previewBtn = document.getElementById("preview");
const badgeEl = document.getElementById("badge");

function setStatus(t) { statusEl.textContent = t; }

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('Active tab:', tab?.id, tab?.url);
  return tab?.id;
}

async function sendToContent(tabId, type, payload) {
  try {
    console.log("Sending to content script (simple):", { tabId, type, payload });
    const response = await chrome.tabs.sendMessage(tabId, { type, payload });
    console.log("Content script response (simple):", response);
    if (response === undefined) {
      throw new Error("Content script not found. Please refresh the page and try again.");
    }
    return response;
  } catch (e) {
    console.error("Error sending to content script:", e);
    throw new Error("Content script not found. Please refresh the page and try again.");
  }
}

async function refreshBadge() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
    if (!resp?.ok) throw new Error(resp?.error || "status error");
    const { useMock, model, hasKey } = resp.data;

    if (useMock) {
      badgeEl.textContent = "MOCK";
      badgeEl.className = "badge mock";
      badgeEl.title = "Mock Mode: no API calls";
    } else if (!hasKey) {
      badgeEl.textContent = "NEEDS KEY";
      badgeEl.className = "badge warn";
      badgeEl.title = "Set your API key in Settings or /env/local.js";
    } else {
      badgeEl.textContent = `LIVE`;
      badgeEl.className = "badge live";
      badgeEl.title = `Live mode • Model: ${model}`;
    }
  } catch {
    badgeEl.textContent = "…";
    badgeEl.className = "badge";
    badgeEl.title = "Status unavailable";
  }
}

async function sendLLMGenerate(payload) {
  // Keep-alive hack for MV3 service worker
  const port = chrome.runtime.connect({ name: "keepAlive" });
  try {
    console.time("LLM_GENERATE popup (preview)");
    const start = Date.now();
    const response = await chrome.runtime.sendMessage({ type: "LLM_GENERATE", payload });
    const elapsed = Date.now() - start;
    console.timeEnd("LLM_GENERATE popup (preview)");
    console.log(`[AI PDP Extension][popup] LLM_GENERATE response (preview):`, response, `Elapsed: ${elapsed}ms`);
    return response;
  } finally {
    port.disconnect();
  }
}

runBtn.addEventListener("click", async () => {
  setStatus("Scraping page...");
  const tabId = await getActiveTabId();
  if (!tabId) return setStatus("No active tab");

  try {
    const scraped = await sendToContent(tabId, "scrapePDP");
    if (!scraped?.ok) throw new Error(scraped?.error || "Scrape failed");

    setStatus("Calling LLM...");
    const genResp = await sendLLMGenerate(scraped);
    console.log('[AI PDP Extension][popup] LLM_GENERATE response:', genResp);
    if (!genResp?.ok) throw new Error(genResp?.error || "LLM failed: ");

    setStatus("Replacing content...");
    const applyResp = await sendToContent(tabId, "replacePDP", genResp.data);
    if (!applyResp?.ok) throw new Error(applyResp?.error || "Replace failed");

    setStatus("Done ✅");
  } catch (e) {
    setStatus("Error: " + (e.message || String(e)));
  } finally {
    refreshBadge();
  }
});

previewBtn.addEventListener("click", async () => {
  setStatus("Scraping page...");
  const tabId = await getActiveTabId();
  if (!tabId) return setStatus("No active tab");
  try {
    const scraped = await sendToContent(tabId, "scrapePDP");
    if (!scraped?.ok) throw new Error(scraped?.error || "Scrape failed");
    const llm = await sendLLMGenerate(scraped);
    console.log('[AI PDP Extension][popup] LLM_GENERATE response (preview):', llm);
    if (!llm?.ok) throw new Error(llm?.error || "LLM failed");
    setStatus("Preview:\n" + JSON.stringify(llm.data, null, 2));
  } catch (e) {
    setStatus("Error: " + (e.message || String(e)));
  } finally {
    refreshBadge();
  }
});

refreshBadge();