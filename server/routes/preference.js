import { Hono } from 'hono';
import { getOAuthClient } from '../oauth.js';
import { getDidFromCookie } from './auth.js';

const PREFERENCE_NSID = 'social.atshare.preference';

const preference = new Hono();

/**
 * GET /api/preference/:did
 * Public — reads a user's preference record from their PDS.
 * No authentication required (getRecord is public).
 */
preference.get('/:did', async (c) => {
  const did = c.req.param('did');

  try {
    // Resolve DID → PDS endpoint via PLC directory
    const plcRes = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
    if (!plcRes.ok) return c.json({ preference: null });

    const didDoc = await plcRes.json();
    const pdsService = didDoc.service?.find(
      (s) => s.id === '#atproto_pds' && s.type === 'AtprotoPersonalDataServer'
    );
    if (!pdsService) return c.json({ preference: null });

    const pdsEndpoint = pdsService.serviceEndpoint.replace(/\/+$/, '');
    const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${PREFERENCE_NSID}&rkey=self`;

    const res = await fetch(url);
    if (res.status === 400 || res.status === 404) return c.json({ preference: null });
    if (!res.ok) return c.json({ preference: null });

    const { value } = await res.json();
    return c.json({ preference: value });
  } catch {
    return c.json({ preference: null });
  }
});

/**
 * POST /api/preference
 * Authenticated — writes the user's preference to their PDS.
 * Requires a valid session cookie.
 */
preference.post('/', async (c) => {
  const did = getDidFromCookie(c);
  if (!did) return c.json({ error: 'Not authenticated' }, 401);

  const body = await c.req.json();
  const pref = body.preference;
  if (!pref) return c.json({ error: 'Missing preference' }, 400);

  try {
    const client = await getOAuthClient();
    const session = await client.restore(did);

    const res = await session.fetchHandler('/xrpc/com.atproto.repo.putRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: did,
        collection: PREFERENCE_NSID,
        rkey: 'self',
        record: { $type: PREFERENCE_NSID, ...pref },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return c.json({ error: `putRecord failed: ${res.status}`, detail: text }, 502);
    }

    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default preference;
