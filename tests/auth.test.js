import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@atproto/oauth-client-browser', () => ({
  BrowserOAuthClient: {
    load: vi.fn(),
  },
}));

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { signIn, restoreSession, signOut, _resetForTesting } from '../src/auth.js';

const makeSession = (sub = 'did:plc:test') => ({
  sub,
  fetchHandler: vi.fn(),
});

const makeClient = (overrides = {}) => ({
  signIn: vi.fn().mockResolvedValue(makeSession()),
  init: vi.fn().mockResolvedValue(undefined),
  revoke: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  _resetForTesting();
});

describe('restoreSession', () => {
  it('returns null when no existing session', async () => {
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue(undefined) })
    );
    const session = await restoreSession();
    expect(session).toBeNull();
  });

  it('returns session when one exists', async () => {
    const session = makeSession();
    BrowserOAuthClient.load.mockResolvedValue(
      makeClient({ init: vi.fn().mockResolvedValue({ session }) })
    );
    const result = await restoreSession();
    expect(result).toBe(session);
  });
});

describe('signIn', () => {
  it('calls client.signIn with handle and popup display', async () => {
    const session = makeSession();
    const mockClient = makeClient({ signIn: vi.fn().mockResolvedValue(session) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await restoreSession();
    const result = await signIn('rob.bsky.social');
    expect(mockClient.signIn).toHaveBeenCalledWith(
      'rob.bsky.social',
      expect.objectContaining({ display: 'popup' })
    );
    expect(result).toBe(session);
  });

  it('rejects when signIn is cancelled', async () => {
    const mockClient = makeClient({
      signIn: vi.fn().mockRejectedValue(new Error('Aborted')),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await restoreSession();
    await expect(signIn('rob.bsky.social')).rejects.toThrow('Aborted');
  });
});

describe('signOut', () => {
  it('revokes the current session', async () => {
    const session = makeSession('did:plc:signout');
    const mockClient = makeClient({
      init: vi.fn().mockResolvedValue({ session }),
      revoke: vi.fn().mockResolvedValue(undefined),
    });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await restoreSession();
    await signOut();
    expect(mockClient.revoke).toHaveBeenCalledWith('did:plc:signout');
  });

  it('is a no-op when not signed in', async () => {
    const mockClient = makeClient({ init: vi.fn().mockResolvedValue(undefined) });
    BrowserOAuthClient.load.mockResolvedValue(mockClient);
    await restoreSession();
    await expect(signOut()).resolves.not.toThrow();
  });
});
