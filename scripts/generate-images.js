import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/favicon.svg');

await sharp(svg).resize(32, 32).png().toFile('public/favicon-32.png');
console.log('Created public/favicon-32.png');

await sharp(svg).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('Created public/apple-touch-icon.png');
