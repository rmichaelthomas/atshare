/**
 * OAuth callback page entry point.
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Stores the session in browser storage
 *
 * After init(), this page waits for the embedding component to request
 * the DID via postMessage. This avoids relying on window.opener (stripped
 * by some browsers after cross-origin navigation), BroadcastChannel
 * (partitioned in third-party contexts), or popup.closed (unreliable
 * cross-origin). The component polls with {type: 'atshare-get-did'}
 * and this page responds with the DID.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

let authDid = null;
let authError = null;

try {
  const result = await client.init();
  if (result?.session) {
    authDid = result.session.sub;
  }
} catch (err) {
  authError = err.message;
}

// If auth failed, broadcast error and close immediately
if (authError) {
  window.opener?.postMessage({ type: 'atshare-auth-error', error: authError }, '*');
  window.close();
}

// Auth succeeded — wait for the component to ask for the DID.
// The component polls with {type: 'atshare-get-did'} every 2 seconds.
// We respond with the DID and wait for {type: 'atshare-close'} to close.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'atshare-get-did' && authDid) {
    event.source.postMessage({
      type: 'atshare-auth-complete',
      did: authDid,
    }, event.origin || '*');
  }

  if (data.type === 'atshare-close') {
    window.close();
  }
});

// Also try direct notification (works when window.opener is preserved)
if (authDid) {
  window.opener?.postMessage({ type: 'atshare-auth-complete', did: authDid }, '*');
}

// Safety: auto-close after 5 minutes if component never acknowledges
setTimeout(() => window.close(), 300000);
