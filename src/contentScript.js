// contentScript.js
// Scrapes and replaces PDP fields (title, description, shipping, returns)

console.log('[AI PDP Extension] contentScript.js injected');

function getTextBySelectors(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      let text = '';
      // Special handling for Amazon feature bullets
      if (sel === '#feature-bullets' && el.querySelectorAll('li').length > 0) {
        text = Array.from(el.querySelectorAll('li'))
          .map(li => li.innerText.trim() || li.textContent.trim())
          .filter(Boolean)
          .join('\n');
        console.log(`[AI PDP Extension][scrape] Selector: ${sel} (feature-bullets), Text:`, text);
      } else {
        text = el.innerText?.trim() || el.textContent?.trim() || '';
        console.log(`[AI PDP Extension][scrape] Selector: ${sel}, Text:`, text);
      }
      if (text) return text;
    } else {
      console.log(`[AI PDP Extension][scrape] Selector: ${sel} not found.`);
    }
  }
  return '';
}

// Wait for a selector to appear in the DOM (polling)
async function waitForSelector(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// Make scrapePDP async and wait for key selectors
async function scrapePDP() {
  // Wait for the most important selectors (Amazon)
  await waitForSelector('#productTitle', 5000);
  await waitForSelector('#feature-bullets', 5000);

  // Amazon, MercadoLibre, then generic selectors
  const title = getTextBySelectors([
    '#productTitle', // Amazon
    'h1.ui-pdp-title', // MercadoLibre
    'h1[itemprop="name"]',
    'h1',
    '.product-title',
    '[itemprop="name"]'
  ]);
  const description = getTextBySelectors([
    '#productDescription', // Amazon
    '#feature-bullets', // Amazon
    'div.ui-pdp-description__content', // MercadoLibre
    'div.ui-pdp-description',
    '.product-description',
    '[itemprop="description"]',
    '#description'
  ]);
  const shipping = getTextBySelectors([
    '#mir-layout-DELIVERY_BLOCK', // Amazon
    '.shipping3P', // Amazon
    'p.ui-pdp-delivery__shipping', // MercadoLibre
    'div.ui-pdp-shipping',
    '.shipping',
    '.shipping-info',
    '[data-shipping]',
    '#shipping'
  ]);
  const returns = getTextBySelectors([
    '#RETURNS_POLICY', // Amazon
    '.returns-policy-message', // Amazon
    'div.ui-pdp-return-policy', // MercadoLibre
    '.returns',
    '.returns-info',
    '[data-returns]',
    '#returns'
  ]);
  return { title, description, shipping, returns };
}

function replacePDP({ title, description, shipping, returns }) {
  const setTextBySelectors = (selectors, value) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.innerText = value;
        break;
      }
    }
  };
  if (title) setTextBySelectors([
    '#productTitle', 'h1.ui-pdp-title', 'h1[itemprop="name"]', 'h1', '.product-title', '[itemprop="name"]'
  ], title);
  if (description) setTextBySelectors([
    '#productDescription', '#feature-bullets', 'div.ui-pdp-description__content', 'div.ui-pdp-description', '.product-description', '[itemprop="description"]', '#description'
  ], description);
  if (shipping) setTextBySelectors([
    '#mir-layout-DELIVERY_BLOCK', '.shipping3P', 'p.ui-pdp-delivery__shipping', 'div.ui-pdp-shipping', '.shipping', '.shipping-info', '[data-shipping]', '#shipping'
  ], shipping);
  if (returns) setTextBySelectors([
    '#RETURNS_POLICY', '.returns-policy-message', 'div.ui-pdp-return-policy', '.returns', '.returns-info', '[data-returns]', '#returns'
  ], returns);
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[AI PDP Extension] contentScript.js received message:', msg);
  if (msg.type === 'scrapePDP') {
    (async () => {
      const result = await scrapePDP();
      sendResponse({ ok: true, ...result });
    })();
    return true; // Required for async sendResponse
  }
  if (msg.type === 'replacePDP' && msg.payload) {
    replacePDP(msg.payload);
    sendResponse({ ok: true });
    return true;
  }
});
