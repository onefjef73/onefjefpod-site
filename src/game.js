// (ONE F) — a small, pointless onefjef game.
// You are "Je". Catch one falling f to become "Jef". Catch a second and you
// are "Jeff", which is someone else. Every so often you sneeze and lose it.
// Parentheses protect you once. A "ph" makes you "Jeph" and flips your controls.
(function () {
  var box = document.querySelector('[data-game]');
  if (!box) return;
  var canvas = box.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var overlay = box.querySelector('[data-game-overlay]');
  var titleEl = box.querySelector('[data-game-title]');
  var lineEl = box.querySelector('[data-game-line]');
  var btn = box.querySelector('[data-game-start]');
  var scoreEl = box.parentNode.querySelector('[data-game-score]');
  var bestEl = box.parentNode.querySelector('[data-game-best]');
  var FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var NEED = 7;            // seconds you may go without an f
  var LEVEL_EVERY = 12;    // seconds as Jef per level
  var W = 0, H = 0, dpr = 1;
  var running = false, last = 0, raf = 0;
  var p, drops, flashes, flown, spawnIn, extraIn, windIn, wind, level;
  var keys = {};
  var best = 0;
  try { best = Number(localStorage.getItem('onef-best')) || 0; } catch (e) { /* no storage */ }
  bestEl.textContent = best;

  function colors() {
    var s = getComputedStyle(document.documentElement);
    return { ink: s.getPropertyValue('--ink').trim() || '#000', accent: s.getPropertyValue('--accent').trim() || '#9c2626', soft: s.getPropertyValue('--soft').trim() || '#555' };
  }
  function size() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function unit() { return Math.max(26, Math.min(W, H) * 0.1); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function say(text, secs) { flashes.push({ text: text, t: secs || 0.9 }); if (flashes.length > 2) flashes.shift(); }

  function reset() {
    p = { x: W / 2, input: W / 2, hasF: false, shield: false, jeph: 0, need: NEED, sneezeIn: 0, time: 0, score: 0 };
    drops = []; flashes = []; flown = null; spawnIn = 0.4; extraIn = rand(5, 8); windIn = rand(18, 24); wind = { v: 0, t: 0 }; level = 1;
    scoreEl.textContent = '0';
  }
  function start() {
    size(); reset();
    overlay.hidden = true; running = true; last = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    canvas.focus();
  }
  function end(title, line) {
    running = false;
    if (p.score > best) { best = p.score; try { localStorage.setItem('onef-best', String(best)); } catch (e) { /* no storage */ } }
    bestEl.textContent = best;
    titleEl.textContent = title;
    lineEl.textContent = line + ' You lasted ' + p.score + (p.score === 1 ? ' second' : ' seconds') + ' as Jef and reached level ' + level + '.';
    btn.textContent = 'Play again';
    overlay.hidden = false; btn.focus();
  }

  function word() {
    var w = p.hasF ? (p.jeph > 0 ? 'Jeph' : 'Jef') : 'Je';
    return p.shield ? '(' + w + ')' : w;
  }
  function spawn(kind, x) {
    var u = unit();
    drops.push({
      kind: kind, x: x == null ? rand(u * 0.5, W - u * 0.5) : x, y: -u,
      v: H * rand(0.26, 0.44) * (1 + (level - 1) * 0.2), r: rand(-1.2, 1.2), a: 0,
      vx: kind === 'f' && level >= 2 ? W * rand(-0.1, 0.1) * Math.min(level - 1, 3) / 2 : 0, // from level 2 they fall at a slant
    });
  }

  function tick(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000, 0.05); last = now;
    var u = unit(), c = colors();

    // movement: a "ph" turns you around for a few seconds
    var flip = p.jeph > 0;
    var speed = W * 0.95;
    if (keys.left) p.input += (flip ? 1 : -1) * speed * dt;
    if (keys.right) p.input += (flip ? -1 : 1) * speed * dt;
    p.input = Math.min(Math.max(p.input, 0), W);
    ctx.font = '700 ' + u + 'px ' + FONT;
    var pw = ctx.measureText(word()).width;
    var target = p.pointer != null ? (flip ? W - p.pointer : p.pointer) : p.input;
    if (p.pointer != null) p.input = target;
    p.x = Math.min(Math.max(target, pw / 2), W - pw / 2);
    var py = H - u * 0.45;

    // what falls
    spawnIn -= dt;
    if (spawnIn <= 0) {
      if (level >= 4 && Math.random() < 0.22) { // a row of f's with one gap to slip through
        var cols = Math.max(4, Math.floor(W / (u * 2.2))), gap = Math.floor(Math.random() * cols);
        for (var n = 0; n < cols; n++) if (n !== gap && n !== gap + 1) spawn('f', (n + 0.5) * W / cols);
        for (var q = drops.length - 1; q >= 0 && drops[q].y === -u; q--) { drops[q].v = H * 0.36 * (1 + (level - 1) * 0.12); drops[q].vx = 0; }
        say('(RAIN)', 0.8); spawnIn = 1.6;
      } else { spawn('f'); spawnIn = rand(0.7, 1.25) / (1 + (level - 1) * 0.32); }
    }
    extraIn -= dt;
    if (extraIn <= 0) {
      spawn(level >= 2 && Math.random() < 0.55 ? 'ph' : '( )');
      extraIn = rand(6, 10);
    }
    // wind, from level 3
    if (level >= 3) {
      windIn -= dt;
      if (windIn <= 0) { wind = { v: (Math.random() < 0.5 ? -1 : 1) * W * rand(0.18, 0.3), t: 3.5 }; windIn = rand(10, 16); say('(WIND)', 1.1); }
    }
    if (wind.t > 0) wind.t -= dt;
    var push = wind.t > 0 ? wind.v : 0;

    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      d.y += d.v * dt; d.a += d.r * dt; d.x += (push + d.vx) * dt;
      if (d.kind === 'ph') d.x += (p.x > d.x ? 1 : -1) * W * 0.1 * dt; // the ph comes looking for you
      if (d.x < -u) d.x = W + u; else if (d.x > W + u) d.x = -u;
      var reach = pw / 2 + u * (d.kind === 'f' ? 0.18 : 0.3);
      var hit = !d.spent && d.y > py - u * 0.75 && d.y < py + u * 0.1 && Math.abs(d.x - p.x) < reach;
      if (hit) {
        if (d.kind === 'f') {
          if (!p.hasF) { p.hasF = true; p.sneezeIn = rand(7, 12) / (1 + (level - 1) * 0.12); say('(JEF)', 0.7); drops.splice(i, 1); }
          else if (p.shield) { p.shield = false; d.spent = true; d.v = -H * 0.5; d.vx = (d.x < p.x ? -1 : 1) * W * 0.5; say('(CLOSE)', 0.7); }
          else { drops.splice(i, 1); draw(c, u, py, 'Jeff'); end('(JEFF)', 'Two f’s. That’s a different guy.'); return; }
        } else if (d.kind === '( )') {
          p.shield = true; say('(SAFE)', 0.7); drops.splice(i, 1);
        } else {
          if (p.shield) { p.shield = false; say('(CLOSE)', 0.7); }
          else { p.jeph = 5; p.hasF = true; if (!(p.sneezeIn > 0)) p.sneezeIn = rand(7, 12); say('(JEPH)', 1); }
          drops.splice(i, 1);
        }
      } else if (d.y > H + u || d.y < -u * 3) drops.splice(i, 1);
    }

    if (p.jeph > 0) p.jeph -= dt;
    if (p.hasF) {
      p.time += dt;
      var s = Math.floor(p.time);
      if (s !== p.score) { p.score = s; scoreEl.textContent = s; }
      var lv = 1 + Math.floor(p.time / LEVEL_EVERY);
      if (lv !== level) { level = lv; say('(LEVEL ' + level + ')', 1.2); }
      p.sneezeIn -= dt;
      if (p.sneezeIn <= 0) {
        p.hasF = false; p.jeph = 0; p.need = NEED; say('(SNEEZE)', 0.9);
        flown = { x: p.x + pw / 2, y: py - u * 0.3, vx: W * 0.5, vy: -H * 0.6 };
      }
    } else {
      p.need -= dt;
      if (p.need <= 0) { draw(c, u, py, p.shield ? '(Je)' : 'Je'); end('(JE)', 'No f at all. That’s not a name.'); return; }
    }
    if (flown) { flown.x += flown.vx * dt; flown.y += flown.vy * dt; flown.vy += H * 1.6 * dt; if (flown.y > H + u) flown = null; }
    for (var k = flashes.length - 1; k >= 0; k--) { flashes[k].t -= dt; if (flashes[k].t <= 0) flashes.splice(k, 1); }

    draw(c, u, py, word());
    raf = requestAnimationFrame(tick);
  }

  function draw(c, u, py, text) {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.kind === '( )' ? 0 : d.a);
      if (d.kind === 'f') { ctx.font = '700 ' + u + 'px ' + FONT; ctx.fillStyle = c.accent; ctx.fillText('f', 0, 0); }
      else if (d.kind === 'ph') { ctx.font = '700 ' + u * 0.85 + 'px ' + FONT; ctx.fillStyle = c.ink; ctx.fillText('ph', 0, 0); }
      else { ctx.font = '700 ' + u * 0.9 + 'px ' + FONT; ctx.fillStyle = c.soft; ctx.fillText('( )', 0, 0); }
      ctx.restore();
    }
    ctx.font = '700 ' + u + 'px ' + FONT;
    if (flown) { ctx.fillStyle = c.accent; ctx.fillText('f', flown.x, flown.y); }
    ctx.fillStyle = c.ink;
    ctx.fillText(text, p.x, py);
    if (!p.hasF && running) { // time left to find an f
      ctx.fillStyle = c.accent;
      ctx.fillRect(0, H - 6, W * Math.max(p.need, 0) / NEED, 6);
    }
    ctx.font = '700 ' + u * 0.5 + 'px ' + FONT; ctx.fillStyle = c.accent;
    for (var k = 0; k < flashes.length; k++) ctx.fillText(flashes[k].text, W / 2, H * 0.34 + k * u * 0.65);
    ctx.font = '700 ' + Math.max(14, u * 0.3) + 'px ' + FONT; ctx.fillStyle = c.soft; ctx.textAlign = 'right';
    ctx.fillText('Level ' + level, W - 12, 12 + Math.max(14, u * 0.3));
    ctx.textAlign = 'left'; ctx.fillText(p.score + ' s as Jef', 12, 12 + Math.max(14, u * 0.3));
  }

  function pointer(e) {
    if (!running) return;
    var r = canvas.getBoundingClientRect();
    p.pointer = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    if (e.cancelable && e.touches) e.preventDefault();
  }
  canvas.addEventListener('mousemove', pointer);
  canvas.addEventListener('touchstart', pointer, { passive: false });
  canvas.addEventListener('touchmove', pointer, { passive: false });
  function key(e, down) {
    var l = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
    var r = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
    if (!l && !r) return;
    if (l) keys.left = down;
    if (r) keys.right = down;
    if (down && running) { p.pointer = null; e.preventDefault(); }
  }
  window.addEventListener('keydown', function (e) { key(e, true); });
  window.addEventListener('keyup', function (e) { key(e, false); });
  window.addEventListener('resize', function () { if (running) size(); });
  window.addEventListener('hashchange', function () { if (running) { running = false; overlay.hidden = false; } });
  btn.addEventListener('click', start);
  // read-only peek used by the automated play-test
  box.peek = function () { return { p: p, drops: drops, level: level, W: W, H: H, running: running }; };
})();
