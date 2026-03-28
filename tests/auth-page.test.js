// @vitest-environment happy-dom
/**
 * Tests for src/auth-page.js
 *
 * Uses happy-dom for window/URLSearchParams availability.
 * BrowserOAuthClient is fully mocked.
 *
 * Pattern:
 *   1. Set window.location.search to provide query params.
 *   2. Set window.opener to a spy target.
 *   3. Call run() directly.
 *   4. Assert client.signIn was called correctly, or that opener received an
 *      error message.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: {
    load: vi.fn(),
  },
}));

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { run } from '../src/auth-page.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake BrowserOAuthClient instance. */
function makeClient(overrides = {}) {
  return {
    // signIn without display option navigates the page away; the promise never
    // resolves under normal flow, but in tests we resolve immediately.
    signIn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Set window.location.search so URLSearchParams picks up the handle param.
 * happy-dom allows assigning window.location.search directly.
 */
function setSearch(search) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search },
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset opener to null between tests
  Object.defineProperty(window, 'opener', {
    writable: true,
    value: null,
  });
});

// ---------------------------------------------------------------------------
// Normal sign-in flow
// ---------------------------------------------------------------------------

describe('run — normal sign-in flow', () => {
  it('calls BrowserOAuthClient.load with the correct clientId and handleResolver', async () => {
    setSearch('?handle=rob.bsky.social');
    BrowserOAuthClient.load.mockResolvedValue(makeClient());

    await run();

    expect(BrowserOAuthClient.load).toHaveBeenCalledOnce();
    expect(BrowserOAuthClient.load).toHaveBeenCalledWith({
      clientId: 'https://atshare.social/client-metadata.json',
      handleResolver: 'https://bsky.social',
    });
  });

  it('calls client.signIn with the handle and NO display option', async () => {
    setSearch('?handle=rob.bsky.social');
    const mockClient = makeClient();
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    await run();

    expect(mockClient.signIn).toHaveBeenCalledOnce();
    expect(mockClient.signIn).toHaveBeenCalledWith('rob.bsky.social');
    // Must NOT pass any second argument — no {display:'popup'}
    expect(mockClient.signIn.mock.calls[0].length).toBe(1);
  });

  it('URL-decodes the handle from the query string', async () => {
    setSearch('?handle=user%40example.social');
    const mockClient = makeClient();
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    await run();

    expect(mockClient.signIn).toHaveBeenCalledWith('user@example.social');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('run — error handling', () => {
  it('posts atshare-auth-error to window.opener when signIn throws', async () => {
    setSearch('?handle=rob.bsky.social');
    const mockClient = makeClient({
      signIn: vi.fn().mockRejectedValue(new Error('Handle resolution failed')),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);

    const openerPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      writable: true,
      value: { postMessage: openerPostMessage },
    });

    await run();

    expect(openerPostMessage).toHaveBeenCalledOnce();
    expect(openerPostMessage).toHaveBeenCalledWith(
      { type: 'atshare-auth-error', error: 'Handle resolution failed' },
      '*'
    );
  });

  it('posts atshare-auth-error to window.opener when BrowserOAuthClient.load throws', async () => {
    setSearch('?handle=rob.bsky.social');
    BrowserOAuthClient.load.mockRejectedValue(new Error('IndexedDB unavailable'));

    const openerPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      writable: true,
      value: { postMessage: openerPostMessage },
    });

    await run();

    expect(openerPostMessage).toHaveBeenCalledOnce();
    expect(openerPostMessage).toHaveBeenCalledWith(
      { type: 'atshare-auth-error', error: 'IndexedDB unavailable' },
      '*'
    );
  });

  it('does not throw when window.opener is null and an error occurs', async () => {
    setSearch('?handle=rob.bsky.social');
    BrowserOAuthClient.load.mockRejectedValue(new Error('Some error'));
    // window.opener is null (set in beforeEach)

    await expect(run()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Missing handle param
// ---------------------------------------------------------------------------

describe('run — missing handle param', () => {
  it('posts atshare-auth-error when handle param is absent', async () => {
    setSearch('');
    const openerPostMessage = vi.fn();
    Object.defineProperty(window, 'opener', {
      writable: true,
      value: { postMessage: openerPostMessage },
    });

    await run();

    expect(openerPostMessage).toHaveBeenCalledOnce();
    expect(openerPostMessage).toHaveBeenCalledWith(
      { type: 'atshare-auth-error', error: 'Missing handle parameter' },
      '*'
    );
    // Should not attempt to load the client at all
    expect(BrowserOAuthClient.load).not.toHaveBeenCalled();
  });

  it('does not call BrowserOAuthClient.load when handle is missing', async () => {
    setSearch('');
    await run();
    expect(BrowserOAuthClient.load).not.toHaveBeenCalled();
  });
});
