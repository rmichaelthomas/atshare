# atShare

Universal share selector for [AT Protocol](https://atproto.com) and [ActivityPub](https://activitypub.rocks) networks. Drop a single web component onto any page and give your readers one-click sharing to Bluesky and Mastodon.

**[Live demo](https://atshare.social/demo/)**

## Quick Start

```html
<atshare-selector
  url="https://yoursite.com/post/123"
  text="Check this out:">
</atshare-selector>

<script type="module" src="https://atshare.social/dist/atshare-selector.js"></script>
```

## Features

- **Zero dependencies in the embed** -- a single `<script>` tag, no framework required
- **Bluesky + Mastodon** sharing out of the box
- **Preference memory** -- users enter their AT Protocol handle once, and atShare remembers their preferred network across sites by reading their public PDS record
- **Themeable** -- CSS custom properties for colors, borders, radius, font size
- **Shadow DOM** -- styles don't leak in or out
- **Lightweight** -- ~17 KB (ES module)

## Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `url` | yes | current page URL | The URL to share |
| `text` | no | -- | Text prepended to the URL in the share |
| `label` | no | `"Share"` | Button label |

## Theming

Style with CSS custom properties on the element or a parent:

```css
atshare-selector {
  --atshare-bg: #1e293b;
  --atshare-bg-hover: #334155;
  --atshare-color: #f8fafc;
  --atshare-border: #334155;
  --atshare-accent: #60a5fa;
  --atshare-radius: 8px;
  --atshare-font-size: 14px;
}
```

## How Preferences Work

atShare can remember a user's preferred network across every site that embeds it -- no account on your site required.

1. The user clicks **"Enter handle to load preference"** and types their AT Protocol handle (e.g. `rob.bsky.social`)
2. atShare resolves the handle, finds their PDS, and reads a public `social.atshare.preference` record
3. If a preference exists, the preferred network gets a checkmark
4. The handle is stored in `localStorage` so it loads automatically on future visits

To *set* a preference, users visit [atshare.social/demo/](https://atshare.social/demo/) and sign in via AT Protocol OAuth (same-origin). Their preference is written to their PDS and follows them to any site running atShare.

## Development

```bash
git clone https://github.com/rmichaelthomas/atshare.git
cd atshare
npm install
npm run dev        # Vite dev server at localhost:5173
npm test           # Vitest
npm run build      # Library build (ES + UMD)
npm run build:demo # Demo site build (bundles all deps)
```

## Project Structure

```
src/
  atshare-selector.js   Web component
  networks.js           Network definitions (Bluesky, Mastodon)
  identity.js           Handle/DID/PDS resolution
  pds.js                Preference record read/write
  auth.js               OAuth wrapper (same-origin only)
  oauth-callback.js     OAuth callback page
```

## License

MIT
