import { Hono } from 'hono';
import { getOAuthClient, getPublicJwks } from '../oauth.js';
import crypto from 'crypto';

const auth = new Hono();

// In-memory map of session tokens → DIDs (lightweight session tracking)
// For production, move this to SQLite alongside the OAuth sessions.
const cookieSessions = new Map();

/**
 * GET /api/auth/login?handle=rob.bsky.social&returnUrl=https://example.com/page
 * Returns { url } — the OAuth authorization URL to open in a popup.
 */
auth.get('/login', async (c) => {
  const handle = c.req.query('handle');
  const returnUrl = c.req.query('returnUrl') || '';

  if (!handle) {
    return c.json({ error: 'Missing handle parameter' }, 400);
  }

  const client = await getOAuthClient();
  const url = await client.authorize(handle, { state: returnUrl });

  return c.json({ url: url.toString() });
});

/**
 * GET /api/auth/callback?code=...&state=...&iss=...
 * Exchanges the authorization code for tokens, sets a session cookie,
 * and redirects the popup back to the embedding site.
 */
auth.get('/callback', async (c) => {
  const params = new URLSearchParams(c.req.url.split('?')[1] || '');

  const client = await getOAuthClient();
  const { session } = await client.callback(params);

  // Create a session cookie
  const sessionId = crypto.randomUUID();
  cookieSessions.set(sessionId, session.did);

  // Set HTTP-only cookie (SameSite=None for cross-origin)
  c.header('Set-Cookie', [
    `atshare_session=${sessionId}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Path=/',
    'Max-Age=2592000', // 30 days
  ].join('; '));

  // Send session token to the opener via postMessage, then close the popup.
  // The component listens for this message and passes the token to the iframe proxy.
  // Also set the cookie as a fallback for same-origin usage.
  return c.html(`<!DOCTYPE html><html><body>
<p style="font-family:system-ui;color:#64748b;text-align:center;margin-top:40px">Signed in. Closing\u2026</p>
<script>
  if (window.opener) {
    window.opener.postMessage({
      type: 'atshare-auth-callback',
      sessionId: ${JSON.stringify(sessionId)},
      did: ${JSON.stringify(session.did)}
    }, '*');
  }
  window.close();
</script>
</body></html>`);
});

/**
 * GET /api/auth/session
 * Returns the current session's DID, or { did: null }.
 * Accepts session via cookie or Bearer token.
 */
auth.get('/session', async (c) => {
  const did = getDidFromRequest(c);
  return c.json({ did: did || null });
});

/**
 * POST /api/auth/logout
 * Revokes the session and clears the cookie/token.
 */
auth.post('/logout', async (c) => {
  const sessionId = getTokenFromRequest(c);
  const did = sessionId ? cookieSessions.get(sessionId) : null;

  if (did) {
    try {
      const client = await getOAuthClient();
      const session = await client.restore(did);
      await session.signOut();
    } catch {}
    cookieSessions.delete(sessionId);
  }

  c.header('Set-Cookie', [
    'atshare_session=',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Path=/',
    'Max-Age=0',
  ].join('; '));

  return c.json({ ok: true });
});

/**
 * GET /api/jwks
 * Returns the server's public keys in JWKS format.
 */
auth.get('/jwks', async (c) => {
  const jwks = await getPublicJwks();
  return c.json(jwks);
});

// --- Helpers ---

function getCookieValue(c, name) {
  const cookie = c.req.header('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

/**
 * Extract session token from Bearer header or cookie.
 * Bearer token takes precedence (iframe proxy path).
 */
function getTokenFromRequest(c) {
  const authHeader = c.req.header('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return getCookieValue(c, 'atshare_session');
}

/**
 * Get DID from request — supports both Bearer token and cookie.
 */
export function getDidFromRequest(c) {
  const sessionId = getTokenFromRequest(c);
  return sessionId ? cookieSessions.get(sessionId) || null : null;
}

// Legacy alias
export const getDidFromCookie = getDidFromRequest;

export default auth;
