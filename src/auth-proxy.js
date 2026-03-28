/**
 * Cross-origin OAuth proxy for the atShare web component.
 *
 * The component (<atshare-selector>) runs on any embedding site. OAuth and PDS
 * operations must happen on atshare.social because the OAuth library uses
 * origin-scoped IndexedDB. This module handles all cross-origin communication
 * via postMessage — it never imports @atproto/oauth-client-browser.
 *
 * Two communication channels:
 *   Popup  — window.open() to atshare.social/auth/?handle=... for sign-in
 *   iframe  — hidden <iframe> to atshare.social/auth-frame.html for everything else
 */

export const ATSHARE_ORIGIN = 'https://atshare.social';

// Cached current DID for sync getSession() access
let _did = null;

// Reference to the open sign-in popup (for cancelSignIn)
let _currentPopup = null;

// iframe readiness — a single Promise that resolves when the frame is ready.
// Stays set across calls so _ensureFrame() is idempotent.
let _frameReady = null;

// Resolver for _frameReady, called when atshare-frame-ready message arrives.
let _frameReadyResolve = null;

// The actual iframe element once created
let _frame = null;

// Map of pending postMessage request ids → { resolve, reject }
const _pending = new Map();

/**
 * Ensure the hidden auth iframe exists and is ready.
 * Idempotent — repeated calls return the same Promise.
 * @returns {Promise<void>}
 */
export function _ensureFrame() {
  if (_frameReady) return _frameReady;

  _frameReady = new Promise((resolve) => {
    _frameReadyResolve = resolve;

    _frame = document.createElement('iframe');
    _frame.src = `${ATSHARE_ORIGIN}/auth-frame.html`;
    _frame.style.display = 'none';
    _frame.setAttribute('aria-hidden', 'true');

    window.addEventListener('message', _onMessage);
    document.body.appendChild(_frame);
  });

  return _frameReady;
}

/**
 * Central postMessage listener for both iframe responses and popup signals.
 * @param {MessageEvent} event
 */
function _onMessage(event) {
  if (event.origin !== ATSHARE_ORIGIN) return;

  const data = event.data;
  if (!data || typeof data !== 'object') return;

  // iframe ready signal
  if (data.type === 'atshare-frame-ready') {
    if (_frameReadyResolve) {
      _frameReadyResolve();
      _frameReadyResolve = null;
    }
    return;
  }

  // iframe response to a postToFrame request (has an id)
  if (data.id != null && _pending.has(data.id)) {
    const { resolve, reject, timeout } = _pending.get(data.id);
    _pending.delete(data.id);
    clearTimeout(timeout);
    if ('error' in data) {
      reject(new Error(data.error));
    } else {
      resolve(data.result);
    }
    return;
  }
}

/**
 * Send a message to the hidden iframe and return a Promise for the response.
 * Generates a unique id so responses can be correlated.
 * @param {object} message - will be augmented with a unique `id`
 * @returns {Promise<any>}
 */
export function _postToFrame(message) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const timeout = setTimeout(() => {
      _pending.delete(id);
      reject(new Error('Auth frame request timed out'));
    }, 10000);

    _pending.set(id, { resolve, reject, timeout });
    _frame.contentWindow.postMessage({ ...message, id }, ATSHARE_ORIGIN);
  });
}

/**
 * Sign in via AT Protocol OAuth popup.
 * Must be called from a user gesture so window.open() is not blocked.
 *
 * @param {string} handle - e.g. "rob.bsky.social"
 * @returns {Promise<{sub: string}>}
 */
export function signIn(handle) {
  // Open popup SYNCHRONOUSLY in user gesture context to avoid popup blockers.
  const url = `${ATSHARE_ORIGIN}/auth/?handle=${encodeURIComponent(handle)}`;
  const popup = window.open(url, 'atshare-auth', 'width=600,height=700');

  if (!popup) {
    return Promise.reject(new Error('Popup was blocked. Allow popups for this site and try again.'));
  }

  // Ensure the iframe is loaded so its BroadcastChannel relay is active
  // before the callback page broadcasts the auth result. The iframe loads
  // in <1s; the auth flow takes several seconds (user authorizes at PDS),
  // so the relay will be ready in time.
  _ensureFrame();

  return new Promise((resolve, reject) => {

    _currentPopup = popup;

    // Poll the auth-frame for a session appearing in IndexedDB.
    // We cannot rely on popup.closed (Safari/Brave return true when
    // the popup navigates cross-origin to the PDS auth page) or on
    // postMessage/BroadcastChannel notifications. Instead, we simply
    // check every 2 seconds whether the OAuth flow has completed and
    // a session has been stored.
    const sessionPoll = setInterval(async () => {
      if (settled) return;
      try {
        await _ensureFrame();
        const result = await _postToFrame({ type: 'restoreSession' });
        if (result && result.sub) {
          cleanup();
          _did = result.sub;
          resolve({ sub: result.sub });
        }
      } catch {
        // iframe not ready yet or request failed — keep polling
      }
    }, 2000);

    // Safety timeout: reject after 2 minutes if no session appears
    const timeout = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Sign-in timed out'));
      }
    }, 120000);

    let settled = false;
    function cleanup() {
      if (settled) return;
      settled = true;
      clearInterval(sessionPoll);
      clearTimeout(timeout);
      if (_currentPopup === popup) {
        _currentPopup = null;
        _cancelReject = null;
      }
    }

    // Store reject so cancelSignIn() can trigger it
    _cancelReject = () => {
      cleanup();
      reject(new Error('Sign-in cancelled'));
    };
  });
}

// Stored reject callback for cancelSignIn
let _cancelReject = null;

/**
 * Cancel the current sign-in, causing the signIn() promise to reject.
 */
export function cancelSignIn() {
  try { _currentPopup?.close(); } catch {}
  if (_cancelReject) {
    _cancelReject();
    _cancelReject = null;
  }
}

/**
 * Attempt to restore an existing session (no popup, no user interaction).
 * @returns {Promise<{sub: string}|null>}
 */
export async function restoreSession() {
  await _ensureFrame();
  const result = await _postToFrame({ type: 'restoreSession' });
  if (result && result.sub) {
    _did = result.sub;
    return { sub: result.sub };
  }
  _did = null;
  return null;
}

/**
 * Sign out and revoke the current session.
 * @returns {Promise<void>}
 */
export async function signOut() {
  if (!_did) return;
  await _ensureFrame();
  await _postToFrame({ type: 'signOut', did: _did });
  _did = null;
}

/**
 * Return the cached current DID, or null if not signed in.
 * Synchronous — does not hit the network.
 * @returns {{sub: string}|null}
 */
export function getSession() {
  return _did ? { sub: _did } : null;
}

/**
 * Read the user's atShare preference from the PDS via the iframe.
 * @param {string} did
 * @returns {Promise<object|null>}
 */
export async function getPreference(did) {
  await _ensureFrame();
  return _postToFrame({ type: 'getPreference', did });
}

/**
 * Write the user's atShare preference to the PDS via the iframe.
 * @param {string} did
 * @param {object} preference
 * @returns {Promise<void>}
 */
export async function putPreference(did, preference) {
  await _ensureFrame();
  await _postToFrame({ type: 'putPreference', did, preference });
}

/**
 * Reset all module-level state. For testing purposes only.
 * @internal
 */
export function _resetForTesting() {
  _did = null;
  _currentPopup = null;
  _cancelReject = null;
  _frameReady = null;
  _frameReadyResolve = null;
  _frame = null;
  _pending.clear();
  window.removeEventListener('message', _onMessage);
}
