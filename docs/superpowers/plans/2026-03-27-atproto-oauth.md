# AT Protocol OAuth Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire AT Protocol OAuth into `<atshare-selector>` so authenticated users can persist their share preference to their PDS as a `social.atshare.preference` record.

**Architecture:** `auth.js` wraps `BrowserOAuthClient` as a singleton. The component calls `auth.restoreSession()` on load and `auth.signIn(handle, { display: 'popup' })` when the user opts in. After auth, `pds.js` reads/writes the preference using the session's `fetchHandler` (the library's DPoP-aware fetch wrapper). A bundled callback page at `atshare.social/oauth/callback` completes the popup flow by calling `client.init()`.

**Tech Stack:** `@atproto/oauth-client-browser` (v0.3.x, already installed), Vite (web component + callback page builds), Vitest (unit tests), vanilla JS custom elements

---

## Library API Reference

Before implementing, note these exact API signatures from the installed library source:

```js
// BrowserOAuthClient.load() — async factory, restores existing sessions from localStorage
const client = await BrowserOAuthClient.load({ clientId, handleResolver });

// client.init() — auto-detects callback params OR restores session. Use on callback page.
const result = await client.init(); // returns { session } or undefined

// client.signIn(handle, options) — popup mode
const session = await client.signIn(handle, {
  display: 'popup',
  signal: abortController.signal, // optional: cancels the popup flow
});

// session.sub — the user's DID (AtprotoDid)
// session.fetchHandler(pathname, init?) — DPoP-aware fetch wrapper
//   pathname is resolved against the PDS endpoint (tokenSet.aud)
//   Can also pass a full URL — new URL(fullUrl, base) ignores base when fullUrl is absolute
const res = await session.fetchHandler('/xrpc/com.atproto.repo.getRecord?...', { method: 'GET' });
```

**Callback page**: `client.init()` detects the OAuth callback params, completes the PKCE exchange via BroadcastChannel, and calls `window.close()` automatically. No manual `window.close()` needed.

**Cancellation**: `signInPopup` opens the popup internally — we cannot access the popup object to poll `popup.closed`. Instead, wire a Cancel button to `AbortController.abort()` which rejects the `signIn()` promise.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/pds.js` | MODIFY | Swap `accessToken: string` → `fetchHandler: Function` on both exports |
| `src/auth.js` | CREATE | `BrowserOAuthClient` singleton; `signIn`, `restoreSession`, `signOut` |
| `src/oauth-callback.js` | CREATE | Callback page entry point — calls `client.init()` |
| `src/atshare-selector.js` | MODIFY | Sign-in zone UI (4 states) + auth wiring |
| `public/oauth/callback/index.html` | CREATE | HTML shell for bundled callback page |
| `public/client-metadata.json` | CREATE | AT Protocol OAuth client registration document |
| `vite.config.js` | MODIFY | Add callback page as second build entry |
| `vitest.config.js` | CREATE | Test runner config |
| `tests/pds.test.js` | CREATE | Unit tests for updated pds.js |
| `tests/auth.test.js` | CREATE | Unit tests for auth.js |

---

## Task 1: Set up Vitest and update `pds.js`

This is the most testable change and the foundation everything else builds on.

**Files:**
- Create: `vitest.config.js`
- Create: `tests/pds.test.js`
- Modify: `src/pds.js`

- [ ] **Step 1.1: Install Vitest**

```bash
npm install --save-dev vitest
```

Expected: `vitest` added to `devDependencies` in `package.json`.

- [ ] **Step 1.2: Create `vitest.config.js`**

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 1.3: Add test script to `package.json`**

Add to the `scripts` block:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.4: Write failing tests for the updated `pds.js` signatures**

```js
// tests/pds.test.js
import { describe, it, expect, vi } from 'vitest';
import { getPreference, putPreference, PREFERENCE_NSID } from '../src/pds.js';

describe('getPreference', () => {
  it('calls fetchHandler with the correct XRPC URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ value: { primaryNetwork: 'bluesky', networks: [] } }),
    });

    const result = await getPreference(
      'https://pds.example.com',
      'did:plc:abc123',
      mockFetch
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/xrpc/com.atproto.repo.getRecord');
    expect(url).toContain('repo=did%3Aplc%3Aabc123');
    expect(url).toContain(`collection=${PREFERENCE_NSID}`);
    expect(url).toContain('rkey=self');
    expect(result).toEqual({ primaryNetwork: 'bluesky', networks: [] });
  });

  it('returns null when the record does not exist (400)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const result = await getPreference('https://pds.example.com', 'did:plc:abc', mockFetch);
    expect(result).toBeNull();
  });

  it('throws on unexpected errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(
      getPreference('https://pds.example.com', 'did:plc:abc', mockFetch)
    ).rejects.toThrow('getRecord failed: 500');
  });

  it('does NOT set an Authorization header (fetchHandler owns auth)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ value: {} }),
    });
    await getPreference('https://pds.example.com', 'did:plc:abc', mockFetch);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers ?? {});
    expect(headers.has('Authorization')).toBe(false);
  });
});

describe('putPreference', () => {
  it('calls fetchHandler with POST to putRecord URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const pref = { primaryNetwork: 'bluesky', networks: [] };

    await putPreference('https://pds.example.com', 'did:plc:abc123', mockFetch, pref);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/xrpc/com.atproto.repo.putRecord');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.collection).toBe(PREFERENCE_NSID);
    expect(body.rkey).toBe('self');
    expect(body.record.$type).toBe(PREFERENCE_NSID);
    expect(body.record.primaryNetwork).toBe('bluesky');
  });

  it('does NOT set an Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await putPreference('https://pds.example.com', 'did:plc:abc', mockFetch, {});
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers ?? {});
    expect(headers.has('Authorization')).toBe(false);
  });

  it('throws when putRecord fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(
      putPreference('https://pds.example.com', 'did:plc:abc', mockFetch, {})
    ).rejects.toThrow('putRecord failed: 401');
  });
});
```

- [ ] **Step 1.5: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `getPreference` and `putPreference` are being called with 3/4 args but the current implementation uses `accessToken` as the 3rd parameter.

- [ ] **Step 1.6: Update `src/pds.js`**

Replace the entire file:

```js
/**
 * PDS preference record read/write.
 *
 * Reads and writes social.atshare.preference to the user's PDS.
 * Uses the session's fetchHandler from @atproto/oauth-client-browser,
 * which automatically handles DPoP headers and token refresh.
 * Callers do NOT set Authorization headers — fetchHandler owns auth.
 */

export const PREFERENCE_NSID = 'social.atshare.preference';

/**
 * Read the user's atShare preference record from their PDS.
 * @param {string} pdsEndpoint - e.g. "https://morel.us-east.host.bsky.network"
 * @param {string} did - the user's DID
 * @param {Function} fetchHandler - session.fetchHandler from oauth-client-browser
 * @returns {Promise<object|null>} preference record value, or null if not found
 */
export async function getPreference(pdsEndpoint, did, fetchHandler) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${PREFERENCE_NSID}&rkey=self`;
  const res = await fetchHandler(url);
  if (res.status === 400) return null; // record not found
  if (!res.ok) throw new Error(`getRecord failed: ${res.status}`);
  const { value } = await res.json();
  return value;
}

/**
 * Write the user's atShare preference record to their PDS.
 * @param {string} pdsEndpoint
 * @param {string} did
 * @param {Function} fetchHandler - session.fetchHandler from oauth-client-browser
 * @param {object} preference - the preference data to write
 */
export async function putPreference(pdsEndpoint, did, fetchHandler, preference) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.putRecord`;
  const body = {
    repo: did,
    collection: PREFERENCE_NSID,
    rkey: 'self',
    record: { $type: PREFERENCE_NSID, ...preference },
  };
  const res = await fetchHandler(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`putRecord failed: ${res.status}`);
}
```

- [ ] **Step 1.7: Run tests — verify they pass**

```bash
npm test
```

Expected: All 6 tests PASS.

- [ ] **Step 1.8: Commit**

```bash
git add src/pds.js tests/pds.test.js vitest.config.js package.json package-lock.json
git commit -m "feat: swap pds.js accessToken for fetchHandler, add Vitest"
```

---

## Task 2: Create `src/auth.js`

**Files:**
- Create: `src/auth.js`
- Create: `tests/auth.test.js`

- [ ] **Step 2.1: Write failing tests for `auth.js`**

```js
// tests/auth.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the library before importing auth.js
vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: {
    load: vi.fn(),
  },
}));

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { signIn, restoreSession, signOut } from '../src/auth.js';

const makeSession = (sub = 'did:plc:test') => ({
  sub,
  fetchHandler: vi.fn(),
});

const makeClient = (overrides = {}) => ({
  signIn: vi.fn().mockResolvedValue(makeSession()),
  init: vi.fn().mockResolvedValue(undefined),
  revoke: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the singleton between tests by re-mocking load
});

describe('restoreSession', () => {
  it('returns null when no existing session', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue(undefined) })
    );
    const session = await restoreSession();
    expect(session).toBeNull();
  });

  it('returns session when one exists', async () => {
    const session = makeSession();
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue({ session }) })
    );
    const result = await restoreSession();
    expect(result).toBe(session);
  });
});

describe('signIn', () => {
  it('calls client.signIn with handle and popup display', async () => {
    const session = makeSession();
    const mockClient = makeClient({ signIn: vi.fn().mockResolvedValue(session) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    // Ensure client is initialized
    await restoreSession();

    const result = await signIn('rob.bsky.social');
    expect(mockClient.signIn).toHaveBeenCalledWith(
      'rob.bsky.social',
      expect.objectContaining({ display: 'popup' })
    );
    expect(result).toBe(session);
  });

  it('rejects when signIn is cancelled', async () => {
    const mockClient = makeClient({
      signIn: vi.fn().mockRejectedValue(new Error('Aborted')),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await restoreSession();

    await expect(signIn('rob.bsky.social')).rejects.toThrow('Aborted');
  });
});

describe('signOut', () => {
  it('revokes the current session', async () => {
    const session = makeSession('did:plc:signout');
    const mockClient = makeClient({
      init: vi.fn().mockResolvedValue({ session }),
      revoke: vi.fn().mockResolvedValue(undefined),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    await restoreSession();
    await signOut();

    expect(mockClient.revoke).toHaveBeenCalledWith('did:plc:signout');
  });

  it('is a no-op when not signed in', async () => {
    const mockClient = makeClient({ init: vi.fn().mockResolvedValue(undefined) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    await restoreSession();
    await expect(signOut()).resolves.not.toThrow();
  });
});
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
npm test tests/auth.test.js
```

Expected: FAIL — `../src/auth.js` does not exist.

- [ ] **Step 2.3: Create `src/auth.js`**

```js
/**
 * AT Protocol OAuth client wrapper.
 *
 * Owns a singleton BrowserOAuthClient instance.
 * The component imports this module and never touches @atproto/oauth-client-browser directly.
 *
 * Session lifecycle:
 *   restoreSession() — call on component load; returns existing session from IndexedDB or null
 *   signIn(handle)   — opens popup, returns session on success, rejects on cancel/error
 *   signOut()        — revokes the current session
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const CLIENT_ID = 'https://atshare.social/client-metadata.json';
const HANDLE_RESOLVER = 'https://bsky.social';

let _client = null;   // BrowserOAuthClient singleton
let _session = null;  // current OAuthSession or null

/**
 * Lazily initialize and return the BrowserOAuthClient singleton.
 * @returns {Promise<BrowserOAuthClient>}
 */
async function getClient() {
  if (!_client) {
    _client = await BrowserOAuthClient.load({
      clientId: CLIENT_ID,
      handleResolver: HANDLE_RESOLVER,
    });
  }
  return _client;
}

/**
 * Attempt to restore an existing session from IndexedDB (no popup, no network).
 * @returns {Promise<OAuthSession|null>}
 */
export async function restoreSession() {
  try {
    const client = await getClient();
    const result = await client.init();
    _session = result?.session ?? null;
    return _session;
  } catch {
    _session = null;
    return null;
  }
}

/**
 * Sign in via AT Protocol OAuth popup.
 * Pass an AbortController signal to support a Cancel button.
 *
 * @param {string} handle - e.g. "rob.bsky.social"
 * @param {AbortSignal} [signal] - optional cancellation signal
 * @returns {Promise<OAuthSession>}
 */
export async function signIn(handle, signal) {
  const client = await getClient();
  _session = await client.signIn(handle, { display: 'popup', signal });
  return _session;
}

/**
 * Sign out and revoke the current session.
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (!_session) return;
  const client = await getClient();
  const sub = _session.sub;
  _session = null;
  await client.revoke(sub);
}

/**
 * Return the current session, or null if not signed in.
 * @returns {OAuthSession|null}
 */
export function getSession() {
  return _session;
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
npm test
```

Expected: All tests PASS (pds + auth).

- [ ] **Step 2.5: Commit**

```bash
git add src/auth.js tests/auth.test.js
git commit -m "feat: add auth.js — BrowserOAuthClient singleton with signIn/restoreSession/signOut"
```

---

## Task 3: OAuth callback page + Vite config

**Files:**
- Create: `src/oauth-callback.js`
- Create: `public/oauth/callback/index.html`
- Modify: `vite.config.js`

- [ ] **Step 3.1: Create `src/oauth-callback.js`**

```js
/**
 * OAuth callback page entry point.
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params (?code=...&state=...) in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Sends the session to the originating tab via BroadcastChannel
 *   4. Calls window.close() to close the popup
 *
 * The clientId and handleResolver MUST be identical to the values used
 * in auth.js — the BroadcastChannel key is derived from clientId.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

// init() auto-detects callback params and handles everything.
// window.close() is called internally by the library on success.
await client.init();
```

- [ ] **Step 3.2: Create `public/oauth/callback/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>atShare — Signing in…</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      color: #475569;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <p>Completing sign-in…</p>
  <script type="module" src="/src/oauth-callback.js"></script>
</body>
</html>
```

- [ ] **Step 3.3: Update `vite.config.js` to support callback page + component library builds**

The library build (ES + UMD) keeps `@atproto/oauth-client-browser` external.
The callback page build bundles it.

Replace the entire file:

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

// Detect which build target via env var
// npm run build         → component library
// npm run build:callback → callback page app
const isCallback = process.env.BUILD_TARGET === 'callback';

export default defineConfig(
  isCallback
    ? {
        // App build for the callback page — bundles all dependencies
        build: {
          outDir: 'dist/oauth/callback',
          rollupOptions: {
            input: resolve(__dirname, 'public/oauth/callback/index.html'),
          },
        },
      }
    : {
        // Library build for the web component — keeps oauth lib external
        build: {
          outDir: 'dist',
          lib: {
            entry: resolve(__dirname, 'src/atshare-selector.js'),
            name: 'AtshareSelector',
            fileName: 'atshare-selector',
            formats: ['es', 'umd'],
          },
          rollupOptions: {
            external: ['@atproto/oauth-client-browser'],
          },
        },
      }
);
```

- [ ] **Step 3.4: Add build scripts to `package.json`**

Update the `scripts` block to add:
```json
"build:callback": "BUILD_TARGET=callback vite build"
```

- [ ] **Step 3.5: Verify dev server still works**

```bash
npm run dev
```

Open `http://localhost:5173/demo/` — the Share buttons should appear and work as before. Check browser console for errors.

- [ ] **Step 3.6: Commit**

```bash
git add src/oauth-callback.js public/oauth/callback/index.html vite.config.js package.json
git commit -m "feat: add OAuth callback page and dual Vite build config"
```

---

## Task 4: Client metadata document

**Files:**
- Create: `public/client-metadata.json`

- [ ] **Step 4.1: Create `public/client-metadata.json`**

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

This file must be served at `https://atshare.social/client-metadata.json` with `Content-Type: application/json` and CORS header `Access-Control-Allow-Origin: *`. Deploy it to the atshare.social server before testing live OAuth.

- [ ] **Step 4.2: Commit**

```bash
git add public/client-metadata.json
git commit -m "feat: add AT Protocol OAuth client metadata document"
```

---

## Task 5: Add sign-in zone to the component template

This task adds HTML and CSS only — no JavaScript logic yet. Verify visually in the demo before wiring.

**Files:**
- Modify: `src/atshare-selector.js` (template section only)

- [ ] **Step 5.1: Add sign-in zone styles to the template `<style>` block**

In `src/atshare-selector.js`, locate the `<style>` block in `TEMPLATE.innerHTML`. Add after the `.footer` styles:

```css
    /* --- Sign-in zone --- */
    .signin-zone {
      padding: 6px 10px;
    }

    /* State: signed-out — single "Sign in to save preference" link */
    .signin-prompt {
      display: none;
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
    }
    .signin-prompt:hover { color: #64748b; }

    /* State: handle-input */
    .signin-handle-wrap {
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .signin-handle-wrap label {
      font-size: 12px;
      color: #64748b;
    }
    .signin-handle-wrap input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid var(--atshare-border, #e2e8f0);
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .signin-handle-wrap input.error { border-color: #ef4444; }
    .signin-handle-wrap .signin-error {
      font-size: 11px;
      color: #ef4444;
      display: none;
    }
    .signin-handle-wrap .signin-error.visible { display: block; }
    .signin-handle-wrap .signin-continue-btn {
      align-self: flex-end;
      padding: 5px 12px;
      border: none;
      border-radius: 4px;
      background: var(--atshare-accent, #1d4ed8);
      color: #fff;
      font-size: 13px;
      cursor: pointer;
    }

    /* State: waiting (popup open) */
    .signin-waiting {
      display: none;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: #64748b;
    }
    .signin-waiting .signin-cancel-btn {
      font-size: 12px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-waiting .signin-cancel-btn:hover { color: #64748b; }

    /* State: signed-in */
    .signin-info {
      display: none;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #475569;
    }
    .signin-info .signin-handle { font-weight: 500; }
    .signin-info .signin-signout-btn {
      font-size: 11px;
      color: #94a3b8;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
    }
    .signin-info .signin-signout-btn:hover { color: #64748b; }

    /* Visibility helpers — applied to parent .signin-zone */
    .signin-zone.state-signedout  .signin-prompt      { display: block; }
    .signin-zone.state-handle     .signin-handle-wrap { display: flex; }
    .signin-zone.state-waiting    .signin-waiting      { display: flex; }
    .signin-zone.state-signedin   .signin-info         { display: flex; }
```

- [ ] **Step 5.2: Add sign-in zone HTML to the template, between the Mastodon wrap and the divider**

Locate this in `TEMPLATE.innerHTML`:
```html
      <div class="divider"></div>
      <div class="footer">
```

Insert before the divider:
```html
      <div class="signin-zone state-signedout">
        <button class="signin-prompt">Sign in to save preference</button>

        <div class="signin-handle-wrap">
          <label>Your AT Protocol handle</label>
          <input type="text" class="signin-handle-input" placeholder="rob.bsky.social" autocomplete="username" spellcheck="false">
          <span class="signin-error"></span>
          <button class="signin-continue-btn">Continue</button>
        </div>

        <div class="signin-waiting">
          <span>Opening sign-in…</span>
          <button class="signin-cancel-btn">Cancel</button>
        </div>

        <div class="signin-info">
          <span class="signin-handle"></span>
          <button class="signin-signout-btn">Sign out</button>
        </div>
      </div>
```

- [ ] **Step 5.3: Verify visually in the dev server**

With `npm run dev` running, open `http://localhost:5173/demo/`. Click Share → you should see the "Sign in to save preference" text appear in the popover between the network list and the "atShare" footer. No broken layout.

To test other states, run in browser console:
```js
const zone = document.querySelector('atshare-selector').shadowRoot.querySelector('.signin-zone');
zone.className = 'signin-zone state-handle';    // shows handle input
zone.className = 'signin-zone state-waiting';   // shows "Opening sign-in…"
zone.className = 'signin-zone state-signedin';  // shows signed-in row
zone.className = 'signin-zone state-signedout'; // back to default
```

- [ ] **Step 5.4: Commit**

```bash
git add src/atshare-selector.js
git commit -m "feat: add sign-in zone HTML/CSS to component (4 states, no logic yet)"
```

---

## Task 6: Wire auth logic into `atshare-selector.js`

**Files:**
- Modify: `src/atshare-selector.js`

- [ ] **Step 6.1: Add imports and query new DOM elements in the constructor**

At the top of `src/atshare-selector.js`, the file currently has:
```js
import { NETWORKS, buildIntentUrl } from './networks.js';
import { getPreference, putPreference } from './pds.js';
```

**Keep both existing imports.** Add two new imports after them:
```js
import { signIn, restoreSession, signOut, getSession } from './auth.js';
import { resolvePdsEndpoint } from './identity.js';
```

In the `constructor()`, after the existing `this._labelText = ...` line, add:
```js
    // Sign-in zone elements
    this._signinZone        = this.shadowRoot.querySelector('.signin-zone');
    this._signinPrompt      = this.shadowRoot.querySelector('.signin-prompt');
    this._signinHandleWrap  = this.shadowRoot.querySelector('.signin-handle-wrap');
    this._signinHandleInput = this.shadowRoot.querySelector('.signin-handle-input');
    this._signinError       = this.shadowRoot.querySelector('.signin-error');
    this._signinContinueBtn = this.shadowRoot.querySelector('.signin-continue-btn');
    this._signinWaiting     = this.shadowRoot.querySelector('.signin-waiting');
    this._signinCancelBtn   = this.shadowRoot.querySelector('.signin-cancel-btn');
    this._signinInfo        = this.shadowRoot.querySelector('.signin-info');
    this._signinHandle      = this.shadowRoot.querySelector('.signin-handle');
    this._signinSignoutBtn  = this.shadowRoot.querySelector('.signin-signout-btn');

    this._signinAbortController = null; // used to cancel popup

    // Event listeners for sign-in zone
    this._signinPrompt.addEventListener('click', () => this._setSigninState('handle'));
    this._signinContinueBtn.addEventListener('click', () => this._onSigninContinue());
    this._signinHandleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._onSigninContinue();
    });
    this._signinCancelBtn.addEventListener('click', () => this._onSigninCancel());
    this._signinSignoutBtn.addEventListener('click', () => this._onSignOut());
```

- [ ] **Step 6.2: Add `_setSigninState()` method**

Add this method to the class (after `_setMastodonInstance`):

```js
  /**
   * Switch the sign-in zone to one of: 'signedout' | 'handle' | 'waiting' | 'signedin'
   * @param {'signedout'|'handle'|'waiting'|'signedin'} state
   * @param {object} [opts]
   * @param {string} [opts.handle] - display handle for 'signedin' state
   * @param {string} [opts.errorMsg] - error message for 'handle' state
   */
  _setSigninState(state, opts = {}) {
    this._signinZone.className = `signin-zone state-${state}`;

    // Clear error on state transitions (unless explicitly setting one)
    if (state !== 'handle' || !opts.errorMsg) {
      this._signinError.textContent = '';
      this._signinError.classList.remove('visible');
      this._signinHandleInput.classList.remove('error');
    }

    if (state === 'handle' && opts.errorMsg) {
      this._signinError.textContent = opts.errorMsg;
      this._signinError.classList.add('visible');
      this._signinHandleInput.classList.add('error');
    }

    if (state === 'signedin' && opts.handle) {
      this._signinHandle.textContent = `✓ ${opts.handle}`;
    }
  }
```

- [ ] **Step 6.3: Add `_onSigninContinue()` method**

```js
  async _onSigninContinue() {
    const handle = this._signinHandleInput.value.trim();
    if (!handle) return;

    this._setSigninState('waiting');

    this._signinAbortController = new AbortController();

    try {
      const session = await signIn(handle, this._signinAbortController.signal);
      this._signinAbortController = null;

      // Load preference from PDS (non-blocking; errors are silent)
      try {
        const pdsEndpoint = await resolvePdsEndpoint(session.sub);
        const pref = await getPreference(pdsEndpoint, session.sub, session.fetchHandler);
        if (pref) {
          this._preference = pref;
          this._renderNetworks();
        }
      } catch {
        // Preference load failure is silent — share still works
      }

      // TODO: resolve DID to handle for display (see Known Limitations)
      this._setSigninState('signedin', { handle: session.sub });
    } catch (err) {
      this._signinAbortController = null;
      const msg = err?.message?.includes('Abort') || err?.message?.includes('cancel')
        ? 'Sign-in cancelled'
        : 'Sign-in failed — try again';
      this._setSigninState('handle', { errorMsg: msg });
    }
  }
```

- [ ] **Step 6.4: Add `_onSigninCancel()` and `_onSignOut()` methods**

```js
  _onSigninCancel() {
    this._signinAbortController?.abort();
    this._signinAbortController = null;
    this._setSigninState('signedout');
  }

  async _onSignOut() {
    await signOut();
    this._preference = null;
    this._renderNetworks();
    this._setSigninState('signedout');
    this._signinHandleInput.value = '';
  }
```

- [ ] **Step 6.5: Update `connectedCallback` to attempt session restore**

Replace:
```js
  connectedCallback() {
    this._render();
  }
```

With:
```js
  connectedCallback() {
    this._render();
    this._tryRestoreSession();
  }

  async _tryRestoreSession() {
    try {
      const session = await restoreSession();
      if (!session) return;

      try {
        const pdsEndpoint = await resolvePdsEndpoint(session.sub);
        const pref = await getPreference(pdsEndpoint, session.sub, session.fetchHandler);
        if (pref) {
          this._preference = pref;
          this._renderNetworks();
        }
      } catch {
        // Preference load failure is silent
      }

      // TODO: resolve DID to handle for display (see Known Limitations)
      this._setSigninState('signedin', { handle: session.sub });
    } catch {
      // restoreSession failure is silent — show signed-out state (default)
    }
  }
```

- [ ] **Step 6.6: Update `_persistPreference()` to write to PDS when authenticated**

Replace the existing `_persistPreference()` method:

```js
  _persistPreference(networkId, opts) {
    const pref = {
      primaryNetwork: networkId,
      networks: this._buildNetworksArray(networkId, opts),
    };

    // Always write to localStorage as fallback
    try {
      localStorage.setItem('atshare.preference', JSON.stringify(pref));
    } catch {
      // localStorage unavailable — no-op
    }

    // Write to PDS if authenticated (fire-and-forget, don't await)
    const session = getSession();
    if (session) {
      resolvePdsEndpoint(session.sub)
        .then((pdsEndpoint) =>
          putPreference(pdsEndpoint, session.sub, session.fetchHandler, pref)
        )
        .catch(() => {
          // PDS write failure is silent — localStorage fallback already written
        });
    }
  }
```

- [ ] **Step 6.7: Verify in the dev server**

```bash
npm run dev
```

Open `http://localhost:5173/demo/`. Click Share:
- ✅ "Sign in to save preference" appears at the bottom of the picker
- ✅ Clicking it transitions to handle input state
- ✅ Bluesky and Mastodon still work as before

Signing in fully requires deploying `client-metadata.json` to atshare.social first (see Task 4 deployment note). Until then, the UI states work but `signIn()` will fail at the library's authorization URL discovery step.

- [ ] **Step 6.8: Run all tests**

```bash
npm test
```

Expected: All tests still PASS. (The component logic is not unit-tested here — it requires a real browser for Shadow DOM. The auth and pds modules are covered.)

- [ ] **Step 6.9: Commit**

```bash
git add src/atshare-selector.js
git commit -m "feat: wire auth into atshare-selector — sign-in zone, session restore, PDS preference write"
```

---

## Task 7: Final integration and push

- [ ] **Step 7.1: Deploy `public/client-metadata.json` to atshare.social**

The file must be served at `https://atshare.social/client-metadata.json` with:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *`

Verify with:
```bash
curl -I https://atshare.social/client-metadata.json
```

Expected: `HTTP/2 200`, `content-type: application/json`, `access-control-allow-origin: *`

- [ ] **Step 7.2: Deploy the callback page to atshare.social**

Build the callback page:
```bash
npm run build:callback
```

Deploy `dist/oauth/callback/` to the server so it's served at `https://atshare.social/oauth/callback/`.

Verify with:
```bash
curl -s https://atshare.social/oauth/callback/ | head -5
```

Expected: Returns HTML containing `<title>atShare — Signing in…</title>`.

- [ ] **Step 7.3: End-to-end smoke test**

With both server files deployed:
1. Open `http://localhost:5173/demo/`
2. Click Share → click "Sign in to save preference"
3. Enter your AT Protocol handle → click Continue
4. A popup should open to your PDS's authorization page
5. Authorize the app
6. Popup closes → picker shows "✓ your.handle Sign out"
7. Click Bluesky to share → verify the preference is written (check browser DevTools → Application → IndexedDB for the session)
8. Reload the page → component should auto-restore the session and show signed-in state

- [ ] **Step 7.4: Push everything**

```bash
git push origin main
```

---

## Known Limitations (not blocking for MVP)

- **`session.sub` shows a DID, not the handle** in the signed-in state (e.g. `✓ did:plc:abc123` instead of `✓ rob.bsky.social`). Fix in a follow-up: call `identity.resolveHandleToDid()` in reverse (use `com.atproto.identity.resolveHandle` or PLC directory `alsoKnownAs` field to get the handle from DID).
- **Multiple `<atshare-selector>` instances** on one page share the same session singleton but each maintains its own UI state — this is correct behavior.
- **`@atproto/oauth-client-browser` is currently `external`** in the lib build. Sites embedding the component must provide the library themselves or we need to bundle it in a future UMD build.
