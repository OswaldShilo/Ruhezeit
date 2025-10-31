// tab-manager.js - Manage tabs and groups
export async function listTabs() {
  return await chrome.tabs.query({});
}

export async function createTab(url) {
  return await chrome.tabs.create({ url });
}
