// ai-utils.js - helpers for connecting to built-in AI APIs
export function preparePrompt(text) {
  return (text || '').toString().trim();
}

export function parseAiResponse(resp) {
  if (!resp) return null;
  if (typeof resp === 'string') return resp;
  return resp.result ?? resp.summary ?? resp.draft ?? resp;
}
