/**
 * Auth frame — runs on atshare.social inside a hidden <iframe>.
 *
 * Owns a BrowserOAuthClient instance so that OAuth sessions (stored in
 * origin-scoped IndexedDB) are always accessed from atshare.social,
 * regardless of which site embeds the <atshare-selector> component.
 *
 * Communication protocol:
 *   Parent → frame: { id, type, ...payload }
 *   Frame  → parent: { id, result } | { id, error }
 *   Frame  → parent (ready): { type: 'atshare-frame-ready' }
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { getPreference, putPreference } from './pds.js';

const CLIENT_ID = 'https://atshare.social/client-metadata.json';
const HANDLE_RESOLVER = 'https://bsky.social';

let _client = null;

/**
 * Initialize the BrowserOAuthClient, begin listening for postMessage
 * requests from the parent window, and set up a BroadcastChannel relay
 * for auth-complete messages from the callback page.
 *
 * Exported so tests can call it directly after mocking dependencies.
 */
export async function init() {
  // When embedded as a third-party iframe, browsers partition storage.
  // Request unpartitioned access so we can read sessions stored by the
  // OAuth callback popup (which runs as top-level atshare.social).
  // Auto-granted in Chrome/Brave after the user interacts with atshare.social
  // via the OAuth popup. Safari requires a user gesture (known limitation).
  if (document.requestStorageAccess) {
    try {
      await document.requestStorageAccess();
    } catch {
      // Access denied — continue with partitioned storage
    }
  }

  _client = await BrowserOAuthClient.load({
    clientId: CLIENT_ID,
    handleResolver: HANDLE_RESOLVER,
  });

  window.addEventListener('message', _onMessage);

  // Relay auth-complete/error from the callback page (same origin,
  // via BroadcastChannel) to the parent window (cross-origin, via postMessage).
  // This avoids relying on window.opener, which some browsers strip
  // when the popup navigates through a cross-origin PDS auth page.
  const authChannel = new BroadcastChannel('atshare-auth-channel');
  authChannel.addEventListener('message', (event) => {
    const { type } = event.data || {};
    if (type === 'atshare-auth-complete' || type === 'atshare-auth-error') {
      window.parent.postMessage(event.data, '*');
    }
  });

  window.parent.postMessage({ type: 'atshare-frame-ready' }, '*');
}

/**
 * Handle a single postMessage request from the parent window.
 * Responds with { id, result } or { id, error }.
 * @param {MessageEvent} event
 */
async function _onMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.id == null) return;
  if (event.source !== window.parent) return;

  const { id, type } = data;
  const source = event.source;

  try {
    let result;

    switch (type) {
      case 'restoreSession': {
        // Request unpartitioned storage on each check — the OAuth popup
        // may have just completed, granting first-party interaction status.
        if (document.requestStorageAccess) {
          try { await document.requestStorageAccess(); } catch {}
        }
        // Read the last-authenticated DID from localStorage (written by the
        // callback page after a successful OAuth exchange) and restore the
        // full session from IndexedDB. Using restore(sub) directly instead
        // of client.init() avoids re-running init logic on repeated calls.
        const sub = localStorage.getItem('@@atproto/oauth-client-browser(sub)');
        if (sub) {
          try {
            const session = await _client.restore(sub);
            result = { sub: session.sub };
          } catch {
            result = null;
          }
        } else {
          result = null;
        }
        break;
      }

      case 'signOut': {
        await _client.revoke(data.did);
        result = true;
        break;
      }

      case 'getPreference': {
        const session = await _client.restore(data.did);
        const tokenInfo = await session.getTokenInfo();
        const pdsEndpoint = tokenInfo.aud.replace(/\/+$/, '');
        result = await getPreference(
          pdsEndpoint,
          data.did,
          session.fetchHandler.bind(session)
        );
        break;
      }

      case 'putPreference': {
        const session = await _client.restore(data.did);
        const tokenInfo = await session.getTokenInfo();
        const pdsEndpoint = tokenInfo.aud.replace(/\/+$/, '');
        await putPreference(
          pdsEndpoint,
          data.did,
          session.fetchHandler.bind(session),
          data.preference
        );
        result = undefined;
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    source.postMessage({ id, result: result !== undefined ? result : null }, '*');
  } catch (err) {
    source.postMessage({ id, error: err.message || String(err) }, '*');
  }
}

/**
 * Reset module state for testing purposes only.
 * @internal
 */
export function _resetForTesting() {
  _client = null;
  window.removeEventListener('message', _onMessage);
}

// Auto-initialize when the module loads in a real browser context.
// In tests, vi.mock controls BrowserOAuthClient.load and callers invoke init() directly.
if (typeof window !== 'undefined' && window.parent !== window) {
  init();
}
