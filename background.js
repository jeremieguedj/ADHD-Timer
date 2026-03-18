// Check if the timer should reset (finished on a previous calendar day)
// Keeps settings (mode, limits) but resets counters so kids get a fresh daily allowance
function checkMidnightReset(data) {
  if (!data || !data.finished) return data;
  const startDate = new Date(data.startedAt).toDateString();
  const today = new Date().toDateString();
  if (startDate === today) return data;

  // New day — reset counters, keep limits
  data.active = true;
  data.finished = false;
  data.accumulatedTime = 0;
  data.episodesWatched = 0;
  data.remindersShown = [];
  data.startedAt = Date.now();
  chrome.storage.local.set({ adhdTimer: data });
  return data;
}

// Inject content script into a tab if not already present
function ensureContentScript(tabId) {
  chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }).catch(() => {});
  chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] }).catch(() => {});
}

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

  // Ensure content script is injected on SPA navigations (Netflix doesn't do full page loads)
  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = checkMidnightReset(result.adhdTimer);
    if (data && data.active) {
      ensureContentScript(details.tabId);
    }
  });

  // Only count if we had a previous video (i.e., this is a navigation, not first load)
  if (!previousVideoId) return;

  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = checkMidnightReset(result.adhdTimer);
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
      sendResponse(checkMidnightReset(result.adhdTimer) || null);
    });
    return true;
  }

});
