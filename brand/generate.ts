// Generates every image the app uses from one logo picture (D23). The one kept here is a
// placeholder; a deployment puts the center's own at the same path (README.md).
//
//   pnpm install && pnpm --filter @kmcdc/brand generate
//
// Input:  source/logo.png (4797 × 3200, the full picture)
// Output: images/ (committed). See README.md for what each file is for.

import { mkdir, rm, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { BANDS, type Band } from "./bands.ts";
import { SCREENS } from "./screens.ts";

const SOURCE = "source/logo.png";
const OUT = "images";

// Colours: ring = the roof's maroon; backgrounds match the app's light and dark themes.
const MAROON = "#6e1620";
const SKY: [number, number, number] = [196, 226, 252];

// Option A crop, in units of a 1200-px-wide copy of the original: the whole temple.
const CROP = { cx: 598, cy: 360, r: 400 };
const SKY_BAND = 42; // the crop reaches this far above the original; filled with mirrored sky
const SKY_TINT_TO = 110; // the faded sky near the top is deepened down to here
const RING = 0.025; // ring width as a share of the diameter

/** Writes a PNG as an 8-bit palette image: about a quarter of the size, no visible loss. */
const savePng = async (file: string, png: Buffer) =>
  writeFile(
    file,
    await sharp(png).png({ palette: true, quality: 95, effort: 10, dither: 1 }).toBuffer(),
  );

const circleSvg = (size: number, body: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${body}</svg>`,
  );

/** The original with the sky extended upward and its faded top deepened to match. */
async function preparedSource() {
  const { data, info } = await sharp(SOURCE)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const k = width / 1200;
  const band = Math.round(SKY_BAND * k);
  const h = height + band;
  const out = Buffer.alloc(width * h * 3);
  const row = width * 3;
  for (let y = 0; y < band; y++) data.copy(out, y * row, (band - 1 - y) * row, (band - y) * row);
  data.copy(out, band * row);
  const tintTo = Math.round(SKY_TINT_TO * k) + band;
  for (let y = 0; y < tintTo; y++) {
    const ramp = 1 - y / tintTo;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const lum =
        0.299 * out.readUInt8(i) + 0.587 * out.readUInt8(i + 1) + 0.114 * out.readUInt8(i + 2);
      const pale = lum > 200 ? 1 : Math.max(0, (lum - 170) / 30);
      const m = 0.75 * ramp * pale;
      SKY.forEach((sky, c) => {
        out[i + c] = Math.round(out.readUInt8(i + c) * (1 - m) + sky * m);
      });
    }
  }
  return { image: sharp(out, { raw: { width, height: h, channels: 3 } }), k, band };
}

/** The circular logo with its maroon ring, transparent outside, at `size` px. */
async function circleLogo(size: number) {
  const { image, k, band } = await preparedSource();
  const left = Math.round((CROP.cx - CROP.r) * k);
  const top = Math.round((CROP.cy - CROP.r) * k) + band;
  const side = Math.round(2 * CROP.r * k);
  const sw = size * RING;
  return sharp(
    await image
      .extract({ left, top, width: side, height: side })
      .resize(size, size)
      .png()
      .toBuffer(),
  )
    .ensureAlpha()
    .composite([
      {
        input: circleSvg(size, `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`),
        blend: "dest-in",
      },
      {
        input: circleSvg(
          size,
          `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - sw / 2}" fill="none" stroke="${MAROON}" stroke-width="${sw}"/>`,
        ),
      },
    ])
    .png()
    .toBuffer();
}

/** `logo` scaled to `share` of the smaller side, centred on a `bg` canvas. */
async function onCanvas(logo: Buffer, width: number, height: number, share: number, bg: string) {
  const d = Math.round(Math.min(width, height) * share);
  return sharp({ create: { width, height, channels: 4, background: bg } })
    .composite([{ input: await sharp(logo).resize(d, d).toBuffer(), gravity: "centre" }])
    .png()
    .toBuffer();
}

async function markBand(png: Buffer, band: Band) {
  const { label: text, fill } = BANDS[band];
  const { width, height } = await sharp(png).metadata();
  const bh = Math.round(height * 0.3);
  const label = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="0" y="${height - bh}" width="${width}" height="${bh}" fill="${fill}"/>` +
      `<text x="50%" y="${height - bh / 2}" dy="0.35em" text-anchor="middle" fill="#fff" ` +
      `font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${bh * 0.72}">${text}</text></svg>`,
  );
  // Keep the label inside the icon's own shape (the circle, for transparent icons).
  const marked = await sharp(png)
    .composite([{ input: label }])
    .png()
    .toBuffer();
  return sharp(marked)
    .composite([{ input: png, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/** A .ico holding PNG images (supported by every current browser). */
function ico(pngs: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

async function iconSet(logo: Buffer, dir: string, band?: Band) {
  const mark = (b: Buffer) => (band ? markBand(b, band) : Promise.resolve(b));
  const scaled = (s: number) => sharp(logo).resize(s, s).png().toBuffer();
  await mkdir(dir, { recursive: true });
  for (const s of [64, 192, 512])
    await savePng(`${dir}/pwa-${s}x${s}.png`, await mark(await scaled(s)));
  // Android crops maskable icons to a shape; the safe zone is the middle 80%.
  await savePng(
    `${dir}/maskable-icon-512x512.png`,
    await mark(await onCanvas(logo, 512, 512, 0.8, "#ffffff")),
  );
  // iOS gives every icon rounded-square corners and needs a solid background.
  await savePng(
    `${dir}/apple-touch-icon-180x180.png`,
    await mark(await onCanvas(logo, 180, 180, 0.88, "#ffffff")),
  );
  const fav = await Promise.all(
    [16, 32, 48].map(async (s) => ({ size: s, data: await mark(await scaled(s)) })),
  );
  await writeFile(`${dir}/favicon.ico`, ico(fav));
  // The splash screen's logo (EV-42): 184 points at 3×.
  await savePng(`${dir}/splash-logo.png`, await mark(await scaled(552)));
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(`${OUT}/splash`, { recursive: true });
  const logo = await circleLogo(1024);
  await writeFile(`${OUT}/logo-circle-1024.png`, logo);

  await iconSet(logo, OUT);
  for (const band of Object.keys(BANDS) as Band[]) await iconSet(logo, `${OUT}/${band}`, band);

  for (const s of [1, 2, 3]) {
    const name = s === 1 ? "header-logo.png" : `header-logo@${s}x.png`;
    await savePng(
      `${OUT}/${name}`,
      await sharp(logo)
        .resize(48 * s, 48 * s)
        .png()
        .toBuffer(),
    );
  }

  // The start-up images themselves are screenshots of the splash (startup-images.ts).
  const links: string[] = [];
  for (const [w, h, dpr, devices] of SCREENS) {
    const pw = w * dpr;
    const ph = h * dpr;
    const media = `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`;
    links.push(`<!-- ${devices} -->`);
    for (const theme of ["light", "dark"] as const) {
      const file = `splash/apple-splash-${theme}-${pw}x${ph}.png`;
      links.push(
        `<link rel="apple-touch-startup-image" href="/${file}" media="${media} and (prefers-color-scheme: ${theme})">`,
      );
    }
  }
  await writeFile(
    `${OUT}/head-links.html`,
    [
      `<!-- Generated by brand/generate.ts. The app's build puts these in index.html (apps/web/brand-assets.ts). -->`,
      `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">`,
      `<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">`,
      ...links,
      "",
    ].join("\n"),
  );
  await writeFile(
    `${OUT}/manifest-icons.json`,
    JSON.stringify(
      [
        { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
        { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        {
          src: "/maskable-icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${OUT}/; the start-up images come next (startup-images.ts).`);
}

await main();
