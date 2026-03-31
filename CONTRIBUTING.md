# Contributing to atShare

Welcome! atShare is an open source project built for the open social web, and contributions of all kinds are genuinely appreciated — whether you're adding a network, fixing a bug, or improving the docs.

This guide is short on purpose. If something isn't covered here, use your best judgment and open a PR.

---

## Ways to Contribute

### Add a Network (Easiest Path)

The community JSON registry is the most accessible way to contribute. If a network isn't in the selector, open a PR to `destinations.json`:

```json
{
  "id": "your-network",
  "name": "Your Network",
  "type": "atproto",
  "intentUrl": "https://your-app.example/intent/compose?text={text}&url={url}",
  "icon": "your-network-icon",
  "color": "#HEXCOLOR"
}
```

Fields:
- `type`: `atproto`, `activitypub`, or `web`
- `intentUrl`: supports `{text}`, `{url}`, `{title}`, and `{instance}` (for Fediverse)
- `icon`: match an existing icon name in `src/icons/` or include an SVG path in the PR

You can also [open an issue](../../issues/new?template=new_destination.md) to request a network and let someone else implement it.

### Report a Bug

[Open a bug report](../../issues/new?template=bug_report.md) with what you expected, what happened, and your browser/OS/version.

### Request a Feature

[Open a feature request](../../issues/new?template=feature_request.md). Describe the use case, not just the solution.

### Improve Documentation

Typo, outdated example, unclear explanation — PRs for docs are always welcome, no issue needed.

### Code Contributions

For anything beyond a small bug fix, open an issue first so we can discuss the approach before you spend time on it.

---

## Development Setup

```bash
git clone https://github.com/rmichaelthomas/atshare.git
cd atshare
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # run tests
npm run build    # build dist/
```

The demo page at `/demo/index.html` is the primary development surface for the selector component.

---

## Architecture Notes

atShare runs on [Microcosm](https://microcosm.blue) for identity resolution — community-maintained AT Protocol infrastructure, not Bluesky's AppView. Authentication uses AT Protocol OAuth, and preferences are stored as `social.atshare.preference` records on the user's own PDS. Understanding this flow helps when contributing to anything in the auth or identity path.

---

## PR Process

1. Fork the repo and create a branch (`feature/my-thing` or `fix/my-bug`)
2. Make your changes and add tests if applicable
3. Run `npm test` to make sure everything passes
4. Open a PR with a clear description of what it does and why

---

## Code Style

Keep functions small and avoid introducing new dependencies — the zero-dependency policy for the web component is intentional.

---

atShare grows with the ecosystem, not ahead of it. Your contribution makes the open social web a little more connected.
