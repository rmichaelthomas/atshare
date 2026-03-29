# Launch Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare atshare.social for public launch with branding, SEO, caching, and code cleanup.

**Architecture:** Static assets (favicon, OG image) created in `public/`, meta tags added to `index.html`, `.htaccess` for cache-control, deploy workflow updated to upload all new files via scp.

**Tech Stack:** HTML, SVG, PNG (generated via canvas script), Apache/LiteSpeed `.htaccess`

---

## File Structure

**Files to create:**
- `public/favicon.svg` — SVG favicon (rounded square, Seafoam @ on Ink)
- `public/favicon-32.png` — 32x32 PNG favicon fallback
- `public/apple-touch-icon.png` — 180x180 PNG for iOS
- `public/og.png` — 1200x630 OpenGraph image
- `public/robots.txt` — crawler permissions
- `public/.htaccess` — cache-control headers
- `scripts/generate-images.js` — one-time script to generate PNG assets from canvas

**Files to modify:**
- `index.html` — lines 3-7, add meta tags and favicon links after existing meta tags
- `package.json` — add homepage and repository fields after license field
- `.github/workflows/deploy.yml` — rename step, add assembly + upload lines

---

### Task 1: Create favicon SVG

**Files:**
- Create: `public/favicon.svg`

- [ ] **Step 1: Create the SVG favicon**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="4" ry="4" fill="#1A1A2E"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="22" font-weight="700" fill="#64DFDF">@</text>
</svg>
```

- [ ] **Step 2: Verify it renders**

Open `public/favicon.svg` in a browser. Should show a dark rounded square with a seafoam `@`.

- [ ] **Step 3: Commit**

```bash
git add public/favicon.svg
git commit -m "feat: add SVG favicon"
```

---

### Task 2: Generate PNG favicon and apple-touch-icon

**Files:**
- Create: `scripts/generate-images.js`
- Create: `public/favicon-32.png`
- Create: `public/apple-touch-icon.png`

- [ ] **Step 1: Create the image generation script**

This script uses Node.js canvas (or a simple HTML-to-PNG approach). Since we don't want to add dependencies, we'll use a small inline Node script that writes SVG to PNG via the `sharp` package (install as devDependency), or alternatively generate the PNGs by rendering the SVG in a headless browser.

Simplest approach — use `sharp` as a one-time dev tool:

```bash
npx sharp-cli -i public/favicon.svg -o public/favicon-32.png resize 32 32
npx sharp-cli -i public/favicon.svg -o public/apple-touch-icon.png resize 180 180
```

If `sharp-cli` is not available, create `scripts/generate-images.js`:

```javascript
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/favicon.svg');

await sharp(svg).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('Created public/favicon-32.png');

await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Created public/apple-touch-icon.png');
```

Run: `npx --yes sharp-cli -i public/favicon.svg -o public/favicon-32.png resize 32 32`
Then: `npx --yes sharp-cli -i public/favicon.svg -o public/apple-touch-icon.png resize 180 180`

If sharp-cli doesn't handle SVG text elements well, fall back to the script approach:
`npm install --save-dev sharp && node scripts/generate-images.js`

- [ ] **Step 2: Verify PNGs exist and look correct**

```bash
file public/favicon-32.png
file public/apple-touch-icon.png
```

Expected: Both show as PNG image data with correct dimensions.

- [ ] **Step 3: Commit**

```bash
git add public/favicon-32.png public/apple-touch-icon.png scripts/generate-images.js
git commit -m "feat: add PNG favicon and apple-touch-icon"
```

---

### Task 3: Generate OG image

**Files:**
- Create: `public/og.png`

- [ ] **Step 1: Create OG image generation script**

Create `scripts/generate-og.js` — renders a 1200x630 canvas with:
- Ink background (`#1A1A2E`)
- Large faded `@` at ~7% opacity, positioned top-right
- Centered: Seafoam `@`, white "atShare", slate tagline

```javascript
import sharp from 'sharp';

const width = 1200;
const height = 630;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#1A1A2E"/>
  <text x="920" y="280" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="400" font-weight="700" fill="#64DFDF" opacity="0.07">@</text>
  <text x="600" y="240" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="80" font-weight="700" fill="#64DFDF">@</text>
  <text x="600" y="320" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="56" font-weight="700" fill="#ffffff">atShare</text>
  <text x="600" y="390" text-anchor="middle" dominant-baseline="central"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="24" fill="#94a3b8">Share button for the open social web</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('Created public/og.png (1200x630)');
```

- [ ] **Step 2: Run the script**

```bash
node scripts/generate-og.js
```

- [ ] **Step 3: Verify the image**

```bash
file public/og.png
```

Expected: `PNG image data, 1200 x 630`

Open in browser to visually verify layout.

- [ ] **Step 4: Commit**

```bash
git add public/og.png scripts/generate-og.js
git commit -m "feat: add OG image"
```

---

### Task 4: Add meta tags, favicon links, and canonical URL to index.html

**Files:**
- Modify: `index.html:3-7`

- [ ] **Step 1: Add all new tags after the existing meta description tag**

Insert after line 7 (`<meta name="description" ...>`):

```html
  <link rel="canonical" href="https://atshare.social">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="atShare — Share button for the open social web">
  <meta property="og:description" content="Drop a single script tag onto any page and give your readers one-click sharing to Bluesky, Mastodon, and more. Zero dependencies, themeable, preference memory.">
  <meta property="og:image" content="https://atshare.social/og.png">
  <meta property="og:url" content="https://atshare.social">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="atShare">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="atShare — Share button for the open social web">
  <meta name="twitter:description" content="Drop a single script tag onto any page and give your readers one-click sharing to Bluesky, Mastodon, and more. Zero dependencies, themeable, preference memory.">
  <meta name="twitter:image" content="https://atshare.social/og.png">
  <meta name="theme-color" content="#1A1A2E">
```

- [ ] **Step 2: Verify index.html is valid**

Run the dev server and check the page loads without errors. Inspect `<head>` in DevTools to confirm all tags are present.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add OG tags, favicon links, canonical URL, and theme-color"
```

---

### Task 5: Create robots.txt

**Files:**
- Create: `public/robots.txt`

- [ ] **Step 1: Create the file**

```
User-agent: *
Allow: /
```

- [ ] **Step 2: Commit**

```bash
git add public/robots.txt
git commit -m "feat: add robots.txt"
```

---

### Task 6: Create .htaccess for cache-control

**Files:**
- Create: `public/.htaccess`

- [ ] **Step 1: Create the file**

```apache
# Cache-Control headers
<IfModule mod_headers.c>
  # JS component bundles — 1 day cache
  <FilesMatch "\.(js|cjs)$">
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

- [ ] **Step 2: Commit**

```bash
git add public/.htaccess
git commit -m "feat: add .htaccess with cache-control headers"
```

---

### Task 7: Update package.json metadata

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add homepage and repository fields**

Add after the `"license": "MIT"` line:

```json
"homepage": "https://atshare.social",
"repository": {
  "type": "git",
  "url": "https://github.com/rmichaelthomas/atshare.git"
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json'))"
```

Expected: No error output.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add homepage and repository to package.json"
```

---

### Task 8: Update deploy workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Rename step from "Deploy via SFTP" to "Deploy via SCP"**

Change line 34:
```yaml
      - name: Deploy via SCP
```

- [ ] **Step 2: Add new files to assembly step**

Add after the `cp public/demo/index.html deploy/demo/` line:

```yaml
          # Static assets (branding, SEO)
          cp public/og.png deploy/
          cp public/favicon.svg deploy/
          cp public/favicon-32.png deploy/
          cp public/apple-touch-icon.png deploy/
          cp public/robots.txt deploy/
          cp public/.htaccess deploy/
```

- [ ] **Step 3: Add new scp upload lines**

Add after the `scp $SCP_OPTS deploy/demo/index.html` line, before the `echo "Deploy complete. Verifying..."` line:

```yaml
          scp $SCP_OPTS deploy/og.png "${REMOTE}:${DEST}/og.png"
          scp $SCP_OPTS deploy/favicon.svg "${REMOTE}:${DEST}/favicon.svg"
          scp $SCP_OPTS deploy/favicon-32.png "${REMOTE}:${DEST}/favicon-32.png"
          scp $SCP_OPTS deploy/apple-touch-icon.png "${REMOTE}:${DEST}/apple-touch-icon.png"
          scp $SCP_OPTS deploy/robots.txt "${REMOTE}:${DEST}/robots.txt"
          scp $SCP_OPTS deploy/.htaccess "${REMOTE}:${DEST}/.htaccess"
```

- [ ] **Step 4: Extend the remote verification command**

The existing ssh verification line checks only `index.html` and `atshare-selector.js`. Add `og.png` and `.htaccess` to confirm new uploads landed:

```bash
ssh $SCP_OPTS "${REMOTE}" "ls -la ${DEST}/index.html ${DEST}/dist/atshare-selector.js ${DEST}/og.png ${DEST}/.htaccess"
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: rename deploy step to SCP, add new static assets to upload"
```

---

### Task 9: Run /simplify code review pass

**Files:**
- Review: `src/atshare-selector.js`, `index.html`, `demo/index.html`, `public/demo/index.html`

- [ ] **Step 1: Run /simplify skill**

Invoke the `simplify` skill to review changed code for reuse, quality, and efficiency.

Key items to check:
- Dead code or stale references from the old trigger button design
- Demo script src paths — verify they are correct for their context: `demo/index.html` should use `/src/atshare-selector.js` (Vite dev only, never deployed), `public/demo/index.html` should use `/dist/atshare-selector.js` (production, deployed). Do NOT change `demo/index.html` to `/dist/` — that would break local development.
- Unused CSS rules
- Any other issues found

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "refactor: simplify and clean up after launch prep"
```

---

### Task 10: Push and verify deploy

- [ ] **Step 1: Push all changes**

```bash
git push
```

- [ ] **Step 2: Watch the deploy run**

```bash
gh run watch
```

Expected: All steps pass, including the new file uploads.

- [ ] **Step 3: Verify deployed files**

```bash
curl -sI "https://atshare.social/og.png" | head -5
curl -sI "https://atshare.social/favicon.svg" | head -5
curl -sI "https://atshare.social/robots.txt" | head -5
curl -s "https://atshare.social/" | grep -c "og:image"
curl -sI "https://atshare.social/dist/atshare-selector.js" | grep cache-control
```

Expected: All files return 200, OG tag present in HTML, cache-control header on JS file.
