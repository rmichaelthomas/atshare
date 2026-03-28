/**
 * Auth page — runs on atshare.social/auth/ inside a popup window.
 *
 * Flow:
 *   1. Reads `handle` from URLSearchParams.
 *   2. Creates a BrowserOAuthClient directly (same clientId/handleResolver as
 *      auth-frame.js so they share IndexedDB).
 *   3. Calls client.signIn(handle) WITHOUT a `display` option, so the library
 *      uses signInRedirect() and navigates this popup to the PDS auth page.
 *   4. If anything fails before the redirect, posts an error to window.opener.
 *
 * NOTE: Does NOT import auth.js — auth.js passes `{display:'popup'}` which
 * would open a nested popup window instead of redirecting this one.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const CLIENT_ID = 'https://atshare.social/client-metadata.json';
const HANDLE_RESOLVER = 'https://bsky.social';

/**
 * Main entry point. Reads the handle param, initialises the client, and
 * triggers the redirect to the PDS authorization page.
 *
 * Exported so tests can call it directly after mocking dependencies.
 *
 * @returns {Promise<void>}
 */
export async function run() {
  const params = new URLSearchParams(window.location.search);
  const handle = params.get('handle');
  const returnUrl = params.get('returnUrl');

  if (!handle) {
    postError('Missing handle parameter');
    return;
  }

  try {
    const client = await BrowserOAuthClient.load({
      clientId: CLIENT_ID,
      handleResolver: HANDLE_RESOLVER,
    });

    // Pass returnUrl as the OAuth state — it persists through the redirect
    // flow and is available in the callback via result.state.
    // signIn without {display:'popup'} calls signInRedirect() internally.
    const signInOpts = returnUrl ? { state: returnUrl } : undefined;
    await client.signIn(handle, signInOpts);
  } catch (err) {
    postError(err.message || String(err));
  }
}

/**
 * Post an error message back to the opener window.
 * @param {string} message
 */
function postError(message) {
  if (window.opener) {
    window.opener.postMessage(
      { type: 'atshare-auth-error', error: message },
      '*'
    );
  }
}

// Auto-run when the module loads in a real browser context.
// In tests, vi.mock controls BrowserOAuthClient.load and callers invoke run() directly.
if (typeof window !== 'undefined' && window.location) {
  run();
}
