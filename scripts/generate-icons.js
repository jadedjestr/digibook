import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { logger } from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceSvg = path.join(projectRoot, 'public', 'icons', 'icon.svg');
const outputDir = path.join(projectRoot, 'public', 'icons');

const sizes = [
  { size: 192, file: 'icon-192x192.png' },
  { size: 512, file: 'icon-512x512.png' },
  { size: 180, file: 'icon-180x180.png' },
];

const generateIcons = async () => {
  for (const { size, file } of sizes) {
    const outputPath = path.join(outputDir, file);
    await sharp(sourceSvg)
      .resize(size, size, { fit: 'contain' })
      .png({ compressionLevel: 9, quality: 100 })
      .toFile(outputPath);
    logger.debug(`Generated ${file} (${size}x${size})`);
  }
};

generateIcons().catch(error => {
  logger.error('Icon generation failed:', error);
  process.exit(1);
});
