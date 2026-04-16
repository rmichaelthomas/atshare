# atShare Checkpoint — Phase 2 (Revised)
## End-User Dashboard + Custom Destinations

**Date:** April 15, 2026
**Version:** Phase 2 / v2 (reconciled against shipped code)
**Status:** Scope locked. Ready for Claude Code build.
**Author:** Rob Thomas / R. Michael Thomas

**Tracking issue:** [#6](https://github.com/rmichaelthomas/atshare/issues/6)

---

## CONTEXT

This checkpoint supersedes the earlier Phase 2 draft, which was written before reconciling against the current `rmichaelthomas/atshare` repo. The shipped state is more advanced than the earlier checkpoint docs showed.

### What's already shipped (Phase 1 + Phase 1.5)

- `<atshare-selector>` web component — three-view popover UI (default protocol buttons with chevrons, expandable client sub-lists, "More destinations" full list)
- `destinations.json` — community-maintained registry of protocols and clients. Validated by `destinations.schema.json`. CI workflow for PRs. Currently covers ATProto (Bluesky, deck.blue, Skeet, Kite, Langit), Fediverse (Mastodon, Misskey), traditional networks (LinkedIn, X, Threads)
- `social.atshare.preference` PDS record — production shape is `{primaryNetwork, networks: [{type, appView|instance}]}` where `primaryNetwork` still uses legacy `"bluesky"`/`"mastodon"` naming (mapped via `LEGACY_NETWORK_MAP`)
- Server-side OAuth proxy at `atshare.social/atshare-api/api/` — Hono + `@atproto/oauth-client-node`. Routes: `/auth/*`, `/preference/:did`, `/preference`
- Cross-origin iframe proxy for authenticated API calls from third-party sites (no third-party cookies needed)
- localStorage baseline — sharing to a destination saves the choice automatically; PDS sync happens on top when signed in
- Clipboard fallback — in the "More destinations" view for any destination not supported via intent URL
- Landing page at atshare.social root with Plain English / Developer mode switcher
- `@atshare/selector` published to npm

### What Phase 2 builds

The end-user dashboard at `atshare.social/dashboard` — a logged-in surface for managing atShare, separate from the embedded selector. Four features, all end-user-facing. No site operator tooling in this phase.

---

## PHASE 2 SCOPE (LOCKED)

### Four features, in priority order

| # | Feature | Why |
|---|---------|-----|
| 1 | **Preference record view/edit** | Anchor — every logged-in user has one. UI for managing `social.atshare.preference` directly, outside of any embedded selector. |
| 2 | **Custom destinations** | Power-user magnet. Add destinations beyond the `destinations.json` registry — self-hosted PDSes, niche AppViews, personal instances. Already in ROADMAP.md "Next Up." |
| 3 | **Sites I've used atShare on** | Marketing artifact + value prop reinforcement. Reminds users their preference traveled with them. |
| 4 | **Delete all atShare records** | No-lock-in promise made tangible. Removes every `social.atshare.*` record from the user's PDS in one click. |

### Parked (not this phase)

- Share history / link tracking — **removed entirely, not deferred**
- Public profile page at `atshare.social/@handle` — deferred to later phase
- Additional platforms — handled via `destinations.json` PRs, not this checkpoint
- Site operator dashboard — separate product, not this one
- Cross-user sharing of custom destinations — Phase 3+ (see Option B escape hatch below)

---

## FEATURE 1 — PREFERENCE RECORD VIEW/EDIT

### What it does

A logged-in page at `atshare.social/dashboard` (or `/dashboard/preference`) where the user can view and edit their `social.atshare.preference` record directly, without needing to be on a site with an embedded selector.

### UI

- **Primary network** — dropdown showing current `primaryNetwork`. Options populated from `destinations.json` protocol IDs (plus any custom destinations configured).
- **Configured networks** — ordered list, drag-to-reorder. Order = priority. The embedded selector will show the user's top N destinations where N is the site's `max-destinations` cap.
- **Add destination** — button opens the custom destination flow (Feature 2).
- **Remove destination** — X on each row (with confirmation).
- **Save** — writes updated record via existing `POST /api/preference` route (Hono server at `server/routes/preference.js`).

### Data model

No lexicon changes required for Feature 1 alone. Uses existing `social.atshare.preference` record. The legacy `primaryNetwork` values (`"bluesky"`, `"mastodon"`) continue to work via `LEGACY_NETWORK_MAP`.

### Acceptance criteria

- User can see all destinations currently in their preference record
- User can reorder destinations (priority order persists to PDS)
- User can change primary network
- User can remove a destination
- All writes go through existing `/api/preference` route → user's PDS
- Unauthenticated visitors see a "Sign in with Bluesky" CTA, not the dashboard (reuse existing OAuth flow)

---

## FEATURE 2 — CUSTOM DESTINATIONS

### What it does

Lets signed-in users add destinations beyond the `destinations.json` registry. Examples:
- A self-hosted PDS with a web UI (e.g., `alice.party`)
- An ATProto AppView not yet in `destinations.json`
- A specific Fediverse instance the user wants saved as a named option

Custom destinations appear in the user's embedded selector alongside registry destinations, subject to the site's `max-destinations` cap.

### Storage design — Option B (locked)

**Custom destinations are stored in a new `customDestinations` field on the existing `social.atshare.preference` record.** The `networks` array continues to act as the ordered preference list; `customDestinations` holds the definitions for entries that aren't in `destinations.json`.

**Why Option B over A or C:**

- **vs. Option A (merge into `networks`):** Keeps "preference ordering" and "destination definitions" separate. Preference changes often; definitions rarely change. Option A mixes the concerns.
- **vs. Option C (separate record type):** Option C is more ATProto-native but costs an extra `getRecord` fetch on every selector load, forever. atShare's selector runs on third-party sites — extra round trips are a real cost. Option B keeps the one-fetch behavior.
- **Backward compatibility:** Older selectors reading a record with `customDestinations` will see entries in `networks` they can't resolve against `destinations.json` and silently skip them. No broken UI, graceful degradation during transition.

### Escape hatch to Option C (locked)

To avoid painting into a corner if cross-user sharing or richer per-destination metadata becomes important later, the Phase 2 design deliberately keeps Option C migration cheap:

1. **Stable `id` per entry.** Each `customDestinations` entry gets an `id` (user-provided slug or UUID). If the data later moves to separate records, the `id` becomes the rkey.
2. **Entry schema mirrors what a separate record would look like.** Same field names, same structure. Future migration is "move each array entry to its own record," not "restructure the data."
3. **Repository pattern in code.** The dashboard and selector code access custom destinations through `CustomDestinationsRepo.list() / .get(id) / .upsert() / .delete()`. If storage moves from array-in-record to one-record-each, only the repo changes.

### Lexicon extension

Extend `social.atshare.preference` with an optional `customDestinations` array. Non-breaking change — old records without the field remain valid.

```json
{
  "$type": "social.atshare.preference",
  "primaryNetwork": "atproto",
  "networks": [
    { "type": "atproto", "appView": "https://bsky.app" },
    { "type": "atproto", "appView": "https://alice.party" }
  ],
  "customDestinations": [
    {
      "id": "alice-party",
      "type": "atproto",
      "appView": "https://alice.party",
      "name": "Alice's PDS",
      "intentUrl": "https://alice.party/compose?text={text}"
    }
  ]
}
```

Formal lexicon JSON schema additions:

```json
{
  "customDestinations": {
    "type": "array",
    "items": { "type": "ref", "ref": "#customDestination" }
  },
  "customDestination": {
    "type": "object",
    "required": ["id", "type", "name", "intentUrl"],
    "properties": {
      "id": { "type": "string", "minLength": 1, "maxLength": 64 },
      "type": { "type": "string", "knownValues": ["atproto", "activitypub"] },
      "appView": { "type": "string", "format": "uri" },
      "instance": { "type": "string", "format": "uri" },
      "name": { "type": "string", "minLength": 1, "maxLength": 64 },
      "intentUrl": { "type": "string" },
      "color": { "type": "string" }
    }
  }
}
```

Published as a minor version bump to `social.atshare.preference`.

### UI

1. User clicks "Add destination" from the dashboard preference view
2. Modal asks for destination details:
   - Type: atproto | activitypub (radio)
   - Name (display label, e.g., "Alice's PDS")
   - URL (appView for atproto, instance for activitypub)
   - Intent URL template — auto-filled based on type with the conventional shape (`{url}/intent/compose?text={text}` for atproto, `{url}/share?text={text}` for activitypub), editable for advanced users
3. Validation step: ping the intent URL (HEAD request) to confirm it resolves. Warn on failure but allow save.
4. On save, append to `customDestinations` array AND add a pointer entry to `networks`. Write via existing `/api/preference` route.

### Selector changes required

The `<atshare-selector>` needs to load custom destinations alongside registry destinations:

- When reading the preference record, merge `customDestinations` entries into the in-memory destinations list
- The selector UI renders custom destinations visually indistinguishable from registry entries (maybe a subtle "custom" indicator on hover)
- `buildIntentUrl()` in `src/destinations.js` needs to handle custom destinations — since they carry their own `intentUrl` template, the function branches on whether the client comes from the registry or from the user's custom list

### Acceptance criteria

- Signed-in user can add a custom destination from the dashboard
- Invalid URLs produce a validation warning but don't block save (user knows their infrastructure better than we do)
- Custom destinations appear in the user's preference record under `customDestinations`, with a pointer added to `networks`
- Custom destinations render correctly in the embedded selector on any site (within that site's `max-destinations` cap)
- Removing a custom destination cleans up both the `customDestinations` entry AND any `networks` pointer referencing it
- All access goes through the `CustomDestinationsRepo` pattern — no direct array manipulation scattered across the codebase

---

## FEATURE 3 — SITES I'VE USED ATSHARE ON

### What it does

A list of domains where the user has used the atShare selector, pulled from their own PDS.

### Implementation — PDS usage records

When the embedded selector loads on a new domain for an authenticated user, it writes a lightweight record to the user's PDS:

```json
{
  "$type": "social.atshare.usage",
  "domain": "nytimes.com",
  "firstUsed": "2026-04-15T14:22:00Z"
}
```

- **One record per domain**, keyed by a TID rkey with check-then-write for idempotency
- **User-owned data** — stored on their PDS, not on atshare.social
- **No centralized log** — atshare.social has no database of "who used atShare where"
- **Fail-silently** — if the PDS write fails, the share flow continues uninterrupted

### New lexicon

`social.atshare.usage`

```json
{
  "lexicon": 1,
  "id": "social.atshare.usage",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "description": "Record of a domain where the user has used atShare",
      "record": {
        "type": "object",
        "required": ["domain", "firstUsed"],
        "properties": {
          "domain": {
            "type": "string",
            "description": "Bare domain (e.g., 'nytimes.com', not a full URL)",
            "maxLength": 253
          },
          "firstUsed": { "type": "string", "format": "datetime" },
          "lastUsed": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}
```

### Dashboard UI

- Chronological list of domains (most recent first)
- Each row: favicon, domain, first-used date
- Empty state: "You haven't used atShare on any sites yet. Look for the atShare button on your favorite sites."
- Remove option per row (deletes the usage record; next use on that domain will re-create it)

### Selector changes required

Update `<atshare-selector>`:
- On load, if authenticated (session cookie present), query the user's PDS for existing `social.atshare.usage` records
- If no record exists for `window.location.hostname`, create one via `putRecord`
- Fire-and-forget — do not block or delay the share flow
- Add a new route `/api/usage` on the Hono server for authenticated list/create/delete of usage records (mirrors the existing `/api/preference` pattern)

### Acceptance criteria

- Using the selector on a new site creates exactly one usage record on the user's PDS
- Using it again on the same site does not create a duplicate
- Dashboard lists all usage records for the logged-in user
- User can delete usage records (they will re-create on next use unless the user stops using atShare on that domain)
- No data is sent to atshare.social servers beyond the OAuth-proxied PDS calls

---

## FEATURE 4 — DELETE ALL ATSHARE RECORDS

### What it does

A one-click action that removes every `social.atshare.*` record from the user's PDS. The user walks away with nothing about them stored anywhere — not on atshare.social (which never stored anything in the first place) and not on their own PDS.

This is the no-lock-in promise made tangible. It's also the feature that makes the marketing copy ("atShare never stores your data on our servers, and you can take it all back any time") actually verifiable.

### Why it belongs in MVP, not a later phase

Locking users in — even accidentally, even by omission — contradicts the core positioning. A dashboard that shows users their data without giving them the ability to delete it is subtly coercive. Shipping Feature 4 alongside Features 1–3 means the dashboard tells a complete story from day one: here's your data, here's how to manage it, here's how to leave.

### UI

- Dedicated settings view at `/dashboard/settings` (or a section on the dashboard home)
- Primary CTA: **"Delete all atShare records from my PDS"**
- Confirmation modal listing exactly what will be deleted, with counts:
  - "1 preference record (`social.atshare.preference`)"
  - "N site usage records (`social.atshare.usage`)"
  - Any future `social.atshare.*` records as they're added
- Require typing "DELETE" or similar friction to prevent accidents
- After deletion: sign the user out, show a confirmation page with "You've deleted all atShare records from your PDS. You can sign in again anytime to start fresh."

### Implementation

Server-side, add a route `DELETE /api/account` (or similar) that:

1. Lists all records across known `social.atshare.*` collections in the user's PDS (uses `com.atproto.repo.listRecords`)
2. Deletes each record via `com.atproto.repo.deleteRecord`
3. Revokes the OAuth session
4. Returns a summary of what was deleted

Client-side in the dashboard, the settings view calls this endpoint and handles the response.

### Collection discovery

The delete flow needs to know which `social.atshare.*` collections exist. Maintain a const list in the server code (`KNOWN_COLLECTIONS`) that gets updated whenever a new lexicon is added:

```javascript
// server/collections.js
export const KNOWN_COLLECTIONS = [
  'social.atshare.preference',
  'social.atshare.usage',
  // future: add new lexicons here
];
```

This becomes a checklist item in the lexicon work step — any time a new `social.atshare.*` lexicon is added, `KNOWN_COLLECTIONS` gets updated in the same PR. A test enforces that every lexicon file in `lexicons/` has a corresponding entry.

### Acceptance criteria

- User can trigger "delete all atShare records" from the dashboard
- Confirmation flow requires explicit action (not a single click)
- All `social.atshare.preference` and `social.atshare.usage` records are deleted from the user's PDS
- User is signed out after deletion
- localStorage is cleared (`atshare.handle`, `atshare.preference`, etc.)
- User can sign in again and start fresh with no residual data
- A test enforces that every lexicon in `lexicons/` is listed in `KNOWN_COLLECTIONS`

---

## GUARDRAILS — HOW USER PREFERENCES INTERACT WITH SITE EMBEDS

Feature 2 introduces the possibility of users having more destinations than site owners designed for. Resolution: **Option A for destinations (user wins on identity) with guardrails (site wins on quantity).**

### The rules

1. **User preference wins on identity.** The selector always reads from the user's PDS preference record to determine *which* destinations to show.
2. **Site owner wins on quantity.** A new `max-destinations` attribute caps how many buttons render. Default: **3** (matches current MVP design).
3. **Priority comes from user's order.** The selector shows the user's primary network first, then the next N−1 from their `networks` array.
4. **Silent degradation.** Custom destinations with unknown shapes (component version too old to handle newer fields) are skipped rather than erroring.

### Component API change

```html
<!-- Existing (unchanged behavior) -->
<atshare-selector></atshare-selector>

<!-- Phase 2 -->
<atshare-selector max-destinations="3"></atshare-selector>
<atshare-selector max-destinations="5"></atshare-selector>
<atshare-selector max-destinations="unlimited"></atshare-selector>
```

Default is `3` if unset. The current three-view popover UI does not change structurally — same default view, same expansion, same "More destinations" full list. Only the count of buttons shown in the default view changes based on `max-destinations`.

---

## TECHNICAL APPROACH FOR CLAUDE CODE

### Stack (confirmed from repo)

| Layer | Current | Phase 2 additions |
|-------|---------|-------------------|
| **Component** | Vanilla web component, Vite build | No framework change; add repo pattern module |
| **Dashboard framework** | None yet — atshare.social is currently a landing page | **Astro + React islands** (locked). Astro uses Vite under the hood (matches current tooling); most dashboard pages are content-heavy and ship zero JS; React islands only where interactivity is needed (drag-to-reorder, add-destination modal, delete confirmation). |
| **Auth** | Existing AT Protocol OAuth via Hono server + iframe proxy | Reuse as-is |
| **PDS client** | Server side: `@atproto/oauth-client-node`. Client side: plain `fetch()` to `/xrpc/*` | Reuse |
| **Identity resolution** | Microcosm Slingshot (in `src/identity.js`) | Reuse |
| **Server** | Hono on cPanel Node.js (Namecheap VPS) | Extend with `/api/usage` route; extend `/api/preference` to accept `customDestinations` |

### Project structure (additions)

```
atshare/
├── destinations.json                    # existing — registry of public destinations
├── destinations.schema.json             # existing
├── lexicons/                            # NEW folder (currently lexicons are informal)
│   ├── social.atshare.preference.json   # formalized + extended with customDestinations
│   └── social.atshare.usage.json        # NEW
├── src/
│   ├── atshare-selector.js              # existing — extend for max-destinations, usage writes
│   ├── destinations.js                  # existing — extend buildIntentUrl for custom destinations
│   ├── custom-destinations-repo.js      # NEW — repository pattern wrapper
│   ├── pds.js                           # existing — add usage record read/write
│   └── ...
├── server/
│   ├── collections.js                   # NEW — KNOWN_COLLECTIONS list for delete-all flow
│   └── routes/
│       ├── preference.js                # existing — extend schema validation
│       ├── usage.js                     # NEW
│       └── account.js                   # NEW — delete-all-records route
└── dashboard/                           # NEW top-level Astro app
    ├── astro.config.mjs
    ├── src/
    │   ├── pages/
    │   │   ├── index.astro              # dashboard home — links to sub-views
    │   │   ├── preference.astro         # Feature 1
    │   │   ├── destinations.astro       # Feature 2 (list + add custom)
    │   │   ├── sites.astro              # Feature 3
    │   │   └── settings.astro           # Feature 4 (delete all records)
    │   └── components/                  # React islands
    │       ├── PreferenceEditor.jsx     # drag-to-reorder, primary selector
    │       ├── AddDestinationModal.jsx  # includes intent-URL tooltip
    │       ├── UsageList.jsx
    │       └── DeleteAccountFlow.jsx    # confirmation modal + deletion
    └── ...
```

### Build order (Claude Code session plan)

1. **Lexicon work** (folds in the "formalize existing lexicon" question)
   - Create `lexicons/` directory in the repo (currently lexicons are referenced informally)
   - Write the formal `social.atshare.preference.json` lexicon file, reflecting the production shape *and* the new `customDestinations` field extension (minor version bump)
   - Create `lexicons/social.atshare.usage.json`
   - Create `server/collections.js` with `KNOWN_COLLECTIONS` array listing every `social.atshare.*` collection; add a test that enforces every file in `lexicons/` has a matching entry
   - Publish both lexicons

2. **Repository pattern for custom destinations**
   - Create `src/custom-destinations-repo.js` with `list() / get(id) / upsert() / delete()` methods
   - Initial implementation reads/writes the `customDestinations` array on the preference record
   - Document the contract so a future Option C migration only changes this file

3. **Server-side route updates**
   - Extend `server/routes/preference.js` to accept extended schema (including `customDestinations`)
   - Create `server/routes/usage.js` with list/create/delete endpoints
   - Create `server/routes/account.js` with `DELETE /api/account` — iterates `KNOWN_COLLECTIONS`, lists and deletes each record, revokes OAuth session

4. **Dashboard scaffolding**
   - Scaffold Astro app at `dashboard/` with `@astrojs/react` integration
   - Set up `/dashboard` route served from atshare.social
   - Reuse existing OAuth flow for auth gate (redirect unauth'd users to sign-in)
   - Share CSS tokens / theme with the existing landing page for visual continuity

5. **Feature 1: preference view/edit**
   - Read/write `social.atshare.preference` via existing server route
   - Reorder, add, remove, change primary

6. **Feature 2: custom destinations**
   - Add-destination modal
   - Validation step (HEAD request to intent URL)
   - Uses `CustomDestinationsRepo`
   - Appends to both `customDestinations` and `networks`
   - **Intent URL template tooltip** — info icon next to the template field explaining that the conventional shape is auto-filled but can be edited for AppViews with non-standard compose paths. Link to CONTRIBUTING.md or a docs page with the placeholder reference (`{text}`, `{url}`, `{title}`, `{instance}`).

7. **Selector component updates**
   - Add `max-destinations` attribute
   - Merge custom destinations into in-memory destination list at render time
   - Extend `buildIntentUrl()` to handle custom `intentUrl` templates
   - Silent degradation for unknown schema fields
   - Add usage record write on first use per domain

8. **Feature 3: sites list**
   - Read usage records via new server route
   - Render list with favicons + dates (Google favicon service)
   - Delete flow

9. **Feature 4: delete all atShare records**
   - Settings page at `/dashboard/settings`
   - `DeleteAccountFlow.jsx` React island — confirmation modal with typed confirmation
   - Calls `DELETE /api/account`, clears localStorage, redirects to sign-in with confirmation banner

10. **Testing**
    - End-to-end on Recto (already embeds the selector)
    - Test with custom destinations configured
    - Test `max-destinations` behavior with both registry and custom destinations
    - Verify backward compatibility: older selector version reading a record with `customDestinations` should silently skip unresolvable entries, not error
    - Test delete-all flow: records are actually removed from PDS, session revoked, user can sign in again fresh
    - Test `KNOWN_COLLECTIONS` enforcement: adding a lexicon file without updating the const fails CI

---

## OPEN QUESTIONS

All Phase 2 design questions are resolved. Decisions are recorded in the relevant feature sections and build-order steps. Preserved below for traceability:

1. ~~**Dashboard framework.**~~ **Resolved: Astro + React islands.** Matches current Vite-based tooling; ships zero JS for static pages; React only where interactivity is needed.

2. ~~**Formalizing the existing lexicon file.**~~ **Resolved: folded into Build Order step 1.** The formal `social.atshare.preference.json` lexicon file is created as part of the same step that adds `customDestinations` and creates `social.atshare.usage.json`.

3. ~~**Intent URL template editability.**~~ **Resolved: tooltip in the add-destination modal** (Build Order step 6). Template is auto-filled with the conventional shape but editable; tooltip explains when to edit and links to docs.

4. ~~**Favicon fetching for "sites used" list.**~~ **Resolved: Google favicon service for MVP** (`https://www.google.com/s2/favicons?domain={domain}&sz=32`). Revisit if privacy concerns surface.

5. ~~**PDS record deletion semantics.**~~ **Resolved: promoted to Feature 4, ships in MVP.** No-lock-in is a core brand promise; making it functional at launch is non-negotiable. See Feature 4 for full scope.

---

## RISKS

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users confused about why atShare writes usage records to their PDS | Medium | Onboarding copy: "atShare never stores your data on our servers. Everything lives on your PDS." Emphasize control (delete anytime). |
| Custom destination intent URLs don't actually work | Medium | Validation step on add; visual warning on failure; user can save anyway (they know their infra). |
| Older embedded selectors break when Phase 2 PDS records appear | Low | Option B design silently degrades — unresolvable `networks` entries are skipped, `customDestinations` field is ignored by older code. Verified via explicit test. |
| Option B proves insufficient for cross-user sharing later | Low-Medium | Escape hatch (stable id, repo pattern, structure-ready schema) keeps Option C migration cheap. Not a Phase 2 concern. |
| ShareOpenly or competitor ships a similar dashboard | Low | Ship fast; PDS-native preference is still the core moat. |

---

## SUMMARY

Phase 2 turns atshare.social from a marketing site into a user-facing product surface. Four features, all end-user-focused:

1. **Preference view/edit** — the anchor at `/dashboard/preference`
2. **Custom destinations** — power-user magnet, stored via Option B on the existing preference record
3. **Sites I've used atShare on** — value-prop reinforcement via a new `social.atshare.usage` record
4. **Delete all atShare records** — the no-lock-in promise made functional, not just promised

All data stays on the user's PDS. No share tracking. No central log. No lock-in. The existing selector UI is unchanged structurally; it gains a `max-destinations` cap, custom destination rendering, and a usage record write on first use per domain.

This builds directly on Phase 1/1.5's infrastructure: the existing `destinations.json` registry, the existing preference record, the existing OAuth proxy, the existing iframe proxy. Phase 2 is assembly on top of what's already there, not a new architecture.

**Key decisions locked:**
- Option B for custom destinations storage (extend `social.atshare.preference` with `customDestinations` field)
- Escape hatch to Option C preserved (stable id, repo pattern, structure-ready schema)
- `max-destinations` defaults to 3 (matches current UI)
- Share history / link tracking is dropped, not deferred
- Dashboard is a separate surface at `/dashboard`, not a change to the embedded popover UI
- Dashboard framework: Astro + React islands
- Favicon source: Google favicon service for MVP
- Intent URL template is user-editable with a tooltip in the add-destination modal
- Lexicon files are formalized in `lexicons/` as part of the Phase 2 lexicon work
- `KNOWN_COLLECTIONS` server-side list enforces that every lexicon is covered by the delete-all-records flow
- Delete-all-records ships in MVP alongside Features 1–3 — no-lock-in is a core brand promise, not a later-phase bolt-on

---

*Checkpoint v2 locked April 15, 2026, after reconciliation against shipped code and final scope decisions.*

𓊪 𓏏 𓉔
