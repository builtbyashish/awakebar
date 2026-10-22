/**
 * Generates the macOS menu bar template icons into assets/.
 *
 * Template images must be pure black with an alpha channel; macOS recolors them
 * for light/dark menu bars. Shapes are described as signed distance functions in
 * an 18x18 design grid and supersampled, so every size comes out of the same
 * source of truth. No image dependencies, just zlib from Node.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GRID = 18;
const SAMPLES = 8;
const assetsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'assets',
);

const length = (x, y) => Math.hypot(x, y);

function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - hw + r;
  const dy = Math.abs(py - cy) - hh + r;
  const outside = length(Math.max(dx, 0), Math.max(dy, 0));
  return Math.min(Math.max(dx, dy), 0) + outside - r;
}

function sdRing(px, py, cx, cy, radius) {
  return Math.abs(length(px - cx, py - cy) - radius);
}

function sdCapsule(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(
    1,
    Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)),
  );
  return length(pax - bax * h, pay - bay * h);
}

/**
 * Cup body, as a distance field: negative inside. Taller than it is wide, and
 * filling most of the 18x18 grid so the icon matches the weight of its menu bar
 * neighbours. A short, wide cup reads as a battery.
 */
function cupBody(x, y) {
  return sdRoundRect(x, y, 7.6, 9.0, 4.4, 6.3, 1.7);
}

/** Handle, already stroked to a ring of the given width. */
function handle(x, y, width) {
  const ring = sdRing(x, y, 12.4, 8.4, 2.6) - width / 2;
  // Keep only the part that sticks out to the right of the cup.
  return Math.max(ring, 11.9 - x);
}

/** A rim line, carved out of the filled cup so it still reads as a mug. */
function rim(x, y) {
  return sdRoundRect(x, y, 7.6, 5.4, 3.1, 0.42, 0.42);
}

/** Awake: a filled mug. */
function awake(x, y) {
  return Math.min(Math.max(cupBody(x, y), -rim(x, y)), handle(x, y, 1.4));
}

/** The diagonal "off" stroke, and the wider gap knocked out beneath it. */
const slashLine = (x, y) => sdCapsule(x, y, 3.0, 15.4, 15.0, 3.0);
const slash = (x, y) => slashLine(x, y) - 0.75;
const slashGap = (x, y) => slashLine(x, y) - 1.7;

/**
 * Idle: the same mug, outlined and struck through. Fill alone was too subtle to
 * read at menu bar size, and it never said which state was which; a slash is the
 * usual "this is off" marker.
 */
function idle(x, y) {
  const mug = Math.min(
    Math.abs(cupBody(x, y)) - 0.7,
    rim(x, y),
    handle(x, y, 1.4),
  );
  // Knock the gap out of the mug, then lay the stroke into it.
  return Math.min(Math.max(mug, -slashGap(x, y)), slash(x, y));
}

function render(shape, size) {
  const scale = size / GRID;
  const step = 1 / (SAMPLES * scale);
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        const y = (py + (sy + 0.5) / SAMPLES) / scale;
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = (px + (sx + 0.5) / SAMPLES) / scale;
          if (shape(x, y, step) < 0) hits++;
        }
      }
      // Black with coverage as alpha: the template image contract.
      pixels[(py * size + px) * 4 + 3] = Math.round(
        (hits / (SAMPLES * SAMPLES)) * 255,
      );
    }
  }

  return pixels;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, tail]);
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA

  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row++) {
    raw[row * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(
      raw,
      row * (size * 4 + 1) + 1,
      row * size * 4,
      (row + 1) * size * 4,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, shape] of [
  ['awakeTemplate', awake],
  ['idleTemplate', idle],
]) {
  for (const [suffix, size] of [
    ['', 18],
    ['@2x', 36],
    ['@3x', 54],
  ]) {
    const file = path.join(assetsDir, `${name}${suffix}.png`);
    writeFileSync(file, encodePng(render(shape, size), size));
    console.log(`wrote ${path.basename(file)} (${size}x${size})`);
  }
}
