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
 * Initialize the BrowserOAuthClient and begin listening for postMessage
 * requests from the parent window.
 *
 * Exported so tests can call it directly after mocking dependencies.
 */
export async function init() {
  _client = await BrowserOAuthClient.load({
    clientId: CLIENT_ID,
    handleResolver: HANDLE_RESOLVER,
  });

  window.addEventListener('message', _onMessage);

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
        const initResult = await _client.init();
        result = initResult?.session ? { sub: initResult.session.sub } : null;
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
        result = await getPreference(
          tokenInfo.aud,
          data.did,
          session.fetchHandler.bind(session)
        );
        break;
      }

      case 'putPreference': {
        const session = await _client.restore(data.did);
        const tokenInfo = await session.getTokenInfo();
        await putPreference(
          tokenInfo.aud,
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
