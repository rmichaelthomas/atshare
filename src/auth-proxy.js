/**
 * Server-backed OAuth proxy for the atShare web component.
 *
 * Routes all authenticated API calls through a hidden iframe proxy on
 * atshare.social, avoiding third-party cookie restrictions. The iframe
 * makes same-origin requests and stores the session token in its own
 * (partitioned) localStorage.
 *
 * This module is used for AUTHENTICATED operations (sign-in, sign-out, preference write).
 * Public preference reads use getPublicPreference() from pds.js directly.
 */

import { proxyRequest, storeToken } from './iframe-proxy.js';

let _did = null;

/**
 * Get the OAuth authorization URL for the given handle.
 * The component handles popup management separately to avoid popup blockers.
 *
 * @param {string} handle - AT Protocol handle (e.g. "rob.bsky.social")
 * @returns {Promise<string>} the OAuth authorization URL to navigate to
 */
export async function getAuthUrl(handle) {
  const data = await proxyRequest('getAuthUrl', {
    handle,
    returnUrl: window.location.href.split('#')[0],
  });
  return data.url;
}

/**
 * Handle the OAuth callback postMessage from the popup.
 * Stores the session token in the iframe proxy and caches the DID.
 *
 * @param {string} sessionId - session token from the callback
 * @param {string} did - the authenticated user's DID
 */
export async function handleAuthCallback(sessionId, did) {
  await storeToken(sessionId);
  _did = did;
}

/**
 * Check if the user has an active session (via iframe proxy).
 * @returns {Promise<{did: string|null}>}
 */
export async function checkSession() {
  const data = await proxyRequest('checkSession');
  _did = data.did || null;
  return data;
}

/**
 * Sign out — revoke session on server via iframe proxy.
 */
export async function signOut() {
  await proxyRequest('signOut');
  _did = null;
}

/**
 * Get the current session DID (cached, sync).
 * @returns {{sub: string}|null}
 */
export function getSession() {
  return _did ? { sub: _did } : null;
}

/**
 * Write a preference to the user's PDS via the server proxy.
 * @param {string} did
 * @param {object} preference
 */
export async function putPreference(did, preference) {
  await proxyRequest('putPreference', { did, preference });
}
