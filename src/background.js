async function getStored(key) {
  const obj = await chrome.storage.local.get(key);
  return obj?.[key];
}

async function getConfig() {
  const storedKey = await getStored("OPENAI_API_KEY");
  const storedMock = await getStored("USE_MOCK");
  const storedModel = await getStored("MODEL");
  const env = await getEnv();
  return {
    apiKey: storedKey ?? "",
    useMock: !!storedMock,
    model: storedModel ?? "gpt-4o-mini"
  };
}

async function callLLM(input) {
  const cfg = await getConfig();
  console.log('[AI PDP Extension][background] callLLM config:', cfg);

  // MOCK MODE: return synthetic content without hitting the network
  if (cfg.useMock) {
    console.log('[AI PDP Extension][background] Using MOCK mode for LLM');
    await new Promise(r => setTimeout(r, 250));
    const baseTitle = input.title?.trim() || "Sample Product";
    const baseDesc = input.description?.trim() || "This is a sample product description.";
    const mockResult = {
      title: `${baseTitle} — Enhanced`,
      description:
        `${baseDesc}\n\n` +
        `• Benefits-focused copy\n` +
        `• Clear formatting\n` +
        `• SEO-friendly phrasing`,
      shipping: "• Standard shipping 3–5 business days\n• Expedited options at checkout",
      returns: "• 30-day returns on unused items\n• Easy exchanges via the returns portal"
    };
    console.log('[AI PDP Extension][background] Returning mock result:', mockResult);
    return mockResult;
  }

  if (!cfg.apiKey) throw new Error("Missing API key. Set it in Options or /env/local.js");

  const system = `You are an e-commerce copywriter.
Return STRICT JSON with keys: title, description, shipping, returns.
- Title: <= 70 chars, no emojis, no shouting.
- Description: 2-4 short paragraphs; benefits-first; keep facts consistent with input.
- Shipping/Returns: concise bullet points; no promises not present in input.
- Never invent specs or guarantees.`;

  const user = {
    url: input.url,
    language: input.language || "en",
    title: input.title || "",
    description: input.description || "",
    shipping: input.shipping || "",
    returns: input.returns || ""
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ]
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM error: ${resp.status} ${text}`);
  }
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("Model did not return valid JSON."); }

  return {
    title: parsed.title || user.title,
    description: parsed.description || user.description,
    shipping: parsed.shipping || user.shipping,
    returns: parsed.returns || user.returns
  };
}

// Message router
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg.type === "LLM_GENERATE") {
      try {
        const out = await callLLM(msg.payload);
        console.log('[AI PDP Extension][background] callLLM success:', out);
        sendResponse({ ok: true, data: out });
      } catch (e) {
        console.error('[AI PDP Extension][background] callLLM error:', e);
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    } else if (msg.type === "GET_STATUS") {
      try {
        const cfg = await getConfig();
        sendResponse({
          ok: true,
          data: {
            useMock: !!cfg.useMock,
            model: cfg.model,
            hasKey: !!cfg.apiKey
          }
        });
      } catch (e) {
        sendResponse({ ok: false, error: e.message || String(e) });
      }
    } else if (msg.type === "PING") {
      console.log('[AI PDP Extension][background] Received PING');
      sendResponse({ ok: true, data: "pong" });
    } else {
      sendResponse({ ok: false, error: "Unknown message type" });
    }
  })();
  return true; // Required for async sendResponse
});