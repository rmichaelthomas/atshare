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

/**
 * Reset singleton state for testing purposes only.
 * @internal
 */
export function _resetForTesting() {
  _client = null;
  _session = null;
}
