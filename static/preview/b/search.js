// Search page: looks through every episode's title, description, show notes and transcript.
// Everything runs in the visitor's browser from two small files the build writes.
(function () {
  var me = document.currentScript;
  var base = me.dataset.base || '';
  var form = document.querySelector('[data-search-form]');
  var input = form.querySelector('input');
  var status = document.querySelector('[data-search-status]');
  var list = document.querySelector('[data-search-results]');
  var episodes = null, transcripts = null, timer = 0;

  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function terms(q) {
    // "tacos" also finds "taco"; "stories" finds "story".
    return fold(q).split(/[^a-z0-9']+/).filter(function (w) { return w.length > 1 || /\d/.test(w); })
      .map(function (w) { return w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) : w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w; });
  }
  // A short piece of text around the first match, with the matches marked.
  function snippet(text, words) {
    var f = fold(text), at = -1;
    for (var i = 0; i < words.length && at < 0; i++) at = f.indexOf(words[i]);
    if (at < 0) return '';
    var start = Math.max(0, at - 90), end = Math.min(text.length, at + 160);
    while (start > 0 && text[start] !== ' ') start--;
    while (end < text.length && text[end] !== ' ') end++;
    var piece = text.slice(start, end).trim();
    var out = esc(piece);
    words.forEach(function (w) {
      var re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return (start > 0 ? '…' : '') + out + (end < text.length ? '…' : '');
  }
  function has(hay, words) {
    for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    return true;
  }

  function run() {
    var q = input.value.trim();
    var url = new URL(location.href);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
    list.innerHTML = '';
    var words = terms(q);
    if (!words.length) { status.textContent = 'Search every episode title, description, show note and transcript.'; return; }
    if (!episodes) { status.textContent = 'Loading…'; return; }
    var hits = [];
    episodes.forEach(function (ep) {
      var title = fold(ep.t + ' ' + ep.k), desc = fold(ep.x), notes = fold(ep.o);
      var tr = transcripts && transcripts[ep.s] ? transcripts[ep.s] : '';
      var trf = tr ? fold(tr) : '';
      var all = title + ' ' + desc + ' ' + notes + ' ' + trf;
      if (!has(all, words)) return;
      var score = 0, where = '';
      words.forEach(function (w) {
        if (title.indexOf(w) >= 0) score += 100;
        else if (desc.indexOf(w) >= 0) score += 30;
        else if (notes.indexOf(w) >= 0) score += 15;
        else score += 5;
        if (trf) score += Math.min(10, trf.split(w).length - 1);
      });
      if (!has(title + ' ' + desc, words)) {
        if (has(notes, words) || !trf) where = '<span class="hit-where">In the show notes:</span> ' + snippet(ep.o, words);
        else where = '<span class="hit-where">In the transcript:</span> ' + snippet(tr, words);
      }
      hits.push({ ep: ep, score: score, where: where });
    });
    hits.sort(function (a, b) { return b.score - a.score || (b.ep.n || 0) - (a.ep.n || 0); });
    var note = transcripts ? '' : ' Still loading the transcripts, so there may be more in a moment.';
    status.textContent = hits.length ? hits.length + (hits.length === 1 ? ' episode' : ' episodes') + ' found.' + note : 'Nothing found for “' + q + '”.' + note;
    list.innerHTML = hits.slice(0, 60).map(function (h) {
      var ep = h.ep, href = base + '/episode/' + ep.s + '/';
      var meta = [ep.k ? '<span class="kind">' + esc(ep.k) + '</span>' : '', ep.d ? '<span>' + esc(ep.d) + '</span>' : '', ep.m ? '<span>' + ep.m + ' min</span>' : ''].join('');
      return '<li class="row"><a class="row-art" href="' + href + '" tabindex="-1" aria-hidden="true"><img class="thumb" src="' + esc(ep.i) + '" width="480" height="480" alt="" loading="lazy"></a>' +
        '<div class="row-main"><p class="meta">' + meta + '</p><h3 class="row-title"><a href="' + href + '">' + esc(ep.t) + '</a></h3>' +
        '<p class="row-ex">' + (h.where || snippet(ep.x, terms(q)) || esc(ep.x)) + '</p></div></li>';
    }).join('');
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.value = new URLSearchParams(location.search).get('q') || '';

  fetch(me.dataset.index).then(function (r) { return r.json(); }).then(function (data) {
    episodes = data; run();
    return fetch(me.dataset.transcripts).then(function (r) { return r.json(); });
  }).then(function (data) { transcripts = data; if (input.value.trim()) run(); })
    .catch(function () { if (!episodes) status.textContent = 'Search didn’t load. Check your connection and reload the page.'; });
})();
