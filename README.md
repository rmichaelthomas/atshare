# atShare

Universal share selector for [AT Protocol](https://atproto.com) and [ActivityPub](https://activitypub.rocks) networks. Drop a single web component onto any page and give your readers one-click sharing to Bluesky and Mastodon.

**[atshare.social](https://atshare.social)** | **[Live demo](https://atshare.social/demo/)**

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
- **Preference memory** -- share once and your preferred network is remembered locally; sign in with your Bluesky handle to sync your preference across every site running atShare
- **Themeable** -- CSS custom properties for colors, borders, radius, font size
- **Shadow DOM** -- styles don't leak in or out
- **Lightweight** -- ~19 KB (ES module)

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

atShare remembers a user's preferred network across every site that embeds it -- no account on your site required.

**Local (automatic):** When a user shares to a network, their choice is saved in `localStorage`. On return visits, that network gets a checkmark.

**Cross-site (sign in):** Users click "Sign in" in the selector, enter their Bluesky handle, and complete a one-time OAuth flow via popup. This writes a `social.atshare.preference` record to their PDS. Any site running atShare can read it back and show the checkmark -- the preference follows the user across the web.

**Cross-origin architecture:** The component uses a hidden iframe proxy on atshare.social to relay authenticated API calls via `postMessage`. This avoids third-party cookie restrictions -- the iframe makes same-origin requests while the OAuth popup sends the session token back to the embedding page via `postMessage`.

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
  pds.js                Preference record read/write (public)
  auth-proxy.js         Server-backed OAuth proxy client
  iframe-proxy.js       Cross-origin iframe proxy (postMessage relay)
public/
  proxy/index.html      Iframe proxy page hosted on atshare.social
index.html              Landing page (atshare.social root)
server/
  index.js              Hono API server
  oauth.js              NodeOAuthClient singleton
  routes/auth.js        OAuth login/callback/session/logout
  routes/preference.js  Preference read/write via PDS
```

## License

MIT
