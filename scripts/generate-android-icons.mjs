import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#03004B"/>
  <polygon points="96,44 152,76 96,108 40,76" fill="#FFDEAB"/>
  <rect x="64" y="80" width="64" height="10" rx="3" fill="#7B5814"/>
  <line x1="96" y1="56" x2="136" y2="80" stroke="#7B5814" stroke-width="4"/>
  <polygon points="130,76 142,80 130,84 118,80" fill="#FFDEAB"/>
</svg>`;

const SIZES = [
  { dir: "mipmap-mdpi", size: 48 },
  { dir: "mipmap-hdpi", size: 72 },
  { dir: "mipmap-xhdpi", size: 96 },
  { dir: "mipmap-xxhdpi", size: 144 },
  { dir: "mipmap-xxxhdpi", size: 192 },
];

const BASE = "android-template/app/src/main/res";

async function main() {
  for (const { dir, size } of SIZES) {
    const outDir = `${BASE}/${dir}`;
    mkdirSync(outDir, { recursive: true });
    const outPath = `${outDir}/ic_launcher.png`;
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(outPath);
    console.log(`Wrote ${size}x${size} → ${outPath}`);
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});