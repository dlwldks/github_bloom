/* GitHub Bloom — background.js */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ theme: 'github', apiKey: '' });
});
