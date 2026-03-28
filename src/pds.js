/**
 * PDS preference record read/write.
 *
 * Reads and writes social.atshare.preference to the user's PDS.
 * Uses the session's fetchHandler from @atproto/oauth-client-browser,
 * which automatically handles DPoP headers and token refresh.
 * Callers do NOT set Authorization headers — fetchHandler owns auth.
 */

export const PREFERENCE_NSID = 'social.atshare.preference';

/**
 * Read the user's atShare preference record from their PDS.
 * @param {string} pdsEndpoint - e.g. "https://morel.us-east.host.bsky.network"
 * @param {string} did - the user's DID
 * @param {Function} fetchHandler - session.fetchHandler from oauth-client-browser
 * @returns {Promise<object|null>} preference record value, or null if not found
 */
export async function getPreference(pdsEndpoint, did, fetchHandler) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${PREFERENCE_NSID}&rkey=self`;
  const res = await fetchHandler(url);
  if (res.status === 400) return null; // record not found
  if (!res.ok) throw new Error(`getRecord failed: ${res.status}`);
  const { value } = await res.json();
  return value;
}

/**
 * Write the user's atShare preference record to their PDS.
 * @param {string} pdsEndpoint
 * @param {string} did
 * @param {Function} fetchHandler - session.fetchHandler from oauth-client-browser
 * @param {object} preference - the preference data to write
 */
export async function putPreference(pdsEndpoint, did, fetchHandler, preference) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.putRecord`;
  const body = {
    repo: did,
    collection: PREFERENCE_NSID,
    rkey: 'self',
    record: { $type: PREFERENCE_NSID, ...preference },
  };
  const res = await fetchHandler(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`putRecord failed: ${res.status}`);
}
