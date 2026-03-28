// @vitest-environment happy-dom
/**
 * Tests for src/auth-frame.js
 *
 * Uses happy-dom for window/MessageEvent availability.
 * BrowserOAuthClient and pds.js are fully mocked.
 *
 * Pattern:
 *   1. Call init() to start the frame handler.
 *   2. Dispatch a MessageEvent simulating what auth-proxy.js would send.
 *   3. Assert that event.source.postMessage was called with the correct response.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: {
    load: vi.fn(),
  },
}));

vi.mock('../src/pds.js', () => ({
  getPreference: vi.fn(),
  putPreference: vi.fn(),
}));

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { getPreference, putPreference } from '../src/pds.js';
import { init, _resetForTesting } from '../src/auth-frame.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_DID = 'did:plc:testuser';
const PDS_ENDPOINT = 'https://pds.example.com';

/** Build a fake OAuthSession with the given DID. */
function makeSession(sub = TEST_DID) {
  return {
    sub,
    fetchHandler: vi.fn(),
    getTokenInfo: vi.fn().mockResolvedValue({ aud: PDS_ENDPOINT, sub }),
  };
}

/** Build a fake BrowserOAuthClient. */
function makeClient(overrides = {}) {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(makeSession()),
    ...overrides,
  };
}

/**
 * Simulate the parent window sending a postMessage to the frame.
 * Returns the mocked window.parent so we can assert on postMessage replies.
 */
function sendMessage(data) {
  // Get or create a spy on window.parent's postMessage
  let postMessageSpy = vi.spyOn(window.parent, 'postMessage');

  // Clear any previous calls (e.g., from init())
  postMessageSpy.mockClear();

  window.dispatchEvent(
    new MessageEvent('message', { data, source: window.parent })
  );

  return { postMessage: postMessageSpy };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  _resetForTesting();
});

afterEach(() => {
  _resetForTesting();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('init', () => {
  it('calls BrowserOAuthClient.load with the correct clientId and handleResolver', async () => {
    BrowserOAuthClient.load.mockResolvedValue(makeClient());
    await init();

    expect(BrowserOAuthClient.load).toHaveBeenCalledOnce();
    expect(BrowserOAuthClient.load).toHaveBeenCalledWith({
      clientId: 'https://atshare.social/client-metadata.json',
      handleResolver: 'https://bsky.social',
    });
  });

  it('posts atshare-frame-ready to window.parent after loading', async () => {
    BrowserOAuthClient.load.mockResolvedValue(makeClient());
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    await init();

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'atshare-frame-ready' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// restoreSession
// ---------------------------------------------------------------------------

describe('restoreSession', () => {
  it('returns {sub: did} when a session exists', async () => {
    const session = makeSession(TEST_DID);
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue({ session }) })
    );
    await init();

    const source = sendMessage({ id: 'req-1', type: 'restoreSession' });
    await Promise.resolve(); // flush microtasks

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-1', result: { sub: TEST_DID } },
      '*'
    );
  });

  it('returns null when no session exists', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue(undefined) })
    );
    await init();

    const source = sendMessage({ id: 'req-2', type: 'restoreSession' });
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-2', result: null },
      '*'
    );
  });

  it('returns null when init() returns object without session', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue({}) })
    );
    await init();

    const source = sendMessage({ id: 'req-3', type: 'restoreSession' });
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-3', result: null },
      '*'
    );
  });

  it('returns an error response when client.init() throws', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockRejectedValue(new Error('IndexedDB unavailable')) })
    );
    await init();

    const source = sendMessage({ id: 'req-4', type: 'restoreSession' });
    await Promise.resolve();
    await Promise.resolve(); // additional flush for rejection

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-4', error: 'IndexedDB unavailable' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('signOut', () => {
  it('calls client.revoke with the provided DID and returns true', async () => {
    const mockClient = makeClient();
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await init();

    const source = sendMessage({ id: 'req-5', type: 'signOut', did: TEST_DID });
    await Promise.resolve();

    expect(mockClient.revoke).toHaveBeenCalledWith(TEST_DID);
    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-5', result: true },
      '*'
    );
  });

  it('returns an error response when revoke throws', async () => {
    const mockClient = makeClient({
      revoke: vi.fn().mockRejectedValue(new Error('Revoke failed')),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await init();

    const source = sendMessage({ id: 'req-6', type: 'signOut', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-6', error: 'Revoke failed' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// getPreference
// ---------------------------------------------------------------------------

describe('getPreference', () => {
  it('restores session, gets token info, and calls pds.getPreference', async () => {
    const session = makeSession(TEST_DID);
    const mockClient = makeClient({
      restore: vi.fn().mockResolvedValue(session),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    const pref = { primaryNetwork: 'bluesky', networks: [] };
    getPreference.mockResolvedValue(pref);

    await init();

    const source = sendMessage({ id: 'req-7', type: 'getPreference', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockClient.restore).toHaveBeenCalledWith(TEST_DID);
    expect(session.getTokenInfo).toHaveBeenCalled();
    expect(getPreference).toHaveBeenCalledWith(
      PDS_ENDPOINT,
      TEST_DID,
      expect.any(Function)
    );
    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-7', result: pref },
      '*'
    );
  });

  it('passes fetchHandler bound to session so `this` is preserved', async () => {
    const session = makeSession(TEST_DID);
    const mockClient = makeClient({ restore: vi.fn().mockResolvedValue(session) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    getPreference.mockResolvedValue(null);

    await init();
    sendMessage({ id: 'req-8', type: 'getPreference', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const [, , passedFetchHandler] = getPreference.mock.calls[0];
    // The bound function should behave as session.fetchHandler — call it and
    // verify it delegates to the original
    passedFetchHandler('https://pds.example.com/xrpc/test', {});
    expect(session.fetchHandler).toHaveBeenCalledWith(
      'https://pds.example.com/xrpc/test',
      {}
    );
  });

  it('returns null when preference record does not exist', async () => {
    const session = makeSession(TEST_DID);
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockResolvedValue(session) })
    );
    getPreference.mockResolvedValue(null);

    await init();

    const source = sendMessage({ id: 'req-9', type: 'getPreference', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-9', result: null },
      '*'
    );
  });

  it('returns an error response when session restore fails', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockRejectedValue(new Error('Session not found')) })
    );
    await init();

    const source = sendMessage({ id: 'req-10', type: 'getPreference', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-10', error: 'Session not found' },
      '*'
    );
  });

  it('returns an error response when PDS fetch fails', async () => {
    const session = makeSession(TEST_DID);
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockResolvedValue(session) })
    );
    getPreference.mockRejectedValue(new Error('getRecord failed: 500'));

    await init();

    const source = sendMessage({ id: 'req-11', type: 'getPreference', did: TEST_DID });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-11', error: 'getRecord failed: 500' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// putPreference
// ---------------------------------------------------------------------------

describe('putPreference', () => {
  it('restores session, gets token info, and calls pds.putPreference', async () => {
    const session = makeSession(TEST_DID);
    const mockClient = makeClient({ restore: vi.fn().mockResolvedValue(session) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    putPreference.mockResolvedValue(undefined);

    await init();

    const pref = { primaryNetwork: 'mastodon', networks: ['mastodon'] };
    const source = sendMessage({
      id: 'req-12',
      type: 'putPreference',
      did: TEST_DID,
      preference: pref,
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockClient.restore).toHaveBeenCalledWith(TEST_DID);
    expect(session.getTokenInfo).toHaveBeenCalled();
    expect(putPreference).toHaveBeenCalledWith(
      PDS_ENDPOINT,
      TEST_DID,
      expect.any(Function),
      pref
    );
    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-12', result: null },
      '*'
    );
  });

  it('passes fetchHandler bound to session so `this` is preserved', async () => {
    const session = makeSession(TEST_DID);
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockResolvedValue(session) })
    );
    putPreference.mockResolvedValue(undefined);

    await init();
    sendMessage({ id: 'req-13', type: 'putPreference', did: TEST_DID, preference: {} });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const [, , passedFetchHandler] = putPreference.mock.calls[0];
    passedFetchHandler('https://pds.example.com/xrpc/test', { method: 'POST' });
    expect(session.fetchHandler).toHaveBeenCalledWith(
      'https://pds.example.com/xrpc/test',
      { method: 'POST' }
    );
  });

  it('returns an error response when session restore fails', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockRejectedValue(new Error('Session not found')) })
    );
    await init();

    const source = sendMessage({
      id: 'req-14',
      type: 'putPreference',
      did: TEST_DID,
      preference: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-14', error: 'Session not found' },
      '*'
    );
  });

  it('returns an error response when PDS write fails', async () => {
    const session = makeSession(TEST_DID);
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ restore: vi.fn().mockResolvedValue(session) })
    );
    putPreference.mockRejectedValue(new Error('putRecord failed: 401'));

    await init();

    const source = sendMessage({
      id: 'req-15',
      type: 'putPreference',
      did: TEST_DID,
      preference: {},
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-15', error: 'putRecord failed: 401' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// Unknown message type
// ---------------------------------------------------------------------------

describe('unknown message type', () => {
  it('returns an error response for unrecognized types', async () => {
    BrowserOAuthClient.load.mockResolvedValue(makeClient());
    await init();

    const source = sendMessage({ id: 'req-99', type: 'doSomethingWeird' });
    await Promise.resolve();

    expect(source.postMessage).toHaveBeenCalledWith(
      { id: 'req-99', error: 'Unknown message type: doSomethingWeird' },
      '*'
    );
  });
});

// ---------------------------------------------------------------------------
// Messages without an id are ignored
// ---------------------------------------------------------------------------

describe('messages without an id', () => {
  it('ignores messages that have no id field', async () => {
    BrowserOAuthClient.load.mockResolvedValue(makeClient());
    await init();

    const source = sendMessage({ type: 'restoreSession' }); // no id
    await Promise.resolve();

    expect(source.postMessage).not.toHaveBeenCalled();
  });
});
