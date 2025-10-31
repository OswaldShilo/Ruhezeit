// translator-api.js - wrapper for translation API
export async function translate(text, targetLang = 'en') {
  try {
    if (chrome?.translator?.translate) {
      return await chrome.translator.translate({ text, target: targetLang });
    }
  } catch (e) {
    console.warn('builtin translator unavailable', e);
  }
  console.log('translate (fallback)', text, targetLang);
  return { translated: text };
}
