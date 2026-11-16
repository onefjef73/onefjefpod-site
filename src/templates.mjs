// Every page's HTML lives here. Text that changes often is in site.config.json
// and content/about.md, so this file rarely needs touching.

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const jsonLd = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

export function fmtDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${Math.max(m, 1)} min`;
}

export function isoDuration(sec) {
  if (!sec) return undefined;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `PT${h ? h + 'H' : ''}${m ? m + 'M' : ''}${s || (!h && !m) ? s + 'S' : ''}`;
}

const clock = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`;
};

export function makeTemplates(cfg, base, show) {
  const L = cfg.labels;
  const url = (p) => `${base}${p}`;
  const asset = (p) => `${base}${p}${cfg._fingerprints?.[p] ? `?v=${cfg._fingerprints[p]}` : ''}`;
  const abs = (p) => `${cfg.siteUrl}${p}`;
  const fmtDate = (d) => d ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: cfg.timeZone }).format(d) : '';
  const isoDate = (d) => d ? d.toISOString() : undefined;
  const epPath = (ep) => `/episode/${ep.slug}/`;
  // A photo path starting with / is a file in static/; anything else is a full web address.
  const hostPhoto = cfg.host.photo?.startsWith('/') ? asset(cfg.host.photo) : cfg.host.photo;
  const hostPhotoAbs = cfg.host.photo?.startsWith('/') ? abs(cfg.host.photo) : cfg.host.photo;

  const seriesLd = {
    '@type': 'PodcastSeries',
    '@id': abs('/#podcast'),
    name: show.title || cfg.showName,
    url: abs('/'),
    description: show.description || cfg.tagline,
    image: show.image || abs('/img/logo.jpg'),
    inLanguage: cfg.language,
    webFeed: cfg.feedUrl,
    sameAs: [...cfg.listen.filter((l) => !/rss/i.test(l.name)).map((l) => l.url), ...cfg.socialAll.map((l) => l.url)],
    publisher: { '@type': 'Person', '@id': abs('/about/#host'), name: cfg.host.name },
    author: { '@type': 'Person', '@id': abs('/about/#host'), name: cfg.host.name, url: abs('/about/') },
  };

  function layout({ title, description, path, body, image, type = 'website', ld = [], noindex = false, pageClass = '', head = '', card = 'summary_large_image' }) {
    const canonical = abs(path);
    const img = image || abs('/img/og-default.jpg');
    const graph = { '@context': 'https://schema.org', '@graph': ld };
    return `<!doctype html>
<html lang="${esc(cfg.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="${esc(cfg.showName)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="${card}">
<meta property="og:locale" content="en_US">
${head}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.showName)}" href="${esc(cfg.feedUrl)}">
<link rel="icon" href="${url('/favicon.ico')}" sizes="48x48">
<link rel="icon" type="image/png" href="${url('/img/icon-192.png')}" sizes="192x192">
<link rel="apple-touch-icon" href="${url('/img/apple-touch-icon.png')}">
<link rel="manifest" href="${url('/site.webmanifest')}">
<meta name="theme-color" content="#efefef">
<script>(function(){var t='light';try{if(localStorage.getItem('theme')==='dark')t='dark'}catch(e){}document.documentElement.dataset.theme=t})()</script>
<link rel="stylesheet" href="${asset('/styles.css')}">
${ld.length ? jsonLd(graph) : ''}
</head>
<body class="${pageClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="${url('/')}" aria-label="${esc(cfg.showName)} home">${esc(cfg.showName)}</a>
  <nav aria-label="Main">
    <a href="${url('/episodes/')}">episodes</a>
    <a href="${url('/about/')}">about</a>
    <a href="${url('/listen/')}">listen</a>
    ${cfg.support?.url ? `<a class="nav-support" href="${esc(cfg.support.url)}" rel="noopener">patreon</a>` : ''}
    <a href="${url('/game/')}">game</a>
  </nav>
  <button class="theme" type="button" aria-label="Switch between light and dark" title="Switch between light and dark">
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>
  </button>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-map" aria-hidden="true"></div>
  <div class="foot-in">
    <div class="foot-col">
      <p class="foot-brand">${esc(cfg.showName)}</p>
      <p>${esc(cfg.tagline)}</p>
      ${cfg.contact?.email ? `<p><a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a></p>` : ''}
      ${cfg.contact?.voicemail ? `<p>Leave a voicemail: <a href="tel:+${esc(cfg.contact.voicemail.replace(/\D/g, ''))}">${esc(cfg.contact.voicemail)}</a></p>` : ''}
    </div>
    <div class="foot-col">
      <ul class="plain">${cfg.listen.map((l) => `<li><a href="${esc(l.url)}" rel="noopener">${esc(l.name)}</a></li>`).join('')}</ul>
    </div>
    <div class="foot-col">
      <ul class="plain">${cfg.social.map((l) => `<li><a href="${esc(l.url)}" rel="noopener me">${esc(l.name)}</a></li>`).join('')}</ul>
    </div>
  </div>
  <p class="foot-legal">© ${cfg.copyrightStartYear && cfg.copyrightStartYear < new Date().getFullYear() ? `${cfg.copyrightStartYear} - ` : ''}${new Date().getFullYear()} ${esc((cfg.copyright || show.copyright || cfg.host.name).replace(/^(copyright|©|\(c\))\s*(\d{4})?\s*/i, ''))}</p>
</footer>
<script src="${asset('/app.js')}" defer></script>
</body>
</html>
`;
  }

  const thumb = (ep, eager) => {
    if (!ep.thumb) return '';
    const src = ep.thumb.startsWith('/') ? url(ep.thumb) : ep.thumb;
    return `<img class="thumb" src="${esc(src)}" width="480" height="480" alt=""${eager ? '' : ' loading="lazy"'}>`;
  };
  const epLabel = (ep) => ep.number != null ? `<span class="row-num">Episode ${ep.number}</span>`
    : ep.type === 'bonus' ? '<span class="row-num">Bonus</span>' : ep.type === 'trailer' ? '<span class="row-num">Trailer</span>' : '';

  const epNumber = (ep) => ep.number != null ? `<span class="num">${ep.number}</span>` : `<span class="num num-none" aria-hidden="true">+</span>`;

  const metaLine = (ep, labelShown = false) => [
    ep.date ? `<time datetime="${isoDate(ep.date)}">${fmtDate(ep.date)}</time>` : '',
    ep.seconds ? `<span>${fmtDuration(ep.seconds)}</span>` : '',
    labelShown ? '' : ep.type === 'trailer' ? '<span>Trailer</span>' : ep.type === 'bonus' ? '<span>Bonus</span>' : '',
  ].filter(Boolean).join('');

  const row = (ep) => `<li class="row${ep.thumb ? ' has-thumb' : ''}">
  <a href="${url(epPath(ep))}">
    ${ep.thumb ? thumb(ep) : epNumber(ep)}
    <span class="row-main">
      ${ep.thumb ? epLabel(ep) : ''}
      <span class="row-title">${esc(ep.title)}</span>
      <span class="row-meta">${metaLine(ep, !!ep.thumb)}</span>
      ${ep.lead.map((t) => `<span class="row-ex">${esc(t)}</span>`).join('')}
    </span>
  </a>
</li>`;

  const player = (ep) => ep.audio ? `<div class="player" data-player>
  <audio preload="none" src="${esc(ep.audio)}"${ep.seconds ? ` data-duration="${ep.seconds}"` : ''}></audio>
  <button class="p-play" type="button" data-play aria-label="Play ${esc(ep.title)}">
    <svg class="i-play" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M7 4v16l14-8z" fill="currentColor"/></svg>
    <svg class="i-pause" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>
  </button>
  <div class="p-body">
    <input class="p-seek" type="range" min="0" max="${ep.seconds || 100}" value="0" step="1" data-seek aria-label="Position in episode">
    <div class="p-row">
      <span class="p-time"><span data-now>0:00</span> / <span data-total>${ep.seconds ? clock(ep.seconds) : '–:––'}</span></span>
      <span class="p-ctl">
        <button type="button" data-skip="-15" aria-label="Back 15 seconds">−15</button>
        <button type="button" data-skip="30" aria-label="Forward 30 seconds">+30</button>
        <button type="button" data-speed aria-label="Playback speed">1×</button>
      </span>
    </div>
  </div>
</div>` : '';

  const listenButtons = () => `<ul class="btns">${cfg.listen.map((l) =>
    `<li><a class="btn" href="${esc(l.url)}" rel="noopener">${esc(l.name)}</a></li>`).join('')}</ul>`;

  const supportBand = () => cfg.support?.url ? `<section class="band news">
  <div class="wrap">
    <h2 class="news-h">${esc(cfg.support.heading)}</h2>
    ${cfg.support.body ? `<p class="news-p">${esc(cfg.support.body)}</p>` : ''}
    <a class="btn btn-solid" href="${esc(cfg.support.url)}" rel="noopener">${esc(cfg.support.button)}</a>
  </div>
</section>` : '';

  function home(episodes, aboutShort) {
    const latest = episodes[0];
    const rest = episodes.slice(1, 1 + cfg.homeEpisodeCount);
    const body = `<section class="hero">
  <h1 class="hero-card">
    <span class="only-light">
      <img class="hc-wide" src="${asset('/img/hero-wide-2400.webp')}" width="2400" height="870" alt="${esc(cfg.showName)} ${esc(cfg.parenthetical)}" fetchpriority="high">
      <img class="hc-square" src="${asset('/img/hero-square-1600.webp')}" width="1600" height="840" alt="${esc(cfg.showName)} ${esc(cfg.parenthetical)}" loading="lazy">
    </span>
    <span class="only-dark">
      <img class="hc-wide" src="${asset('/img/hero-wide-dark-2400.webp')}" width="2400" height="870" alt="${esc(cfg.showName)} ${esc(cfg.parenthetical)}" loading="lazy">
      <img class="hc-square" src="${asset('/img/hero-square-dark-1600.webp')}" width="1600" height="840" alt="${esc(cfg.showName)} ${esc(cfg.parenthetical)}" loading="lazy">
    </span>
  </h1>
</section>
${latest ? `<section class="latest wrap" aria-labelledby="latest-h">
  <div class="card">
    <h2 class="paren" id="latest-h">${esc(L.latest)}</h2>
    <div class="card-grid">
      ${latest.thumb ? `<a class="card-thumb" href="${url(epPath(latest))}" tabindex="-1" aria-hidden="true">${thumb(latest, true)}</a>` : ''}
      <div>
        <p class="card-meta">${latest.number != null ? `<span>Episode ${latest.number}</span>` : ''}${metaLine(latest)}</p>
        <h3 class="card-title"><a href="${url(epPath(latest))}">${esc(latest.title)}</a></h3>
        ${latest.lead.map((t) => `<p class="card-ex">${esc(t)}</p>`).join('')}
      </div>
    </div>
    ${player(latest)}
    <p class="card-more"><a href="${url(epPath(latest))}">Show notes and transcript</a></p>
  </div>
</section>` : ''}
<section class="wrap block" aria-labelledby="eps-h">
  <h2 class="paren" id="eps-h">${esc(L.episodes)}</h2>
  <ol class="rows" reversed>${rest.map(row).join('\n')}</ol>
  <p class="more"><a class="btn" href="${url('/episodes/')}">All ${episodes.length} episodes</a></p>
</section>
<section class="band about-band" aria-labelledby="about-h">
  <div class="wrap two">
    <div>
      <h2 class="paren" id="about-h">${esc(L.about)}</h2>
      <div class="lede">${show.descriptionHtml || `<p>${esc(cfg.tagline)}</p>`}</div>
    </div>
    <div>
      <h2 class="paren">${esc(L.listen)}</h2>
      ${listenButtons()}
    </div>
  </div>
</section>
${supportBand()}`;
    return layout({
      title: `${cfg.showName}: ${cfg.tagline} (podcast)`,
      description: show.description ? show.description.slice(0, 300) : cfg.tagline,
      path: '/',
      body,
      pageClass: 'is-home',
      ld: [
        { '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: cfg.showName, inLanguage: cfg.language },
        seriesLd,
      ],
    });
  }

  function episodeList(pageEps, page, pages, total) {
    const path = page === 1 ? '/episodes/' : `/episodes/${page}/`;
    const pageUrl = (n) => url(n === 1 ? '/episodes/' : `/episodes/${n}/`);
    const nav = pages > 1 ? `<nav class="pager" aria-label="Episode pages">
  ${page > 1 ? `<a class="btn" href="${pageUrl(page - 1)}" rel="prev">Newer</a>` : '<span></span>'}
  <ol>${Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
    n === page ? `<li><span aria-current="page">${n}</span></li>` : `<li><a href="${pageUrl(n)}">${n}</a></li>`).join('')}</ol>
  ${page < pages ? `<a class="btn" href="${pageUrl(page + 1)}" rel="next">Older</a>` : '<span></span>'}
</nav>` : '';
    const body = `<section class="wrap block page-top">
  <h1 class="paren big">${esc(L.episodes)}</h1>
  <ol class="rows" reversed>${pageEps.map(row).join('\n')}</ol>
  ${nav}
</section>`;
    return layout({
      title: `Episodes${page > 1 ? `, page ${page}` : ''} | ${cfg.showName}`,
      description: `Every episode of ${cfg.showName}: ${cfg.tagline}.${page > 1 ? ` Page ${page} of ${pages}.` : ''}`,
      path,
      body,
      ld: [
        seriesLd,
        { '@type': 'ItemList', itemListElement: pageEps.map((e, i) => ({ '@type': 'ListItem', position: (page - 1) * pageEps.length + i + 1, url: abs(epPath(e)), name: e.title })) },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.showName, item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Episodes', item: abs('/episodes/') },
        ] },
      ],
    });
  }

  function episode(ep, { newer, older, transcriptHtml, extra }) {
    const path = epPath(ep);
    const paren = extra?.parenthetical ? `<p class="ep-paren">${esc(extra.parenthetical)}</p>` : '';
    const video = extra?.youtube ? `<section class="ep-sec" aria-labelledby="watch-h">
    <h2 class="paren" id="watch-h">${esc(L.watch)}</h2>
    <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(extra.youtube)}" title="${esc(ep.title)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
  </section>` : '';
    const shareUrl = encodeURIComponent(abs(path));
    const body = `<article class="ep wrap">
  <header class="ep-head page-top">
    <p class="crumb"><a href="${url('/episodes/')}">All episodes</a></p>
    <div class="ep-top${ep.thumb ? ' has-thumb' : ''}">
      ${ep.thumb ? thumb(ep, true).replace('alt=""', `alt="Artwork for ${esc(ep.title)}"`) : epNumber(ep)}
      <div>
        ${paren}
        <h1 class="ep-title">${esc(ep.title)}</h1>
        <p class="row-meta">${ep.thumb && ep.number != null ? `<span>Episode ${ep.number}</span>` : ''}${metaLine(ep)}</p>
      </div>
    </div>
    ${player(ep)}
    <ul class="btns small">${cfg.listen.filter((l) => !/rss/i.test(l.name)).map((l) =>
      `<li><a class="btn" href="${esc(l.url)}" rel="noopener">${esc(l.name)}</a></li>`).join('')}
      <li><button class="btn" type="button" data-share data-url="${esc(abs(path))}" data-title="${esc(ep.title)}">Copy link</button></li>
    </ul>
  </header>
  ${video}
  <section class="ep-sec" aria-labelledby="notes-h">
    <h2 class="paren" id="notes-h">${esc(L.notes)}</h2>
    <div class="prose">${ep.notesHtml || '<p>No show notes for this episode.</p>'}</div>
  </section>
  ${transcriptHtml ? `<section class="ep-sec" aria-labelledby="tr-h">
    <h2 class="paren" id="tr-h">${esc(L.transcript)}</h2>
    <div class="prose transcript" id="transcript" data-clamp>${transcriptHtml}</div>
    <button class="btn" type="button" data-expand aria-controls="transcript" hidden>Read the full transcript</button>
  </section>` : ''}
  <nav class="ep-nav" aria-label="More episodes">
    ${older ? `<a href="${url(epPath(older))}" rel="prev"><span>Previous episode</span><strong>${esc(older.title)}</strong></a>` : '<span></span>'}
    ${newer ? `<a class="next" href="${url(epPath(newer))}" rel="next"><span>Next episode</span><strong>${esc(newer.title)}</strong></a>` : '<span></span>'}
  </nav>
</article>
${supportBand()}`;
    const image = ep.image || show.image || abs('/img/og-default.jpg');
    return layout({
      title: `${ep.title}${ep.number != null ? ` (Ep. ${ep.number})` : ''} | ${cfg.showName}`,
      description: ep.excerpt || `${ep.title}, an episode of ${cfg.showName}.`,
      path,
      body,
      image,
      type: 'article',
      card: 'summary',
      head: [
        ep.date ? `<meta property="article:published_time" content="${isoDate(ep.date)}">` : '',
        ep.audio ? `<meta property="og:audio" content="${esc(ep.audio)}">\n<meta property="og:audio:type" content="${esc(ep.audioType)}">` : '',
      ].filter(Boolean).join('\n'),
      ld: [
        {
          '@type': 'PodcastEpisode',
          '@id': abs(path) + '#episode',
          url: abs(path),
          name: ep.title,
          description: ep.summary ? ep.summary.slice(0, 500) : undefined,
          datePublished: isoDate(ep.date),
          episodeNumber: ep.number ?? undefined,
          duration: isoDuration(ep.seconds),
          timeRequired: isoDuration(ep.seconds),
          image,
          inLanguage: cfg.language,
          thumbnailUrl: image,
          author: { '@type': 'Person', '@id': abs('/about/#host'), name: cfg.host.name },
          isAccessibleForFree: true,
          partOfSeries: { '@id': abs('/#podcast') },
          associatedMedia: ep.audio ? { '@type': 'AudioObject', contentUrl: ep.audio, encodingFormat: ep.audioType, duration: isoDuration(ep.seconds) } : undefined,
        },
        seriesLd,
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.showName, item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Episodes', item: abs('/episodes/') },
          { '@type': 'ListItem', position: 3, name: ep.title, item: abs(path) },
        ] },
      ],
    });
  }

  function about(aboutHtml) {
    const body = `<section class="wrap block page-top">
  <h1 class="paren big">${esc(L.about)}</h1>
  <div class="two">
    <div>
      <h2 class="h-plain">The show</h2>
      <div class="lede">${show.descriptionHtml || `<p>${esc(cfg.tagline)}</p>`}</div>
      <h2 class="h-plain">${esc(cfg.host.name)}</h2>
      <div class="prose">${aboutHtml}</div>
    </div>
    <aside>
      ${cfg.host.photo ? `<img class="host-photo" src="${esc(hostPhoto)}" alt="${esc(cfg.host.name)}" width="480" height="480" loading="lazy">` : ''}
      <ul class="plain contact">
        ${cfg.contact?.email ? `<li><a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a></li>` : ''}
        ${cfg.contact?.voicemail ? `<li>Voicemail: <a href="tel:+${esc(cfg.contact.voicemail.replace(/\D/g, ''))}">${esc(cfg.contact.voicemail)}</a></li>` : ''}
        ${cfg.host.website ? `<li><a href="${esc(cfg.host.website)}" rel="noopener me">${esc(cfg.host.website.replace(/^https?:\/\//, ''))}</a></li>` : ''}
      </ul>
    </aside>
  </div>
</section>
${supportBand()}`;
    return layout({
      title: `About ${cfg.showName} and ${cfg.host.name}`,
      description: `About ${cfg.showName}, a podcast about ${cfg.tagline.toLowerCase()}, and its host, ${cfg.host.name}.`,
      path: '/about/',
      body,
      ld: [
        seriesLd,
        { '@type': 'Person', '@id': abs('/about/#host'), name: cfg.host.name, url: abs('/about/'), image: hostPhotoAbs || undefined,
          sameAs: [cfg.host.website, ...cfg.socialAll.map((s) => s.url)].filter(Boolean) },
      ],
    });
  }

  function listen() {
    const body = `<section class="wrap block page-top">
  <h1 class="paren big">${esc(L.listen)}</h1>
  <h2 class="h-plain">Pick your podcast app</h2>
  ${listenButtons()}
  <h2 class="h-plain">Follow along</h2>
  <ul class="btns">${cfg.social.map((l) => `<li><a class="btn" href="${esc(l.url)}" rel="noopener me">${esc(l.name)}</a></li>`).join('')}</ul>
</section>
${supportBand()}`;
    return layout({
      title: `Listen to ${cfg.showName} on Apple Podcasts, Spotify and more`,
      description: `Where to listen to ${cfg.showName}: ${cfg.listen.map((l) => l.name).join(', ')}.`,
      path: '/listen/',
      body,
      ld: [seriesLd],
    });
  }

  function game() {
    const body = `<section class="wrap block page-top">
  <h1 class="paren big">(ONE F)</h1>
  <div class="game-cols">
    <div class="game" data-game>
      <canvas tabindex="0" aria-label="One F, a game. Move left and right to catch exactly one falling letter f."></canvas>
      <div class="game-overlay" data-game-overlay>
        <p class="game-title" data-game-title>(ONE F)</p>
        <p class="game-line" data-game-line>Jef has one f. Keep it that way.</p>
        <button class="btn btn-solid" type="button" data-game-start>Play</button>
      </div>
    </div>
    <div class="game-side">
      <p class="game-how">You are Je. Catch one falling f. Only one. Move with your mouse, your finger, or the arrow keys.</p>
      <ul class="game-key">
        <li><strong>f</strong> Catch one. Dodge the rest.</li>
        <li><strong>( )</strong> Parentheses save you from one extra f.</li>
        <li><strong>ph</strong> Makes you Jeph. Everything goes backwards for a bit.</li>
      </ul>
      <p class="game-score">Seconds as Jef: <strong data-game-score>0</strong> <span>Best: <strong data-game-best>0</strong></span></p>
    </div>
  </div>
</section>
<script src="${asset('/game.js')}" defer></script>`;
    return layout({
      title: `One F, a small game | ${cfg.showName}`,
      description: `A small, pointless game from ${cfg.showName}. Catch one f. Only one.`,
      path: '/game/',
      body,
    });
  }

  function notFound(episodes) {
    const body = `<section class="wrap block page-top">
  <h1 class="paren big">(404)</h1>
  <p class="lede">That page isn't here. The episodes are.</p>
  <ol class="rows" reversed>${episodes.slice(0, 5).map(row).join('\n')}</ol>
  <p class="more"><a class="btn" href="${url('/episodes/')}">All episodes</a></p>
</section>`;
    return layout({ title: `Page not found | ${cfg.showName}`, description: 'Page not found.', path: '/404.html', body, noindex: true });
  }

  function redirect(target) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Redirecting…</title>
<meta name="robots" content="noindex"><link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0; url=${esc(target)}"></head>
<body><p><a href="${esc(target)}">Continue to ${esc(target)}</a></p></body></html>`;
  }

  return { home, episodeList, episode, about, listen, game, notFound, redirect, epPath };
}
