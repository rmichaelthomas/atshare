# Roadmap

## Current State

### Server-Side OAuth Proxy — Done

Server deployed and working at `atshare.social/atshare-api/api/` (Hono + `@atproto/oauth-client-node` on cPanel Node.js, Namecheap VPS).

Endpoints: `/api/health`, `/api/jwks`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/logout`, `/api/preference/:did`, `/api/preference` (POST).

### Component OAuth Sign-In — Done

Simplified sign-in flow in `<atshare-selector>`:
- **Local preference** — sharing to a destination saves the choice in localStorage (automatic, no sign-in needed)
- **Sign in** — click "Sign in" → enter ATProto handle → popup OAuth via server proxy → preference written to PDS → syncs across all sites running atShare

Popup opens synchronously on user click (about:blank → OAuth URL) to avoid popup blockers. Session restore on reload via localStorage handle. Sign-in zone states: `idle` → `input` → `waiting` → `signedin`.

### Cross-Origin Iframe Proxy — Done

All authenticated API calls route through a hidden iframe proxy on atshare.social via `postMessage`, eliminating the dependency on third-party cookies (`SameSite=None`). The OAuth popup sends the session token back to the opener via `postMessage`; the server accepts `Authorization: Bearer` tokens alongside cookies.

Files: `src/iframe-proxy.js` (client), `public/proxy/index.html` (proxy page), updated `src/auth-proxy.js`.

### Landing Page — Done

Landing page at atshare.social root with a "Plain English / Developer" mode switcher. Plain English mode explains the value prop for non-technical users (bloggers, content creators). Developer mode shows code snippets, attributes table, CSS custom properties reference, and architecture details. Both modes share the live interactive component demos and theming showcase.

### Universal Destination Selector (Phase 1.5) — Done

Expanded the share selector from Bluesky + Mastodon to a universal destination picker:

- **Community-contributed registry** — `destinations.json` defines all protocols and clients; anyone can add destinations via PR
- **Three-view popover UI** — default protocol buttons with chevrons, expandable client sub-lists, and "More destinations" full categorized list
- **ATProto client choice** — Bluesky, deck.blue, Skeet, Kite, Langit (users pick their preferred client)
- **Fediverse support** — Mastodon, Misskey (with instance URL input)
- **Traditional networks** — LinkedIn, X/Twitter, Threads
- **Clipboard fallback** — copy share text for any unsupported destination
- **SVG brand icons** — platform icons with protocol-colored accents, no emoji
- **Preference migration** — existing localStorage preferences auto-migrate to the new format
- **CI validation** — GitHub Actions workflow validates destination registry PRs
- **CONTRIBUTING.md** — guide for community destination contributions

Files: `destinations.json`, `destinations.schema.json`, `src/destinations.js` (replaces `networks.js`), `src/icons/`, updated `src/atshare-selector.js`.

### Next Up

- **npm publish** — publish `@atshare/selector` to npm
- **First integration** — replace Recto's "Share to Bluesky" button with atShare
- **Custom destinations** — signed-in users can add their own intent URL templates, saved to PDS

---

## Phase 2: atShare Badge

An identity card component that displays a user's cross-network presence:

- **atShare Badge** -- embeddable card showing a user's AT Protocol + ActivityPub identity
- **Combined follower counts** across Bluesky, Mastodon, and other networks
- **SVG badge endpoint** -- `atshare.social/badge/{handle}.svg` for use in READMEs, blogs, etc.

## Distribution

- **npm package** -- publish `@atshare/selector` to npm for `npm install` usage
- **CDN** -- host the built component on a CDN (or atshare.social itself) for `<script>` tag embedding
- ~~**Landing page**~~ -- done (atshare.social root with mode switcher)

## Future Ideas

- **More networks** -- Nostr, Pixelfed, Calckey, or other AT Protocol / ActivityPub services as the community adds them
- **Share counts** -- display how many times a URL has been shared (requires backend)
- **Registered lexicon** -- publish `social.atshare.preference` as a formal AT Protocol lexicon
- **Fediverse instance auto-discovery** -- detect user's instance from their handle
