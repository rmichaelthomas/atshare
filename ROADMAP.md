# Roadmap

## Current State

### Server-Side OAuth Proxy — Done

Server deployed and working at `atshare.social/atshare-api/api/` (Hono + `@atproto/oauth-client-node` on cPanel Node.js, Namecheap VPS).

Endpoints: `/api/health`, `/api/jwks`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/logout`, `/api/preference/:did`, `/api/preference` (POST).

### Component OAuth Sign-In — Done

Simplified sign-in flow in `<atshare-selector>`:
- **Local preference** — sharing to a network saves the choice in localStorage (automatic, no sign-in needed)
- **Sign in** — click "Sign in" → enter Bluesky handle → popup OAuth via server proxy → preference written to PDS → syncs across all sites running atShare

Popup opens synchronously on user click (about:blank → OAuth URL) to avoid popup blockers. Session restore on reload via localStorage handle. Sign-in zone states: `idle` → `input` → `waiting` → `signedin`.

### Cross-Origin Iframe Proxy — Done

All authenticated API calls route through a hidden iframe proxy on atshare.social via `postMessage`, eliminating the dependency on third-party cookies (`SameSite=None`). The OAuth popup sends the session token back to the opener via `postMessage`; the server accepts `Authorization: Bearer` tokens alongside cookies.

Files: `src/iframe-proxy.js` (client), `public/proxy/index.html` (proxy page), updated `src/auth-proxy.js`.

### Landing Page — Done

Landing page at atshare.social root with a "Plain English / Developer" mode switcher. Plain English mode explains the value prop for non-technical users (bloggers, content creators). Developer mode shows code snippets, attributes table, CSS custom properties reference, and architecture details. Both modes share the live interactive component demos and theming showcase.

### Next Up

- **npm publish** — publish `@atshare/selector` to npm
- **First integration** — replace Recto's "Share to Bluesky" button with atShare

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

- **More networks** -- Threads, Nostr, or other AT Protocol / ActivityPub services
- **Share counts** -- display how many times a URL has been shared (requires backend)
- **Registered lexicon** -- publish `social.atshare.preference` as a formal AT Protocol lexicon
