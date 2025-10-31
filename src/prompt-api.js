// prompt-api.js - wrapper to call a Prompt API (placeholder)
export async function sendPrompt(prompt) {
  // If built-in Prompt API exists on chrome.* namespace (origin trial), use it.
  try {
    if (chrome?.prompt?.send) {
      const resp = await chrome.prompt.send({ prompt: prompt });
      return resp;
    }
  } catch (e) {
    console.warn('built-in prompt API unavailable', e);
  }
  // Fallback: mirror local mock
  console.log('sendPrompt (fallback)', prompt);
  return { result: 'mock response for: ' + prompt };
}
