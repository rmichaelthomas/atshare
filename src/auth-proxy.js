/**
 * Server-backed OAuth proxy for the atShare web component.
 *
 * Communicates with the atshare.social API server via fetch().
 * The server handles OAuth token management, DPoP signing, and PDS operations.
 * Uses HTTP-only cookies for session tracking (SameSite=None for cross-origin).
 *
 * This module is used for AUTHENTICATED operations (sign-in, sign-out, preference write).
 * Public preference reads use getPublicPreference() from pds.js directly.
 */

const API = 'https://atshare.social/atshare-api/api';

let _did = null;

/**
 * Get the OAuth authorization URL for the given handle.
 * The component handles popup management separately to avoid popup blockers.
 *
 * @param {string} handle - AT Protocol handle (e.g. "rob.bsky.social")
 * @returns {Promise<string>} the OAuth authorization URL to navigate to
 */
export async function getAuthUrl(handle) {
  const res = await fetch(
    `${API}/auth/login?handle=${encodeURIComponent(handle)}&returnUrl=${encodeURIComponent(window.location.href.split('#')[0])}`,
    { credentials: 'include' }
  );
  if (!res.ok) throw new Error('Failed to start sign-in');
  const { url } = await res.json();
  return url;
}

/**
 * Check if the user has an active session (via cookie).
 * @returns {Promise<{did: string|null}>}
 */
export async function checkSession() {
  const res = await fetch(`${API}/auth/session`, { credentials: 'include' });
  const data = await res.json();
  _did = data.did || null;
  return data;
}

/**
 * Sign out — revoke session on server and clear cookie.
 */
export async function signOut() {
  await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
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
  const res = await fetch(`${API}/preference`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ did, preference }),
  });
  if (!res.ok) throw new Error('Failed to write preference');
}
