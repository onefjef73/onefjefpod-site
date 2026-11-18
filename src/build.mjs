// Builds the whole site into dist/. Run with: npm run build
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { loadFeed, cleanHtml, plainText } from './feed.mjs';
import { getTranscript } from './transcript.mjs';
import { makeTemplates } from './templates.mjs';
import { makeThumb } from './thumbs.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const sample = process.argv.includes('--sample');
const cfg = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
cfg.siteUrl = cfg.siteUrl.replace(/\/$/, '');
cfg._version = Date.now().toString(36);
// Which design to build: "a" (dark, with a sidebar) or "b" (light, with a grid).
cfg.design = process.env.DESIGN || cfg.design || 'a';
cfg.defaultTheme = process.env.DEFAULT_THEME || cfg.defaultTheme || (cfg.design === 'b' ? 'light' : 'dark');
cfg.themeKey = process.env.THEME_KEY || 'theme';
// Preview copies tell search engines to stay away.
cfg.noindex = process.env.NOINDEX === '1';
// A short fingerprint of each image, stylesheet and script. It goes on the end of
// the file's address, so when a file changes browsers fetch the new one at once
// instead of showing a saved copy.
cfg._fingerprints = {};
{
  const { createHash } = await import('node:crypto');
  const { readdir } = await import('node:fs/promises');
  const mark = async (urlPath, file) => { cfg._fingerprints[urlPath] = createHash('sha1').update(await readFile(file)).digest('hex').slice(0, 8); };
  for (const f of await readdir(path.join(root, 'static/img'))) await mark(`/img/${f}`, path.join(root, 'static/img', f));
  for (const f of ['styles.css', 'app.js', 'game.js', 'search.js']) await mark(`/${f}`, path.join(root, 'src', f));
}
// A link that is already a "listen" button or the Patreon button is not repeated among the social links.
const listenUrls = new Set([...cfg.listen.map((l) => l.url), cfg.support?.url || ''].map((u) => u.replace(/\/$/, '')));
cfg.socialAll = cfg.social;
cfg.social = cfg.social.filter((l) => !listenUrls.has(l.url.replace(/\/$/, '')));
const base = (process.env.BASE_PATH || '').replace(/\/$/, '');
const perPage = Number(process.env.PER_PAGE) || cfg.episodesPerPage;

const feedUrl = sample ? path.join(root, 'fixtures/sample-feed.xml') : (process.env.FEED_URL || cfg.feedUrl);
console.log(`Reading feed: ${feedUrl}`);
const { show, episodes } = await loadFeed(feedUrl);
if (!episodes.length) throw new Error('The feed has no episodes. Nothing was published.');
console.log(`  ${episodes.length} episodes, newest: "${episodes[0].title}"`);

const extras = JSON.parse(await readFile(path.join(root, 'content/episodes.json'), 'utf8'));
const aboutSrc = await readFile(path.join(root, 'content/about.md'), 'utf8');
const todos = aboutSrc.split('\n').filter((l) => l.trim().startsWith('TODO:'));
if (todos.length) console.warn(`  note: content/about.md still has ${todos.length} TODO line(s); they are left off the site.`);
const aboutHtml = cleanHtml(marked.parse(aboutSrc.split('\n').filter((l) => !l.trim().startsWith('TODO:')).join('\n')));
const aboutShort = (aboutHtml.match(/<p>[\s\S]*?<\/p>/) || [''])[0];

const t = makeTemplates(cfg, base, show);
const pages = [];
async function write(urlPath, html, { lastmod, index = true } = {}) {
  const file = urlPath.endsWith('/') ? path.join(dist, urlPath, 'index.html') : path.join(dist, urlPath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  if (index) pages.push({ urlPath, lastmod });
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'static'), dist, { recursive: true });
await cp(path.join(root, 'src/styles.css'), path.join(dist, 'styles.css'));
await cp(path.join(root, 'src/app.js'), path.join(dist, 'app.js'));
await cp(path.join(root, 'src/game.js'), path.join(dist, 'game.js'));
await cp(path.join(root, 'src/search.js'), path.join(dist, 'search.js'));

// Episode artwork first, so every page that lists episodes can show it.
{
  const tq = [...episodes];
  const tw = async () => { for (let ep = tq.shift(); ep; ep = tq.shift()) ep.thumb = await makeThumb(ep, { cacheDir: path.join(root, '.cache/thumbs'), outDir: path.join(dist, 'img/ep') }); };
  await Promise.all(Array.from({ length: 6 }, tw));
}

const newest = episodes[0].date || new Date();
await write('/', t.home(episodes), { lastmod: newest });
await write('/about/', t.about(aboutHtml));
await write('/listen/', t.listen());
await write('/game/', t.game());
await write('/search/', t.search(), { index: false });
await write('/404.html', t.notFound(episodes), { index: false });

const pageCount = Math.ceil(episodes.length / perPage);
for (let p = 1; p <= pageCount; p++) {
  const slice = episodes.slice((p - 1) * perPage, p * perPage);
  await write(p === 1 ? '/episodes/' : `/episodes/${p}/`, t.episodeList(slice, p, pageCount), { lastmod: newest });
}
// The old site called page one /episodes/1
await write('/episodes/1/', t.redirect(`${cfg.siteUrl}/episodes/`), { index: false });
// The old site listed five episodes per page, so it had more pages than this one.
for (let p = pageCount + 1; p <= Math.ceil(episodes.length / 5); p++) {
  await write(`/episodes/${p}/`, t.redirect(`${cfg.siteUrl}/episodes/`), { index: false });
}

let withTranscript = 0;
const transcriptText = {};
const opts = { localDir: path.join(root, 'content/transcripts'), cacheDir: path.join(root, '.cache/transcripts') };
const queue = episodes.map((ep, i) => ({ ep, i }));
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const { ep, i } = job;
    const transcriptHtml = await getTranscript(ep, opts);
    if (transcriptHtml) { withTranscript++; transcriptText[ep.slug] = plainText(transcriptHtml).replace(/\s+/g, ' ').trim(); }
    await write(t.epPath(ep), t.episode(ep, {
      newer: episodes[i - 1], older: episodes[i + 1], transcriptHtml, extra: extras[ep.slug],
    }), { lastmod: ep.date });
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`  ${withTranscript} of ${episodes.length} episode pages have a transcript`);

// Search: a small index of every episode, and a separate file of transcript text
// that the search page loads after the first results are on screen.
await writeFile(path.join(dist, 'search-index.json'), JSON.stringify(episodes.map((ep) => ({
  s: ep.slug,
  t: ep.title,
  n: ep.number ?? null,
  k: ep.number != null ? `Episode ${ep.number}` : ep.type === 'bonus' ? 'Bonus' : ep.type === 'trailer' ? 'Trailer' : '',
  d: ep.date ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: cfg.timeZone }).format(ep.date) : '',
  m: ep.seconds ? Math.round(ep.seconds / 60) : 0,
  i: ep.thumb ? (ep.thumb.startsWith('/') ? `${base}${ep.thumb}` : ep.thumb) : `${base}/img/logo.jpg`,
  x: ep.lead.join(' '),
  o: plainText(ep.notesHtml || '').replace(/\s+/g, ' ').trim(),
}))));
await writeFile(path.join(dist, 'search-transcripts.json'), JSON.stringify(transcriptText));

for (const [name, target] of Object.entries(cfg.redirects || {})) {
  if (target) await write(`/${name}/`, t.redirect(target), { index: false });
}

pages.sort((a, b) => a.urlPath.localeCompare(b.urlPath));
await writeFile(path.join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${cfg.siteUrl}${p.urlPath}</loc>${p.lastmod ? `<lastmod>${p.lastmod.toISOString().slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);
await writeFile(path.join(dist, 'robots.txt'), `# Everyone is welcome: search engines, and the AI search and assistant
# crawlers (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User,
# PerplexityBot and the rest). To keep AI search but opt out of AI training,
# add "User-agent: GPTBot" and "User-agent: ClaudeBot" blocks with "Disallow: /".
User-agent: *
Allow: /

Sitemap: ${cfg.siteUrl}/sitemap.xml
`);
await writeFile(path.join(dist, 'site.webmanifest'), JSON.stringify({
  name: cfg.showName, short_name: cfg.showName, start_url: `${base}/`, display: 'browser',
  background_color: '#efefef', theme_color: '#9c2626',
  icons: [192, 512].map((s) => ({ src: `${base}/img/icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })),
}, null, 2));
if (!existsSync(path.join(dist, '.nojekyll'))) await writeFile(path.join(dist, '.nojekyll'), '');
if (!sample) {
  const e = episodes[0];
  await writeFile(path.join(root, 'data/latest.json'), JSON.stringify({ title: e.title, slug: e.slug, published: e.date?.toISOString() ?? null, episodes: episodes.length }, null, 2) + '\n');
}
console.log(`Built ${pages.length} pages into dist/`);
