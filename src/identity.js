/**
 * Identity resolution: handle → DID → PDS endpoint
 *
 * Step 1: Slingshot resolveHandle  (handle → DID)
 * Step 2: PLC Directory            (DID → PDS endpoint)
 */

const SLINGSHOT_BASE = 'https://slingshot.microcosm.blue/xrpc';
const PLC_DIRECTORY  = 'https://plc.directory';

/**
 * Resolve a handle to a DID via Microcosm Slingshot.
 * @param {string} handle - e.g. "jay.bsky.team"
 * @returns {Promise<string>} DID string, e.g. "did:plc:..."
 */
export async function resolveHandleToDid(handle) {
  const url = `${SLINGSHOT_BASE}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`resolveHandle failed: ${res.status}`);
  const { did } = await res.json();
  return did;
}

/**
 * Resolve a DID to its PDS endpoint URL via the PLC Directory.
 * @param {string} did - e.g. "did:plc:..."
 * @returns {Promise<string>} PDS endpoint URL, e.g. "https://morel.us-east.host.bsky.network"
 */
export async function resolvePdsEndpoint(did) {
  const url = `${PLC_DIRECTORY}/${encodeURIComponent(did)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PLC directory lookup failed: ${res.status}`);
  const doc = await res.json();
  const pdsService = doc.service?.find(
    (s) => s.id === '#atproto_pds' && s.type === 'AtprotoPersonalDataServer'
  );
  if (!pdsService) throw new Error(`No PDS service found for DID: ${did}`);
  return pdsService.serviceEndpoint;
}

/**
 * Full resolution: handle → DID → PDS endpoint.
 * @param {string} handle
 * @returns {Promise<{ did: string, pdsEndpoint: string }>}
 */
export async function resolveIdentity(handle) {
  const did = await resolveHandleToDid(handle);
  const pdsEndpoint = await resolvePdsEndpoint(did);
  return { did, pdsEndpoint };
}
