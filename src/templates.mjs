// Every page's HTML lives here. Text that changes often is in site.config.json
// and content/about.md, so this file rarely needs touching.
import { readFileSync } from 'node:fs';

const ICONS = JSON.parse(readFileSync(new URL('./icons.json', import.meta.url), 'utf8'));

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

// Which brand logo goes with a link, worked out from its name or address.
const iconKey = (l) => {
  const s = `${l.name} ${l.url}`.toLowerCase();
  if (s.includes('apple')) return 'applepodcasts';
  if (s.includes('spotify')) return 'spotify';
  if (s.includes('pocket')) return 'pocketcasts';
  if (s.includes('youtube')) return 'youtube';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('substack')) return 'substack';
  if (s.includes('facebook')) return 'facebook';
  if (s.includes('patreon')) return 'patreon';
  if (s.includes('rss') || s.includes('feed')) return 'rss';
  return null;
};
const icon = (key, size = 22) => {
  const i = ICONS[key];
  if (!i) return '';
  // Black logos (TikTok, Patreon) follow the text colour so they show in dark mode too.
  const color = i.hex && i.hex !== '000000' ? ` style="color:#${i.hex}"` : '';
  return `<svg class="logo-i" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"${color}><path fill="currentColor" d="${i.path}"/></svg>`;
};

// Phone numbers in show notes (like 1-669-241-5882) never break across two lines,
// and tapping one on a phone calls it. Only text between tags is touched.
const keepPhoneTogether = (html) => html.split(/(<[^>]+>)/).map((part, i, all) => {
  if (part.startsWith('<')) return part;
  const insideLink = all.slice(0, i).reverse().find((t) => /^<\/?a[\s>]/i.test(t));
  return part.replace(/\b(1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, (num) => {
    const digits = num.replace(/\D/g, '');
    const shown = `<span class="nowrap">${num}</span>`;
    const nb = num.replace(/-/g, '\u2011');
    return insideLink && !/^<\//.test(insideLink) ? shown : `<a class="nowrap" href="tel:+${digits.length === 10 ? '1' + digits : digits}">${nb}</a>`;
  });
}).join('');

// The short "Onefjef is produced, edited & hosted by Jef Taylor." line stays on one
// line on phones; it shrinks a little on very narrow screens instead of wrapping.
const creditOneLine = (html) => html.replace(/<p>((?:(?!<\/p>).)*?produced, edited(?:(?!<\/p>).)*?)<\/p>/gs, (whole, inner) => {
  const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
  return text.length <= 56 ? `<p class="credit">${inner}</p>` : whole;
});

export function makeTemplates(cfg, base, show) {
  const design = cfg.design || 'a';
  const url = (p) => `${base}${p}`;
  const asset = (p) => `${base}${p}${cfg._fingerprints?.[p] ? `?v=${cfg._fingerprints[p]}` : ''}`;
  const abs = (p) => `${cfg.siteUrl}${p}`;
  const fmtDate = (d) => d ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: cfg.timeZone }).format(d) : '';
  const fmtShort = (d) => d ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: cfg.timeZone }).format(d) : '';
  const isoDate = (d) => d ? d.toISOString() : undefined;
  const epPath = (ep) => `/episode/${ep.slug}/`;
  // A photo path starting with / is a file in static/; anything else is a full web address.
  const hostPhoto = cfg.host.photo?.startsWith('/') ? asset(cfg.host.photo) : cfg.host.photo;
  const hostPhotoAbs = cfg.host.photo?.startsWith('/') ? abs(cfg.host.photo) : cfg.host.photo;
  const showArt = asset('/img/logo.jpg');

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

  const searchIcon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  function layout({ title, description, path, body, image, type = 'website', ld = [], noindex = false, pageClass = '', head = '', card = 'summary_large_image', current = '' }) {
    const canonical = abs(path);
    const img = image || abs('/img/og-default.jpg');
    const graph = { '@context': 'https://schema.org', '@graph': ld };
    const navItem = (href, label, key) => `<a href="${url(href)}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
    return `<!doctype html>
<html lang="${esc(cfg.language)}" class="design-${design}" data-theme="${cfg.defaultTheme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex || cfg.noindex ? '<meta name="robots" content="noindex">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'}
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
<link rel="icon" href="${asset('/favicon.ico')}" sizes="48x48">
<link rel="icon" type="image/png" href="${asset('/img/favicon.png')}" sizes="32x32">
<link rel="icon" type="image/png" href="${asset('/img/icon-192.png')}" sizes="192x192">
<link rel="apple-touch-icon" href="${asset('/img/apple-touch-icon.png')}">
<link rel="manifest" href="${url('/site.webmanifest')}">
<link rel="preload" href="${url(design === 'b' ? '/fonts/instrument-sans-latin-wght-normal.woff2' : '/fonts/archivo-latin-wght-normal.woff2')}" as="font" type="font/woff2" crossorigin>
<meta name="color-scheme" content="light dark">
<script>(function(){var r=document.documentElement,t=null;try{t=localStorage.getItem('${cfg.themeKey}')}catch(e){}
if(t!=='dark'&&t!=='light')t=${cfg.followSystemTheme === false ? `'${cfg.defaultTheme}'` : `(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'`};r.dataset.theme=t})()</script>
<link rel="stylesheet" href="${asset('/styles.css')}">
${ld.length ? jsonLd(graph) : ''}
</head>
<body class="${pageClass}">
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="${url('/')}">
      <span class="brand-name">${esc(cfg.showName)}</span>
      <span class="brand-tag">${esc(cfg.tagline)}</span>
    </a>
    <nav class="nav" aria-label="Main">
      ${navItem('/episodes/', 'Episodes', 'episodes')}
      ${navItem('/about/', 'About', 'about')}
      ${navItem('/listen/', 'Listen', 'listen')}
      ${cfg.support?.url ? `<a href="${esc(cfg.support.url)}" rel="noopener">Patreon</a>` : ''}
      ${navItem('/game/', 'Game', 'game')}
    </nav>
    <form class="top-search" action="${url('/search/')}" method="get" role="search" aria-label="Search the site">
      <label class="sr-only" for="top-q">Search episodes</label>
      ${searchIcon}
      <input id="top-q" name="q" type="search" placeholder="Search" autocomplete="off">
      <button class="sr-only" type="submit">Search</button>
    </form>
    <a class="icon-btn search-link" href="${url('/search/')}" aria-label="Search">${searchIcon}</a>
    <button class="icon-btn theme" type="button" data-theme-key="${cfg.themeKey}" aria-label="Switch between light and dark" title="Switch between light and dark">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>
    </button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="wrap foot-in">
    <div class="foot-brand">
      <a class="brand" href="${url('/')}"><span class="brand-name">${esc(cfg.showName)}</span><span class="brand-tag">${esc(cfg.tagline)}</span></a>
      ${cfg.contact?.email ? `<p><a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a></p>` : ''}
      ${cfg.contact?.voicemail ? `<p>Voicemail: <a href="tel:+${esc(cfg.contact.voicemail.replace(/\D/g, ''))}">${esc(cfg.contact.voicemail).replace(/-/g, '\u2011')}</a></p>` : ''}
    </div>
    <div class="foot-side">
      ${socialIcons()}
      <p><a href="${url('/listen/')}">All the ways to listen</a></p>
      ${cfg.guest ? `<p><a href="${url('/about/#be-on-the-show')}">${esc(cfg.guest.heading)}</a></p>` : ''}
    </div>
  </div>
  <p class="wrap foot-legal">© ${cfg.copyrightStartYear && cfg.copyrightStartYear < new Date().getFullYear() ? `${cfg.copyrightStartYear} - ` : ''}${new Date().getFullYear()} ${esc((cfg.copyright || show.copyright || cfg.host.name).replace(/^(copyright|©|\(c\))\s*(\d{4})?\s*/i, ''))}</p>
</footer>
<script src="${asset('/app.js')}" defer></script>
</body>
</html>
`;
  }

  const thumb = (ep, { eager = false, cls = 'thumb', alt = '' } = {}) => {
    const src = ep.thumb ? (ep.thumb.startsWith('/') ? url(ep.thumb) : ep.thumb) : showArt;
    return `<img class="${cls}" src="${esc(src)}" width="480" height="480" alt="${esc(alt)}"${eager ? '' : ' loading="lazy"'}>`;
  };
  const epKind = (ep) => ep.number != null ? `Episode ${ep.number}` : ep.type === 'bonus' ? 'Bonus' : ep.type === 'trailer' ? 'Trailer' : '';
  const metaLine = (ep, withKind = true, long = false) => [
    withKind && epKind(ep) ? `<span class="kind">${epKind(ep)}</span>` : '',
    ep.date ? `<time datetime="${isoDate(ep.date)}">${long ? fmtDate(ep.date) : fmtShort(ep.date)}</time>` : '',
    ep.seconds ? `<span>${fmtDuration(ep.seconds)}</span>` : '',
  ].filter(Boolean).join('');

  const row = (ep, h = 3) => `<li class="row">
  <a class="row-art" href="${url(epPath(ep))}" tabindex="-1" aria-hidden="true">${thumb(ep)}</a>
  <div class="row-main">
    <p class="meta">${metaLine(ep)}</p>
    <h${h} class="row-title"><a href="${url(epPath(ep))}">${esc(ep.title)}</a></h${h}>
    ${ep.lead.map((t) => `<p class="row-ex">${esc(t)}</p>`).join('')}
  </div>
</li>`;

  const tile = (ep, h = 3) => `<li class="tile">
  <a class="tile-art" href="${url(epPath(ep))}" tabindex="-1" aria-hidden="true">${thumb(ep)}</a>
  <p class="meta">${metaLine(ep)}</p>
  <h${h} class="tile-title"><a href="${url(epPath(ep))}">${esc(ep.title)}</a></h${h}>
  ${ep.lead.map((t) => `<p class="tile-ex">${esc(t)}</p>`).join('')}
</li>`;

  const player = (ep) => ep.audio ? `<div class="player" data-player>
  <audio preload="none" src="${esc(ep.audio)}"${ep.seconds ? ` data-duration="${ep.seconds}"` : ''}></audio>
  <button class="p-play" type="button" data-play aria-label="Play ${esc(ep.title)}">
    <svg class="i-play" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>
    <svg class="i-pause" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>
  </button>
  <div class="p-body">
    <input class="p-seek" type="range" min="0" max="${ep.seconds || 100}" value="0" step="1" data-seek aria-label="Position in episode">
    <div class="p-row">
      <span class="p-time"><span data-now>0:00</span> / <span data-total>${ep.seconds ? clock(ep.seconds) : '–:––'}</span></span>
      <span class="p-ctl">
        <button type="button" data-skip="-15" title="Back 15 seconds">−15s<span class="sr-only"> back</span></button>
        <button type="button" data-skip="30" title="Forward 30 seconds">+30s<span class="sr-only"> forward</span></button>
        <button type="button" data-speed title="Playback speed"><span data-speed-val>1×</span><span class="sr-only"> playback speed</span></button>
      </span>
    </div>
  </div>
</div>` : '';

  const listenButtons = (links = cfg.listen, cls = '') => `<ul class="logo-btns ${cls}">${links.map((l) =>
    `<li><a class="logo-btn" href="${esc(l.url)}" rel="noopener">${icon(iconKey(l))}<span>${esc(l.name)}</span></a></li>`).join('')}</ul>`;

  function socialIcons() {
    return `<ul class="social">${cfg.social.map((l) => `<li><a href="${esc(l.url)}" rel="noopener me" aria-label="${esc(cfg.showName)} on ${esc(l.name)}" title="${esc(l.name)}">${icon(iconKey(l), 20) || esc(l.name)}</a></li>`).join('')}</ul>`;
  }

  const supportBox = (cls = '') => cfg.support?.url ? `<div class="support ${cls}">
  <h2 class="support-h">${esc(cfg.support.heading)}</h2>
  ${cfg.support.body ? `<p>${esc(cfg.support.body)}</p>` : ''}
  <a class="btn btn-solid" href="${esc(cfg.support.url)}" rel="noopener">${icon('patreon', 18)}${esc(cfg.support.button)}</a>
</div>` : '';
  const supportBand = () => cfg.support?.url ? `<section class="band support-band"><div class="wrap">${supportBox()}</div></section>` : '';

  const latestBlock = (latest) => `<div class="block-head latest-head"><h2 class="block-h">Latest episode</h2></div>
<article class="latest" aria-label="Latest episode">
  <a class="latest-art" href="${url(epPath(latest))}" tabindex="-1" aria-hidden="true">${thumb(latest, { eager: true })}</a>
  <div class="latest-main">
    <p class="meta">${metaLine(latest)}</p>
    <h3 class="latest-title"><a href="${url(epPath(latest))}">${esc(latest.title)}</a></h3>
    ${latest.lead.map((t) => `<p>${esc(t)}</p>`).join('')}
  </div>
  <div class="latest-play">
    ${player(latest)}
    <p class="latest-more"><a href="${url(epPath(latest))}">Show notes and transcript</a></p>
  </div>
</article>`;

  const stars = (n) => `<span class="stars" role="img" aria-label="${n} out of 5 stars">${'★'.repeat(n)}</span>`;
  const appleReviews = cfg.listen.find((l) => /apple/i.test(l.name))?.url;
  // Real listener reviews, quoted exactly; edit the list in site.config.json.
  const reviewsBox = (cls = '') => cfg.reviews?.length ? `<section class="reviews ${cls}" aria-labelledby="reviews-h">
    <h2 class="side-h" id="reviews-h">What listeners say</h2>
    ${cfg.reviews.map((r) => `<figure class="review">
      ${stars(r.stars || 5)}
      <blockquote><p>“${esc(r.quote)}”</p></blockquote>
      <figcaption>${esc(r.name)}, ${appleReviews && /apple/i.test(r.source) ? `<a href="${esc(appleReviews)}" rel="noopener">${esc(r.source)}</a>` : esc(r.source)}</figcaption>
    </figure>`).join('')}
  </section>` : '';
  // "Be on the show": how to pitch a story or leave a voicemail.
  const guestBox = (cls = '', headingTag = 'h2', headingCls = 'side-h') => cfg.guest ? `<section class="guest ${cls}" id="be-on-the-show" aria-labelledby="guest-h">
    <${headingTag} class="${headingCls}" id="guest-h">${esc(cfg.guest.heading)}</${headingTag}>
    <p>${esc(cfg.guest.pitch)}</p>
    ${cfg.contact?.email ? `<p class="guest-line"><a class="btn small" href="mailto:${esc(cfg.contact.email)}?subject=${encodeURIComponent('Be on the show')}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>${esc(cfg.contact.email)}</a></p>` : ''}
    ${cfg.contact?.voicemail ? `<p>${esc(cfg.guest.voicemail)}</p><p class="guest-line"><a class="btn small" href="tel:+${esc(cfg.contact.voicemail.replace(/\D/g, ''))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" fill="currentColor"/></svg>${esc(cfg.contact.voicemail).replace(/-/g, '\u2011')}</a></p>` : ''}
  </section>` : '';

  const sideAbout = () => `<aside class="side">
  <section class="side-box">
    <img class="side-art" src="${showArt}" width="600" height="600" alt="${esc(cfg.showName)} ${esc(cfg.parenthetical)} artwork" loading="lazy">
    <h2 class="side-h">About the podcast</h2>
    <div class="side-desc">${show.descriptionHtml || `<p>${esc(cfg.tagline)}</p>`}</div>
    <a class="side-host" href="${url('/about/')}">
      ${cfg.host.photo ? `<img src="${esc(hostPhoto)}" width="56" height="56" alt="" loading="lazy">` : ''}
      <span>Hosted by <strong>${esc(cfg.host.name)}</strong></span>
    </a>
  </section>
  ${reviewsBox('side-box')}
  <section class="side-box">
    <h2 class="side-h">Listen for free</h2>
    ${listenButtons(cfg.listen, 'stack')}
  </section>
  <section class="side-box">
    <h2 class="side-h">Follow</h2>
    ${socialIcons()}
  </section>
  ${guestBox('side-box')}
  ${supportBox('side-box')}
</aside>`;

  function home(episodes) {
    const latest = episodes[0];
    const count = cfg.homeEpisodeCount;
    // "Start here": episodes for new listeners, by episode number, in the order listed
    // under startHere in site.config.json. A number the feed doesn't have is skipped.
    const startEps = (cfg.startHere || []).map((n) => episodes.find((e) => e.number === Number(n))).filter(Boolean);
    const startHere = (item, list) => startEps.length ? `<section class="block start-here" aria-labelledby="start-h">
  <div class="block-head">
    <h2 class="block-h" id="start-h">Start here</h2>
  </div>
  <ol class="${list}">${startEps.map((e) => item(e)).join('\n')}</ol>
</section>` : '';
    const h1 = `<h1 class="sr-only">${esc(cfg.showName)}: ${esc(cfg.tagline)}</h1>`;
    let body;
    if (design === 'b') {
      body = `${h1}
<section class="feature">
  <div class="wrap">${latest ? latestBlock(latest) : ''}</div>
</section>
${startEps.length ? `<div class="wrap">${startHere(tile, 'tiles')}</div>` : ''}
<section class="wrap block" aria-labelledby="recent-h">
  <div class="block-head">
    <h2 class="block-h" id="recent-h">Recent episodes</h2>
    <a class="block-link" href="${url('/episodes/')}">All episodes</a>
  </div>
  <ol class="tiles">${episodes.slice(1, 1 + count).map((e) => tile(e)).join('\n')}</ol>
</section>
<section class="band about-band" aria-labelledby="about-h">
  <div class="wrap about-grid">
    <div>
      <h2 class="block-h" id="about-h">About the podcast</h2>
      <div class="lede">${show.descriptionHtml || `<p>${esc(cfg.tagline)}</p>`}</div>
      <a class="side-host" href="${url('/about/')}">
        ${cfg.host.photo ? `<img src="${esc(hostPhoto)}" width="56" height="56" alt="" loading="lazy">` : ''}
        <span>Hosted by <strong>${esc(cfg.host.name)}</strong></span>
      </a>
    </div>
    <div>
      <h2 class="block-h">Listen for free</h2>
      ${listenButtons()}
      <h2 class="block-h follow-h">Follow</h2>
      ${socialIcons()}
    </div>
  </div>
</section>
${supportBand()}`;
    } else {
      body = `${h1}
<div class="wrap with-side">
  <div class="main-col">
    ${latest ? latestBlock(latest) : ''}
    ${startHere(row, 'rows')}
    <section class="block" aria-labelledby="recent-h">
      <div class="block-head">
        <h2 class="block-h" id="recent-h">More episodes</h2>
        <a class="block-link" href="${url('/episodes/')}">All episodes</a>
      </div>
      <ol class="rows">${episodes.slice(1, 1 + count).map((e) => row(e)).join('\n')}</ol>
      <p class="more"><a class="btn" href="${url('/episodes/')}">See all episodes</a></p>
    </section>
  </div>
  ${sideAbout()}
</div>`;
    }
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

  function pageHead(title, sub = '') {
    return `<header class="page-head"><h1 class="page-h">${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</header>`;
  }

  function episodeList(pageEps, page, pages) {
    const path = page === 1 ? '/episodes/' : `/episodes/${page}/`;
    const pageUrl = (n) => url(n === 1 ? '/episodes/' : `/episodes/${n}/`);
    const nav = pages > 1 ? `<nav class="pager" aria-label="Episode pages">
  ${page > 1 ? `<a class="btn" href="${pageUrl(page - 1)}" rel="prev">Newer</a>` : '<span></span>'}
  <ol>${Array.from({ length: pages }, (_, i) => i + 1).map((n) =>
    n === page ? `<li><span aria-current="page">${n}</span></li>` : `<li><a href="${pageUrl(n)}">${n}</a></li>`).join('')}</ol>
  ${page < pages ? `<a class="btn" href="${pageUrl(page + 1)}" rel="next">Older</a>` : '<span></span>'}
</nav>` : '';
    const list = design === 'b' ? `<ol class="tiles">${pageEps.map((e) => tile(e, 2)).join('\n')}</ol>` : `<ol class="rows">${pageEps.map((e) => row(e, 2)).join('\n')}</ol>`;
    const body = `<section class="wrap block${design === 'a' ? ' narrow-ish' : ''}">
  ${pageHead('Episodes')}
  <form class="search-inline" action="${url('/search/')}" method="get" role="search" aria-label="Search episodes">
    <label class="sr-only" for="list-q">Search episodes</label>
    ${searchIcon}<input id="list-q" name="q" type="search" placeholder="Search every episode and transcript" autocomplete="off"><button class="sr-only" type="submit">Search</button>
  </form>
  ${list}
  ${nav}
</section>`;
    return layout({
      title: `Episodes${page > 1 ? `, page ${page}` : ''} | ${cfg.showName}`,
      description: `Every episode of ${cfg.showName}: ${cfg.tagline}.${page > 1 ? ` Page ${page} of ${pages}.` : ''}`,
      path,
      body,
      current: 'episodes',
      ld: [
        seriesLd,
        { '@type': 'ItemList', itemListElement: pageEps.map((e, i) => ({ '@type': 'ListItem', position: (page - 1) * cfg.episodesPerPage + i + 1, url: abs(epPath(e)), name: e.title })) },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: cfg.showName, item: abs('/') },
          { '@type': 'ListItem', position: 2, name: 'Episodes', item: abs('/episodes/') },
        ] },
      ],
    });
  }

  function episode(ep, { newer, older, transcriptHtml, extra: extraIn }) {
    const path = epPath(ep);
    // A video set in content/episodes.json wins; otherwise use the one from Captivate.
    const extra = { ...(extraIn || {}), youtube: extraIn?.youtube || ep.youtube || '' };
    const video = extra?.youtube ? `<section class="ep-sec" aria-labelledby="watch-h">
    <h2 class="sec-h" id="watch-h">Watch</h2>
    <div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(extra.youtube)}" title="${esc(ep.title)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
  </section>` : '';
    const body = `<article class="ep wrap narrow">
  <p class="crumb"><a href="${url('/episodes/')}">All episodes</a></p>
  <header class="ep-head">
    ${thumb(ep, { eager: true, cls: 'thumb ep-art', alt: `Artwork for ${ep.title}` })}
    <div>
      <p class="meta">${metaLine(ep)}</p>
      <h1 class="ep-title">${esc(ep.title)}</h1>
    </div>
  </header>
  ${player(ep)}
  <div class="ep-actions">
    ${listenButtons(cfg.listen.filter((l) => !/rss/i.test(l.name)), 'small')}
    <button class="logo-btn share-btn" type="button" data-share-open aria-haspopup="dialog" aria-controls="share-dialog"><svg class="logo-i" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Share or embed</span></button>
  </div>
  <dialog class="share-dialog" id="share-dialog" aria-labelledby="share-h">
    <div class="sd-head">
      <h2 id="share-h">Share this episode</h2>
      <button class="sd-close" type="button" data-share-close aria-label="Close"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
    </div>
    <section class="sd-sec">
      <h3 class="sd-h">Link</h3>
      <div class="sd-field">
        <input type="text" readonly value="${esc(abs(path))}" aria-label="Episode link" data-share-link>
        <button class="btn btn-solid sd-copy" type="button" data-copy="link">Copy link</button>
      </div>
      <button class="btn small sd-native" type="button" data-native-share data-title="${esc(ep.title)}" data-url="${esc(abs(path))}" hidden>More ways to share</button>
    </section>
    <section class="sd-sec">
      <h3 class="sd-h">Embed a player on your website</h3>
      <iframe class="sd-preview" src="${url(`/embed/${ep.slug}/`)}" title="Preview of the embedded player" height="168" loading="lazy" data-embed-preview></iframe>
      <div class="sd-options" role="radiogroup" aria-label="Player colors">
        <span class="sd-opt-label">Colors</span>
        <label><input type="radio" name="emtheme" value="" checked data-embed-theme> Match the visitor</label>
        <label><input type="radio" name="emtheme" value="light" data-embed-theme> Light</label>
        <label><input type="radio" name="emtheme" value="dark" data-embed-theme> Dark</label>
      </div>
      <div class="sd-field">
        <input type="text" readonly value="${esc(embedCode(ep))}" aria-label="Embed code" class="sd-code" data-embed-code data-embed-src="${esc(abs(`/embed/${ep.slug}/`))}">
        <button class="btn btn-solid sd-copy" type="button" data-copy="code">Copy code</button>
      </div>
      <p class="sd-note">Paste it anywhere that accepts HTML, like a WordPress "Custom HTML" block or a Squarespace "Code" block.</p>
    </section>
  </dialog>
  ${video}
  <section class="ep-sec" aria-labelledby="notes-h">
    <h2 class="sec-h" id="notes-h">Show notes</h2>
    <div class="prose">${ep.notesHtml ? creditOneLine(keepPhoneTogether(ep.notesHtml)) : '<p>No show notes for this episode.</p>'}</div>
  </section>
  ${transcriptHtml ? `<section class="ep-sec" aria-labelledby="tr-h">
    <h2 class="sec-h" id="tr-h">Transcript</h2>
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
      // An SEO title or description set in content/episodes.json replaces the default for
      // search results and link previews; the page itself always shows the real title.
      title: extra?.seoTitle ? `${extra.seoTitle} | ${cfg.showName}` : (ep.number != null && ep.title.length + cfg.showName.length < 52) ? `${ep.title} (Ep. ${ep.number}) | ${cfg.showName}` : `${ep.title} | ${cfg.showName}`,
      description: extra?.seoDescription || ep.excerpt || `${ep.title}, an episode of ${cfg.showName}.`,
      path,
      body,
      image,
      type: 'article',
      card: 'summary',
      current: 'episodes',
      head: [
        ep.date ? `<meta property="article:published_time" content="${isoDate(ep.date)}">` : '',
        `<meta property="og:image:alt" content="${esc(`Artwork for ${ep.title}, an episode of ${cfg.showName}`)}">`,
        `<link rel="alternate" type="application/json+oembed" href="${esc(abs(`/embed/${ep.slug}/oembed.json`))}" title="${esc(ep.title)}">`,
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
          video: extra?.youtube ? { '@type': 'VideoObject', name: ep.title, embedUrl: `https://www.youtube.com/embed/${extra.youtube}`, url: `https://www.youtube.com/watch?v=${extra.youtube}`, thumbnailUrl: `https://i.ytimg.com/vi/${extra.youtube}/hqdefault.jpg`, uploadDate: isoDate(ep.date), description: ep.excerpt || ep.title } : undefined,
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

  // The code someone pastes into another site to show a player for one episode.
  function embedCode(ep, slug = ep.slug) {
    return `<iframe src="${abs(`/embed/${slug}/`)}" title="${cfg.showName}: ${ep.title.replace(/"/g, '&quot;')}" width="100%" height="168" style="border:0;border-radius:12px;max-width:680px" loading="lazy" allow="autoplay"></iframe>`;
  }

  // A small, self-contained player page that other sites show in an iframe.
  function embed(ep, { latest = false } = {}) {
    const epUrl = abs(epPath(ep));
    const art = ep.thumb ? (ep.thumb.startsWith('/') ? url(ep.thumb) : ep.thumb) : showArt;
    return `<!doctype html>
<html lang="${esc(cfg.language)}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(ep.title)} | ${esc(cfg.showName)}</title>
<meta name="robots" content="noindex">
<link rel="canonical" href="${esc(epUrl)}">
<meta name="color-scheme" content="light dark">
<script>(function(){var r=document.documentElement,q=new URLSearchParams(location.search).get('theme');r.dataset.theme=(q==='dark'||q==='light')?q:((window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light')})()</script>
<link rel="stylesheet" href="${asset('/styles.css')}">
</head>
<body class="embed-page">
<main class="em">
  <a class="em-art" href="${esc(epUrl)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="${esc(art)}" width="480" height="480" alt=""></a>
  <div class="em-main">
    <p class="em-top"><a class="em-show" href="${esc(abs('/'))}" target="_blank" rel="noopener">${esc(cfg.showName)}</a><span>${latest ? 'Latest episode' : epKind(ep)}</span>${ep.seconds ? `<span>${fmtDuration(ep.seconds)}</span>` : ''}</p>
    <h1 class="em-title"><a href="${esc(epUrl)}" target="_blank" rel="noopener">${esc(ep.title)}</a></h1>
    ${player(ep)}
  </div>
</main>
<script src="${asset('/app.js')}" defer></script>
</body>
</html>
`;
  }

  function oembed(ep) {
    return JSON.stringify({
      version: '1.0', type: 'rich', provider_name: cfg.showName, provider_url: abs('/'),
      title: ep.title, author_name: cfg.host.name, author_url: abs('/about/'),
      thumbnail_url: ep.image || abs('/img/logo.jpg'), html: embedCode(ep), width: 680, height: 168,
    });
  }

  function about(aboutHtml) {
    const body = `<section class="wrap block about-sec">
  ${pageHead('About')}
  <div class="about-grid about-page">
    <div>
      <h2 class="block-h">The podcast</h2>
      <div class="lede">${show.descriptionHtml || `<p>${esc(cfg.tagline)}</p>`}</div>
      <h2 class="block-h">${esc(cfg.host.name)}</h2>
      <div class="prose">${aboutHtml}</div>
      ${guestBox('about-guest', 'h2', 'block-h')}
    </div>
    <aside>
      ${cfg.host.photo ? `<img class="host-photo" src="${esc(hostPhoto)}" alt="${esc(cfg.host.name)}" width="480" height="480" loading="lazy">` : ''}
      <ul class="plain contact">
        ${cfg.contact?.email ? `<li><a href="mailto:${esc(cfg.contact.email)}">${esc(cfg.contact.email)}</a></li>` : ''}
        ${cfg.contact?.voicemail ? `<li>Voicemail: <a href="tel:+${esc(cfg.contact.voicemail.replace(/\D/g, ''))}">${esc(cfg.contact.voicemail).replace(/-/g, '\u2011')}</a></li>` : ''}
        ${cfg.host.website ? `<li><a href="${esc(cfg.host.website)}" rel="noopener me">${esc(cfg.host.website.replace(/^https?:\/\//, ''))}</a></li>` : ''}
      </ul>
      ${socialIcons()}
    </aside>
  </div>
</section>
${supportBand()}`;
    return layout({
      title: `About ${cfg.showName} and ${cfg.host.name}`,
      description: `About ${cfg.showName}, a podcast about ${cfg.tagline.toLowerCase()}, and its host, ${cfg.host.name}.`,
      path: '/about/',
      body,
      current: 'about',
      ld: [
        seriesLd,
        { '@type': 'Person', '@id': abs('/about/#host'), name: cfg.host.name, url: abs('/about/'), image: hostPhotoAbs || undefined,
          sameAs: [cfg.host.website, ...cfg.socialAll.map((s) => s.url)].filter(Boolean) },
      ],
    });
  }

  function listen() {
    const body = `<section class="wrap block">
  ${pageHead('Listen', `${esc(cfg.showName)} is free in every podcast app.`)}
  <h2 class="block-h">Pick your podcast app</h2>
  ${listenButtons(cfg.listen, 'big')}
  <h2 class="block-h follow-h">Follow along</h2>
  <ul class="logo-btns big">${cfg.social.map((l) => `<li><a class="logo-btn" href="${esc(l.url)}" rel="noopener me">${icon(iconKey(l))}<span>${esc(l.name)}</span></a></li>`).join('')}</ul>
</section>
${supportBand()}`;
    return layout({
      title: `Listen to ${cfg.showName} on Apple Podcasts, Spotify and more`,
      description: `Where to listen to ${cfg.showName}: ${cfg.listen.map((l) => l.name).join(', ')}.`,
      path: '/listen/',
      body,
      current: 'listen',
      ld: [seriesLd],
    });
  }

  function search() {
    const body = `<section class="wrap block narrow-ish">
  ${pageHead('Search')}
  <form class="search-big" action="${url('/search/')}" method="get" role="search" aria-label="Search episodes and transcripts" data-search-form>
    <label class="sr-only" for="q">Search episodes and transcripts</label>
    ${searchIcon}<input id="q" name="q" type="search" placeholder="Try “tacos”, “Chris Casey” or “earthquake”" autocomplete="off" autofocus><button class="sr-only" type="submit">Search</button>
  </form>
  <p class="search-status" data-search-status aria-live="polite">Search every episode title, description, show note and transcript.</p>
  <ol class="rows search-results" data-search-results></ol>
</section>
<script src="${asset('/search.js')}" defer data-base="${base}" data-index="${asset('/search-index.json')}" data-transcripts="${asset('/search-transcripts.json')}"></script>`;
    return layout({
      title: `Search | ${cfg.showName}`,
      description: `Search every episode of ${cfg.showName}, including the transcripts.`,
      path: '/search/',
      body,
      current: 'search',
      noindex: true,
    });
  }

  function game() {
    const body = `<section class="wrap block">
  ${pageHead('One F', 'A small, pointless game.')}
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
      current: 'game',
    });
  }

  function notFound(episodes) {
    const body = `<section class="wrap block">
  ${pageHead('Page not found', 'That page isn’t here. The episodes are.')}
  <ol class="rows">${episodes.slice(0, 5).map((e) => row(e, 2)).join('\n')}</ol>
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

  return { home, episodeList, episode, embed, oembed, about, listen, search, game, notFound, redirect, epPath };
}
