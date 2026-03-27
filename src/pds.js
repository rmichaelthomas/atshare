/**
 * PDS preference record read/write.
 *
 * Reads and writes social.atshare.preference to the user's PDS.
 * Requires an authenticated AT Protocol session (access token).
 */

export const PREFERENCE_NSID = 'social.atshare.preference';

/**
 * Read the user's atShare preference record from their PDS.
 * @param {string} pdsEndpoint - e.g. "https://morel.us-east.host.bsky.network"
 * @param {string} did - the user's DID
 * @param {string} accessToken - AT Protocol OAuth access token
 * @returns {Promise<object|null>} preference record, or null if not found
 */
export async function getPreference(pdsEndpoint, did, accessToken) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${PREFERENCE_NSID}&rkey=self`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 400) return null; // record not found
  if (!res.ok) throw new Error(`getRecord failed: ${res.status}`);
  const { value } = await res.json();
  return value;
}

/**
 * Write the user's atShare preference record to their PDS.
 * @param {string} pdsEndpoint
 * @param {string} did
 * @param {string} accessToken
 * @param {object} preference - the preference record to write
 */
export async function putPreference(pdsEndpoint, did, accessToken, preference) {
  const url = `${pdsEndpoint}/xrpc/com.atproto.repo.putRecord`;
  const body = {
    repo: did,
    collection: PREFERENCE_NSID,
    rkey: 'self',
    record: { $type: PREFERENCE_NSID, ...preference },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`putRecord failed: ${res.status}`);
}
