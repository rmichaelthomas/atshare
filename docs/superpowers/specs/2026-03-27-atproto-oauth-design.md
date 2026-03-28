# AT Protocol OAuth Integration — Design Spec

**Date:** 2026-03-27
**Project:** atShare (`atshare.social`)
**Scope:** Step 9 — Wire AT Protocol OAuth into `<atshare-selector>` so authenticated users can persist their share preference to their PDS as a `social.atshare.preference` record.

---

## Overview

Sign-in is optional and lives inside the picker (Option B). Users see Bluesky/Mastodon immediately and can share without authenticating. A subtle "Sign in to save preference" prompt at the bottom of the picker lets them optionally authenticate via AT Protocol OAuth. Once authenticated, their preference is written to their PDS so it follows them across any site running atShare.

Authentication uses `@atproto/oauth-client-browser` (already in `package.json`). The OAuth callback is a minimal static page hosted at `https://atshare.social/oauth/callback`.

---

## Architecture

### New / Modified Files

```
src/
  auth.js                     ← NEW: BrowserOAuthClient wrapper
  atshare-selector.js         ← MODIFIED: sign-in UI + auth wiring
  pds.js                      ← unchanged
  identity.js                 ← unchanged

atshare.social (server)
  /client-metadata.json       ← NEW: OAuth client registration document
  /oauth/callback             ← NEW: popup completion page (~10 lines)

docs/superpowers/specs/
  2026-03-27-atproto-oauth-design.md   ← this file
```

### Module Responsibilities

**`src/auth.js`**
- Owns a singleton `BrowserOAuthClient` instance
- Exposes three functions:
  - `signIn(handle)` — resolves handle via `identity.js`, opens OAuth popup, returns session
  - `restoreSession()` — silently restores an existing session from IndexedDB; returns session or null
  - `signOut()` — clears the stored session
- The component never imports `@atproto/oauth-client-browser` directly

**`src/atshare-selector.js`** (additions)
- Calls `auth.restoreSession()` in `connectedCallback`; if session found, loads preference from PDS
- Adds sign-in zone UI to the popover shadow DOM
- Manages three sign-in UI states: signed-out, waiting, signed-in
- Calls `auth.signIn(handle)` when user submits handle
- After auth, calls `pds.getPreference()` to load existing preference
- In `_share()`, if session exists, calls `pds.putPreference()` async (fire-and-forget) with the session's `fetchHandler`

**`pds.js`** — no changes needed. Already accepts `accessToken` parameter. Will be updated to accept a `fetchHandler` function instead of a raw token (the library's fetch wrapper that auto-handles DPoP and token refresh).

---

## Auth Flow

1. User clicks "Sign in to save preference" in the picker
2. Picker reveals inline handle input
3. User enters handle (e.g. `rob.bsky.social`), clicks Continue
4. `auth.signIn(handle)`:
   a. Calls `identity.resolveHandleToDid(handle)` via Slingshot
   b. `BrowserOAuthClient.signIn()` opens popup to user's PDS authorization server
5. Component shows "Opening sign-in…" state with Cancel option
6. User authenticates in popup; PDS redirects to `https://atshare.social/oauth/callback`
7. Callback page calls `client.handleCallback()` — completes PKCE + DPoP exchange, writes session to IndexedDB via `BroadcastChannel`, closes popup
8. The originating tab's `BrowserOAuthClient` receives the session via `BroadcastChannel` (library-internal, no wiring required)
9. `auth.signIn()` promise resolves with the session
10. Component calls `pds.getPreference()` with the session
11. If preference record exists: populate `this._preference`, re-render network buttons with ✓
12. If not: next share action creates the record

**Subsequent page loads:**
- `connectedCallback` calls `auth.restoreSession()` — silently returns session from IndexedDB or null
- If session found: load preference, update UI — no popup, no handle prompt

---

## UI Changes

The picker gains a **sign-in zone** between the network list and the footer divider. Three mutually exclusive states:

### Signed out
```
─────────────────────────────
Sign in to save preference      ← muted, small, tappable
─────────────────────────────
atShare
```

Clicking reveals inline handle input:
```
Your AT Protocol handle
[ rob.bsky.social          ]
                    [ Continue ]
```

### Waiting (popup open)
```
Opening sign-in…   [ Cancel ]
```
If no popup detected within ~2 seconds:
```
⚠ Popup blocked — allow popups for this site
```

### Signed in
```
✓ rob.bsky.social   Sign out
```
The preferred network button gains a `✓` suffix (already implemented in `_renderNetworks`, just needs `this._preference` populated from PDS).

---

## Preference Read/Write

**Writing** — fire-and-forget after a successful share:
```
user clicks network → window.open() fires immediately → putPreference() called async
```
Never blocks the share. On failure: silently fall back to localStorage. No user-facing error.

**Reading** — two moments:
1. `connectedCallback` — after `restoreSession()` succeeds
2. After sign-in — immediately following resolved `signIn()` promise

Both are non-blocking. If `getPreference()` fails, the picker still works without showing a preference ✓.

---

## Error Handling

| Error | Handling |
|---|---|
| Handle doesn't resolve | Inline: "Couldn't find that handle" under input |
| Popup blocked | Inline warning in sign-in zone, picker stays open |
| OAuth cancelled or failed | Return to signed-out state; inline: "Sign-in cancelled" |
| PDS write fails | Silent — localStorage fallback, no UI impact |
| PDS read fails | Silent — picker works, no ✓ shown |
| Session expired / refresh fails | `restoreSession()` returns null → show signed-out state |

---

## Token Handling

`@atproto/oauth-client-browser` manages all token concerns:
- DPoP key generation and JWT signing
- PKCE code exchange
- Automatic token refresh
- Session persistence in IndexedDB

The component and `pds.js` use the session's `fetchHandler` (the library's fetch wrapper) instead of passing raw access tokens. This means `pds.js` will replace its `Authorization: Bearer` header approach with accepting a `fetchHandler` function parameter.

---

## Client Metadata Document

Hosted at `https://atshare.social/client-metadata.json`:

```json
{
  "client_id": "https://atshare.social/client-metadata.json",
  "client_name": "atShare",
  "client_uri": "https://atshare.social",
  "logo_uri": "https://atshare.social/logo.png",
  "tos_uri": "https://atshare.social/tos",
  "policy_uri": "https://atshare.social/privacy",
  "redirect_uris": ["https://atshare.social/oauth/callback"],
  "scope": "atproto",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

`client_id` must exactly match the URL where this document is served.

---

## Callback Page

Hosted at `https://atshare.social/oauth/callback` as a minimal static HTML page:

```html
<!DOCTYPE html>
<html>
<head><title>atShare — Signing in…</title></head>
<body>
<script type="module">
  import { BrowserOAuthClient } from 'https://esm.sh/@atproto/oauth-client-browser';
  const client = await BrowserOAuthClient.load({
    clientId: 'https://atshare.social/client-metadata.json',
    handleResolver: 'https://bsky.social',
  });
  await client.handleCallback();
  window.close();
</script>
</body>
</html>
```

`handleCallback()` completes the exchange, writes the session to IndexedDB, signals the originating tab via `BroadcastChannel`, then the popup closes.

---

## What Is Not In Scope

- Reading other users' preference records (requires their permission)
- Server-side token storage or proxy
- Multiple accounts / account switching
- localStorage fallback as a named feature (it exists silently as a fallback)
- Any network beyond Bluesky + Mastodon
