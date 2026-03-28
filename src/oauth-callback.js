/**
 * OAuth callback page entry point.
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params (?code=...&state=...) in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Sends the session to the originating tab via BroadcastChannel
 *   4. Calls window.close() to close the popup
 *
 * The clientId and handleResolver MUST be identical to the values used
 * in auth.js — the BroadcastChannel key is derived from clientId.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

// init() auto-detects callback params and handles everything.
// window.close() is called internally by the library on success.
await client.init();
