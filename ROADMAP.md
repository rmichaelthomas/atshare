# Roadmap

## Next Up

### Server-Side Token Proxy

Currently, writing preferences to a user's PDS requires same-origin OAuth -- users must visit [atshare.social](https://atshare.social/demo/) to set their preference. Third-party sites can only *read* preferences (via public `getRecord`).

A lightweight backend on `atshare.social` would enable full read/write from any embedding site:

```
<atshare-selector> (any site)  ──fetch──>  atshare.social/api/  ──>  user's PDS
                                           (manages OAuth tokens)
```

**Why this is needed:** Browser privacy protections (storage partitioning, cross-origin reference invalidation) make it impossible for a third-party embedded widget to complete an OAuth flow purely client-side. Every major embeddable auth widget (Disqus, Giscus, Facebook Comments) uses a server-side proxy for this reason.

**Approach:** A small Node.js service or Cloudflare Worker on `atshare.social` that handles:
- OAuth PKCE flow initiation and token exchange
- DPoP key management and token storage
- Proxied `putRecord` / `getRecord` calls to the user's PDS
- Session cookies for the embedding site

The component would call `fetch('https://atshare.social/api/sign-in')` etc. -- standard CORS requests with no storage access issues.

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
- **Handle display for OAuth sessions** -- resolve DID to handle when signed in via same-origin OAuth
