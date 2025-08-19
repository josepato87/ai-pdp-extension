// /env/local.js
// Local-only overrides. Safe to omit in production builds.
//
// You can export either default or named. We’ll handle both.
export default {
  // Put your local key here for fast testing (optional).
  // If omitted, the extension will use the key from Options (chrome.storage).
  OPENAI_API_KEY: "sk-REPLACE_ME_LOCAL_DEV",

  // Force mock mode locally (true/false). Options page can also override.
  USE_MOCK: false,

  // Optional: choose a local default model name
  MODEL: "gpt-4o-mini"
};