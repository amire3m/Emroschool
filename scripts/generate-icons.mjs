import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const outDir = `${publicDir}icons/`;

const PNG_SOURCE = `${outDir}app-icon-source.png`;
const SVG_SOURCE = `${outDir}app-icon.svg`;
const source = existsSync(PNG_SOURCE) ? PNG_SOURCE : SVG_SOURCE;

const BRAND = "#03004b";

async function makeRoundedBackground(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 3, g: 0, b: 75, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${BRAND}"/></svg>`,
        ),
      },
    ])
    .png()
    .toBuffer();
}

async function makeSquareBackground(size) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 3, g: 0, b: 75, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(outDir, { recursive: true });

  for (const size of [192, 512]) {
    const contentSize = Math.round(size * 0.78);
    const logo = await sharp(source)
      .resize(contentSize, contentSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const pad = Math.round((size - contentSize) / 2);
    const background = await makeRoundedBackground(size);
    await sharp(background)
      .composite([{ input: logo, left: pad, top: pad }])
      .png()
      .toFile(`${outDir}icon-${size}x${size}.png`);
  }

  const maskableSize = 512;
  const contentSize = Math.round(maskableSize * 0.62);
  const logo = await sharp(source)
    .resize(contentSize, contentSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const pad = Math.round((maskableSize - contentSize) / 2);
  const background = await makeSquareBackground(maskableSize);
  await sharp(background)
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(`${outDir}maskable-512.png`);

  console.log("icons generated from", source, "in", outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
