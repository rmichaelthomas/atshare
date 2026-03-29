import { describe, it, expect } from 'vitest';
import { migrateLocalPreference } from '../src/destinations.js';

describe('migrateLocalPreference', () => {
  it('migrates old bluesky preference to new format', () => {
    const old = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://bsky.app' }],
    };
    const result = migrateLocalPreference(old);
    expect(result).toEqual({
      primaryNetwork: 'atproto',
      preferredClient: 'bsky',
    });
  });

  it('migrates old bluesky with deck.blue appView', () => {
    const old = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://deck.blue' }],
    };
    const result = migrateLocalPreference(old);
    expect(result).toEqual({
      primaryNetwork: 'atproto',
      preferredClient: 'deckblue',
    });
  });

  it('migrates old mastodon preference', () => {
    const old = {
      primaryNetwork: 'mastodon',
      networks: [{ type: 'activitypub', instance: 'https://mastodon.social' }],
    };
    const result = migrateLocalPreference(old);
    expect(result).toEqual({
      primaryNetwork: 'activitypub',
      preferredClient: 'mastodon',
      mastodonInstance: 'https://mastodon.social',
    });
  });

  it('returns new-format preferences unchanged', () => {
    const newFormat = {
      primaryNetwork: 'atproto',
      preferredClient: 'deckblue',
    };
    const result = migrateLocalPreference(newFormat);
    expect(result).toEqual(newFormat);
  });

  it('returns null for null/undefined', () => {
    expect(migrateLocalPreference(null)).toBeNull();
    expect(migrateLocalPreference(undefined)).toBeNull();
  });

  it('falls back to default client for unknown appView domain', () => {
    const old = {
      primaryNetwork: 'bluesky',
      networks: [{ type: 'atproto', appView: 'https://unknown.example' }],
    };
    const result = migrateLocalPreference(old);
    expect(result.primaryNetwork).toBe('atproto');
    expect(result.preferredClient).toBe('bsky');
  });
});
