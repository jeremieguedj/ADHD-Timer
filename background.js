// Track Netflix SPA navigation to count episodes
let lastVideoId = null;

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (!details.url.includes('netflix.com/watch/')) return;

  const match = details.url.match(/netflix\.com\/watch\/(\d+)/);
  if (!match) return;

  const videoId = match[1];
  if (videoId === lastVideoId) return;

  const previousVideoId = lastVideoId;
  lastVideoId = videoId;

  // Only count if we had a previous video (i.e., this is a navigation, not first load)
  if (!previousVideoId) return;

  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = result.adhdTimer;
    if (!data || !data.active) return;

    data.episodesWatched = (data.episodesWatched || 0) + 1;

    // Check if finished BEFORE saving — prevents race condition
    if (data.mode === 'episode' && data.episodesWatched >= data.maxEpisodes) {
      data.finished = true;
      chrome.storage.local.set({ adhdTimer: data }, () => {
        chrome.tabs.sendMessage(details.tabId, {
          type: 'ADHD_TIMER_FINISHED',
          data
        }).catch(() => {});
      });
      return;
    }

    // Reset reminders for the new episode in episode mode
    if (data.mode === 'episode') {
      data.remindersShown = [];
    }

    chrome.storage.local.set({ adhdTimer: data }, () => {
      // Notify content script about episode change
      chrome.tabs.sendMessage(details.tabId, {
        type: 'ADHD_EPISODE_CHANGE',
        data
      }).catch(() => {
        // Content script may not be ready yet
      });
    });
  });
}, { url: [{ hostContains: 'netflix.com' }] });

// Handle messages from popup/content
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ADHD_GET_STATE') {
    chrome.storage.local.get(['adhdTimer'], (result) => {
      sendResponse(result.adhdTimer || null);
    });
    return true;
  }

});
