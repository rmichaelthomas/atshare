# Roadmap

## Current State

### Server-Side OAuth Proxy — Done

Server deployed and working at `atshare.social/atshare-api/api/` (Hono + `@atproto/oauth-client-node` on cPanel Node.js, Namecheap VPS).

Endpoints: `/api/health`, `/api/jwks`, `/api/auth/login`, `/api/auth/callback`, `/api/auth/session`, `/api/auth/logout`, `/api/preference/:did`, `/api/preference` (POST).

### Component OAuth Sign-In — Done

Simplified sign-in flow in `<atshare-selector>`:
- **Local preference** — sharing to a network saves the choice in localStorage (automatic, no sign-in needed)
- **Sign in** — click "Sign in" → enter Bluesky handle → popup OAuth via server proxy → preference written to PDS → syncs across all sites running atShare

Popup opens synchronously on user click (about:blank → OAuth URL) to avoid popup blockers. Session restore on reload via cookie + localStorage handle. Sign-in zone states: `idle` → `input` → `waiting` → `signedin`.

### Next Up

- **Cross-origin testing** from third-party domains against the production API
- **Landing page** — atshare.social home page with docs and live demo

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
