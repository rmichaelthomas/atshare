# Universal Destination Selector — Design Spec

**Phase:** 1.5
**Date:** 2026-03-29
**Status:** Draft

## Problem

atShare currently supports two share destinations: Bluesky (via bsky.app) and Mastodon. The AT Protocol ecosystem has multiple clients (deck.blue, Skeet, Kite, Langit), ActivityPub has multiple server implementations (Misskey, Calckey, Pixelfed), and traditional networks (LinkedIn, X, Threads) have share intent URLs. Users need a universal selector that surfaces the right destination without overwhelming them.

The original motivation: a user on Blacksky (a PDS, not an AppView) can't use "Share to Bluesky" buttons that hardcode bsky.app. atShare should let users choose their preferred ATProto client.

## Design Decisions

### UI Pattern: Smart Defaults + Grouped Expand (A+B Hybrid)

The selector combines two patterns:

1. **Smart defaults** — Top-level protocol buttons (Bluesky, Mastodon) with preference-driven ordering. Returning users see their preferred client noted ("via deck.blue"). One click shares immediately.
2. **Grouped expand** — A chevron on each protocol button reveals alternative clients. Clicking a client shares AND saves it as the preferred client for that protocol.
3. **"More destinations"** — A link below the top-level buttons opens a full categorized list of all destinations, including traditional networks and clipboard.

### Visual Design

- SVG brand icons for each platform (Bluesky butterfly, Mastodon logo, X logo, LinkedIn, etc.)
- Brand colors as subtle accents — Bluesky blue (#0085ff), Mastodon purple (#6364ff), etc.
- Preferred destination gets a faint brand-color background wash, checkmark, and "via {client}" label
- Client sub-lists use minimal colored dots (protocol brand color for preferred, neutral for others)
- "More destinations" view uses clean rows grouped by protocol, category headers tinted with protocol color
- Clipboard lives at the bottom of the "More destinations" view, separated by a divider
- No emoji anywhere in the UI
- Clients without a dedicated SVG icon get a small circle filled with their protocol's brand color

### Interaction Flow

| Action | Result |
|--------|--------|
| Click protocol button | Shares to preferred (or default) client immediately |
| Click chevron | Expands client sub-list (does not share) |
| Click client in sub-list | Shares to that client, saves as preferred, collapses |
| Click "More destinations" | Replaces popover content with full categorized list |
| Click destination in full list | Shares, saves, returns to default view |
| Click "Back" in full list | Returns to default view |
| Click "Copy to clipboard" | Copies share text, shows "Copied!" for ~2s |

### Custom Destinations (Deferred)

Custom destinations for signed-in users (adding arbitrary intent URLs saved to PDS) are deferred to a follow-up phase. This phase implements registry-based destinations only.

## Data Architecture

### Destination Registry: `destinations.json`

A community-contributed JSON file at the repo root. Structure:

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

#### Field Definitions

**Protocol:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique protocol identifier |
| `label` | string | yes | Display name for the category header |
| `color` | string | yes | Hex color for brand accent |
| `clients` | array | yes | Client entries for this protocol |

**Client:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique client identifier (across entire registry) |
| `name` | string | yes | Display name |
| `domain` | string | no | Primary domain (must match `intentUrl` hostname) |
| `intentUrl` | string | yes | URL template with `{text}`, `{url}`, `{title}` placeholders |
| `icon` | string | no | Filename of SVG icon in `src/icons/` |
| `requiresInstance` | boolean | no | If true, user must provide their instance URL |
| `default` | boolean | no | If true, this is the default client for the protocol |

#### Template Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `{text}` | Share text | Component `text` attribute. The caller (component) is responsible for composing text from `url` + `title` if no explicit `text` attribute is provided, same as today. `buildIntentUrl` does pure template substitution only. |
| `{url}` | URL being shared | Component `url` attribute |
| `{title}` | Page title | Component `title` attribute or `document.title` |
| `{instance}` | User's Fediverse instance URL | Stored in localStorage |

### JSON Schema: `destinations.schema.json`

A JSON Schema file at the repo root for CI validation. Enforces:
- Required fields on protocols and clients
- `id` as non-empty string
- `intentUrl` as string containing at least one template variable
- `color` as hex color pattern
- `icon` as `.svg` filename pattern

### Preference Schema

No changes to the existing `social.atshare.preference` lexicon:

```json
{
  "$type": "social.atshare.preference",
  "primaryNetwork": "bluesky",
  "networks": [
    { "type": "atproto", "appView": "https://deck.blue" },
    { "type": "activitypub", "instance": "https://mastodon.social" }
  ]
}
```

The `appView` field already stores a specific client domain. The component maps `appView` back to a client ID by matching against `domain` fields in the registry.

Custom destinations (for signed-in users adding their own intent URLs) will require a lexicon extension with a `customDestinations` array field. That extension is **deferred to a follow-up spec** — this phase implements the registry-based destinations only.

### localStorage Format

The localStorage shape changes from the current PDS-mirrored format to a flatter structure. `atshare.preference` stores:

```json
{
  "primaryNetwork": "atproto",
  "preferredClient": "deckblue",
  "mastodonInstance": "https://mastodon.social"
}
```

**Migration from old format:** On first load, if localStorage contains the old shape (`{ primaryNetwork: "bluesky", networks: [...] }`), the component migrates it:
- `"bluesky"` → `primaryNetwork: "atproto"`, `preferredClient: "bsky"`
- `"mastodon"` → `primaryNetwork: "activitypub"`, `preferredClient: "mastodon"`
- `networks[].instance` → `mastodonInstance`
- `networks[].appView` → mapped to client ID via registry domain lookup, stored as `preferredClient`
- Old keys are removed after migration

### Preference Resolution Order

1. **PDS record** (if signed in and record exists) → hydrate localStorage
2. **localStorage** (if exists) → use directly
3. **Registry defaults** (`default: true` clients) → first-time fallback

Preference writes: update localStorage synchronously on every share, write to PDS in background (fire-and-forget) if signed in. Same pattern as today.

### Migration

Two migration paths:

1. **localStorage** — handled on first load as described above. Old format is detected by the presence of a `networks` array. Migration is one-time and transparent.
2. **PDS records** — no migration needed. The existing `primaryNetwork` and `appView` fields are read and mapped to registry client IDs at resolution time. Old records continue to work.

## Component Architecture

### New: `src/destinations.js`

Replaces `src/networks.js`. Responsibilities:

- Imports `destinations.json` at build time (Vite JSON import)
- Exports:
  - `getProtocols()` — returns protocol list for rendering
  - `getClients(protocolId)` — returns clients for a protocol
  - `getDefaultClient(protocolId)` — returns the `default: true` client
  - `buildIntentUrl(clientId, { text, url, title, instance })` — template variable substitution
  - `resolvePreference(preference)` — maps a stored preference (with `appView` domain) back to a client entry from the registry

### Modified: `src/atshare-selector.js`

Changes to the web component:

**New UI states for the popover:**
1. **Default view** — protocol buttons (ATProto and Fediverse only) with chevrons, "More destinations" link. The "other" protocol group (LinkedIn, X, Threads) does NOT get a top-level button — these destinations only appear in the "More destinations" full list view.
2. **Expanded view** — one protocol's client sub-list is visible
3. **Full list view** — all destinations from all protocol groups (including "other"), categorized, clipboard at bottom

**Rendering changes:**
- Protocol buttons render from `getProtocols()` instead of hardcoded `NETWORKS` array
- Each button shows the preferred client name if a preference is saved
- SVG icons inlined into shadow DOM (imported from `src/icons/`)
- Brand colors applied via inline styles derived from protocol `color` field
- "More destinations" view: clean rows, protocol-colored category headers, clipboard at bottom with divider

**Behavioral changes:**
- Clicking a protocol button calls `buildIntentUrl` with the preferred (or default) client
- Chevron click toggles expanded state for that protocol (only one expanded at a time)
- Client click in sub-list: shares, updates preference, collapses sub-list
- "More destinations" click: swaps popover content to full list
- "Back" link in full list: returns to default view

### New: `src/icons/`

Directory containing SVG icons for platforms. Referenced by `icon` field in `destinations.json`. Icons should be:
- Single-color SVGs (fill color applied at render time from protocol/brand color)
- Square viewBox
- Minimal file size (no embedded fonts, no raster data)

Platforms without a dedicated icon file get a small filled circle using their protocol's `color`.

### Unchanged

- `src/pds.js` — no changes needed
- `src/identity.js` — no changes needed
- `src/auth.js`, `src/auth-proxy.js`, `src/iframe-proxy.js` — no changes
- `src/oauth-callback.js` — no changes
- Server routes — no changes

## Community Contribution Workflow

### Adding a Destination

1. Edit `destinations.json` — add a client entry under the appropriate protocol
2. Optionally add an SVG icon to `src/icons/`
3. Open a PR

### CI Validation

Automated checks on PRs that touch `destinations.json`:
- Schema validation against `destinations.schema.json`
- HTTPS enforcement — all `intentUrl` values must use `https://` or start with `{instance}`
- Domain verification — `domain` field must match hostname in `intentUrl`
- Icon check — if `icon` is specified, the file must exist in `src/icons/`
- No duplicate client `id` values across the entire registry

### Manual Review

Maintainer reviews for:
- Legitimacy of the client/network
- Intent URL actually works (manual spot-check)
- Icon quality (if provided)
- No spam or phishing URLs

### Contribution Guide

`CONTRIBUTING.md` covers:
- How to add a client (which fields, format, examples)
- Intent URL template variables and how they're substituted
- Icon requirements (SVG, square viewBox, single color or brand-approved)
- What gets rejected (dead URLs, non-HTTPS, spam, duplicates)

## Out of Scope

- Search/filter in destination list
- Drag-to-reorder destinations
- Share counts or analytics
- Custom icons for custom destinations (they get protocol-colored dot)
- Fediverse instance auto-discovery
- npm publish (separate task)
