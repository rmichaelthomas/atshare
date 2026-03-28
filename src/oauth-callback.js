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

try {
  // init() auto-detects callback params and completes the OAuth exchange.
  const result = await client.init();

  // Post success message to opener with the user's DID.
  if (result?.session) {
    window.opener?.postMessage({
      type: 'atshare-auth-complete',
      did: result.session.sub,
    }, '*');
  }
} catch (err) {
  // Post error message to opener on failure.
  window.opener?.postMessage({
    type: 'atshare-auth-error',
    error: err.message,
  }, '*');
} finally {
  // Close the popup after success or error.
  window.close();
}
