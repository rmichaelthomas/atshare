/**
 * OAuth callback page entry point (same-origin only).
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Stores the session in IndexedDB
 *   4. Signals the originating tab via BroadcastChannel
 *   5. Closes this popup
 *
 * This only works same-origin (component on atshare.social).
 * Cross-origin preference loading uses public getRecord instead.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

await client.init();
