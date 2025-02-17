import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = join(__dirname, '../public/icon.svg');
const svg = readFileSync(svgPath);

// Convert to 192x192
sharp(svg)
  .resize(192, 192)
  .png()
  .toFile(join(__dirname, '../public/icon-192.png'))
  .then(() => console.log('Generated 192x192 icon'))
  .catch(err => console.error('Error generating 192x192:', err));

// Convert to 512x512
sharp(svg)
  .resize(512, 512)
  .png()
  .toFile(join(__dirname, '../public/icon-512.png'))
  .then(() => console.log('Generated 512x512 icon'))
  .catch(err => console.error('Error generating 512x512:', err)); 