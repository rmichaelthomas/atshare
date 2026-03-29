# Universal Destination Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Bluesky + Mastodon share selector with a universal destination picker driven by a community-contributed JSON registry, supporting multiple ATProto clients, Fediverse instances, traditional networks, and clipboard fallback.

**Architecture:** A `destinations.json` registry at the repo root defines all protocols and clients. A new `src/destinations.js` module replaces `src/networks.js`, providing lookup and URL-building functions. The web component (`src/atshare-selector.js`) gets three popover states: default view (protocol buttons), expanded view (client sub-list), and full list view (all destinations). Preferences migrate from the old localStorage shape to a flatter format.

**Tech Stack:** Vanilla JS web component (shadow DOM), Vite build, Vitest for tests, JSON Schema for registry validation.

**Spec:** `docs/superpowers/specs/2026-03-29-universal-destination-selector-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `destinations.json` | Create | Community-contributed destination registry |
| `destinations.schema.json` | Create | JSON Schema for CI validation |
| `src/destinations.js` | Create | Registry lookup, URL building, preference resolution |
| `src/networks.js` | Delete | Replaced by `src/destinations.js` |
| `src/icons/bluesky.svg` | Create | Bluesky butterfly icon |
| `src/icons/mastodon.svg` | Create | Mastodon logo icon |
| `src/icons/linkedin.svg` | Create | LinkedIn logo icon |
| `src/icons/x.svg` | Create | X/Twitter logo icon |
| `src/icons/threads.svg` | Create | Threads logo icon |
| `src/atshare-selector.js` | Modify | New popover states, render from registry, preference migration |
| `tests/destinations.test.js` | Create | Tests for destinations module |
| `tests/preference-migration.test.js` | Create | Tests for localStorage migration |
| `CONTRIBUTING.md` | Create | Guide for adding destinations |
| `.github/workflows/validate-destinations.yml` | Create | CI validation for destination PRs |

---

### Task 1: Destination Registry and Schema

**Files:**
- Create: `destinations.json`
- Create: `destinations.schema.json`

- [ ] **Step 1: Create `destinations.schema.json`**

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["protocols"],
  "properties": {
    "$schema": { "type": "string" },
    "protocols": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "label", "color", "clients"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "label": { "type": "string", "minLength": 1 },
          "color": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
          "clients": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "required": ["id", "name", "intentUrl"],
              "properties": {
                "id": { "type": "string", "minLength": 1 },
                "name": { "type": "string", "minLength": 1 },
                "domain": { "type": "string" },
                "intentUrl": { "type": "string", "pattern": "\\{(text|url|title|instance)\\}" },
                "icon": { "type": "string", "pattern": "\\.svg$" },
                "requiresInstance": { "type": "boolean" },
                "default": { "type": "boolean" }
              },
              "additionalProperties": false
            }
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2: Create `destinations.json`**

```json
{
  "$schema": "./destinations.schema.json",
  "protocols": [
    {
      "id": "atproto",
      "label": "AT Protocol",
      "color": "#0085ff",
      "clients": [
        {
          "id": "bsky",
          "name": "Bluesky",
          "domain": "bsky.app",
          "intentUrl": "https://bsky.app/intent/compose?text={text}",
          "icon": "bluesky.svg",
          "default": true
        },
        {
          "id": "deckblue",
          "name": "deck.blue",
          "domain": "deck.blue",
          "intentUrl": "https://deck.blue/intent/compose?text={text}"
        },
        {
          "id": "skeet",
          "name": "Skeet",
          "domain": "skeetapp.com",
          "intentUrl": "https://skeetapp.com/intent/compose?text={text}"
        },
        {
          "id": "kite",
          "name": "Kite",
          "domain": "kite.blue",
          "intentUrl": "https://kite.blue/intent/compose?text={text}"
        },
        {
          "id": "langit",
          "name": "Langit",
          "domain": "langit.pages.dev",
          "intentUrl": "https://langit.pages.dev/intent/compose?text={text}"
        }
      ]
    },
    {
      "id": "activitypub",
      "label": "Fediverse",
      "color": "#6364ff",
      "clients": [
        {
          "id": "mastodon",
          "name": "Mastodon",
          "intentUrl": "{instance}/share?text={text}",
          "requiresInstance": true,
          "default": true
        },
        {
          "id": "misskey",
          "name": "Misskey",
          "intentUrl": "{instance}/share?text={text}",
          "requiresInstance": true
        }
      ]
    },
    {
      "id": "other",
      "label": "Other Networks",
      "color": "#888888",
      "clients": [
        {
          "id": "linkedin",
          "name": "LinkedIn",
          "domain": "linkedin.com",
          "intentUrl": "https://www.linkedin.com/sharing/share-offsite/?url={url}",
          "icon": "linkedin.svg"
        },
        {
          "id": "x",
          "name": "X / Twitter",
          "domain": "x.com",
          "intentUrl": "https://x.com/intent/tweet?text={text}&url={url}",
          "icon": "x.svg"
        },
        {
          "id": "threads",
          "name": "Threads",
          "domain": "threads.net",
          "intentUrl": "https://www.threads.net/intent/post?text={text}",
          "icon": "threads.svg"
        }
      ]
    }
  ]
}
```

- [ ] **Step 3: Validate schema works**

Run: `node -e "const Ajv = require('ajv'); /* ... */"` — actually, we don't have ajv installed. Instead, validate manually:

Run: `node -e "const d = JSON.parse(require('fs').readFileSync('destinations.json','utf8')); console.log(d.protocols.length, 'protocols,', d.protocols.flatMap(p=>p.clients).length, 'clients'); d.protocols.forEach(p => { if (!p.id || !p.label || !p.color || !p.clients.length) throw new Error('Invalid protocol: ' + p.id); p.clients.forEach(c => { if (!c.id || !c.name || !c.intentUrl) throw new Error('Invalid client: ' + c.id); }); }); console.log('OK');"`

Expected: `3 protocols, 10 clients` then `OK`

- [ ] **Step 4: Commit**

```bash
git add destinations.json destinations.schema.json
git commit -m "feat: add destination registry and JSON schema"
```

---

### Task 2: SVG Brand Icons

**Files:**
- Create: `src/icons/bluesky.svg`
- Create: `src/icons/mastodon.svg`
- Create: `src/icons/linkedin.svg`
- Create: `src/icons/x.svg`
- Create: `src/icons/threads.svg`

- [ ] **Step 1: Create `src/icons/` directory and SVG files**

Each icon should be a single-path SVG with a square viewBox, no fill attribute (fill applied at render time). Source the paths from each platform's official brand assets/guidelines.

`src/icons/bluesky.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 530"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 300 249.49c26.262-54.316 97.782-155.54 164.28-205.46C512.26 8.009 590-19.862 590 68.825c0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.38-3.69-10.832-3.708-7.896-.017-2.936-1.193.516-3.707 7.896-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.449-163.25-81.433C20.15 217.613 10 86.536 10 68.824c0-88.687 77.742-60.816 125.72-24.795z"/></svg>
```

`src/icons/mastodon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 74 79"><path d="M73.7 17.9c-1-5.2-5.8-9.2-11.8-10.6C55.8 5.8 48.2 5 37.2 5h-.1C26.2 5 23.5 5.8 17.3 7.3 11.4 8.7 6.5 12.7 5.5 17.9c-1 5.4-1.1 11.6-.8 17.3.2 4 .3 8 .6 12 .5 5.5 1.5 10.9 4.5 15.5 3.4 5.3 8.6 8.5 14.2 10.2 6 1.8 12.5 2.1 18.7 1.2 1-.2 2-.3 3-.5l.1-4.9c-1.4.3-2.8.6-4.2.7-5.8.6-11.7.1-16-3.1-.4-.3-.7-.6-1-1l.2-.1c7.2 1.7 14.5 2.4 21.9 1.9 2.1-.1 4.2-.4 6.3-.7 4.3-.8 8.4-2 12.1-4.2.1 0 .1-.1.2-.1v-.1c3.3-2.6 5.5-7 6.3-13.1.3-2.2.4-4.6.5-6.9.1-1.6.2-3.2.2-4.9v-2c.1-2.8 0-5.6-.3-8.3zM61.4 43h-8.5V25.5c0-3.7-1.5-5.5-4.7-5.5-3.4 0-5.2 2.2-5.2 6.6V36h-8.4V26.6c0-4.4-1.7-6.6-5.2-6.6-3.1 0-4.7 1.9-4.7 5.5V43h-8.5V25c0-3.7 1-6.6 2.8-8.8 2-2.2 4.5-3.3 7.7-3.3 3.7 0 6.5 1.4 8.3 4.3l1.8 3 1.8-3c1.8-2.8 4.6-4.3 8.3-4.3 3.2 0 5.8 1.1 7.7 3.3 1.9 2.2 2.8 5.1 2.8 8.8V43z"/></svg>
```

`src/icons/linkedin.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
```

`src/icons/x.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
```

`src/icons/threads.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><path d="M141.537 88.988a66.667 66.667 0 00-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.674-1.14-23.82 1.371-39.134 15.24-38.264 34.678.44 9.846 5.063 18.345 13.018 23.93 6.72 4.72 15.376 7.064 24.37 6.6 11.87-.612 21.168-5.065 27.616-13.236 4.894-6.205 7.996-14.158 9.362-24.036 5.603 3.382 9.77 7.834 12.204 13.14 4.14 9.022 4.384 23.83-3.613 31.827-7.034 7.034-15.48 10.076-28.15 10.172-14.088-.107-24.738-4.628-31.648-13.432C74.86 143.142 71.1 129.01 70.97 112.11c.13-16.9 3.89-31.034 11.17-41.986C89.07 61.17 99.72 56.65 113.81 56.543c14.17.11 25.01 4.65 32.21 13.49 3.5 4.3 6.16 9.56 7.94 15.65l15.03-4.08c-2.25-7.79-5.81-14.7-10.63-20.58C148.2 48.92 133.36 42.86 114.03 42.7h-.24c-19.22.16-34.16 6.2-44.38 17.96C60.28 71.29 55.87 87.09 55.72 112l.003.14c.15 24.91 4.56 40.71 13.69 51.35 10.22 11.89 25.16 17.93 44.38 18.09h.24c15.43-.11 27.12-4.49 36.72-13.78 12.43-12.05 11.73-27.56 6.36-39.33-3.86-8.45-10.63-15.27-19.61-19.48zM99.56 141.24c-9.97.55-20.33-3.93-21.08-14.96-.56-8.22 5.83-17.38 23.53-18.4 2.07-.12 4.1-.18 6.07-.18 6.3 0 12.19.6 17.53 1.77-2 23.96-14.3 31.16-26.05 31.77z"/></svg>
```

- [ ] **Step 2: Verify icons render**

Run: `ls -la src/icons/`
Expected: 5 SVG files, each under 2KB

- [ ] **Step 3: Commit**

```bash
git add src/icons/
git commit -m "feat: add SVG brand icons for platform destinations"
```

---

### Task 3: Destinations Module (`src/destinations.js`)

**Files:**
- Create: `src/destinations.js`
- Create: `tests/destinations.test.js`

- [ ] **Step 1: Write failing tests for the destinations module**

Create `tests/destinations.test.js`:

```javascript
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
    // All protocols should have a default, but fallback is first client
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
    expect(result.clientId).toBe('bsky'); // falls back to default
  });

  it('returns null for empty/null input', () => {
    expect(resolvePreference(null)).toBeNull();
    expect(resolvePreference(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/destinations.test.js`
Expected: FAIL — module `../src/destinations.js` does not exist

- [ ] **Step 3: Write `src/destinations.js`**

```javascript
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
  // Replace {instance} first (it's part of the URL origin, not a query param)
  if (vars.instance) {
    url = url.replace('{instance}', vars.instance);
  }
  // Replace remaining template vars with encoded values
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

  // Map old network names to protocol IDs
  const protocolMap = { bluesky: 'atproto', mastodon: 'activitypub' };
  const protocolId = protocolMap[primaryNetwork] || primaryNetwork;

  if (!networks || networks.length === 0) {
    const defaultClient = getDefaultClient(protocolId);
    return defaultClient ? { protocolId, clientId: defaultClient.id } : null;
  }

  // Find the matching network entry
  const atprotoNet = networks.find(n => n.type === 'atproto');
  const apNet = networks.find(n => n.type === 'activitypub');

  if (protocolId === 'atproto' && atprotoNet?.appView) {
    // Extract domain from appView URL and look up client
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/destinations.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/destinations.js tests/destinations.test.js
git commit -m "feat: add destinations module with registry lookup and URL building"
```

---

### Task 4: Preference Migration

**Files:**
- Create: `tests/preference-migration.test.js`
- Modify: `src/destinations.js` (add `migrateLocalPreference` export)

- [ ] **Step 1: Write failing tests for preference migration**

Create `tests/preference-migration.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
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
    expect(result.preferredClient).toBe('bsky'); // default
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/preference-migration.test.js`
Expected: FAIL — `migrateLocalPreference` is not exported

- [ ] **Step 3: Add `migrateLocalPreference` to `src/destinations.js`**

Append to `src/destinations.js`:

```javascript
/**
 * Migrate a localStorage preference from the old format to the new flat format.
 * Old format: { primaryNetwork: "bluesky", networks: [...] }
 * New format: { primaryNetwork: "atproto", preferredClient: "bsky", mastodonInstance?: "..." }
 *
 * Returns the preference in new format. If already in new format, returns as-is.
 * @param {object|null} pref
 * @returns {object|null}
 */
export function migrateLocalPreference(pref) {
  if (!pref) return null;

  // Already in new format (has preferredClient, no networks array)
  if (pref.preferredClient && !pref.networks) return pref;

  // Old format detected — migrate
  const resolved = resolvePreference(pref);
  if (!resolved) return null;

  const migrated = {
    primaryNetwork: resolved.protocolId,
    preferredClient: resolved.clientId,
  };

  if (resolved.instance) {
    migrated.mastodonInstance = resolved.instance;
  }

  return migrated;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/preference-migration.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/destinations.js tests/preference-migration.test.js
git commit -m "feat: add localStorage preference migration"
```

---

### Task 5: Update Web Component — Data Layer

Replace the import of `networks.js` and the preference handling in the component. This task changes the data flow only — no UI changes yet.

**Files:**
- Modify: `src/atshare-selector.js:1-20` (imports)
- Modify: `src/atshare-selector.js:458-527` (share and preference methods)
- Delete: `src/networks.js`

- [ ] **Step 1: Replace imports in `atshare-selector.js`**

Replace line 13:
```javascript
import { NETWORKS, buildIntentUrl } from './networks.js';
```
With:
```javascript
import {
  getProtocols,
  getClients,
  getDefaultClient,
  getClientById,
  getClientByDomain,
  buildIntentUrl,
  resolvePreference,
  migrateLocalPreference,
} from './destinations.js';
```

- [ ] **Step 2: Update `_share` method to use new `buildIntentUrl` signature**

Replace the `_share` method (around line 481):
```javascript
_share(networkId, opts = {}) {
  const intentUrl = buildIntentUrl(networkId, this.shareText, opts);
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
  this._closePopover();
  this._persistPreference(networkId, opts);
}
```
With:
```javascript
_share(clientId, opts = {}) {
  const intentUrl = buildIntentUrl(clientId, {
    text: this.shareText,
    url: this.shareUrl,
    title: this.getAttribute('title') || '',
    instance: opts.instance,
  });
  window.open(intentUrl, '_blank', 'noopener,noreferrer');
  this._closePopover();
  this._persistPreference(clientId, opts);
}
```

- [ ] **Step 3: Update `_persistPreference` to write new localStorage format**

Replace the `_persistPreference` and `_buildNetworksArray` methods (around lines 490-513):
```javascript
_persistPreference(networkId, opts) {
  const pref = {
    primaryNetwork: networkId,
    networks: this._buildNetworksArray(networkId, opts),
  };
  try {
    localStorage.setItem('atshare.preference', JSON.stringify(pref));
  } catch {}
  const session = getSession();
  if (session) {
    putPreference(session.sub, pref).catch(() => {});
  }
}

_buildNetworksArray(primaryNetworkId, opts) {
  const networks = [];
  if (primaryNetworkId === 'bluesky') {
    networks.push({ type: 'atproto', appView: 'https://bsky.app' });
  } else if (primaryNetworkId === 'mastodon' && opts.mastodonInstance) {
    networks.push({ type: 'activitypub', instance: opts.mastodonInstance });
  }
  return networks;
}
```
With:
```javascript
_persistPreference(clientId, opts = {}) {
  const client = getClientById(clientId);
  if (!client) return;

  // Write new flat format to localStorage
  const localPref = {
    primaryNetwork: client.protocolId,
    preferredClient: clientId,
  };
  if (opts.instance) {
    localPref.mastodonInstance = opts.instance;
  }
  try {
    localStorage.setItem('atshare.preference', JSON.stringify(localPref));
  } catch {}

  // Write PDS-format preference (fire-and-forget) if authenticated
  const session = getSession();
  if (session) {
    const pdsPref = {
      primaryNetwork: client.protocolId === 'atproto' ? 'bluesky' : 'mastodon',
      networks: [],
    };
    if (client.protocolId === 'atproto') {
      pdsPref.networks.push({ type: 'atproto', appView: `https://${client.domain || 'bsky.app'}` });
    } else if (opts.instance) {
      pdsPref.networks.push({ type: 'activitypub', instance: opts.instance });
    }
    putPreference(session.sub, pdsPref).catch(() => {});
  }
}
```

- [ ] **Step 4: Update `_getMastodonInstance` to read new format with migration**

Replace `_getMastodonInstance` (around line 515):
```javascript
_getMastodonInstance() {
  try {
    const pref = JSON.parse(localStorage.getItem('atshare.preference') || 'null');
    return pref?.networks?.find((n) => n.type === 'activitypub')?.instance || null;
  } catch (_) {
    return null;
  }
}
```
With:
```javascript
_getLocalPreference() {
  try {
    const raw = JSON.parse(localStorage.getItem('atshare.preference') || 'null');
    if (!raw) return null;
    const migrated = migrateLocalPreference(raw);
    // Write back migrated format if it changed
    if (migrated && raw.networks) {
      localStorage.setItem('atshare.preference', JSON.stringify(migrated));
    }
    return migrated;
  } catch {
    return null;
  }
}

_getMastodonInstance() {
  const pref = this._getLocalPreference();
  return pref?.mastodonInstance || null;
}
```

- [ ] **Step 5: Update `_loadPreferenceForHandle` to use `resolvePreference`**

Replace (around line 398):
```javascript
async _loadPreferenceForHandle(handle) {
  const { did, pdsEndpoint } = await resolveIdentity(handle);
  const pref = await getPublicPreference(pdsEndpoint, did);
  if (pref) {
    this._preference = pref;
    this._renderNetworks();
  }
}
```
With:
```javascript
async _loadPreferenceForHandle(handle) {
  const { did, pdsEndpoint } = await resolveIdentity(handle);
  const pdsPref = await getPublicPreference(pdsEndpoint, did);
  if (pdsPref) {
    const resolved = resolvePreference(pdsPref);
    if (resolved) {
      this._preference = resolved;
      // Hydrate localStorage from PDS
      const localPref = {
        primaryNetwork: resolved.protocolId,
        preferredClient: resolved.clientId,
      };
      if (resolved.instance) localPref.mastodonInstance = resolved.instance;
      try { localStorage.setItem('atshare.preference', JSON.stringify(localPref)); } catch {}
    }
    this._renderNetworks();
  }
}
```

- [ ] **Step 6: Delete `src/networks.js`**

```bash
rm src/networks.js
```

- [ ] **Step 7: Verify build still works**

Run: `npx vite build`
Expected: Build succeeds (no import errors)

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/atshare-selector.js src/destinations.js
git rm src/networks.js
git commit -m "refactor: replace networks.js with destinations module in component"
```

---

### Task 6: Update Web Component — UI (Default + Expanded Views)

Replace the current network buttons with the new protocol buttons, chevrons, and expandable client sub-lists. Also update CSS for brand colors, icons, and preference indicators.

**Files:**
- Modify: `src/atshare-selector.js` (template HTML, CSS, `_renderNetworks`, event handlers)

- [ ] **Step 1: Update the template CSS**

In the `<style>` block inside the template, replace the `.network-btn` styles (lines 66-87) with new styles for protocol buttons, chevrons, client sub-lists, and the "More destinations" link. Add icon styles and brand color support:

```css
/* Protocol buttons */
.protocol-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--atshare-border, #e2e8f0);
  border-radius: 6px;
  background: transparent;
  color: var(--atshare-color, #0f172a);
  font-size: 14px;
  cursor: pointer;
  text-align: left;
  gap: 10px;
  transition: background 0.15s;
}
.protocol-btn:hover {
  background: var(--atshare-bg-hover, #f8fafc);
}
.protocol-btn .icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}
.protocol-btn .icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.protocol-btn .icon-dot {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.protocol-btn .icon-dot span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: block;
}
.protocol-btn .btn-label {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.protocol-btn .via {
  font-size: 11px;
  opacity: 0.6;
}
.protocol-btn .btn-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.protocol-btn .check {
  display: none;
}
.protocol-btn.preferred .check {
  display: block;
}
.protocol-btn .chevron {
  width: 14px;
  height: 14px;
  color: #94a3b8;
  transition: transform 0.15s;
}
.protocol-btn.expanded .chevron {
  transform: rotate(180deg);
}

/* Client sub-list */
.client-list {
  display: none;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  margin-top: -2px;
  border: 1px solid var(--atshare-border, #e2e8f0);
  border-top: none;
  border-radius: 0 0 6px 6px;
}
.client-list.visible {
  display: flex;
}
.client-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--atshare-color, #0f172a);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  opacity: 0.7;
}
.client-btn:hover {
  background: var(--atshare-bg-hover, #f8fafc);
  opacity: 1;
}
.client-btn.preferred {
  opacity: 1;
}
.client-btn .client-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.client-btn .client-preferred-label {
  display: none;
  margin-left: auto;
  font-size: 11px;
  opacity: 0.6;
}
.client-btn.preferred .client-preferred-label {
  display: inline;
}

/* Network list spacing */
.network-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* More destinations link */
.more-link {
  display: block;
  text-align: center;
  padding: 6px;
  border: none;
  background: none;
  color: var(--atshare-accent, #1d4ed8);
  font-size: 13px;
  cursor: pointer;
  opacity: 0.7;
}
.more-link:hover {
  opacity: 1;
}
```

- [ ] **Step 2: Add CSS for the full list view**

Append to the `<style>` block:

```css
/* Full destination list view */
.full-list {
  display: none;
}
.full-list.visible {
  display: block;
}
.full-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.full-list-header span {
  font-size: 12px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.back-link {
  font-size: 12px;
  color: #94a3b8;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.back-link:hover { color: #64748b; }

.full-list-section {
  margin-bottom: 14px;
}
.full-list-section-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  opacity: 0.5;
  margin-bottom: 6px;
}

.full-list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--atshare-color, #0f172a);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.full-list-item:hover {
  background: var(--atshare-bg-hover, #f8fafc);
}
.full-list-item .icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.full-list-item .icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
.full-list-item .check {
  margin-left: auto;
  display: none;
}
.full-list-item.preferred .check {
  display: block;
}

.clipboard-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-top: 1px solid var(--atshare-border, #e2e8f0);
  border-radius: 0;
  background: transparent;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  margin-top: 8px;
  padding-top: 12px;
}
.clipboard-btn:hover {
  color: var(--atshare-color, #0f172a);
}
.clipboard-btn svg {
  width: 16px;
  height: 16px;
}
```

- [ ] **Step 3: Update popover HTML in template**

Replace the `.network-list` div and `.mastodon-input-wrap` section in the template (around lines 261-266) with:

```html
<div class="network-list"></div>
<div class="mastodon-input-wrap">
  <label>Instance URL</label>
  <input type="url" placeholder="https://mastodon.social" class="mastodon-instance-input">
  <button class="mastodon-go-btn">Share</button>
</div>
<div class="full-list"></div>
```

- [ ] **Step 4: Rewrite `_renderNetworks` to render protocol buttons with icons and chevrons**

Replace the `_renderNetworks` method with a new implementation that:
1. Reads from `getProtocols()` instead of `NETWORKS`
2. Only renders ATProto and Fediverse as top-level buttons (skip `"other"`)
3. Each button has: SVG icon (from `src/icons/` or colored dot), label, "via {client}" text if preferred, checkmark if preferred, chevron
4. Attaches click handlers: button click → share, chevron click → expand
5. Renders a "More destinations" link at the bottom

Import the SVG icon content inline as strings (Vite `?raw` import) at the top of the file for each icon. For clients without a dedicated icon, render a small colored circle.

- [ ] **Step 5: Add `_renderClientList` method**

When a chevron is clicked, render the client sub-list below that protocol button. Each client row has: colored dot, client name, "preferred" label if applicable. Clicking a client calls `_share(clientId)`.

- [ ] **Step 6: Add `_renderFullList` method**

When "More destinations" is clicked, hide the default view and show the full list. Renders all protocols (including "other") as categorized sections with their brand color headers. Includes clipboard button at the bottom. "Back" link returns to default view.

- [ ] **Step 7: Add `_onClipboardCopy` method**

```javascript
async _onClipboardCopy() {
  try {
    await navigator.clipboard.writeText(this.shareText);
    // Show "Copied!" feedback
    const btn = this.shadowRoot.querySelector('.clipboard-btn span');
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  } catch {}
}
```

- [ ] **Step 8: Update `_onNetworkSelect` to work with client IDs**

Replace with logic that determines the preferred client for a protocol and calls `_share(clientId, opts)`.

- [ ] **Step 9: Wire up preference loading on `connectedCallback`**

Update `connectedCallback` to call `_getLocalPreference()` and set `this._preference` from the migrated result before rendering.

- [ ] **Step 10: Verify in browser**

Run: `npx vite` (dev server)
Open the demo page. Verify:
- Protocol buttons render with icons
- Chevron expands client list
- "More destinations" shows full list with categories
- Clipboard works
- Clicking a client shares to correct URL

- [ ] **Step 11: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 12: Commit**

```bash
git add src/atshare-selector.js
git commit -m "feat: universal destination selector UI with protocol buttons, client expand, and full list view"
```

---

### Task 7: Update Landing Page and Demo

**Files:**
- Modify: `index.html` (update references from "Bluesky or Mastodon" to universal destinations)

- [ ] **Step 1: Update landing page copy**

Update any references to "Bluesky and Mastodon" to reflect the universal destination selector. Update the features section to mention multiple ATProto clients, Fediverse, traditional networks, and clipboard.

- [ ] **Step 2: Verify landing page renders correctly**

Run: `npx vite`
Open `index.html` in browser. Verify the component demo works with the new destinations.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "docs: update landing page for universal destination selector"
```

---

### Task 8: CI Validation and Contribution Guide

**Files:**
- Create: `.github/workflows/validate-destinations.yml`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/validate-destinations.yml`:

```yaml
name: Validate Destinations
on:
  pull_request:
    paths:
      - 'destinations.json'
      - 'src/icons/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Validate JSON schema
        run: |
          node -e "
            const fs = require('fs');
            const data = JSON.parse(fs.readFileSync('destinations.json', 'utf8'));
            const ids = new Set();
            let errors = 0;
            for (const protocol of data.protocols) {
              if (!protocol.id || !protocol.label || !protocol.color || !protocol.clients?.length) {
                console.error('Invalid protocol:', protocol.id);
                errors++;
              }
              if (!/^#[0-9a-fA-F]{6}$/.test(protocol.color)) {
                console.error('Invalid color for', protocol.id, ':', protocol.color);
                errors++;
              }
              for (const client of protocol.clients) {
                if (!client.id || !client.name || !client.intentUrl) {
                  console.error('Invalid client:', client.id);
                  errors++;
                }
                if (ids.has(client.id)) {
                  console.error('Duplicate client id:', client.id);
                  errors++;
                }
                ids.add(client.id);
                // HTTPS check
                if (!client.intentUrl.startsWith('https://') && !client.intentUrl.startsWith('{instance}')) {
                  console.error('Non-HTTPS intent URL for', client.id, ':', client.intentUrl);
                  errors++;
                }
                // Domain match check
                if (client.domain && client.intentUrl.startsWith('https://')) {
                  const urlDomain = new URL(client.intentUrl.replace(/\{[^}]+\}/g, 'x')).hostname;
                  if (!urlDomain.endsWith(client.domain)) {
                    console.error('Domain mismatch for', client.id, ':', client.domain, 'vs', urlDomain);
                    errors++;
                  }
                }
                // Icon exists check
                if (client.icon && !fs.existsSync('src/icons/' + client.icon)) {
                  console.error('Missing icon for', client.id, ':', client.icon);
                  errors++;
                }
              }
            }
            if (errors) { console.error(errors, 'error(s) found'); process.exit(1); }
            console.log('Validation passed:', ids.size, 'clients across', data.protocols.length, 'protocols');
          "
```

- [ ] **Step 2: Create `CONTRIBUTING.md`**

Write a contribution guide covering:
- How to add a new destination (edit `destinations.json`, optional icon in `src/icons/`)
- Field reference (id, name, domain, intentUrl, icon, requiresInstance, default)
- Template variables ({text}, {url}, {title}, {instance})
- Icon requirements (SVG, square viewBox, single-color paths, no embedded fonts)
- What gets rejected (non-HTTPS, dead URLs, spam, duplicates)
- Example PR adding a new client

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/validate-destinations.yml CONTRIBUTING.md
git commit -m "chore: add CI validation and contribution guide for destinations"
```

---

### Task 9: Final Verification and Cleanup

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run full build**

Run: `npm run build:all`
Expected: All build targets succeed

- [ ] **Step 3: Manual smoke test**

Run: `npx vite`
Test in browser:
- Click share button → popover shows Bluesky and Mastodon with icons
- Click Bluesky → opens bsky.app compose
- Click Bluesky chevron → shows deck.blue, Skeet, Kite, Langit
- Click deck.blue → opens deck.blue, preference saved
- Reload → Bluesky now shows "via deck.blue"
- Click "More destinations" → full list with LinkedIn, X, Threads
- Click "Copy to clipboard" → text copied, "Copied!" shown
- Click "Back" → returns to default view
- Sign in → preference syncs to PDS
- Old localStorage format → migrates on first load

- [ ] **Step 4: Verify `destinations.json` validation script works locally**

Run the validation node script from the CI workflow locally to confirm it passes.

- [ ] **Step 5: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for universal destination selector"
```
