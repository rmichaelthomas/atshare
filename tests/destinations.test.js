import { describe, it, expect } from 'vitest';
import {
  getProtocols,
  getClients,
  getDefaultClient,
  getClientById,
  getClientByDomain,
  buildIntentUrl,
  resolvePreference,
} from '../src/destinations.js';

describe('getProtocols', () => {
  it('returns all protocol groups', () => {
    const protocols = getProtocols();
    expect(protocols.length).toBeGreaterThanOrEqual(3);
    expect(protocols.map(p => p.id)).toContain('atproto');
    expect(protocols.map(p => p.id)).toContain('activitypub');
    expect(protocols.map(p => p.id)).toContain('other');
  });
});

describe('getClients', () => {
  it('returns clients for atproto', () => {
    const clients = getClients('atproto');
    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(clients.find(c => c.id === 'bsky')).toBeDefined();
  });

  it('returns empty array for unknown protocol', () => {
    expect(getClients('nonexistent')).toEqual([]);
  });
});

describe('getDefaultClient', () => {
  it('returns the default client for atproto', () => {
    const client = getDefaultClient('atproto');
    expect(client.id).toBe('bsky');
    expect(client.default).toBe(true);
  });

  it('returns first client if no default is marked', () => {
    const client = getDefaultClient('atproto');
    expect(client).toBeDefined();
  });
});

describe('getClientById', () => {
  it('finds a client across all protocols', () => {
    const client = getClientById('deckblue');
    expect(client).toBeDefined();
    expect(client.name).toBe('deck.blue');
  });

  it('returns undefined for unknown id', () => {
    expect(getClientById('nonexistent')).toBeUndefined();
  });
});

describe('getClientByDomain', () => {
  it('finds a client by domain', () => {
    const client = getClientByDomain('deck.blue');
    expect(client).toBeDefined();
    expect(client.id).toBe('deckblue');
  });

  it('returns undefined for unknown domain', () => {
    expect(getClientByDomain('unknown.example')).toBeUndefined();
  });
});

describe('buildIntentUrl', () => {
  it('substitutes {text} in intent URL', () => {
    const url = buildIntentUrl('bsky', { text: 'hello world' });
    expect(url).toBe('https://bsky.app/intent/compose?text=hello%20world');
  });

  it('substitutes {url} in intent URL', () => {
    const url = buildIntentUrl('linkedin', { url: 'https://example.com' });
    expect(url).toBe('https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexample.com');
  });

  it('substitutes multiple variables', () => {
    const url = buildIntentUrl('x', { text: 'hi', url: 'https://example.com' });
    expect(url).toBe('https://x.com/intent/tweet?text=hi&url=https%3A%2F%2Fexample.com');
  });

  it('substitutes {instance} for fediverse clients', () => {
    const url = buildIntentUrl('mastodon', { text: 'hello', instance: 'https://mastodon.social' });
    expect(url).toBe('https://mastodon.social/share?text=hello');
  });

  it('throws for unknown client', () => {
    expect(() => buildIntentUrl('nonexistent', { text: 'hi' })).toThrow('Unknown client');
  });

  it('throws for fediverse client without instance', () => {
    expect(() => buildIntentUrl('mastodon', { text: 'hi' })).toThrow('requires an instance');
  });
});

describe('resolvePreference', () => {
  it('maps a PDS preference to a client entry', () => {
    const pdsRecord = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://deck.blue' }],
    };
    const result = resolvePreference(pdsRecord);
    expect(result.protocolId).toBe('atproto');
    expect(result.clientId).toBe('deckblue');
  });

  it('maps bluesky with bsky.app appView to bsky client', () => {
    const pdsRecord = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://bsky.app' }],
    };
    const result = resolvePreference(pdsRecord);
    expect(result.protocolId).toBe('atproto');
    expect(result.clientId).toBe('bsky');
  });

  it('maps mastodon preference', () => {
    const pdsRecord = {
      primaryNetwork: 'mastodon',
      networks: [{ type: 'activitypub', instance: 'https://mastodon.social' }],
    };
    const result = resolvePreference(pdsRecord);
    expect(result.protocolId).toBe('activitypub');
    expect(result.clientId).toBe('mastodon');
    expect(result.instance).toBe('https://mastodon.social');
  });

  it('falls back to default client when appView domain is unknown', () => {
    const pdsRecord = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://unknown-client.example' }],
    };
    const result = resolvePreference(pdsRecord);
    expect(result.protocolId).toBe('atproto');
    expect(result.clientId).toBe('bsky');
  });

  it('returns null for empty/null input', () => {
    expect(resolvePreference(null)).toBeNull();
    expect(resolvePreference(undefined)).toBeNull();
  });
});
