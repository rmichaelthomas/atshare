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
 * Start the OAuth sign-in flow.
 * Opens a popup to the PDS authorization page (URL provided by the server).
 * Must be called from a user gesture (click handler) to avoid popup blockers.
 *
 * @param {string} handle - AT Protocol handle (e.g. "rob.bsky.social")
 * @returns {Promise<{sub: string}>} resolves with the user's DID
 */
export async function signIn(handle) {
  // Get the OAuth authorization URL from the server
  const res = await fetch(
    `${API}/auth/login?handle=${encodeURIComponent(handle)}&returnUrl=${encodeURIComponent(window.location.href.split('#')[0])}`,
    { credentials: 'include' }
  );
  if (!res.ok) throw new Error('Failed to start sign-in');
  const { url } = await res.json();

  // Open popup to the OAuth URL (must be synchronous with user gesture)
  const popup = window.open(url, 'atshare-auth', 'width=600,height=700');
  if (!popup) throw new Error('Popup was blocked. Allow popups for this site and try again.');

  // Wait for the popup to close (user completes auth or cancels)
  return new Promise((resolve, reject) => {
    const poll = setInterval(async () => {
      try {
        if (!popup.closed) return;
      } catch {
        // cross-origin access error — popup is on different origin, keep waiting
        return;
      }
      clearInterval(poll);

      // Check if a session was established (cookie set by callback)
      try {
        const session = await checkSession();
        if (session.did) {
          _did = session.did;
          resolve({ sub: session.did });
        } else {
          reject(new Error('Sign-in cancelled'));
        }
      } catch {
        reject(new Error('Sign-in cancelled'));
      }
    }, 1000);

    // Safety timeout
    setTimeout(() => {
      clearInterval(poll);
      reject(new Error('Sign-in timed out'));
    }, 120000);
  });
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
