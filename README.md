# onefjef website

The site rebuilds itself from the Captivate feed. Publish an episode in
Captivate as usual and it appears here within about an hour: its own page,
show notes, transcript, audio player, and a place in the episode list and sitemap.

## Changing things

| To change | Edit |
|---|---|
| Links, tagline, Patreon text, copyright name, section labels, episodes per page | `site.config.json` |
| Your bio on the About page | `content/about.md` |
| Your photo | replace `static/img/host.webp` |
| A word in parentheses above an episode title, or a video on an episode page | `content/episodes.json` |
| A transcript (override, or add one Captivate doesn't have) | drop a file in `content/transcripts/` |
| The title card at the top of the home page | run `python3 tools/make_title_cards.py WIDE.jpg SQUARE.jpg` with new artwork |
| Colors, type, layout | `src/styles.css` |
| Page structure | `src/templates.mjs` |
| The game | `src/game.js` |

Editing any file on github.com and pressing "Commit changes" republishes the site.
The show description, episode titles, notes, artwork and transcripts are not edited
here. They come from Captivate.

Six older episodes have their transcripts stored in `content/transcripts/` because
Captivate's own links for them are dead.

## One-time setup

1. Create a free GitHub account and a new **public** repository. Upload everything in this folder to it.
2. In the repository: Settings, then Pages, then set Source to **GitHub Actions**.
3. Open the Actions tab and run "Build and publish site". When it finishes it shows a
   preview address ending in `github.io`. Check the site there before touching your domain.
4. When you're happy: Settings, then Pages, then Custom domain, enter `onefjefpod.com`,
   and follow GitHub's "Managing a custom domain for your GitHub Pages site" help page
   for the DNS records to set where the domain is registered. This is the moment the
   new site replaces the Captivate one.
5. In Google Search Console, submit `https://onefjefpod.com/sitemap.xml`.

## What keeps old links working

Episode pages keep their current addresses (`/episode/...`), and `/rssfeed`,
`/apple` and `/spotify` still forward to the same places.

## Previewing on your own computer (optional)

Needs Node.js 20 or newer.

    npm install
    npm run build     (or: npm run sample, which uses stand-in data and needs no internet)
    npm run serve     then open http://localhost:4173

## Adding the animated episode videos later

Put the YouTube video ID in `content/episodes.json` under that episode's slug:

    "ep-67": { "youtube": "VIDEO_ID" }

A (WATCH) section with the video then appears on that episode's page.
