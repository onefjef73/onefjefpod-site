// Small enhancements: theme switch, audio player, transcript expander, copy link.
(function () {
  var root = document.documentElement;

  // Theme switch: the site opens in light; a visitor's choice of dark is remembered.
  var themeBtn = document.querySelector('.theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.dataset.theme || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    });
  }

  function clock(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Audio player
  var speeds = [1, 1.25, 1.5, 2, 0.8];
  document.querySelectorAll('[data-player]').forEach(function (el) {
    var audio = el.querySelector('audio');
    var play = el.querySelector('[data-play]');
    var seek = el.querySelector('[data-seek]');
    var now = el.querySelector('[data-now]');
    var total = el.querySelector('[data-total]');
    var speedBtn = el.querySelector('[data-speed]');
    var label = play.getAttribute('aria-label');
    var seeking = false, speedIdx = 0;

    function duration() {
      return isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(audio.dataset.duration) || 0;
    }
    function setDuration() {
      var d = duration();
      if (d) { seek.max = Math.floor(d); total.textContent = clock(d); }
    }
    play.addEventListener('click', function () {
      if (audio.paused) {
        document.querySelectorAll('audio').forEach(function (a) { if (a !== audio) a.pause(); });
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        audio.pause();
      }
    });
    audio.addEventListener('play', function () {
      el.classList.add('is-playing');
      play.setAttribute('aria-label', label.replace(/^Play/, 'Pause'));
    });
    audio.addEventListener('pause', function () {
      el.classList.remove('is-playing');
      play.setAttribute('aria-label', label);
    });
    audio.addEventListener('loadedmetadata', setDuration);
    audio.addEventListener('durationchange', setDuration);
    audio.addEventListener('timeupdate', function () {
      if (!seeking) seek.value = Math.floor(audio.currentTime);
      now.textContent = clock(audio.currentTime);
    });
    audio.addEventListener('error', function () {
      if (el.querySelector('.p-err')) return;
      var p = document.createElement('p');
      p.className = 'p-err';
      p.textContent = "The audio didn't load. Check your connection and press play again, or listen in your podcast app.";
      el.querySelector('.p-body').appendChild(p);
    });
    seek.addEventListener('input', function () { seeking = true; now.textContent = clock(seek.value); });
    seek.addEventListener('change', function () { audio.currentTime = Number(seek.value); seeking = false; });
    el.querySelectorAll('[data-skip]').forEach(function (b) {
      b.addEventListener('click', function () {
        var d = duration() || Infinity;
        audio.currentTime = Math.min(Math.max(0, audio.currentTime + Number(b.dataset.skip)), d);
      });
    });
    speedBtn.addEventListener('click', function () {
      speedIdx = (speedIdx + 1) % speeds.length;
      audio.playbackRate = speeds[speedIdx];
      speedBtn.textContent = speeds[speedIdx] + '×';
    });
  });

  // Long transcripts start folded; the full text is always in the page.
  document.querySelectorAll('[data-clamp]').forEach(function (box) {
    var btn = box.parentNode.querySelector('[data-expand]');
    if (!btn || box.scrollHeight < 720) return;
    box.classList.add('is-clamped');
    btn.hidden = false;
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', function () {
      box.classList.remove('is-clamped');
      btn.hidden = true;
    });
  });

  // Copy link
  document.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.dataset.url, original = btn.textContent;
      function done(text) { btn.textContent = text; setTimeout(function () { btn.textContent = original; }, 2000); }
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) {
        navigator.share({ title: btn.dataset.title, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { done('Link copied'); }, function () { done(url); });
      } else {
        done(url);
      }
    });
  });
})();
