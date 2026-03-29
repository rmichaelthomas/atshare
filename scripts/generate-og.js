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
