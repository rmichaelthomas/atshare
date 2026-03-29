# Roadmap

## Next Up

### Wire Component to Server Proxy

The server-side OAuth proxy is **deployed and working** at `atshare.social/atshare-api/api/`. The full OAuth flow has been tested end-to-end (login → PDS authorization → callback → session stored).

**What's done:**
- `server/` directory with Hono + `@atproto/oauth-client-node`
- Deployed to cPanel Node.js on Namecheap VPS
- Endpoints working: `/api/health`, `/api/jwks`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/logout`, `/api/preference/:did`, `/api/preference` (POST)
- `src/auth-proxy.js` exists with fetch-based API client
- `public/server-client-metadata.json` deployed with correct redirect URIs

**What's left — component UI integration:**
1. Update `src/atshare-selector.js` to add a "Sign in" option alongside the existing "Enter handle" flow
2. When user clicks "Sign in": call `signIn(handle)` from `auth-proxy.js` → opens popup to OAuth URL → popup closes after auth → component checks session → shows signed-in state
3. When signed in via server proxy: preference writes go through `putPreference()` in `auth-proxy.js` (proxied to PDS)
4. The handle lookup flow (enter handle → public read) remains as the default, no-auth experience
5. Build and deploy updated demo

**Key files to modify:**
- `src/atshare-selector.js` — add sign-in UI state and flow
- `src/auth-proxy.js` — already written, needs testing with the component
- `public/demo/index.html` — rebuild and deploy

**Server API base URL:** `https://atshare.social/atshare-api/api`

---

## Phase 2: atShare Badge

An identity card component that displays a user's cross-network presence:

- **atShare Badge** -- embeddable card showing a user's AT Protocol + ActivityPub identity
- **Combined follower counts** across Bluesky, Mastodon, and other networks
- **SVG badge endpoint** -- `atshare.social/badge/{handle}.svg` for use in READMEs, blogs, etc.

## Distribution

- **npm package** -- publish `@atshare/selector` to npm for `npm install` usage
- **CDN** -- host the built component on a CDN (or atshare.social itself) for `<script>` tag embedding
- **Landing page** -- atshare.social home page with docs, live demo, and integration guide

## Future Ideas

- **More networks** -- Threads, Nostr, or other AT Protocol / ActivityPub services
- **Share counts** -- display how many times a URL has been shared (requires backend)
- **Registered lexicon** -- publish `social.atshare.preference` as a formal AT Protocol lexicon
