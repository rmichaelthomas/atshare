import { describe, it, expect, vi } from 'vitest';
import { getPreference, putPreference, PREFERENCE_NSID } from '../src/pds.js';

describe('getPreference', () => {
  it('calls fetchHandler with the correct XRPC URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ value: { primaryNetwork: 'bluesky', networks: [] } }),
    });
    const result = await getPreference('https://pds.example.com', 'did:plc:abc123', mockFetch);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/xrpc/com.atproto.repo.getRecord');
    expect(url).toContain('repo=did%3Aplc%3Aabc123');
    expect(url).toContain(`collection=${PREFERENCE_NSID}`);
    expect(url).toContain('rkey=self');
    expect(result).toEqual({ primaryNetwork: 'bluesky', networks: [] });
  });

  it('returns null when the record does not exist (400)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    const result = await getPreference('https://pds.example.com', 'did:plc:abc', mockFetch);
    expect(result).toBeNull();
  });

  it('throws on unexpected errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    await expect(getPreference('https://pds.example.com', 'did:plc:abc', mockFetch)).rejects.toThrow('getRecord failed: 500');
  });

  it('does NOT set an Authorization header (fetchHandler owns auth)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ value: {} }),
    });
    await getPreference('https://pds.example.com', 'did:plc:abc', mockFetch);
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers ?? {});
    expect(headers.has('Authorization')).toBe(false);
  });
});

describe('putPreference', () => {
  it('calls fetchHandler with POST to putRecord URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const pref = { primaryNetwork: 'bluesky', networks: [] };
    await putPreference('https://pds.example.com', 'did:plc:abc123', mockFetch, pref);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('/xrpc/com.atproto.repo.putRecord');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.collection).toBe(PREFERENCE_NSID);
    expect(body.rkey).toBe('self');
    expect(body.record.$type).toBe(PREFERENCE_NSID);
    expect(body.record.primaryNetwork).toBe('bluesky');
  });

  it('does NOT set an Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    await putPreference('https://pds.example.com', 'did:plc:abc', mockFetch, {});
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers ?? {});
    expect(headers.has('Authorization')).toBe(false);
  });

  it('throws when putRecord fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(putPreference('https://pds.example.com', 'did:plc:abc', mockFetch, {})).rejects.toThrow('putRecord failed: 401');
  });
});
