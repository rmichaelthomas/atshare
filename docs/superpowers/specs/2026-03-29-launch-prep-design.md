# Launch Prep Design Spec

**Date:** 2026-03-29
**Status:** Draft

## Overview

Prepare atshare.social for public launch and making the GitHub repo public. Eight tasks covering branding, SEO, caching, metadata, and code cleanup.

## Brand Colors (locked)

- **Seafoam (accent):** `#64DFDF`
- **Ink (dark/text on accent):** `#1A1A2E`

## 1. OpenGraph Image & Meta Tags

### OG Image (`public/og.png`, 1200x630px)

- Background: Ink (`#1A1A2E`)
- Oversized `@` in Seafoam at ~7% opacity, positioned top-right as background texture
- Centered foreground: Seafoam `@` symbol (40px equivalent), white "atShare" wordmark, slate tagline "Share button for the open social web"
- Export as static PNG

### Meta Tags (added to `index.html` `<head>`)

```html
<meta property="og:title" content="atShare — Share button for the open social web">
<meta property="og:description" content="Drop a single script tag onto any page and give your readers one-click sharing to Bluesky, Mastodon, and more. Zero dependencies, themeable, preference memory.">
<meta property="og:image" content="https://atshare.social/og.png">
<meta property="og:url" content="https://atshare.social">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="atShare — Share button for the open social web">
<meta name="twitter:description" content="Drop a single script tag onto any page and give your readers one-click sharing to Bluesky, Mastodon, and more. Zero dependencies, themeable, preference memory.">
<meta name="twitter:image" content="https://atshare.social/og.png">
```

### Deploy

Add `og.png` to the deploy workflow upload list.

## 2. SEO on index.html

Add canonical URL:

```html
<link rel="canonical" href="https://atshare.social">
```

No changes needed to existing `<title>` or `<meta name="description">` — they are already well-written.

## 3. Favicon

**Design:** Rounded square (4px border-radius at 32px), Seafoam `@` on Ink background.

### Files

- `public/favicon.svg` — SVG favicon (scales perfectly at all sizes)
- `public/favicon-32.png` — 32x32 PNG fallback
- `public/apple-touch-icon.png` — 180x180 for iOS

### HTML (added to `index.html` `<head>`)

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

### Deploy

Add all three favicon files to the deploy workflow upload list.

## 4. `/simplify` — Code Review Pass

Run after all other changes are complete. Review source, landing page, and demo for:

- Dead code or stale references
- Unused CSS rules from the old trigger button design
- Anything that can be tightened

## 5. Cache-Control Headers (`.htaccess`)

Create `public/.htaccess`, deployed to `public_html/`.

```apache
# Cache-Control headers
<IfModule mod_headers.c>
  # JS component bundles — 1 day cache
  <FilesMatch "\.js$">
    Header set Cache-Control "public, max-age=86400"
  </FilesMatch>

  # Static assets (images, icons) — 1 week cache
  <FilesMatch "\.(png|svg|ico)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>

  # HTML pages — always revalidate
  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
```

### Deploy

Add `.htaccess` to the deploy workflow upload list.

## 6. package.json Metadata

Add missing fields:

```json
"homepage": "https://atshare.social",
"repository": {
  "type": "git",
  "url": "https://github.com/rmichaelthomas/atshare.git"
}
```

## 7. Deploy Workflow Rename

Rename step `"Deploy via SFTP"` to `"Deploy via SCP"` in `.github/workflows/deploy.yml`. Cosmetic only.

## 8. robots.txt

Create `public/robots.txt`:

```
User-agent: *
Allow: /
```

### Deploy

Add `robots.txt` to the deploy workflow upload list.

## Deploy Workflow Summary

After all changes, the deploy step uploads:

| File | Destination |
|------|-------------|
| `index.html` | `public_html/index.html` |
| `dist/atshare-selector.js` | `public_html/dist/atshare-selector.js` |
| `dist/atshare-selector.umd.cjs` | `public_html/dist/atshare-selector.umd.cjs` |
| `demo/index.html` | `public_html/demo/index.html` |
| `og.png` | `public_html/og.png` |
| `favicon.svg` | `public_html/favicon.svg` |
| `favicon-32.png` | `public_html/favicon-32.png` |
| `apple-touch-icon.png` | `public_html/apple-touch-icon.png` |
| `robots.txt` | `public_html/robots.txt` |
| `.htaccess` | `public_html/.htaccess` |

## Files Modified

- `index.html` — OG/Twitter meta tags, canonical link, favicon links
- `package.json` — homepage, repository fields
- `.github/workflows/deploy.yml` — step rename, additional file uploads

## Files Created

- `public/og.png`
- `public/favicon.svg`
- `public/favicon-32.png`
- `public/apple-touch-icon.png`
- `public/robots.txt`
- `public/.htaccess`
