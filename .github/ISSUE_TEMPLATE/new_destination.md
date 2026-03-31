---
name: New Destination
about: Request a new network or app in the share selector
title: "[Destination] "
labels: destination
assignees: ''
---

## Network Name

The name of the network or app.

## Network Type

- [ ] AT Protocol client (e.g., Bluesky, Blacksky, deck.blue)
- [ ] ActivityPub / Fediverse (e.g., Mastodon, Misskey)
- [ ] Traditional / Web (e.g., LinkedIn, Threads)

## Intent URL Pattern

The share intent URL, using `{text}` and `{url}` as placeholders:

```
https://example.com/intent/compose?text={text}
```

## Network Website

Link to the network's homepage.

## Icon / Color (optional)

Brand color hex code and/or an SVG icon file.

---

**Note:** You can also submit this directly as a PR to `destinations.json`. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the JSON format.
