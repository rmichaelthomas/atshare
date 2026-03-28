/**
 * OAuth callback page entry point.
 *
 * Loaded at https://atshare.social/oauth/callback after the user
 * authenticates at their PDS. Calls client.init() which:
 *   1. Detects the OAuth params in window.location
 *   2. Completes the PKCE + DPoP exchange
 *   3. Stores the session in browser storage
 *
 * The component polls this page with {type: 'atshare-get-did'} via
 * postMessage. Once the DID is available, we respond. The component
 * then sends {type: 'atshare-close'} and we close the popup.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

// DID is set after successful init; null while still loading
let authDid = null;

// Set up the message listener IMMEDIATELY — before async init.
// The component polls every 2 seconds. Early polls (before init completes)
// won't get a response because authDid is still null, but the next poll
// after init completes will succeed.
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

// Now run the async OAuth exchange
const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

try {
  const result = await client.init();
  if (result?.session) {
    authDid = result.session.sub;
    // Also try direct notification (works when window.opener is preserved)
    window.opener?.postMessage({ type: 'atshare-auth-complete', did: authDid }, '*');
  }
} catch (err) {
  window.opener?.postMessage({ type: 'atshare-auth-error', error: err.message }, '*');
  window.close();
}

// Safety: auto-close after 5 minutes if component never acknowledges
setTimeout(() => window.close(), 300000);
