// summarizer-api.js - wrapper for summarization
export async function summarize(text, opts = {}) {
  // Try built-in summarizer if available
  try {
    if (chrome?.summarizer?.summarize) {
      const resp = await chrome.summarizer.summarize({ text, ...opts });
      return resp;
    }
  } catch (e) {
    console.warn('built-in summarizer unavailable', e);
  }
  console.log('summarize (fallback)', text, opts);
  return { summary: typeof text === 'string' ? text.slice(0, 400) : JSON.stringify(text).slice(0,400) };
}
