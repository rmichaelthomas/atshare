import { NodeOAuthClient } from '@atproto/oauth-client-node';
import { JoseKey } from '@atproto/jwk-jose';
import { SessionStore } from './stores/session-store.js';
import { StateStore } from './stores/state-store.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://atshare.social';
const KEY_PATH = process.env.KEY_PATH || './data/private-key.json';

/**
 * Load or generate the ES256 signing key for client authentication.
 * The key is persisted to disk so it survives server restarts.
 */
async function loadOrGenerateKey() {
  if (existsSync(KEY_PATH)) {
    const jwk = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
    return JoseKey.fromJWK(jwk, jwk.kid);
  }
  const key = await JoseKey.generate(['ES256'], 'atshare-signing-key');
  mkdirSync(dirname(KEY_PATH), { recursive: true });
  // Save private JWK with kid
  const jwk = { ...key.privateJwk, kid: key.kid };
  writeFileSync(KEY_PATH, JSON.stringify(jwk), 'utf-8');
  return key;
}

let _client = null;

/**
 * Get or create the singleton NodeOAuthClient.
 */
export async function getOAuthClient() {
  if (_client) return _client;

  const key = await loadOrGenerateKey();

  _client = new NodeOAuthClient({
    clientMetadata: {
      client_id: `${PUBLIC_URL}/server-client-metadata.json`,
      client_name: 'atShare',
      client_uri: PUBLIC_URL,
      logo_uri: `${PUBLIC_URL}/logo.png`,
      tos_uri: `${PUBLIC_URL}/tos`,
      policy_uri: `${PUBLIC_URL}/privacy`,
      redirect_uris: [`${PUBLIC_URL}/atshare-api/api/auth/callback`],
      scope: 'atproto',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      application_type: 'web',
      dpop_bound_access_tokens: true,
    },
    keyset: [key],
    stateStore: new StateStore(),
    sessionStore: new SessionStore(),
  });

  return _client;
}

/**
 * Get the public JWKS for the /api/jwks endpoint.
 */
export async function getPublicJwks() {
  const key = await loadOrGenerateKey();
  return { keys: [key.publicJwk] };
}
