const modeRadios = document.querySelectorAll('input[name="mode"]');
const timeSettings = document.getElementById('time-settings');
const episodeSettings = document.getElementById('episode-settings');
const timePresets = document.getElementById('time-presets');
const episodePresets = document.getElementById('episode-presets');
const maxMinutesInput = document.getElementById('max-minutes');
const maxEpisodesInput = document.getElementById('max-episodes');
const startBtn = document.getElementById('start-btn');
const activeControls = document.getElementById('active-controls');
const stopBtn = document.getElementById('stop-btn');
const extendBtn = document.getElementById('extend-btn');
const extendHint = document.getElementById('extend-hint');
const statusDot = document.querySelector('.status-dot');
const statusText = document.getElementById('status-text');
const details = document.getElementById('details');
const detailTime = document.getElementById('detail-time');
const detailEpisodes = document.getElementById('detail-episodes');
const thresholdInfo = document.getElementById('threshold-info');
const bunnyNameInput = document.getElementById('bunny-name');
const nextActivityInput = document.getElementById('next-activity');
const soundEnabledInput = document.getElementById('sound-enabled');

// Toggle mode UI
function setModeUI(mode) {
  const isTime = mode === 'time';
  timeSettings.style.display = isTime ? 'block' : 'none';
  episodeSettings.style.display = isTime ? 'none' : 'block';
  timePresets.style.display = isTime ? 'flex' : 'none';
  episodePresets.style.display = isTime ? 'none' : 'flex';
  updateThresholdDisplay();
}

modeRadios.forEach(radio => {
  radio.addEventListener('change', () => setModeUI(radio.value));
});

// Update threshold display when values change
maxMinutesInput.addEventListener('input', updateThresholdDisplay);
maxEpisodesInput.addEventListener('input', updateThresholdDisplay);

// Load saved settings
chrome.storage.local.get(['adhdTimer', 'adhdBunnyName', 'adhdNextActivity', 'adhdSoundEnabled'], (result) => {
  const data = result.adhdTimer;

  if (result.adhdBunnyName) bunnyNameInput.value = result.adhdBunnyName;
  if (result.adhdNextActivity) nextActivityInput.value = result.adhdNextActivity;
  if (result.adhdSoundEnabled) soundEnabledInput.checked = true;

  if (!data) {
    updateThresholdDisplay();
    return;
  }

  if (data.mode) {
    document.querySelector(`input[name="mode"][value="${data.mode}"]`).checked = true;
    setModeUI(data.mode);
  }
  if (data.maxMinutes) maxMinutesInput.value = data.maxMinutes;
  if (data.maxEpisodes) maxEpisodesInput.value = data.maxEpisodes;

  if (data.active) {
    showActiveState(data);
  }

  updateThresholdDisplay(data);
});

// Save bunny name on change
bunnyNameInput.addEventListener('change', () => {
  const name = bunnyNameInput.value.trim() || 'Hoppy';
  chrome.storage.local.set({ adhdBunnyName: name });
});

// Save next activity on change
nextActivityInput.addEventListener('change', () => {
  chrome.storage.local.set({ adhdNextActivity: nextActivityInput.value.trim() });
});

// Save sound toggle on change
soundEnabledInput.addEventListener('change', () => {
  chrome.storage.local.set({ adhdSoundEnabled: soundEnabledInput.checked });
});

// Build threshold list for display
function getThresholds(mode, totalSeconds) {
  const thresholds = [];

  if (mode === 'time') {
    // Percentage-based
    const fiftyPct = Math.round(totalSeconds * 0.5);
    if (fiftyPct > 600) {
      thresholds.push({ time: fiftyPct, label: '50%', action: 'Bunny walks across + voice: time left', icon: '🐰' });
    }
    const twentyFivePct = Math.round(totalSeconds * 0.25);
    if (twentyFivePct > 600) {
      thresholds.push({ time: twentyFivePct, label: '25%', action: 'Bunny walks across + voice: time left', icon: '🐰' });
    }
    // Absolute
    if (totalSeconds > 600) {
      thresholds.push({ time: 600, label: '10 min', action: 'Bunny walks across: "Almost done!"', icon: '🐰' });
    }
    if (totalSeconds > 300) {
      thresholds.push({ time: 300, label: '5 min', action: 'Sleepy bunny: "Winding down..."', icon: '😴' });
    }
    if (totalSeconds > 180) {
      thresholds.push({ time: 180, label: '3 min', action: 'Timer pulsates, grows larger', icon: '💓' });
    }
    if (totalSeconds > 90) {
      thresholds.push({ time: 90, label: '1.5 min', action: 'Bunny: "Almost done! Just a little more!"', icon: '🐰' });
    }
    thresholds.push({ time: 0, label: '0 min', action: 'Navigates to goodbye page', icon: '👋' });
  } else {
    // Episode mode — thresholds apply on the last episode
    thresholds.push({ time: null, label: 'Last ep 50%', action: 'Bunny walks across + voice', icon: '🐰', note: 'last ep only' });
    thresholds.push({ time: null, label: 'Last ep 25%', action: 'Bunny walks across + voice', icon: '🐰', note: 'last ep only' });
    thresholds.push({ time: 600, label: '10 min left', action: 'Bunny: "Almost done!"', icon: '🐰', note: 'last ep' });
    thresholds.push({ time: 300, label: '5 min left', action: 'Sleepy bunny: "Winding down..."', icon: '😴', note: 'last ep' });
    thresholds.push({ time: 180, label: '3 min left', action: 'Timer pulsates, grows larger', icon: '💓', note: 'last ep' });
    thresholds.push({ time: 90, label: '1.5 min left', action: 'Bunny: "Almost done! Just a little more!"', icon: '🐰', note: 'last ep' });
    thresholds.push({ time: 0, label: 'Episode ends', action: 'Navigates to goodbye page', icon: '👋' });
  }

  return thresholds;
}

function formatMinSec(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function updateThresholdDisplay(timerData) {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  let totalSeconds;

  if (mode === 'time') {
    const mins = parseInt(maxMinutesInput.value, 10) || 30;
    totalSeconds = mins * 60;
  } else {
    totalSeconds = 0; // Episode mode thresholds are relative to last ep
  }

  const thresholds = getThresholds(mode, totalSeconds);
  const remindersShown = (timerData && timerData.remindersShown) || [];

  // Map threshold labels to keys used in content.js
  const keyMap = { '50%': 'pct50', 'Last ep 50%': 'pct50', '25%': 'pct25', 'Last ep 25%': 'pct25', '10 min': 'abs600', '10 min left': 'abs600', '5 min': 'abs300', '5 min left': 'abs300', '1.5 min': 'abs90', '1.5 min left': 'abs90' };

  let html = `<div class="threshold-title">${mode === 'time' ? 'Time mode' : 'Episode mode'} — what happens</div>`;

  for (const t of thresholds) {
    const key = keyMap[t.label];
    const done = key && remindersShown.includes(key);
    const timeStr = (mode === 'time' && t.time !== null && t.time > 0)
      ? formatMinSec(t.time) + ' left'
      : t.label;

    html += `<div class="threshold-row${done ? ' th-done' : ''}">`;
    html += `<span class="th-icon">${t.icon}</span>`;
    html += `<span class="th-time">${timeStr}</span>`;
    html += `<span class="th-action">${t.action}</span>`;
    html += `</div>`;
  }

  // Add position/color info
  html += `<div class="threshold-row" style="margin-top:4px;border-top:1px solid #1a1a3e;padding-top:4px;">`;
  html += `<span class="th-icon">🔄</span>`;
  html += `<span class="th-time">Always</span>`;
  html += `<span class="th-action">Timer switches sides every 90s, color every 45s</span>`;
  html += `</div>`;

  thresholdInfo.innerHTML = html;
}

function showActiveState(data) {
  startBtn.style.display = 'none';
  activeControls.style.display = 'block';
  statusDot.className = 'status-dot active';
  statusText.textContent = 'Timer active';
  details.style.display = 'block';

  if (data.mode === 'time') {
    const elapsed = Math.floor((data.accumulatedTime || 0) / 60);
    const total = data.maxMinutes;
    detailTime.textContent = `Time: ${elapsed}m / ${total}m`;
    detailEpisodes.textContent = '';
    extendBtn.textContent = '+10 min';
    extendBtn.style.display = 'block';
  } else {
    const watched = Math.max(0, data.episodesWatched || 0);
    detailEpisodes.textContent = `Episodes: ${watched} / ${data.maxEpisodes}`;
    detailTime.textContent = '';
    extendBtn.textContent = '+1 episode';
    extendBtn.style.display = 'block';
  }

  updateThresholdDisplay(data);
}

function showInactiveState() {
  startBtn.style.display = 'block';
  activeControls.style.display = 'none';
  statusDot.className = 'status-dot inactive';
  statusText.textContent = 'Inactive';
  details.style.display = 'none';
  updateThresholdDisplay();
}

function startTimer() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const maxMinutes = Math.max(1, parseInt(maxMinutesInput.value, 10) || 30);
  const maxEpisodes = Math.max(1, parseInt(maxEpisodesInput.value, 10) || 2);

  const data = {
    active: true,
    mode,
    maxMinutes,
    maxEpisodes,
    accumulatedTime: 0,
    episodesWatched: 0,
    startedAt: Date.now(),
    remindersShown: [],
    finished: false
  };

  chrome.storage.local.set({ adhdTimer: data }, () => {
    showActiveState(data);
    // Send to ALL Netflix watch tabs
    chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'ADHD_TIMER_START', data }).catch(() => {});
      });
    });
  });
}

// Switch mode while timer is active
function switchModeWhileActive(newMode) {
  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = result.adhdTimer;
    if (!data || !data.active) {
      // Not active — just start fresh
      startTimer();
      return;
    }

    const oldMode = data.mode;
    if (oldMode === newMode) return; // Same mode, no-op

    const maxMinutes = Math.max(1, parseInt(maxMinutesInput.value, 10) || 30);
    const maxEpisodes = Math.max(1, parseInt(maxEpisodesInput.value, 10) || 2);

    if (newMode === 'time') {
      // Switching to time mode: start the timer immediately
      const newData = {
        active: true,
        mode: 'time',
        maxMinutes,
        maxEpisodes,
        accumulatedTime: 0,
        episodesWatched: 0,
        startedAt: Date.now(),
        remindersShown: [],
        finished: false
      };

      chrome.storage.local.set({ adhdTimer: newData }, () => {
        showActiveState(newData);
        chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'ADHD_TIMER_START', data: newData }).catch(() => {});
          });
        });
      });
    } else {
      // Switching to episode mode: let the current episode finish first.
      // Set episodesWatched to -1 so when the current episode ends and
      // background.js increments it, it becomes 0 — meaning the user's
      // allowed episodes start counting from the NEXT episode.
      const newData = {
        active: true,
        mode: 'episode',
        maxMinutes,
        maxEpisodes,
        accumulatedTime: data.accumulatedTime || 0,
        episodesWatched: -1,
        startedAt: data.startedAt || Date.now(),
        remindersShown: [],
        finished: false
      };

      chrome.storage.local.set({ adhdTimer: newData }, () => {
        showActiveState(newData);
        chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' }, (tabs) => {
          tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { type: 'ADHD_TIMER_START', data: newData }).catch(() => {});
          });
        });
      });
    }
  });
}

startBtn.addEventListener('click', () => {
  const newMode = document.querySelector('input[name="mode"]:checked').value;
  // Check if switching mode while active
  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = result.adhdTimer;
    if (data && data.active && data.mode !== newMode) {
      switchModeWhileActive(newMode);
    } else {
      startTimer();
    }
  });
});

// Quick presets
document.querySelectorAll('.preset-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const mode = chip.dataset.mode;
    const value = parseInt(chip.dataset.value, 10);

    // Set mode
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    setModeUI(mode);

    if (mode === 'time') {
      maxMinutesInput.value = value;
    } else {
      maxEpisodesInput.value = value;
    }

    // Check if we're switching mode while active
    chrome.storage.local.get(['adhdTimer'], (result) => {
      const data = result.adhdTimer;
      if (data && data.active && data.mode !== mode) {
        switchModeWhileActive(mode);
      } else {
        startTimer();
      }
    });
  });
});

// Extend timer — gated with 2-second long-press
let extendHoldTimer = null;

function doExtend() {
  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = result.adhdTimer;
    if (!data || !data.active) return;

    if (data.mode === 'time') {
      data.maxMinutes += 10;
      maxMinutesInput.value = data.maxMinutes;
    } else {
      data.maxEpisodes += 1;
      maxEpisodesInput.value = data.maxEpisodes;
    }

    // Reset reminders so they can fire again for the new window
    data.remindersShown = [];
    data.finished = false;

    chrome.storage.local.set({ adhdTimer: data }, () => {
      showActiveState(data);
      // Notify all Netflix tabs
      chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' }, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { type: 'ADHD_TIMER_START', data }).catch(() => {});
        });
      });
    });
  });
}

function startExtendHold() {
  extendBtn.classList.add('holding');
  extendHoldTimer = setTimeout(() => {
    extendBtn.classList.remove('holding');
    doExtend();
  }, 2000);
}

function cancelExtendHold() {
  extendBtn.classList.remove('holding');
  clearTimeout(extendHoldTimer);
}

extendBtn.addEventListener('mousedown', startExtendHold);
extendBtn.addEventListener('mouseup', cancelExtendHold);
extendBtn.addEventListener('mouseleave', cancelExtendHold);
extendBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startExtendHold(); });
extendBtn.addEventListener('touchend', cancelExtendHold);
extendBtn.addEventListener('touchcancel', cancelExtendHold);

// Stop timer — works from any tab
stopBtn.addEventListener('click', () => {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  chrome.storage.local.set({
    adhdTimer: {
      active: false,
      mode,
      maxMinutes: parseInt(maxMinutesInput.value, 10),
      maxEpisodes: parseInt(maxEpisodesInput.value, 10)
    }
  }, () => {
    showInactiveState();
    // Send stop to ALL Netflix watch tabs
    chrome.tabs.query({ url: 'https://www.netflix.com/watch/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'ADHD_TIMER_STOP' }).catch(() => {});
      });
    });
  });
});

// Refresh status periodically
setInterval(() => {
  chrome.storage.local.get(['adhdTimer'], (result) => {
    if (result.adhdTimer && result.adhdTimer.active) {
      showActiveState(result.adhdTimer);
    }
  });
}, 2000);
