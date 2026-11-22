import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const WIDTH = 960;
const HEIGHT = 600;
const MAX_BYTES = 150_000;
const GAMES = ['cat-outing', 'snack-pop', 'cat-runner'];
const sources = new URL('../docs/art/thumbs/', import.meta.url);
const output = new URL('../thumbs/', import.meta.url);

// An opaque thumbnail needs only its VP8 image chunk. Skia also writes an ICC profile.
function opaqueWebp(encoded) {
  for (let offset = 12; offset < encoded.length;) {
    const size = encoded.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (encoded.toString('ascii', offset, offset + 4) === 'VP8 ') {
      const header = Buffer.from(encoded.subarray(0, 12));
      header.writeUInt32LE(end - offset + 4, 4);
      return Buffer.concat([header, encoded.subarray(offset, end)]);
    }
    offset = end;
  }
  throw new Error('Missing VP8 image chunk');
}

await mkdir(output, { recursive: true });
for (const name of GAMES) {
  const source = await loadImage(new URL(name + '.png', sources));
  if (source.width * HEIGHT !== source.height * WIDTH) {
    throw new Error(name + ' artwork must have a 16:10 aspect ratio');
  }

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, WIDTH, HEIGHT);

  for (let quality = 92; quality >= 40; quality -= 2) {
    const image = opaqueWebp(await canvas.encode('webp', quality));
    if (image.length <= MAX_BYTES) {
      await writeFile(new URL(name + '.webp', output), image);
      console.log(`${name}.webp — ${WIDTH}×${HEIGHT}, ${image.length} bytes`);
      break;
    }
    if (quality === 40) throw new Error(name + ' exceeds the WebP size limit');
  }
}
