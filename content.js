(() => {
  'use strict';

  // Prevent double-injection (e.g., when programmatically injected on SPA navigation)
  if (window._adhdTimerLoaded) return;
  window._adhdTimerLoaded = true;

  // State
  let state = null;
  let video = null;
  let timerEl = null;
  let bunnyEl = null;
  let finalOverlay = null;
  let updateInterval = null;
  let positionInterval = null;
  let colorInterval = null;
  let isProgrammaticPause = false;
  let lastTimeUpdate = 0;
  let greetingShown = false;
  let bunnyShowing = false;
  let timerOnRight = true; // starts on right side
  let colorIndex = 0;

  // Settings (overridden from storage)
  let bunnyName = 'Hoppy';
  let nextActivity = '';
  let soundEnabled = false;

  // Audio context (lazy init)
  let audioCtx = null;

  // Color palette for cycling — kid-friendly, high-contrast on white
  const PIE_COLORS = [
    '#ef5350', // red (like Time Timer)
    '#7c4dff', // purple
    '#26a69a', // teal
    '#ff9800', // orange
    '#42a5f5', // blue
    '#ec407a', // pink
  ];

  // Sprite sheet configurations (generated from Veo 3.1 animations)
  // 24 frames per sprite. Duration = frames / target_fps (~12fps for smooth, relaxed motion).
  const SPRITES = {
    happy:  { file: 'icons/bunny-walk-sprite.png',      fw: 124, fh: 200, frames: 24, sw: 2976, duration: '2s' },
    sleepy: { file: 'icons/bunny-sleepy-sprite.png',     fw: 136, fh: 200, frames: 24, sw: 3264, duration: '3s' },
    wave:   { file: 'icons/bunny-celebrate-sprite.png',  fw: 185, fh: 200, frames: 24, sw: 4440, duration: '2s' },
  };

  // Inject sprite animation CSS (needs chrome.runtime.getURL for image paths)
  function injectSpriteStyles() {
    if (document.getElementById('adhd-sprite-styles')) return;
    const style = document.createElement('style');
    style.id = 'adhd-sprite-styles';
    let css = '';
    for (const [pose, s] of Object.entries(SPRITES)) {
      const url = chrome.runtime.getURL(s.file);
      css += `
        .bunny-sprite-${pose} {
          width: ${s.fw}px; height: ${s.fh}px;
          background: url('${url}') 0 0 no-repeat;
          background-size: ${s.sw}px ${s.fh}px;
          animation: sprite-${pose} ${s.duration} steps(${s.frames}) infinite;
        }
        @keyframes sprite-${pose} {
          to { background-position: -${s.sw}px 0; }
        }
      `;
    }
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Small bunny head icon for timer
  const BUNNY_ICON_SVG = `
    <svg class="timer-bunny-icon" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="8" cy="5" rx="2.5" ry="6" fill="#fff" stroke="#e0e0e0" stroke-width="0.5"/>
      <ellipse cx="8" cy="5" rx="1.5" ry="4" fill="#ffb6c1"/>
      <ellipse cx="16" cy="5" rx="2.5" ry="6" fill="#fff" stroke="#e0e0e0" stroke-width="0.5"/>
      <ellipse cx="16" cy="5" rx="1.5" ry="4" fill="#ffb6c1"/>
      <circle cx="12" cy="14" r="8" fill="#fff" stroke="#e0e0e0" stroke-width="0.5"/>
      <circle cx="9.5" cy="13" r="1.2" fill="#333"/>
      <circle cx="14.5" cy="13" r="1.2" fill="#333"/>
      <ellipse cx="12" cy="15.5" rx="1" ry="0.8" fill="#ffb6c1"/>
    </svg>`;

  // Format seconds to M:SS
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Format remaining time as kid-friendly English
  function formatTimeEnglish(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    if (m > 0 && s > 0) return `${m} minute${m !== 1 ? 's' : ''} and ${s} second${s !== 1 ? 's' : ''}`;
    if (m > 0) return `${m} minute${m !== 1 ? 's' : ''}`;
    return `${s} second${s !== 1 ? 's' : ''}`;
  }

  // Get current pie color (cycles every 45s)
  function getCurrentPieColor() {
    return PIE_COLORS[colorIndex % PIE_COLORS.length];
  }

  // Build SVG path for a pie wedge
  // fraction: 0 to 1 (1 = full circle)
  // cx, cy: center; r: radius
  function piePath(fraction, cx, cy, r) {
    if (fraction <= 0) return '';
    if (fraction >= 1) {
      // Full circle — use two half-arcs
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx} ${cy + r} A ${r} ${r} 0 1 1 ${cx} ${cy - r} Z`;
    }

    const angle = fraction * 2 * Math.PI;
    const endX = cx + r * Math.sin(angle);
    const endY = cy - r * Math.cos(angle);
    const largeArc = fraction > 0.5 ? 1 : 0;

    return `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
  }

  // Audio: gentle ascending two-note chime
  function playChime() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const gain = audioCtx.createGain();
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      const osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.connect(gain);
      osc1.start(now);
      osc1.stop(now + 0.2);

      const gain2 = audioCtx.createGain();
      gain2.connect(audioCtx.destination);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      const osc2 = audioCtx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      osc2.connect(gain2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.4);
    } catch (e) { /* audio not available */ }
  }

  // Audio: warm three-note chord for completion
  function playComplete() {
    if (!soundEnabled) return;
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const freqs = [261.63, 329.63, 392.00];

      freqs.forEach((freq, i) => {
        const gain = audioCtx.createGain();
        gain.connect(audioCtx.destination);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.connect(gain);
        osc.start(now + i * 0.1);
        osc.stop(now + 0.5 + i * 0.1);
      });
    } catch (e) { /* audio not available */ }
  }

  // Play a pre-generated WAV audio file from the extension's audio/ directory
  function playAudioFile(filename) {
    if (!soundEnabled) return;
    try {
      const url = chrome.runtime.getURL(`audio/${filename}`);
      const audio = new Audio(url);
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch (e) { /* extension context gone */ }
  }

  // Track the current Netflix video ID so we can detect episode changes
  let blockedWatchId = null;
  let autoplayCheckInterval = null;

  // Start monitoring for Netflix navigating to a different episode.
  // Instead of overriding pushState (which corrupts Netflix internals),
  // we poll the URL and redirect to done.html if it changes.
  function startAutoplayBlocker() {
    // Capture the current video ID when blocking starts
    const match = location.pathname.match(/\/watch\/(\d+)/);
    if (match) blockedWatchId = match[1];

    if (autoplayCheckInterval) clearInterval(autoplayCheckInterval);
    autoplayCheckInterval = setInterval(() => {
      if (!document.documentElement.classList.contains('adhd-block-autoplay')) return;
      const current = location.pathname.match(/\/watch\/(\d+)/);
      if (current && blockedWatchId && current[1] !== blockedWatchId) {
        // Netflix auto-navigated to a new episode — redirect to done.html
        clearInterval(autoplayCheckInterval);
        if (state && state.active && !state.finished) {
          state.finished = true;
          saveState();
          showFinalOverlay();
        }
      }
    }, 300);
  }

  // MutationObserver: hide next-episode buttons when blocking is active
  // Uses style.display instead of removing from DOM to avoid breaking Netflix
  function startAutoplayWatcher() {
    const observer = new MutationObserver(() => {
      if (!document.documentElement.classList.contains('adhd-block-autoplay')) return;
      const btns = document.querySelectorAll('button[data-uia*="next-episode"], button[data-uia*="next"]');
      btns.forEach(btn => {
        btn.style.display = 'none';
        btn.style.pointerEvents = 'none';
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Toggle autoplay blocking class based on episodes remaining
  function updateAutoplayBlock() {
    if (!state || !state.active || state.mode !== 'episode') {
      document.documentElement.classList.remove('adhd-block-autoplay');
      return;
    }
    const watched = Math.max(0, state.episodesWatched || 0);
    const episodesLeft = state.maxEpisodes - watched;
    if (episodesLeft <= 1) {
      document.documentElement.classList.add('adhd-block-autoplay');
    } else {
      document.documentElement.classList.remove('adhd-block-autoplay');
    }
  }

  // Create pie-wedge timer overlay
  function createTimerOverlay() {
    if (timerEl) return;
    timerEl = document.createElement('div');
    timerEl.id = 'adhd-timer-overlay';
    timerEl.classList.add(timerOnRight ? 'pos-right' : 'pos-left');

    timerEl.innerHTML = `
      <div class="timer-circle">
        <svg viewBox="0 0 130 130">
          <path class="pie-wedge" d="" fill="${getCurrentPieColor()}"/>
        </svg>
        <div class="timer-time">--:--</div>
      </div>
      <div class="timer-info"></div>
      ${BUNNY_ICON_SVG}
    `;
    document.body.appendChild(timerEl);
  }


  // Create bunny container
  function createBunnyContainer() {
    if (bunnyEl) return;
    injectSpriteStyles();
    bunnyEl = document.createElement('div');
    bunnyEl.id = 'adhd-bunny-container';
    bunnyEl.innerHTML = `
      <div class="bunny-walker">
        <div class="speech-bubble"></div>
        <div class="bunny-sprite bunny-sprite-happy"></div>
      </div>
    `;
    document.body.appendChild(bunnyEl);
  }

  // Switch bunny sprite pose
  function setBunnyPose(pose) {
    if (!bunnyEl) return;
    const sprite = bunnyEl.querySelector('.bunny-sprite');
    if (!sprite) return;
    sprite.className = `bunny-sprite bunny-sprite-${pose}`;
  }

  // Position switching — toggle left/right every 90s
  function startPositionSwitching() {
    if (positionInterval) clearInterval(positionInterval);
    positionInterval = setInterval(() => {
      if (!timerEl || !state || !state.active) return;
      timerOnRight = !timerOnRight;
      timerEl.classList.remove('pos-left', 'pos-right');
      timerEl.classList.add(timerOnRight ? 'pos-right' : 'pos-left');
    }, 90000);
  }

  // Color cycling — change pie color every 45s
  function startColorCycling() {
    if (colorInterval) clearInterval(colorInterval);
    colorInterval = setInterval(() => {
      if (!timerEl || !state || !state.active) return;
      colorIndex++;
      // The color is applied on next updateTimerDisplay() call
    }, 45000);
  }

  // Map threshold keys to audio filenames
  const AUDIO_MAP = {
    'greeting': 'greeting.wav',
    'pct50': 'halfway.wav',
    'pct25': 'quarter.wav',
    'abs600': 'ten_minutes.wav',
    'abs300': 'five_minutes.wav',
    'abs90': 'ninety_seconds.wav',
    'goodbye': 'goodbye.wav',
  };

  // Show bunny reminder — walks across entire screen, pauses video, speaks
  async function showBunnyReminder(message, shouldPause = true, pose = 'happy', audioKey = null) {
    if (bunnyShowing) return;
    bunnyShowing = true;
    if (!bunnyEl) createBunnyContainer();

    // Swap bunny sprite based on pose
    const walker = bunnyEl.querySelector('.bunny-walker');
    setBunnyPose(pose);

    const bubble = bunnyEl.querySelector('.speech-bubble');
    bubble.textContent = message;

    // Pause video during bunny walk
    if (shouldPause) {
      isProgrammaticPause = true;
      if (video && !video.paused) {
        video.pause();
      }
    }

    // Play chime (immediate feedback)
    playChime();

    // Play pre-generated audio file if available
    if (audioKey && AUDIO_MAP[audioKey]) {
      playAudioFile(AUDIO_MAP[audioKey]);
    }

    // Wiggle the small bunny icon on the timer
    const bunnyIcon = timerEl && timerEl.querySelector('.timer-bunny-icon');
    if (bunnyIcon) {
      bunnyIcon.classList.add('wiggle');
      setTimeout(() => bunnyIcon.classList.remove('wiggle'), 1500);
    }

    // Reset walker position to left side
    walker.style.transition = 'none';
    walker.style.transform = 'translateX(-60vw)';

    // Force reflow so the reset takes effect
    walker.offsetHeight;

    // Show and start walk to center
    bunnyEl.classList.add('visible');

    requestAnimationFrame(() => {
      walker.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
      walker.style.transform = 'translateX(0vw)'; // center
    });

    // Wait for walk to center (3s), then pause for 4s
    await new Promise(r => setTimeout(r, 3200));
    await new Promise(r => setTimeout(r, 4000));

    // Continue walking off-screen to the right
    requestAnimationFrame(() => {
      walker.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
      walker.style.transform = 'translateX(60vw)';
    });

    // Wait for exit walk (3s) + buffer
    await new Promise(r => setTimeout(r, 3300));

    // Hide
    bunnyEl.classList.remove('visible');
    await new Promise(r => setTimeout(r, 400));

    // Resume video
    if (shouldPause) {
      isProgrammaticPause = false;
      if (video && video.paused && state && state.active && !state.finished) {
        video.play();
      }
    }
    bunnyShowing = false;
  }

  // Show bunny greeting at timer start (no pause)
  async function showGreeting() {
    if (greetingShown) return;
    greetingShown = true;

    // Small delay to let video start
    await new Promise(r => setTimeout(r, 2000));

    if (!state || !state.active) return;
    await showBunnyReminder(
      `Hi! ${bunnyName} is here! Enjoy your show!`,
      false,
      'happy',
      'greeting'
    );
  }

  // Navigate to the "done" page — away from Netflix
  function showFinalOverlay() {
    if (video) video.pause();

    // Navigate to the extension's done page
    window.location.href = chrome.runtime.getURL('done.html');
  }

  // Redirect to done page if timer is finished (blocks kid from returning to Netflix)
  function enforceFinished() {
    window.location.href = chrome.runtime.getURL('done.html');
  }

  // Calculate remaining time
  function getRemainingSeconds() {
    if (!state || !state.active) return Infinity;

    if (state.mode === 'time') {
      const totalAllowed = state.maxMinutes * 60;
      return totalAllowed - (state.accumulatedTime || 0);
    }

    if (state.mode === 'episode') {
      const watched = Math.max(0, state.episodesWatched || 0);
      const episodesLeft = state.maxEpisodes - watched;
      if (episodesLeft <= 0) return 0;
      if (episodesLeft === 1 && video && video.duration) {
        return video.duration - video.currentTime;
      }
      return Infinity;
    }

    return Infinity;
  }

  // Get total allowed seconds (for computing fraction)
  function getTotalSeconds() {
    if (!state || !state.active) return 0;

    if (state.mode === 'time') {
      return state.maxMinutes * 60;
    }

    if (state.mode === 'episode') {
      const watched = Math.max(0, state.episodesWatched || 0);
      const episodesLeft = state.maxEpisodes - watched;
      if (episodesLeft === 1 && video && video.duration) {
        return video.duration;
      }
    }

    return 0;
  }

  // Apply progressive timer scale based on remaining seconds and fraction
  // Grows up to 50% larger, and adds pulsating at 3min and 2min marks
  function applyTimerScale(fraction, remainingSeconds) {
    if (!timerEl) return;
    const circle = timerEl.querySelector('.timer-circle');
    if (!circle) return;

    // Gradual growth: linearly scale from 1.0 at 100% to 1.5 at 0%
    const scale = 1 + (1 - Math.max(0, Math.min(1, fraction))) * 0.5;

    circle.style.setProperty('--timer-scale', scale);
    circle.style.transform = `scale(${scale})`;

    // Pulsating animation at 3min and 2min remaining
    if (remainingSeconds <= 180 && remainingSeconds > 0) {
      if (!circle.classList.contains('pulsate')) {
        circle.classList.add('pulsate');
      }
    } else {
      circle.classList.remove('pulsate');
    }
  }

  // Check reminder thresholds — 5 graduated stages
  function checkReminders() {
    const remaining = getRemainingSeconds();
    if (remaining === Infinity) return;

    const total = getTotalSeconds();
    const fraction = total > 0 ? remaining / total : 1;
    let remindersShown = state.remindersShown || [];

    // Build thresholds
    const thresholds = [];

    const fiftyPct = Math.round(total * 0.5);
    if (fiftyPct > 600) {
      thresholds.push({
        key: 'pct50',
        time: fiftyPct,
        message: `${formatTimeEnglish(fiftyPct)} left! Having fun!`,
        pose: 'happy',
        pulse: true,
        audioKey: 'pct50'
      });
    }

    const twentyFivePct = Math.round(total * 0.25);
    if (twentyFivePct > 600) {
      thresholds.push({
        key: 'pct25',
        time: twentyFivePct,
        message: `${formatTimeEnglish(twentyFivePct)} left!`,
        pose: 'happy',
        pulse: false,
        audioKey: 'pct25'
      });
    }

    thresholds.push({
      key: 'abs600',
      time: 600,
      message: `10 minutes left! Almost done!`,
      pose: 'happy',
      pulse: false,
      audioKey: 'abs600'
    });

    thresholds.push({
      key: 'abs300',
      time: 300,
      message: `Only 5 minutes left! Winding down...`,
      pose: 'sleepy',
      pulse: false,
      audioKey: 'abs300'
    });

    thresholds.push({
      key: 'abs90',
      time: 90,
      message: `Almost done! Just a little bit more!`,
      pose: 'sleepy',
      pulse: false,
      audioKey: 'abs90'
    });

    // Reset reminders for thresholds the user has seeked BACK past.
    // If remaining > threshold.time, that threshold hasn't been crossed yet,
    // so remove it from remindersShown so it can fire again when re-crossed.
    let changed = false;
    for (const threshold of thresholds) {
      const idx = remindersShown.indexOf(threshold.key);
      if (idx !== -1 && remaining > threshold.time + 5) {
        // User seeked back past this threshold (5s buffer to avoid flicker)
        remindersShown.splice(idx, 1);
        changed = true;
      }
    }
    if (changed) {
      state.remindersShown = remindersShown;
      saveState();
    }

    // Find the most urgent unshown threshold
    // Use a 3s tolerance so seeking to "about 5 min" still triggers
    if (!bunnyShowing) {
      let bestThreshold = null;
      for (const threshold of thresholds) {
        if (remaining <= threshold.time + 3 && !remindersShown.includes(threshold.key)) {
          bestThreshold = threshold;
        }
      }

      if (bestThreshold) {
        // Mark all crossed thresholds as shown
        for (const threshold of thresholds) {
          if (remaining <= threshold.time + 3 && !remindersShown.includes(threshold.key)) {
            remindersShown.push(threshold.key);
          }
        }
        state.remindersShown = remindersShown;
        saveState();

        if (bestThreshold.pulse && timerEl) {
          const circle = timerEl.querySelector('.timer-circle');
          if (circle) {
            circle.classList.add('pulse');
            setTimeout(() => circle.classList.remove('pulse'), 3000);
          }
        }

        showBunnyReminder(bestThreshold.message, true, bestThreshold.pose, bestThreshold.audioKey);
      }
    }

    // Final stop
    if (remaining <= 0 && !state.finished) {
      state.finished = true;
      saveState();
      showFinalOverlay();
    }
  }

  // Update pie-wedge timer display
  function updateTimerDisplay() {
    if (!timerEl || !state || !state.active) return;

    const remaining = getRemainingSeconds();
    const total = getTotalSeconds();
    const timeEl = timerEl.querySelector('.timer-time');
    const infoEl = timerEl.querySelector('.timer-info');
    const wedge = timerEl.querySelector('.pie-wedge');

    // Update autoplay blocking state
    updateAutoplayBlock();

    if (state.mode === 'episode') {
      const watched = Math.max(0, state.episodesWatched || 0);
      const episodesLeft = state.maxEpisodes - watched;

      if (episodesLeft <= 1 && watched >= 0 && video && video.duration) {
        const fraction = Math.max(0, remaining / total);
        wedge.setAttribute('d', piePath(fraction, 65, 65, 62));
        wedge.setAttribute('fill', getCurrentPieColor());
        timeEl.textContent = formatTime(Math.max(0, remaining));
        timeEl.style.fontSize = '';
        infoEl.innerHTML = '<span class="episode-dot"></span>';
        applyTimerScale(fraction, remaining);
      } else {
        // Multiple episodes left — full pie
        // Clamp display to maxEpisodes (episodesWatched can be -1 during mode switch grace period)
        const displayLeft = Math.min(episodesLeft, state.maxEpisodes);
        wedge.setAttribute('d', piePath(1, 65, 65, 62));
        wedge.setAttribute('fill', getCurrentPieColor());
        timeEl.textContent = `${Math.max(0, displayLeft)}`;
        timeEl.style.fontSize = '26px';
        let dots = '';
        for (let i = 0; i < state.maxEpisodes; i++) {
          const spent = i < Math.max(0, state.episodesWatched || 0);
          dots += `<span class="episode-dot${spent ? ' spent' : ''}"></span>`;
        }
        infoEl.innerHTML = dots;
        applyTimerScale(1, Infinity);
      }
    } else {
      // Time mode
      if (remaining !== Infinity && total > 0) {
        const fraction = Math.max(0, remaining / total);
        wedge.setAttribute('d', piePath(fraction, 65, 65, 62));
        wedge.setAttribute('fill', getCurrentPieColor());
        timeEl.textContent = formatTime(Math.max(0, remaining));
        timeEl.style.fontSize = '';
        infoEl.innerHTML = '';
        applyTimerScale(fraction, remaining);
      }
    }
  }

  // Save state to storage
  function saveState() {
    if (state) {
      try {
        chrome.storage.local.set({ adhdTimer: state });
      } catch (e) {
        cleanup();
      }
    }
  }

  // Track playback time (only accumulate while playing)
  function onTimeUpdate() {
    if (!state || !state.active || state.finished) return;
    if (!video || video.paused) return;

    const now = Date.now();
    if (lastTimeUpdate > 0) {
      const delta = (now - lastTimeUpdate) / 1000;
      if (delta > 0 && delta < 2) {
        state.accumulatedTime = (state.accumulatedTime || 0) + delta;
      }
    }
    lastTimeUpdate = now;
  }

  function onPlay() {
    lastTimeUpdate = Date.now();
  }

  function onPause() {
    if (state && state.active && lastTimeUpdate > 0) {
      const delta = (Date.now() - lastTimeUpdate) / 1000;
      if (delta > 0 && delta < 2) {
        state.accumulatedTime = (state.accumulatedTime || 0) + delta;
      }
    }
    lastTimeUpdate = 0;
  }

  // Attach to video element
  function attachToVideo(videoEl) {
    if (video === videoEl) return;

    if (video) {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    }

    video = videoEl;
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    if (!video.paused) {
      lastTimeUpdate = Date.now();
    }
  }

  // Watch for video element (Netflix dynamically loads it)
  function watchForVideo() {
    const existing = document.querySelector('video');
    if (existing) attachToVideo(existing);

    const observer = new MutationObserver(() => {
      const v = document.querySelector('video');
      if (v) attachToVideo(v);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Main update loop
  function startUpdateLoop() {
    if (updateInterval) clearInterval(updateInterval);

    updateInterval = setInterval(() => {
      if (!state || !state.active || state.finished) return;

      saveState();
      updateTimerDisplay();
      checkReminders();

      // Near end: increase check frequency
      const remaining = getRemainingSeconds();
      if (remaining !== Infinity && remaining < 30 && remaining > 0) {
        if (!state._fastCheck) {
          state._fastCheck = true;
          clearInterval(updateInterval);
          updateInterval = setInterval(() => {
            if (!state || !state.active || state.finished) return;
            saveState();
            updateTimerDisplay();
            checkReminders();
          }, 250);
        }
      }
    }, 1000);
  }

  // Load settings from storage
  function loadSettings(callback) {
    chrome.storage.local.get(['adhdBunnyName', 'adhdNextActivity', 'adhdSoundEnabled'], (result) => {
      if (result.adhdBunnyName) bunnyName = result.adhdBunnyName;
      if (result.adhdNextActivity) nextActivity = result.adhdNextActivity;
      if (result.adhdSoundEnabled !== undefined) soundEnabled = result.adhdSoundEnabled;
      if (callback) callback();
    });
  }

  // Initialize
  function init(data) {
    state = data;

    if (!state || !state.active) {
      cleanup();
      return;
    }

    loadSettings(() => {
      if (state.finished) {
        // Timer is done — redirect away from Netflix
        enforceFinished();
        return;
      }

      createTimerOverlay();
      createBunnyContainer();
      watchForVideo();
      startUpdateLoop();
      startPositionSwitching();
      startColorCycling();
      updateTimerDisplay();

      // Set up autoplay blocking (detects Netflix SPA navigation)
      startAutoplayBlocker();
      startAutoplayWatcher();

      showGreeting();
    });
  }

  // Cleanup everything
  function cleanup() {
    if (updateInterval) { clearInterval(updateInterval); updateInterval = null; }
    if (positionInterval) { clearInterval(positionInterval); positionInterval = null; }
    if (colorInterval) { clearInterval(colorInterval); colorInterval = null; }
    if (autoplayCheckInterval) { clearInterval(autoplayCheckInterval); autoplayCheckInterval = null; }
    blockedWatchId = null;
    if (timerEl) { timerEl.remove(); timerEl = null; }
    if (bunnyEl) { bunnyEl.remove(); bunnyEl = null; }
    finalOverlay = null;
    document.documentElement.classList.remove('adhd-block-autoplay');
    if (video) {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('play', blockPlay);
    }
    isProgrammaticPause = false;
    lastTimeUpdate = 0;
    greetingShown = false;
    bunnyShowing = false;
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ADHD_TIMER_START') {
      init(message.data);
    } else if (message.type === 'ADHD_TIMER_STOP') {
      state = null;
      cleanup();
    } else if (message.type === 'ADHD_EPISODE_CHANGE') {
      state = message.data;
      updateTimerDisplay();
      checkReminders();
    } else if (message.type === 'ADHD_TIMER_FINISHED') {
      state = message.data;
      if (!state.finished) {
        state.finished = true;
        saveState();
      }
      enforceFinished();
    }
  });

  // Listen for test trigger from page context
  document.addEventListener('adhd-timer-test', (e) => {
    const data = e.detail;
    chrome.storage.local.set({ adhdTimer: data }, () => {
      init(data);
    });
  });

  // Check if finished timer should reset (new calendar day)
  function checkMidnightReset(data) {
    if (!data || !data.finished) return data;
    const startDate = new Date(data.startedAt).toDateString();
    const today = new Date().toDateString();
    if (startDate === today) return data;
    data.active = true;
    data.finished = false;
    data.accumulatedTime = 0;
    data.episodesWatched = 0;
    data.remindersShown = [];
    data.startedAt = Date.now();
    chrome.storage.local.set({ adhdTimer: data });
    return data;
  }

  // Restore state on page load/refresh
  chrome.storage.local.get(['adhdTimer'], (result) => {
    const data = checkMidnightReset(result.adhdTimer);
    if (data && data.active) {
      init(data);
    }
  });
})();
