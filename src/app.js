// Small enhancements: theme switch, audio player, transcript expander, copy link.
(function () {
  var root = document.documentElement;

  // Theme switch: a visitor's own choice is remembered and wins over the system setting.
  var themeBtn = document.querySelector('.theme');
  var themeKey = themeBtn ? themeBtn.dataset.themeKey || 'theme' : 'theme';
  function savedTheme() { try { return localStorage.getItem(themeKey); } catch (e) { return null; } }
  // Until a visitor presses the switch, the site follows their phone or computer's
  // light/dark setting, including when it changes (for example at sunset).
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var follow = function () { if (!savedTheme()) root.dataset.theme = mq.matches ? 'dark' : 'light'; };
    if (mq.addEventListener) mq.addEventListener('change', follow); else if (mq.addListener) mq.addListener(follow);
  }
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(themeKey, next); } catch (e) { /* private mode */ }
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
      (speedBtn.querySelector('[data-speed-val]') || speedBtn).textContent = speeds[speedIdx] + '×';
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

  // Share or embed dialog
  var dlg = document.getElementById('share-dialog');
  if (dlg && dlg.showModal) {
    var openBtn = document.querySelector('[data-share-open]');
    var code = dlg.querySelector('[data-embed-code]');
    var preview = dlg.querySelector('[data-embed-preview]');
    var native = dlg.querySelector('[data-native-share]');
    var baseSrc = code.dataset.embedSrc;
    openBtn.addEventListener('click', function () { dlg.showModal(); });
    dlg.querySelector('[data-share-close]').addEventListener('click', function () { dlg.close(); openBtn.focus(); });
    // Clicking the dimmed area outside the box closes it.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.querySelectorAll('[data-embed-theme]').forEach(function (r) {
      r.addEventListener('change', function () {
        var src = baseSrc + (r.value ? '?theme=' + r.value : '');
        code.value = code.value.replace(/src="[^"]*"/, 'src="' + src + '"');
        preview.src = src.replace(/^https?:\/\/[^/]+/, '');
      });
    });
    dlg.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var field = btn.parentNode.querySelector('input'), original = btn.textContent;
        function done(text) { btn.textContent = text; setTimeout(function () { btn.textContent = original; }, 2000); }
        field.select();
        if (navigator.clipboard) navigator.clipboard.writeText(field.value).then(function () { done('Copied'); }, function () { done('Press Cmd+C'); });
        else done('Press Cmd+C');
      });
    });
    dlg.querySelectorAll('input[readonly]').forEach(function (f) { f.addEventListener('focus', function () { f.select(); }); });
    if (native && navigator.share) {
      native.hidden = false;
      native.addEventListener('click', function () { navigator.share({ title: native.dataset.title, url: native.dataset.url }).catch(function () {}); });
    }
  }
})();
