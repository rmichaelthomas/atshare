# AT Protocol OAuth Integration — Design Spec

**Date:** 2026-03-27
**Project:** atShare (`atshare.social`)
**Scope:** Step 9 — Wire AT Protocol OAuth into `<atshare-selector>` so authenticated users can persist their share preference to their PDS as a `social.atshare.preference` record.

---

## Overview

Sign-in is optional and lives inside the picker (Option B). Users see Bluesky/Mastodon immediately and can share without authenticating. A subtle "Sign in to save preference" prompt at the bottom of the picker lets them optionally authenticate via AT Protocol OAuth. Once authenticated, their preference is written to their PDS so it follows them across any site running atShare.

Authentication uses `@atproto/oauth-client-browser` (already in `package.json`). The OAuth callback is a minimal static page hosted at `https://atshare.social/oauth/callback`, built and bundled by Vite (not served via CDN import).

---

## Architecture

### New / Modified Files

```
src/
  auth.js                     ← NEW: BrowserOAuthClient wrapper
  atshare-selector.js         ← MODIFIED: sign-in UI + auth wiring
  pds.js                      ← MODIFIED: accessToken → fetchHandler
  identity.js                 ← unchanged

atshare.social (server)
  /client-metadata.json       ← NEW: OAuth client registration document
  /oauth/callback/index.html  ← NEW: popup completion page (bundled by Vite)

docs/superpowers/specs/
  2026-03-27-atproto-oauth-design.md   ← this file
```

### Module Responsibilities

**`src/auth.js`**
- Owns a singleton `BrowserOAuthClient` instance, initialized with `clientId: 'https://atshare.social/client-metadata.json'` and `handleResolver: 'https://bsky.social'`
- Exposes three functions:
  - `signIn(handle)` — passes handle directly to `BrowserOAuthClient.signIn(handle)` (the library resolves the handle internally; no `identity.js` call needed here). Opens the OAuth popup. Returns a session object on success, or rejects if the popup is closed or auth fails.
  - `restoreSession()` — silently restores an existing session from IndexedDB; returns session or null
  - `signOut()` — clears the stored session
- Popup-close detection: `auth.signIn()` polls `popup.closed` every 500ms. If the popup closes before `BroadcastChannel` delivers a session, the promise rejects with `{ reason: 'cancelled' }`.
- The component never imports `@atproto/oauth-client-browser` directly

**`src/pds.js`** (modified)
- Replaces the `accessToken` string parameter with a `fetchHandler` function on both `getPreference` and `putPreference`
- New signatures:
  ```js
  getPreference(pdsEndpoint, did, fetchHandler)
  putPreference(pdsEndpoint, did, fetchHandler, preference)
  ```
- `fetchHandler` is the session's fetch wrapper from `@atproto/oauth-client-browser`. It is called as `fetchHandler(url, init)` in place of `fetch(url, init)`. The library injects DPoP headers and handles token refresh automatically — callers drop the `Authorization: Bearer` header entirely.

**`src/atshare-selector.js`** (additions)
- Calls `auth.restoreSession()` in `connectedCallback`; if session found, loads preference from PDS
- Adds sign-in zone UI to the popover shadow DOM
- Manages four sign-in UI states: signed-out, handle-input, waiting, signed-in (see UI Changes)
- Calls `auth.signIn(handle)` when user submits handle
- After auth, calls `pds.getPreference()` to load existing preference
- In `_share()`, if session exists, calls `pds.putPreference()` async (fire-and-forget) with the session's `fetchHandler`

**`src/identity.js`** — unchanged. Used by `auth.js` is NOT needed for sign-in (library handles resolution). Remains available for future use (e.g. reading another user's preference).

---

## Auth Flow

1. User clicks "Sign in to save preference" in the picker
2. Picker transitions to handle-input state
3. User enters handle (e.g. `rob.bsky.social`), clicks Continue
4. `auth.signIn(handle)` calls `BrowserOAuthClient.signIn(handle)` — the library resolves the handle to a DID and PDS internally, then opens a popup to the user's PDS authorization server
5. Component transitions to waiting state: "Opening sign-in… [Cancel]"
6. `auth.js` begins polling `popup.closed` every 500ms
7. User authenticates in popup; PDS redirects to `https://atshare.social/oauth/callback`
8. Callback page initializes its own `BrowserOAuthClient` with identical `clientId` and `handleResolver`, calls `client.handleCallback()` — completes PKCE + DPoP exchange, writes session to IndexedDB, signals originating tab via `BroadcastChannel`, then calls `window.close()`
9. The originating tab's `BrowserOAuthClient` receives the session via `BroadcastChannel`; `signIn()` promise resolves with the session. The `popup.closed` polling loop exits.
10. Component calls `pds.getPreference(pdsEndpoint, did, session.fetchHandler)`
11. If preference record exists: populate `this._preference`, re-render network buttons with ✓, transition to signed-in state
12. If not: transition to signed-in state, next share action creates the record

**Popup closed without completing auth:**
- `popup.closed` polling detects closure before `BroadcastChannel` fires
- `signIn()` rejects with `{ reason: 'cancelled' }`
- Component returns to signed-out state; brief inline message: "Sign-in cancelled"

**Subsequent page loads:**
- `connectedCallback` calls `auth.restoreSession()` — silently returns session from IndexedDB or null
- If session found: load preference, update UI — no popup, no handle prompt

---

## UI Changes

The picker gains a **sign-in zone** between the network list and the footer divider. Four mutually exclusive states:

### 1. Signed out
```
─────────────────────────────
Sign in to save preference      ← muted, small, tappable
─────────────────────────────
atShare
```

### 2. Handle input (revealed after clicking "Sign in to save preference")
```
Your AT Protocol handle
[ rob.bsky.social          ]
                    [ Continue ]
```
Error state (handle not found):
```
Your AT Protocol handle
[ notahandle               ]  ← red border
Couldn't find that handle
                    [ Continue ]
```

### 3. Waiting (popup open)
```
Opening sign-in…   [ Cancel ]
```
If `popup.closed` is true within 2s and no session arrived:
```
Sign-in cancelled              ← auto-clears after 3s, returns to signed-out
```
If popup never opened (blocked):
```
⚠ Popup blocked — allow popups for this site
```

### 4. Signed in
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
| Handle doesn't resolve | Inline: "Couldn't find that handle" under input, red border on field |
| Popup blocked | Inline: "⚠ Popup blocked — allow popups for this site", picker stays open |
| Popup closed before auth complete | `signIn()` rejects; inline: "Sign-in cancelled" (clears after 3s) |
| OAuth failed at PDS level | `signIn()` rejects; return to signed-out state; inline: "Sign-in failed" |
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

**`pds.js` uses `fetchHandler` instead of raw tokens.** The session object exposes a `fetchHandler(url, RequestInit): Promise<Response>` method that wraps `fetch` with DPoP header injection and automatic token refresh. `pds.js` calls `fetchHandler(url, init)` wherever it previously called `fetch(url, init)`, and drops all `Authorization` header construction.

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

Hosted at `https://atshare.social/oauth/callback`. This page is **bundled by Vite** — not served via CDN import — to avoid third-party CDN availability risk.

Source at `src/oauth-callback.js` (new file), built as a separate Vite entry point:

```js
// src/oauth-callback.js
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});
// handleCallback() reads window.location internally to extract `code` and `state`
// from the OAuth redirect — no arguments required.
await client.handleCallback();
window.close();
```

The HTML shell at `public/oauth/callback/index.html` loads the bundled script. The two `BrowserOAuthClient` instances (originating tab and callback page) use identical `clientId` and `handleResolver` values — this is required for the `BroadcastChannel` session handoff to succeed, as the channel key is derived from `clientId`.

`handleCallback()` completes the PKCE exchange, writes the session to IndexedDB, signals the originating tab via `BroadcastChannel`, then the popup closes.

---

## What Is Not In Scope

- Reading other users' preference records (requires their permission)
- Server-side token storage or proxy
- Multiple accounts / account switching
- localStorage fallback as a named feature (it exists silently as a fallback)
- Any network beyond Bluesky + Mastodon
