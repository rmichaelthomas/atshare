/**
 * OAuth callback page entry point.
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params (?code=...&state=...) in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Stores the session in browser storage
 *
 * After init() completes, posts the authentication result to the opener window
 * (the embedding site) with the user's DID, then closes the popup. On error,
 * posts an error message to the opener before closing.
 *
 * The clientId and handleResolver MUST be identical to the values used
 * in auth.js.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

// BroadcastChannel relay — the auth-frame (hidden iframe on atshare.social)
// listens on this channel and forwards the message to the parent component
// via window.parent.postMessage(). This is the primary notification path
// because window.opener may be null if the popup navigated cross-origin.
const authChannel = new BroadcastChannel('atshare-auth-channel');

try {
  // init() auto-detects callback params and completes the OAuth exchange.
  const result = await client.init();

  if (result?.session) {
    const message = {
      type: 'atshare-auth-complete',
      did: result.session.sub,
    };
    // Broadcast to auth-frame (same-origin, always works)
    authChannel.postMessage(message);
    // Also try direct postMessage to opener (works when window.opener is preserved)
    window.opener?.postMessage(message, '*');
  }
} catch (err) {
  const message = {
    type: 'atshare-auth-error',
    error: err.message,
  };
  authChannel.postMessage(message);
  window.opener?.postMessage(message, '*');
} finally {
  authChannel.close();
  // Close the popup after success or error.
  window.close();
}
