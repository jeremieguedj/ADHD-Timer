(() => {
  'use strict';

  // Create floating stars
  function createStars() {
    const container = document.getElementById('stars');
    const emojis = ['\u2B50', '\u2728', '\uD83C\uDF1F', '\uD83C\uDF20', '\uD83C\uDF88', '\uD83C\uDF89'];
    for (let i = 0; i < 20; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      star.style.left = `${Math.random() * 100}%`;
      star.style.fontSize = `${16 + Math.random() * 24}px`;
      star.style.animationDuration = `${4 + Math.random() * 6}s`;
      star.style.animationDelay = `${Math.random() * 5}s`;
      container.appendChild(star);
    }
  }

  // Play pre-generated audio file
  function playAudioFile(filename) {
    try {
      const url = chrome.runtime.getURL(`audio/${filename}`);
      const audio = new Audio(url);
      audio.volume = 0.8;
      audio.play().catch(() => {});
    } catch (e) { /* audio not available */ }
  }

  // Load settings and personalize
  function loadAndPersonalize() {
    chrome.storage.local.get(['adhdBunnyName', 'adhdNextActivity', 'adhdSoundEnabled'], (result) => {
      const bunnyName = result.adhdBunnyName || 'Hoppy';
      const nextActivity = result.adhdNextActivity || '';
      const soundEnabled = result.adhdSoundEnabled;

      // Personalize sub-text
      const subText = document.getElementById('sub-text');
      if (nextActivity) {
        subText.textContent = `Now it's time for ${nextActivity}!`;
      }

      // Play pre-generated goodbye audio
      if (soundEnabled) {
        setTimeout(() => playAudioFile('goodbye.wav'), 800);
      }
    });
  }

  // Parent override — hold 3s to unlock
  function setupParentOverride() {
    const btn = document.getElementById('parent-btn');
    const section = document.getElementById('parent-section');
    let holdTimer = null;

    function startHold() {
      btn.classList.add('holding');
      holdTimer = setTimeout(() => {
        btn.classList.remove('holding');
        btn.classList.add('unlocked');
        btn.textContent = 'Unlocked!';

        // Deactivate the timer
        chrome.storage.local.get(['adhdTimer'], (result) => {
          const data = result.adhdTimer || {};
          data.active = false;
          data.finished = true;
          chrome.storage.local.set({ adhdTimer: data });
        });

        // Show "Go back to Netflix" button
        const backBtn = document.createElement('button');
        backBtn.id = 'back-link';
        backBtn.textContent = 'Go back to Netflix';
        backBtn.addEventListener('click', () => {
          window.location.href = 'https://www.netflix.com';
        });
        section.appendChild(document.createElement('br'));
        section.appendChild(backBtn);
      }, 3000);
    }

    function cancelHold() {
      btn.classList.remove('holding');
      clearTimeout(holdTimer);
    }

    btn.addEventListener('mousedown', startHold);
    btn.addEventListener('mouseup', cancelHold);
    btn.addEventListener('mouseleave', cancelHold);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); });
    btn.addEventListener('touchend', cancelHold);
    btn.addEventListener('touchcancel', cancelHold);
  }

  // Set up celebration sprite animation
  function setupCelebrationSprite() {
    const bunny = document.getElementById('big-bunny');
    if (!bunny) return;
    const url = chrome.runtime.getURL('icons/bunny-celebrate-sprite.png');
    const style = document.createElement('style');
    style.textContent = `
      .bunny-sprite-celebrate {
        background: url('${url}') 0 0 no-repeat;
        background-size: 2960px 200px;
        animation: sprite-celebrate 0.8s steps(16) infinite;
      }
      @keyframes sprite-celebrate {
        to { background-position: -2960px 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Init
  setupCelebrationSprite();
  createStars();
  loadAndPersonalize();
  setupParentOverride();
})();
