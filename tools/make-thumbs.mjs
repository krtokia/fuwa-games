import { mkdir, writeFile } from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { Sprites } from '../snack-pop/js/render/sprites.js';

const WIDTH = 960;
const HEIGHT = 600;
const MAX_BYTES = 150_000;
const asset = path => loadImage(new URL('../' + path, import.meta.url));
const output = new URL('../thumbs/', import.meta.url);

function tile(ctx, x, y, w, h, radius, fill, border) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function gradient(ctx, top, bottom) {
  const fill = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function polygon(ctx, points, fill, border) {
  ctx.beginPath();
  for (const [x, y] of points) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function sparkle(ctx, x, y, radius, fill) {
  polygon(ctx, [
    [x, y - radius], [x + radius * .24, y - radius * .24],
    [x + radius, y], [x + radius * .24, y + radius * .24],
    [x, y + radius], [x - radius * .24, y + radius * .24],
    [x - radius, y], [x - radius * .24, y - radius * .24],
  ], fill);
}

async function outing(ctx) {
  gradient(ctx, '#9ac8aa', '#619885');
  tile(ctx, 79, 82, 802, 472, 28, '#426d60');
  tile(ctx, 79, 68, 802, 472, 28, '#b47852', '#814f3a');
  tile(ctx, 93, 81, 774, 458, 18, '#e4ba87');

  const cell = 108;
  const left = 102;
  const top = 96;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const x = left + col * cell;
      const y = top + row * cell;
      tile(ctx, x + 2, y + 2, 104, 104, 8,
        (row + col) % 2 ? '#f3d19f' : '#f9dfb4');
      tile(ctx, x + 13, y + 93, 36, 2, 1, '#d9ad805e');
      tile(ctx, x + 68, y + 13, 24, 2, 1, '#d9ad805e');
    }
  }

  // Open door and a lit path through the floor squares.
  polygon(ctx, [[428, 79], [533, 79], [584, 235], [403, 235]], '#fff4c792');
  tile(ctx, 422, 19, 116, 91, 15, '#805237', '#624534');
  tile(ctx, 433, 30, 94, 77, 8, '#fff2bd');
  polygon(ctx, [[435, 32], [464, 20], [464, 99], [435, 107]], '#cc8856', '#805237');
  tile(ctx, 453, 63, 6, 7, 3, '#ffe0a2');
  tile(ctx, 423, 106, 114, 9, 4, '#ae7650');
  for (const y of [152, 191]) {
    polygon(ctx, [[480, y - 13], [498, y + 3], [492, y + 9],
      [480, y - 2], [468, y + 9], [462, y + 3]], '#ab7048');
  }

  // A sofa and a striped rug mark the edges of the room.
  tile(ctx, 109, 122, 94, 171, 21, '#436c5d');
  tile(ctx, 122, 139, 71, 134, 15, '#88b69d', '#537b65');
  tile(ctx, 129, 149, 54, 52, 9, '#a8ccb3');
  tile(ctx, 129, 210, 54, 52, 9, '#a8ccb3');
  tile(ctx, 109, 131, 19, 151, 8, '#628e78');
  tile(ctx, 745, 340, 102, 172, 21, '#cf8070', '#a96155');
  for (const y of [356, 368, 484, 496]) {
    tile(ctx, 757, y, 78, 5, 2, '#f5bd9a');
  }

  for (const [file, col, row, length, angle] of [
    ['01-2', 3, 2, 2, 0],
    ['04-3', 2, 2, 3, Math.PI / 2],
    ['02-2', 4, 2, 2, -Math.PI / 2],
    ['03-1', 2, 1, 1, Math.PI / 2],
    ['05-1', 5, 0, 1, -Math.PI / 2],
    ['06-1', 6, 1, 1, Math.PI],
  ]) {
    const cat = await asset('cat-outing/cats/' + file + '.webp');
    ctx.save();
    ctx.translate(left + (col + .5) * cell, top + (row + .5) * cell);
    ctx.rotate(angle);
    ctx.shadowColor = '#653a3655';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(cat, -cell / 2, -cell / 2, cell, cell * length);
    ctx.restore();
  }
}

async function snack(ctx, sprites) {
  gradient(ctx, '#ffe4ee', '#eba1be');
  const halo = ctx.createRadialGradient(793, 280, 28, 793, 280, 379);
  halo.addColorStop(0, '#fff1ba');
  halo.addColorStop(1, '#fff1ba00');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cat = await asset('snack-pop/assets/cats/fuwa-peek-happy.webp');
  ctx.drawImage(cat, 477, 99, 484, 484);
  sparkle(ctx, 777, 114, 24, '#fff9dd');
  sparkle(ctx, 852, 143, 14, '#fffbec');
  sparkle(ctx, 704, 471, 16, '#fff8d3');

  const board = [
    [4, 0, 2, 5, 3, 1],
    [3, 5, 1, 0, 2, 4],
    [1, 2, 3, 3, 3, 5],
    [0, 4, 5, 2, 1, 0],
    [5, 1, 0, 4, 2, 3],
  ];
  const cell = 93;
  tile(ctx, 44, 65, 594, 499, 33, '#ad5c87');
  tile(ctx, 44, 51, 594, 499, 33, '#824464', '#6b3657');
  tile(ctx, 60, 67, 562, 467, 19, '#d69ab1');
  for (const [row, kinds] of board.entries()) {
    for (const [col, kind] of kinds.entries()) {
      const x = 62 + col * cell;
      const y = 68 + row * cell;
      const matched = row === 2 && col >= 2 && col <= 4;
      tile(ctx, x + 3, y + 3, cell - 6, cell - 6, 13,
        matched ? '#fff1ae' : (row + col) % 2 ? '#fce0e9' : '#fff0f3');
      ctx.drawImage(sprites.piece(kind, null, 88), x + 2, y + 2);
      if (matched) {
        sparkle(ctx, x + 77, y + 14, 11, '#fffef3');
        sparkle(ctx, x + 13, y + 78, 8, '#ffffff');
      }
    }
  }
}

async function runner(ctx, sprites) {
  const alley = await asset('cat-runner/assets/moonlit-alley-v1.png');
  const cropWidth = alley.height * WIDTH / HEIGHT;
  ctx.drawImage(alley, (alley.width - cropWidth) / 2, 0, cropWidth, alley.height,
    0, 0, WIDTH, HEIGHT);
  const moon = ctx.createRadialGradient(187, 89, 18, 187, 89, 94);
  moon.addColorStop(0, '#fff0bb80');
  moon.addColorStop(1, '#fff0bb00');
  ctx.fillStyle = moon;
  ctx.fillRect(90, 0, 194, 185);
  ctx.beginPath();
  ctx.arc(187, 89, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#fff1cb';
  ctx.fill();

  // Frame 6: ascent, using the same shared crop as the game.
  const atlas = await asset('cat-runner/assets/fuwa-motion-v1.png');
  ctx.drawImage(atlas, 887, 509, 444, 310, 109, 173, 526, 367);
  for (const [x, y, size] of [[602, 227, 74], [689, 152, 80]]) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.scale(-1, 1);
    ctx.rotate(.28);
    ctx.drawImage(sprites.piece(0, null, size), -size / 2, -size / 2);
    ctx.restore();
  }
  const star = [810, 151];
  const points = Array.from({ length: 10 }, (_, i) => {
    const angle = i * Math.PI / 5 - Math.PI / 2;
    const radius = i % 2 ? 16 : 35;
    return [star[0] + radius * Math.cos(angle), star[1] + radius * Math.sin(angle)];
  });
  ctx.shadowColor = '#ffbe58';
  ctx.shadowBlur = 23;
  polygon(ctx, points, '#ffdb6a', '#fff2bd');
  ctx.shadowBlur = 0;
  sparkle(ctx, 871, 107, 13, '#ffedb9');
  sparkle(ctx, 763, 196, 9, '#ffdc7d');
  sparkle(ctx, 638, 170, 8, '#ffdc7d');
}

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

// Normal pieces use only the cache and canvas factory, without a DOM image.
const sprites = Object.create(Sprites.prototype);
sprites.cache = new Map();
globalThis.document = { createElement: () => createCanvas(1, 1) };

await mkdir(output, { recursive: true });
for (const [name, draw] of [['cat-outing', outing], ['snack-pop', snack], ['cat-runner', runner]]) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  await draw(canvas.getContext('2d'), sprites);
  for (let quality = 92; quality >= 60; quality -= 2) {
    const image = opaqueWebp(await canvas.encode('webp', quality));
    if (image.length <= MAX_BYTES) {
      await writeFile(new URL(name + '.webp', output), image);
      console.log(`${name}.webp — ${WIDTH}×${HEIGHT}, ${image.length} bytes`);
      break;
    }
    if (quality === 60) throw new Error(name + ' exceeds the WebP size limit');
  }
}
