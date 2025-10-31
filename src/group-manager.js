// group-manager.js - helper for Chrome tabGroups
export async function createGroup(tabIds = []) {
  return await chrome.tabs.group({ tabIds });
}

export async function updateGroup(groupId, updateProperties) {
  return await chrome.tabGroups.update(groupId, updateProperties);
}

export async function collapseGroup(groupId) {
  return await chrome.tabGroups.update(groupId, { collapsed: true });
}

export async function expandGroup(groupId) {
  return await chrome.tabGroups.update(groupId, { collapsed: false });
}
