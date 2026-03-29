# Contributing to atShare

Thanks for helping grow atShare's destination list. The most common contribution is adding a new share target — a client app for an existing protocol or a brand new protocol group.

## Adding a new destination

Edit `destinations.json`. Each protocol group has a `clients` array; add your entry there (or create a new protocol object if the protocol isn't represented yet).

Optionally, drop an icon in `src/icons/` and reference it in the `icon` field.

Open a PR. The CI workflow will validate your entry automatically.

## Client field reference

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique kebab-case identifier, e.g. `my-client`. Must not duplicate any existing id. |
| `name` | Yes | Human-readable display name, e.g. `My Client`. |
| `intentUrl` | Yes | Share URL template. Must start with `https://` or `{instance}` (for instance-based protocols). See template variables below. |
| `domain` | No | Root domain of the service, e.g. `example.com`. Used for domain validation in CI and for display. Required when `intentUrl` starts with `https://`. |
| `icon` | No | Filename of an SVG icon in `src/icons/`, e.g. `my-client.svg`. See icon requirements below. |
| `requiresInstance` | No | Set to `true` if the user must supply a server URL (Mastodon-style). Omit otherwise. |
| `default` | No | Set to `true` to pre-select this client in its protocol group. At most one per group. |

## Template variables

These placeholders are replaced at share time with values from the page being shared.

| Variable | Resolves to |
|---|---|
| `{text}` | Composed share text (may include title + URL, depending on what the page provides) |
| `{url}` | Canonical URL of the page |
| `{title}` | Page title |
| `{instance}` | User-supplied instance URL (only meaningful when `requiresInstance: true`) |

URL-encode values as needed; most intent URLs accept pre-encoded query parameters.

## Icon requirements

- Format: SVG only. No PNG, WebP, or other raster formats.
- ViewBox: square (`0 0 N N`). Recommended size: `0 0 24 24` or `0 0 32 32`.
- Paths: single-color, filled shapes. The UI recolors icons at runtime using `currentColor` or CSS `fill`, so icons that rely on embedded colors will look wrong.
- No `fill` attribute on path elements. Use `fill="currentColor"` on the root `<svg>` if needed, or omit fill entirely.
- No embedded fonts or raster images inside the SVG.
- Keep file size small — strip editor metadata before committing.

## What gets rejected

PRs will be closed or asked to revise if they include:

- Non-HTTPS `intentUrl` (exception: `{instance}`-prefixed URLs for federated protocols)
- URLs that are dead or redirect to a homepage rather than a share intent
- Spam, SEO link farms, or non-social-sharing destinations
- Duplicate `id` values
- Icons that are not SVG, contain raster embeds, or carry licensing restrictions

## Example PR: adding an ATProto client

Say you want to add a hypothetical client called **SkyPost** at `skypost.app`.

1. Add an entry to the `atproto` clients array in `destinations.json`:

```json
{
  "id": "skypost",
  "name": "SkyPost",
  "domain": "skypost.app",
  "intentUrl": "https://skypost.app/intent/compose?text={text}",
  "icon": "skypost.svg"
}
```

2. Add `src/icons/skypost.svg` — a clean, square SVG with no fill attributes on paths.

3. Commit and open a PR with a brief description of the client. CI will validate the schema, check the icon file exists, and confirm the domain matches the URL. If everything passes, the PR is good to merge.

## Questions?

Open an issue or start a discussion. We're happy to help.
