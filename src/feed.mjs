// Reads the podcast RSS feed and turns it into plain episode objects.
import { XMLParser } from 'fast-xml-parser';
import sanitizeHtml from 'sanitize-html';
import { readFile } from 'node:fs/promises';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  cdataPropName: false,
  trimValues: true,
  parseTagValue: false,
  // The parser's default entity limits are too low for a feed that carries
  // a full back catalogue of show notes; they are raised, not removed.
  processEntities: { maxTotalExpansions: 5_000_000, maxExpandedLength: 50_000_000 },
  isArray: (name) => ['item', 'podcast:transcript', 'podcast:person', 'itunes:category', 'podcast:alternateEnclosure', 'podcast:source'].includes(name),
});

export async function loadText(url) {
  if (url.startsWith('file:')) return readFile(new URL(url), 'utf8');
  if (!/^https?:/.test(url)) return readFile(url, 'utf8');
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'onefjef-site-builder (+https://onefjefpod.com)' },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status >= 400 && res.status < 500) { const e = new Error(`HTTP ${res.status} for ${url}`); e.final = true; throw e; }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.final) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? '');
  return String(v);
};

export function cleanHtml(html) {
  return sanitizeHtml(html || '', {
    allowedTags: ['p', 'br', 'a', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'hr'],
    allowedAttributes: { a: ['href'] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      h1: 'h2',
      a: (tagName, attribs) => ({ tagName, attribs: { href: attribs.href || '', rel: 'noopener' } }),
    },
  }).trim();
}

export function plainText(html) {
  const spaced = (html || '').replace(/<\/(p|div|li|h[1-6]|blockquote)>|<br\s*\/?>/gi, '$& ');
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function excerpt(str, max = 158) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 60)).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

// The episode's own description: the opening paragraphs of the show notes,
// stopping where the standing links (Patreon, socials, contact) begin.
export function leadText(notesHtml, fallback) {
  const paras = notesHtml.match(/<p>[\s\S]*?<\/p>/g) || [];
  const lead = [];
  for (const [i, p] of paras.entries()) {
    if (i > 0 && /<a\s|patreon|voicemail/i.test(p)) break;
    const t = plainText(p);
    if (t) lead.push(t);
  }
  return lead.length ? lead : (fallback ? [fallback] : []);
}

export function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'episode';
}

// "5025", "83:08" and "01:23:08" all become seconds.
export function toSeconds(v) {
  const s = text(v).trim();
  if (!s) return 0;
  if (/^\d+$/.test(s)) return Number(s);
  const parts = s.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function slugFromLink(link) {
  try {
    const parts = new URL(link).pathname.split('/').filter(Boolean);
    const i = parts.indexOf('episode');
    if (i !== -1 && parts[i + 1]) return decodeURIComponent(parts[i + 1]).toLowerCase();
  } catch { /* not a URL */ }
  return '';
}

// The YouTube video ID from an episode's alternate enclosures, if it has one.
function youtubeId(encs) {
  for (const e of encs || []) {
    const isVideo = /youtube|video/i.test(e['@type'] || '');
    for (const src of e['podcast:source'] || []) {
      const u = src['@uri'] || '';
      const m = u.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/);
      if (m && (isVideo || /youtu/.test(u))) return m[1];
    }
  }
  return '';
}

export async function loadFeed(url) {
  const xml = await loadText(url);
  const doc = parser.parse(xml);
  const ch = doc?.rss?.channel;
  if (!ch) throw new Error('The feed did not contain an RSS channel.');

  const show = {
    title: text(ch.title),
    descriptionHtml: cleanHtml(text(ch.description) || text(ch['itunes:summary'])),
    description: plainText(text(ch.description) || text(ch['itunes:summary'])),
    author: text(ch['itunes:author']),
    image: ch['itunes:image']?.['@href'] || text(ch.image?.url),
    language: text(ch.language) || 'en',
    copyright: text(ch.copyright),
    categories: (ch['itunes:category'] || []).map((c) => c['@text']).filter(Boolean),
  };

  const seen = new Set();
  const episodes = (ch.item || []).map((it) => {
    const title = text(it['itunes:title']) || text(it.title);
    const link = text(it.link);
    let slug = slugFromLink(link) || slugify(title);
    while (seen.has(slug)) slug += '-2';
    seen.add(slug);
    const rawNotes = text(it['content:encoded']) || text(it.description) || text(it['itunes:summary']);
    const notesHtml = cleanHtml(rawNotes);
    const summary = plainText(text(it['itunes:subtitle'])) || plainText(rawNotes);
    const date = new Date(text(it.pubDate));
    const num = parseInt(text(it['itunes:episode']) || text(it['podcast:episode']), 10);
    const season = parseInt(text(it['itunes:season']) || text(it['podcast:season']), 10);
    return {
      title,
      slug,
      guid: text(it.guid),
      date: Number.isNaN(date.getTime()) ? null : date,
      audio: it.enclosure?.['@url'] || '',
      audioType: it.enclosure?.['@type'] || 'audio/mpeg',
      audioBytes: Number(it.enclosure?.['@length']) || 0,
      seconds: toSeconds(it['itunes:duration']),
      number: Number.isNaN(num) ? null : num,
      season: Number.isNaN(season) ? null : season,
      type: text(it['itunes:episodeType']) || 'full',
      image: it['itunes:image']?.['@href'] || '',
      notesHtml,
      summary,
      excerpt: excerpt(summary),
      lead: leadText(notesHtml, excerpt(summary, 600)),
      // A YouTube video added to the episode in Captivate arrives as an "alternate enclosure".
      youtube: youtubeId(it['podcast:alternateEnclosure']),
      transcripts: (it['podcast:transcript'] || [])
        .map((t) => ({ url: t['@url'], type: (t['@type'] || '').toLowerCase() }))
        .filter((t) => t.url),
    };
  }).filter((e) => e.title);

  episodes.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return { show, episodes };
}
