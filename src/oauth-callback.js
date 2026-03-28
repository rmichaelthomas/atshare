/**
 * OAuth callback page entry point.
 *
 * After the user authenticates at their PDS, this page:
 *   1. Completes the PKCE + DPoP exchange via client.init()
 *   2. Redirects the popup back to the embedding site with the DID in the hash
 *
 * The redirect makes the popup same-origin with the opener, so the component
 * code (auth-proxy.js) can use window.opener.postMessage() reliably.
 * This avoids all cross-origin issues (partitioned storage, invalidated
 * window references, stripped window.opener).
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

const client = await BrowserOAuthClient.load({
  clientId: 'https://atshare.social/client-metadata.json',
  handleResolver: 'https://bsky.social',
});

try {
  const result = await client.init();

  if (result?.session) {
    const did = result.session.sub;
    const returnUrl = result.state; // passed via auth-page.js as OAuth state

    if (returnUrl) {
      // Redirect popup to the embedding site with DID in hash.
      // The component's auth-proxy.js detects #atshare-did= on load,
      // posts the DID to window.opener (now same-origin), and closes.
      const separator = returnUrl.includes('?') ? '&' : '?';
      window.location.href = `${returnUrl}#atshare-did=${encodeURIComponent(did)}`;
    } else {
      // Fallback for same-origin (no returnUrl needed) — try direct postMessage
      window.opener?.postMessage({ type: 'atshare-auth-complete', did }, '*');
      window.close();
    }
  }
} catch (err) {
  window.opener?.postMessage({ type: 'atshare-auth-error', error: err.message }, '*');
  window.close();
}
