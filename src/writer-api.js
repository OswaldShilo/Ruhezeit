// writer-api.js - wrapper for writer/generation API
export async function generateDraft(prompt, opts = {}) {
  try {
    if (chrome?.writer?.generate) {
      return await chrome.writer.generate({ prompt, ...opts });
    }
  } catch (e) {
    console.warn('built-in writer unavailable', e);
  }
  console.log('generateDraft (fallback)', prompt, opts);
  return { draft: 'Draft for: ' + (typeof prompt === 'string' ? prompt.slice(0,200) : JSON.stringify(prompt)) };
}
