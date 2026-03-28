import { Hono } from 'hono';
import { getOAuthClient, getPublicJwks } from '../oauth.js';
import crypto from 'crypto';

const auth = new Hono();

// In-memory map of session cookies → DIDs (lightweight session tracking)
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
  const { session, state: returnUrl } = await client.callback(params);

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

  // Redirect popup back to the embedding site
  if (returnUrl) {
    return c.redirect(`${returnUrl}#atshare-auth=success`);
  }

  // Fallback: show success page (same-origin case)
  return c.html('<p>Signed in. You can close this window.</p><script>window.close()</script>');
});

/**
 * GET /api/auth/session
 * Returns the current session's DID, or { did: null }.
 */
auth.get('/session', async (c) => {
  const did = getDidFromCookie(c);
  return c.json({ did: did || null });
});

/**
 * POST /api/auth/logout
 * Revokes the session and clears the cookie.
 */
auth.post('/logout', async (c) => {
  const sessionId = getCookieValue(c, 'atshare_session');
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

export function getDidFromCookie(c) {
  const sessionId = getCookieValue(c, 'atshare_session');
  return sessionId ? cookieSessions.get(sessionId) || null : null;
}

export default auth;
