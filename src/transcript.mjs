// Finds a transcript for an episode and returns clean HTML for the page.
// Order of preference:
//   1. a file you put in content/transcripts/  (<slug>.txt, .md, .html, .srt or .vtt)
//   2. the transcript Captivate attaches to the episode in the feed
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';
import { loadText } from './feed.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const exists = (p) => access(p).then(() => true, () => false);

function cleanTranscriptHtml(html) {
  const body = html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
  return sanitizeHtml(body, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'cite', 'time', 'h3', 'h4'],
    allowedAttributes: {},
    transformTags: { h1: 'h3', h2: 'h3', div: 'p' },
  }).replace(/<p>\s*<\/p>/g, '').trim();
}

// Captions arrive as hundreds of two-second fragments. They are merged into
// readable paragraphs, starting a new one when the speaker changes or after
// a handful of sentences.
function cuesToHtml(cues) {
  const paras = [];
  let cur = null;
  for (const cue of cues) {
    let line = cue.text.replace(/<[^>]+>/g, '')
      .replace(/(?:\b\d+\s+)?\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*--(?:>|&gt;)\s*\d{2}:\d{2}:\d{2}[,.]\d{1,3}/g, ' ')
      .replace(/\s+/g, ' ').trim();
    if (!line) continue;
    let speaker = cue.speaker || '';
    const m = line.match(/^([A-Z][\w .'’-]{0,30}):\s+(.*)$/);
    if (!speaker && m) { speaker = m[1]; line = m[2]; }
    const speakerChanged = speaker && cur && speaker !== cur.speaker;
    const tooLong = cur && cur.text.length > 600 && /[.!?…]["”']?$/.test(cur.text);
    if (!cur || speakerChanged || tooLong) {
      cur = { speaker: speaker || (cur ? cur.speaker : ''), showSpeaker: !cur || speakerChanged, time: cue.start, text: line };
      paras.push(cur);
    } else {
      cur.text += ' ' + line;
    }
  }
  return paras.map((p) => {
    const label = p.showSpeaker && p.speaker ? `<strong>${esc(p.speaker)}:</strong> ` : '';
    return `<p>${label}${esc(p.text)}</p>`;
  }).join('\n');
}

function parseTimed(src) {
  const cues = [];
  const blocks = src.replace(/\r/g, '').replace(/^WEBVTT[^\n]*\n/, '').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim());
    const ti = lines.findIndex((l) => l.includes('-->'));
    if (ti === -1) continue;
    const start = lines[ti].split('-->')[0].trim();
    let body = lines.slice(ti + 1).join(' ');
    let speaker = '';
    const v = body.match(/^<v\s+([^>]+)>/);
    if (v) { speaker = v[1].trim(); body = body.replace(/^<v\s+[^>]+>/, ''); }
    cues.push({ start, text: body, speaker });
  }
  return cues;
}

function parseJson(src) {
  const data = JSON.parse(src);
  const segs = data.segments || data.cues || [];
  return segs.map((s) => ({ start: String(s.startTime ?? s.start ?? ''), text: s.body ?? s.text ?? '', speaker: s.speaker || '' }));
}

function textToHtml(src) {
  return src.replace(/\r/g, '').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
    .map((b) => {
      const m = b.match(/^([A-Z][\w .'’-]{0,30}):\s*([\s\S]*)$/);
      const inner = m ? `<strong>${esc(m[1])}:</strong> ${esc(m[2])}` : esc(b);
      return `<p>${inner.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
}

// Captivate's HTML transcripts are one caption per line, each with its own
// speaker label and timestamp. They are merged into paragraphs like the others.
function captionHtmlToCues(html) {
  const cues = [];
  const re = /<cite>([\s\S]*?)<\/cite>\s*(?:<time>([\s\S]*?)<\/time>)?\s*((?:<p>[\s\S]*?<\/p>\s*)+)/g;
  const plain = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // When Captivate hits a clock time in the speech ("at 10:00") it can mistake the
  // words before the colon for a speaker label and then stamp that fake label on
  // every later line as "<label> <timestamp>". Collect those so they can be undone.
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const unesc = (t) => t.replace(/\\(.)/g, '$1');
  const bogus = [...new Set([...html.matchAll(/<p>([^<]{1,40}?) \d{2}:\d{2}:\d{2}<\/p>/g)].map((x) => escRe(plain(x[1]))))];
  for (let m; (m = re.exec(html)); ) {
    let speaker = plain(m[1]).replace(/:\s*$/, '').trim();
    let text = plain(m[3]);
    // Captivate sometimes mistakes a clock time in the speech ("at 10:00") for a
    // speaker label and a timestamp. Put the words back where they belong.
    for (const label of bogus) {
      text = text.replace(new RegExp(`${label} \\d{2}:\\d{2}:\\d{2} (\\d{2})\\b`), (_, mm) => `${unesc(label)}:${mm}`)
        .replace(new RegExp(`(^| )${label} \\d{2}:\\d{2}:\\d{2}(?= |$)`, 'g'), '');
    }
    text = text.replace(/ \d{2}:\d{2}:\d{2}(?= |$)/g, '').replace(/\s+/g, ' ').trim();
    const realLabel = /^[A-Z][\w.'’-]*( [A-Z0-9][\w.'’-]*){0,2}$/.test(speaker);
    if (speaker && !realLabel) { text = `${speaker} ${text}`; speaker = ''; }
    if (/^(speaker|unknown)$/i.test(speaker)) speaker = '';
    cues.push({ start: plain(m[2] || ''), text, speaker });
  }
  return cues;
}

// Some of Captivate's "HTML" transcripts are really a pasted caption file:
// numbered lines with "00:00:09,490 --> 00:00:18,330" time ranges in the text.
function pastedCaptionsToCues(html) {
  const text = html.replace(/<(cite|time)>[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ');
  return text.split(/\s*(?:\b\d+\s+)?\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*/)
    .map((t) => ({ start: '', speaker: '', text: t.replace(/\s+/g, ' ').trim() })).filter((c) => c.text);
}

function convert(src, kind) {
  if (kind === 'html') {
    if ((src.match(/--(?:>|&gt;)/g) || []).length > 5) return cuesToHtml(pastedCaptionsToCues(src));
    const cues = captionHtmlToCues(src);
    return cues.length > 5 ? cuesToHtml(cues) : cleanTranscriptHtml(src);
  }
  if (kind === 'srt' || kind === 'vtt') return cuesToHtml(parseTimed(src));
  if (kind === 'json') return cuesToHtml(parseJson(src));
  return textToHtml(src);
}

function kindOf(type, url) {
  const u = url.toLowerCase().split('?')[0];
  if (type.includes('html') || u.endsWith('.html')) return 'html';
  if (type.includes('json') || u.endsWith('.json')) return 'json';
  if (type.includes('vtt') || u.endsWith('.vtt')) return 'vtt';
  if (type.includes('srt') || type.includes('subrip') || u.endsWith('.srt')) return 'srt';
  return 'text';
}

const PREFERENCE = ['html', 'json', 'vtt', 'srt', 'text'];

export { convert };

export async function getTranscript(ep, { localDir, cacheDir }) {
  for (const ext of ['html', 'md', 'txt', 'srt', 'vtt']) {
    const p = path.join(localDir, `${ep.slug}.${ext}`);
    if (await exists(p)) {
      const src = await readFile(p, 'utf8');
      return convert(src, ext === 'md' || ext === 'txt' ? 'text' : ext);
    }
  }
  if (!ep.transcripts.length) return '';
  const ranked = ep.transcripts
    .map((t) => ({ ...t, kind: kindOf(t.type, t.url) }))
    .sort((a, b) => PREFERENCE.indexOf(a.kind) - PREFERENCE.indexOf(b.kind));
  for (const t of ranked) {
    const key = createHash('sha1').update(t.url).digest('hex').slice(0, 16);
    const cached = path.join(cacheDir, `${key}.html`);
    if (await exists(cached)) return readFile(cached, 'utf8');
    try {
      const html = convert(await loadText(t.url), t.kind);
      if (html) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cached, html);
        return html;
      }
    } catch (e) {
      console.warn(`  transcript skipped for "${ep.title}": ${e.message}`);
    }
  }
  return '';
}
