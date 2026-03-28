// @vitest-environment happy-dom
/**
 * Tests for src/auth-proxy.js
 *
 * Uses happy-dom for a browser-like environment so window, document, and
 * MessageEvent are all available. Mocks window.open and
 * document.createElement to intercept iframe creation and popup calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  signIn,
  cancelSignIn,
  restoreSession,
  signOut,
  getSession,
  getPreference,
  putPreference,
  _ensureFrame,
  _postToFrame,
  _resetForTesting,
  ATSHARE_ORIGIN,
} from '../src/auth-proxy.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a fake iframe whose contentWindow.postMessage we can intercept.
 * Returns { iframe, postMessageMock } so tests can inspect calls and
 * simulate frame responses via the module listener.
 */
function makeFakeIframe() {
  const iframe = {
    style: {},
    setAttribute: vi.fn(),
    contentWindow: {
      postMessage: vi.fn(),
    },
  };
  return iframe;
}

/**
 * Simulate the frame sending a message to the component window.
 * Dispatches via the real window.dispatchEvent so the module's listener fires.
 */
function simulateFrameMessage(data) {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: ATSHARE_ORIGIN })
  );
}

/**
 * Simulate a message arriving from a different (untrusted) origin.
 */
function simulateWrongOriginMessage(data) {
  window.dispatchEvent(
    new MessageEvent('message', { data, origin: 'https://evil.example.com' })
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let fakeIframe;
let appendedToBody;

beforeEach(() => {
  _resetForTesting();

  fakeIframe = makeFakeIframe();
  appendedToBody = false;

  // Stub document.createElement to return our fake iframe for 'iframe' tags
  vi.spyOn(document, 'createElement').mockImplementation((tag) => {
    if (tag === 'iframe') return fakeIframe;
    // Fall through for other elements
    return document.createElement.wrappedMethod
      ? document.createElement.wrappedMethod(tag)
      : {};
  });

  // Stub document.body.appendChild
  vi.spyOn(document.body, 'appendChild').mockImplementation(() => {
    appendedToBody = true;
  });

  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  _resetForTesting();
});

// ---------------------------------------------------------------------------
// _ensureFrame
// ---------------------------------------------------------------------------

describe('_ensureFrame', () => {
  it('creates a hidden iframe pointing to ATSHARE_ORIGIN/auth-frame.html', async () => {
    const promise = _ensureFrame();

    // Fire the ready message so the promise resolves
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await promise;

    expect(document.createElement).toHaveBeenCalledWith('iframe');
    expect(fakeIframe.src).toBe(`${ATSHARE_ORIGIN}/auth-frame.html`);
    expect(fakeIframe.style.display).toBe('none');
    expect(appendedToBody).toBe(true);
  });

  it('is idempotent — returns the same promise on repeated calls', () => {
    const p1 = _ensureFrame();
    const p2 = _ensureFrame();
    expect(p1).toBe(p2);
    // Resolve so state is clean
    simulateFrameMessage({ type: 'atshare-frame-ready' });
  });

  it('resolves only after atshare-frame-ready message arrives', async () => {
    let resolved = false;
    const promise = _ensureFrame().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    await Promise.resolve(); // flush microtasks
    expect(resolved).toBe(false);

    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await promise;
    expect(resolved).toBe(true);
  });

  it('ignores atshare-frame-ready from wrong origin', async () => {
    let resolved = false;
    _ensureFrame().then(() => { resolved = true; });

    simulateWrongOriginMessage({ type: 'atshare-frame-ready' });
    await Promise.resolve();
    expect(resolved).toBe(false);

    // Cleanup: resolve legitimately
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await _ensureFrame();
  });
});

// ---------------------------------------------------------------------------
// _postToFrame
// ---------------------------------------------------------------------------

describe('_postToFrame', () => {
  async function ensureFrameReady() {
    const p = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await p;
  }

  it('sends a message with a unique id to the iframe contentWindow', async () => {
    await ensureFrameReady();

    const promise = _postToFrame({ type: 'ping' });

    expect(fakeIframe.contentWindow.postMessage).toHaveBeenCalledOnce();
    const [payload, targetOrigin] = fakeIframe.contentWindow.postMessage.mock.calls[0];
    expect(targetOrigin).toBe(ATSHARE_ORIGIN);
    expect(payload.type).toBe('ping');
    expect(typeof payload.id).toBe('string');
    expect(payload.id.length).toBeGreaterThan(0);

    // Resolve the pending promise
    simulateFrameMessage({ id: payload.id, result: 'pong' });
    await expect(promise).resolves.toBe('pong');
  });

  it('rejects when frame response contains an error', async () => {
    await ensureFrameReady();

    const promise = _postToFrame({ type: 'badRequest' });
    const [payload] = fakeIframe.contentWindow.postMessage.mock.calls[0];
    simulateFrameMessage({ id: payload.id, error: 'Something went wrong' });

    await expect(promise).rejects.toThrow('Something went wrong');
  });

  it('ignores responses from wrong origin', async () => {
    await ensureFrameReady();

    const promise = _postToFrame({ type: 'ping' });
    const [payload] = fakeIframe.contentWindow.postMessage.mock.calls[0];

    // Wrong-origin message should be ignored — promise stays pending
    simulateWrongOriginMessage({ id: payload.id, result: 'should be ignored' });
    let settled = false;
    promise.then(() => { settled = true; }).catch(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    // Resolve legitimately so we don't leak
    simulateFrameMessage({ id: payload.id, result: null });
    await promise;
  });

  it('generates unique ids for each call', async () => {
    await ensureFrameReady();

    const p1 = _postToFrame({ type: 'a' });
    const p2 = _postToFrame({ type: 'b' });

    const calls = fakeIframe.contentWindow.postMessage.mock.calls;
    const id1 = calls[0][0].id;
    const id2 = calls[1][0].id;
    expect(id1).not.toBe(id2);

    // Resolve both
    simulateFrameMessage({ id: id1, result: null });
    simulateFrameMessage({ id: id2, result: null });
    await Promise.all([p1, p2]);
  });
});

// ---------------------------------------------------------------------------
// restoreSession
// ---------------------------------------------------------------------------

describe('restoreSession', () => {
  it('sends restoreSession to iframe and returns {sub} when session exists', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = restoreSession();

    // Grab the message id and respond
    await Promise.resolve();
    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'restoreSession'
    );
    expect(call).toBeDefined();
    simulateFrameMessage({ id: call[0].id, result: { sub: 'did:plc:restored' } });

    const result = await promise;
    expect(result).toEqual({ sub: 'did:plc:restored' });
  });

  it('returns null when no session exists', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = restoreSession();
    await Promise.resolve();
    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'restoreSession'
    );
    simulateFrameMessage({ id: call[0].id, result: null });

    const result = await promise;
    expect(result).toBeNull();
  });

  it('updates getSession() after a successful restore', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    expect(getSession()).toBeNull();

    const promise = restoreSession();
    await Promise.resolve();
    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'restoreSession'
    );
    simulateFrameMessage({ id: call[0].id, result: { sub: 'did:plc:abc' } });
    await promise;

    expect(getSession()).toEqual({ sub: 'did:plc:abc' });
  });

  it('clears getSession() when restore returns null', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = restoreSession();
    await Promise.resolve();
    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'restoreSession'
    );
    simulateFrameMessage({ id: call[0].id, result: null });
    await promise;

    expect(getSession()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

describe('signOut', () => {
  it('sends signOut to iframe and clears the cached DID', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    // Seed a session
    const restorePromise = restoreSession();
    await Promise.resolve();
    const restoreCall = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'restoreSession'
    );
    simulateFrameMessage({ id: restoreCall[0].id, result: { sub: 'did:plc:user' } });
    await restorePromise;
    expect(getSession()).toEqual({ sub: 'did:plc:user' });

    const signOutPromise = signOut();
    await Promise.resolve();
    const signOutCall = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'signOut'
    );
    expect(signOutCall).toBeDefined();
    simulateFrameMessage({ id: signOutCall[0].id, result: null });
    await signOutPromise;

    expect(getSession()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSession
// ---------------------------------------------------------------------------

describe('getSession', () => {
  it('returns null initially', () => {
    expect(getSession()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('signIn', () => {
  let mockPopup;
  let openMock;

  beforeEach(() => {
    mockPopup = {
      closed: false,
      close: vi.fn(),
    };
    openMock = vi.spyOn(window, 'open').mockReturnValue(mockPopup);
  });

  it('opens a popup to ATSHARE_ORIGIN/auth/?handle=...', () => {
    signIn('rob.bsky.social');
    expect(openMock).toHaveBeenCalledOnce();
    const [url] = openMock.mock.calls[0];
    expect(url).toBe(`${ATSHARE_ORIGIN}/auth/?handle=rob.bsky.social`);
  });

  it('URL-encodes the handle', () => {
    signIn('user@weird handle.social');
    const [url] = openMock.mock.calls[0];
    expect(url).toContain(encodeURIComponent('user@weird handle.social'));
  });

  it('resolves with {sub} on atshare-auth-complete', async () => {
    const promise = signIn('rob.bsky.social');

    simulateFrameMessage({ type: 'atshare-auth-complete', did: 'did:plc:rob' });

    const result = await promise;
    expect(result).toEqual({ sub: 'did:plc:rob' });
  });

  it('rejects on atshare-auth-error', async () => {
    const promise = signIn('rob.bsky.social');

    simulateFrameMessage({ type: 'atshare-auth-error', error: 'OAuth error' });

    await expect(promise).rejects.toThrow('OAuth error');
  });

  it('rejects with default message when error field is missing', async () => {
    const promise = signIn('rob.bsky.social');
    simulateFrameMessage({ type: 'atshare-auth-error' });
    await expect(promise).rejects.toThrow('Authentication failed');
  });

  it('rejects when the popup is blocked (window.open returns null)', async () => {
    openMock.mockReturnValue(null);
    await expect(signIn('rob.bsky.social')).rejects.toThrow('Popup was blocked');
  });

  it('resolves when popup closes and session is found in iframe', { timeout: 10000 }, async () => {
    vi.useRealTimers(); // async setTimeout + _postToFrame is too complex for fake timers

    // Set up iframe
    _ensureFrame();
    await new Promise((r) => setTimeout(r, 10));
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await new Promise((r) => setTimeout(r, 10));

    const promise = signIn('rob.bsky.social');
    mockPopup.closed = true;

    // Wait for poll (500ms) + grace (300ms) + buffer
    await new Promise((r) => setTimeout(r, 1000));

    // _postToFrame sent a restoreSession request — find its id and respond
    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      c => c[0]?.type === 'restoreSession'
    );
    expect(call).toBeTruthy();
    simulateFrameMessage({ id: call[0].id, result: { sub: 'did:plc:found' } });

    const result = await promise;
    expect(result).toEqual({ sub: 'did:plc:found' });

    vi.useFakeTimers(); // restore for other tests
  });

  it('rejects when popup closes and no session found in iframe', { timeout: 10000 }, async () => {
    vi.useRealTimers();

    _ensureFrame();
    await new Promise((r) => setTimeout(r, 10));
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await new Promise((r) => setTimeout(r, 10));

    const promise = signIn('rob.bsky.social');
    mockPopup.closed = true;

    await new Promise((r) => setTimeout(r, 1000));

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      c => c[0]?.type === 'restoreSession'
    );
    expect(call).toBeTruthy();
    simulateFrameMessage({ id: call[0].id, result: null });

    await expect(promise).rejects.toThrow('Sign-in cancelled');

    vi.useFakeTimers();
  });

  it('ignores auth messages from wrong origin', async () => {
    const promise = signIn('rob.bsky.social');

    simulateWrongOriginMessage({ type: 'atshare-auth-complete', did: 'did:plc:evil' });

    // Promise should still be pending
    let settled = false;
    promise.then(() => { settled = true; }).catch(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    // Cleanup via legitimate resolution
    simulateFrameMessage({ type: 'atshare-auth-complete', did: 'did:plc:real' });
    await promise;
  });

  it('updates getSession() after successful sign-in', async () => {
    const promise = signIn('rob.bsky.social');
    simulateFrameMessage({ type: 'atshare-auth-complete', did: 'did:plc:rob2' });
    await promise;
    expect(getSession()).toEqual({ sub: 'did:plc:rob2' });
  });
});

// ---------------------------------------------------------------------------
// cancelSignIn
// ---------------------------------------------------------------------------

describe('cancelSignIn', () => {
  it('closes the current popup', () => {
    const mockPopup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockPopup);

    signIn('rob.bsky.social');
    cancelSignIn();

    expect(mockPopup.close).toHaveBeenCalledOnce();
  });

  it('is a no-op when no popup is open', () => {
    // Should not throw
    expect(() => cancelSignIn()).not.toThrow();
  });

  it('is a no-op when popup is already closed', () => {
    const mockPopup = { closed: true, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockPopup);

    signIn('rob.bsky.social');
    cancelSignIn();

    expect(mockPopup.close).not.toHaveBeenCalled();
  });

  it('causes signIn promise to reject after poll detects closed popup', { timeout: 10000 }, async () => {
    vi.useRealTimers();

    _ensureFrame();
    await new Promise((r) => setTimeout(r, 10));
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await new Promise((r) => setTimeout(r, 10));

    const mockPopup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(mockPopup);

    const promise = signIn('rob.bsky.social');
    cancelSignIn();
    mockPopup.closed = true;

    await new Promise((r) => setTimeout(r, 1000));

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      c => c[0]?.type === 'restoreSession'
    );
    expect(call).toBeTruthy();
    simulateFrameMessage({ id: call[0].id, result: null });

    await expect(promise).rejects.toThrow('Sign-in cancelled');

    vi.useFakeTimers();
  });
});

// ---------------------------------------------------------------------------
// getPreference
// ---------------------------------------------------------------------------

describe('getPreference', () => {
  it('sends getPreference with did to iframe and returns result', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = getPreference('did:plc:abc');
    await Promise.resolve();

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'getPreference'
    );
    expect(call).toBeDefined();
    expect(call[0].did).toBe('did:plc:abc');

    const pref = { primaryNetwork: 'bluesky', networks: [] };
    simulateFrameMessage({ id: call[0].id, result: pref });

    await expect(promise).resolves.toEqual(pref);
  });

  it('returns null when iframe returns null', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = getPreference('did:plc:abc');
    await Promise.resolve();

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'getPreference'
    );
    simulateFrameMessage({ id: call[0].id, result: null });

    await expect(promise).resolves.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// putPreference
// ---------------------------------------------------------------------------

describe('putPreference', () => {
  it('sends putPreference with did and preference to iframe', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const pref = { primaryNetwork: 'mastodon', networks: ['mastodon'] };
    const promise = putPreference('did:plc:abc', pref);
    await Promise.resolve();

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'putPreference'
    );
    expect(call).toBeDefined();
    expect(call[0].did).toBe('did:plc:abc');
    expect(call[0].preference).toEqual(pref);

    simulateFrameMessage({ id: call[0].id, result: null });
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects when iframe returns an error', async () => {
    const frameReady = _ensureFrame();
    simulateFrameMessage({ type: 'atshare-frame-ready' });
    await frameReady;

    const promise = putPreference('did:plc:abc', {});
    await Promise.resolve();

    const call = fakeIframe.contentWindow.postMessage.mock.calls.find(
      ([p]) => p.type === 'putPreference'
    );
    simulateFrameMessage({ id: call[0].id, error: 'putRecord failed: 401' });

    await expect(promise).rejects.toThrow('putRecord failed: 401');
  });
});
