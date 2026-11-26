// Reads each episode's SEO title and description straight from Captivate, using the
// CAPTIVATE_USER_ID and CAPTIVATE_API_KEY secrets saved in GitHub. Those fields aren't
// in the public podcast feed. If anything goes wrong this returns nothing and the site
// builds as before, so it can never break a rebuild. It never prints the secrets.
const API = 'https://api.captivate.fm';

async function call(url, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${url.replace(API, '')} -> ${res.status}`);
  return body;
}

const arr = (b, ...keys) => { if (Array.isArray(b)) return b; for (const k of keys) if (Array.isArray(b?.[k])) return b[k]; return []; };
const slugOf = (s) => String(s || '').replace(/^https?:\/\/[^/]+\/episode\//, '').replace(/\/$/, '');

export async function fetchCaptivateSeo(feedUrl) {
  const user = process.env.CAPTIVATE_USER_ID, key = process.env.CAPTIVATE_API_KEY;
  if (!user || !key) return {};
  try {
    const form = new FormData(); form.append('username', user); form.append('token', key);
    const auth = await call(`${API}/authenticate/token`, { method: 'POST', body: form });
    const token = auth?.user?.token || auth?.token || auth?.access_token;
    if (!token) { console.log('  Captivate: signed in, but no token in the reply (keys: ' + Object.keys(auth || {}).join(', ') + ')'); return {}; }
    const headers = { Authorization: `Bearer ${token}` };
    const showsBody = await call(`${API}/users/${user}/shows`, { headers });
    const shows = arr(showsBody, 'shows', 'data');
    const feedId = (feedUrl.match(/captivate\.fm\/([^/]+)/) || [])[1];
    const show = shows.find((s) => JSON.stringify(s).includes(feedId)) || shows[0];
    if (!show) { console.log('  Captivate: no shows found'); return {}; }
    const epsBody = await call(`${API}/shows/${show.id}/episodes`, { headers });
    const eps = arr(epsBody, 'episodes', 'data');
    if (!eps.length) { console.log('  Captivate: no episodes in the reply'); return {}; }
    // Field names, never values, so the public build log shows what the API offers.
    const sample = eps[0];
    console.log(`  Captivate: ${eps.length} episodes; SEO-related fields: ${Object.keys(sample).filter((k) => /seo|slug|meta/i.test(k)).join(', ') || 'none'}`);
    const out = {};
    let detailCalls = 0;
    for (const e of eps) {
      let ep = e;
      const hasSeo = Object.keys(ep).some((k) => /seo/i.test(k));
      // Some list replies leave out detail fields; ask for the full episode if so.
      if (!hasSeo && detailCalls < 200) { detailCalls++; const d = await call(`${API}/episodes/${e.id}`, { headers }).catch(() => null); ep = d?.episode || d || e; }
      const slug = slugOf(ep.slug || ep.episode_slug || ep.seo_slug || ep.link || ep.url);
      const title = (ep.seo_title || ep.seoTitle || ep.meta_title || '').trim();
      const desc = (ep.seo_description || ep.seoDescription || ep.meta_description || '').trim();
      if (!slug || (!title && !desc)) continue;
      out[slug] = { ...(title ? { seoTitle: title } : {}), ...(desc ? { seoDescription: desc } : {}) };
    }
    if (detailCalls) console.log(`  Captivate: looked up ${detailCalls} episodes one by one; fields on a full episode: ${Object.keys((await call(`${API}/episodes/${eps[0].id}`, { headers }).catch(() => ({})))?.episode || {}).filter((k) => /seo|slug|meta/i.test(k)).join(', ') || 'none'}`);
    console.log(`  Captivate: SEO titles or descriptions for ${Object.keys(out).length} episodes`);
    return out;
  } catch (err) {
    console.log(`  Captivate: couldn't read SEO fields (${err.message}); using the saved ones`);
    return {};
  }
}
