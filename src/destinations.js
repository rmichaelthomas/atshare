/**
 * Destination registry — replaces networks.js.
 *
 * Reads from destinations.json (imported at build time via Vite).
 * Provides lookup, URL building, and preference resolution.
 */

import registry from '../destinations.json';

// Build flat lookup maps at import time
const _clientsById = new Map();
const _clientsByDomain = new Map();
for (const protocol of registry.protocols) {
  for (const client of protocol.clients) {
    _clientsById.set(client.id, { ...client, protocolId: protocol.id });
    if (client.domain) {
      _clientsByDomain.set(client.domain, { ...client, protocolId: protocol.id });
    }
  }
}

/** Returns all protocol groups from the registry. */
export function getProtocols() {
  return registry.protocols;
}

/** Returns clients for a given protocol ID. */
export function getClients(protocolId) {
  const protocol = registry.protocols.find(p => p.id === protocolId);
  return protocol ? protocol.clients : [];
}

/** Returns the default client for a protocol (the one with `default: true`, or first). */
export function getDefaultClient(protocolId) {
  const clients = getClients(protocolId);
  return clients.find(c => c.default) || clients[0];
}

/** Finds a client by ID across all protocols. */
export function getClientById(clientId) {
  return _clientsById.get(clientId);
}

/** Finds a client by domain across all protocols. */
export function getClientByDomain(domain) {
  return _clientsByDomain.get(domain);
}

/**
 * Build a share intent URL for the given client.
 * @param {string} clientId — client ID from the registry
 * @param {object} vars — template variables
 * @param {string} [vars.text] — share text
 * @param {string} [vars.url] — URL being shared
 * @param {string} [vars.title] — page title
 * @param {string} [vars.instance] — Fediverse instance URL
 * @returns {string} fully resolved intent URL
 */
export function buildIntentUrl(clientId, vars = {}) {
  const client = _clientsById.get(clientId);
  if (!client) throw new Error(`Unknown client: ${clientId}`);
  if (client.requiresInstance && !vars.instance) {
    throw new Error(`Client "${clientId}" requires an instance URL`);
  }

  let url = client.intentUrl;
  if (vars.instance) {
    url = url.replace('{instance}', vars.instance);
  }
  url = url.replace('{text}', encodeURIComponent(vars.text || ''));
  url = url.replace('{url}', encodeURIComponent(vars.url || ''));
  url = url.replace('{title}', encodeURIComponent(vars.title || ''));
  return url;
}

/**
 * Map a PDS preference record to a protocol + client ID.
 * Handles the old format (primaryNetwork: "bluesky") and the appView domain lookup.
 *
 * @param {object|null} pdsRecord — the preference record from PDS
 * @returns {{ protocolId: string, clientId: string, instance?: string } | null}
 */
export function resolvePreference(pdsRecord) {
  if (!pdsRecord) return null;

  const { primaryNetwork, networks } = pdsRecord;

  const protocolMap = { bluesky: 'atproto', mastodon: 'activitypub' };
  const protocolId = protocolMap[primaryNetwork] || primaryNetwork;

  if (!networks || networks.length === 0) {
    const defaultClient = getDefaultClient(protocolId);
    return defaultClient ? { protocolId, clientId: defaultClient.id } : null;
  }

  const atprotoNet = networks.find(n => n.type === 'atproto');
  const apNet = networks.find(n => n.type === 'activitypub');

  if (protocolId === 'atproto' && atprotoNet?.appView) {
    try {
      const domain = new URL(atprotoNet.appView).hostname;
      const client = getClientByDomain(domain);
      return {
        protocolId,
        clientId: client ? client.id : getDefaultClient(protocolId).id,
      };
    } catch {
      return { protocolId, clientId: getDefaultClient(protocolId).id };
    }
  }

  if (protocolId === 'activitypub' && apNet?.instance) {
    return {
      protocolId,
      clientId: getDefaultClient(protocolId)?.id || 'mastodon',
      instance: apNet.instance,
    };
  }

  const defaultClient = getDefaultClient(protocolId);
  return defaultClient ? { protocolId, clientId: defaultClient.id } : null;
}
