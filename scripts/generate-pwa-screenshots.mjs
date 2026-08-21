import sharp from "sharp";

const capLogo = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="#03004B"/>
  <polygon points="96,44 152,76 96,108 40,76" fill="#FFDEAB"/>
  <rect x="64" y="80" width="64" height="10" rx="3" fill="#7B5814"/>
  <line x1="96" y1="56" x2="136" y2="80" stroke="#7B5814" stroke-width="4"/>
  <polygon points="130,76 142,80 130,84 118,80" fill="#FFDEAB"/>
</svg>`;

function frame(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#05014f"/>
        <stop offset="100%" stop-color="#03004b"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect x="30" y="30" width="${width-60}" height="${height-60}" rx="40" fill="none" stroke="#ffdeab" stroke-opacity="0.15" stroke-width="3"/>
    ${body}
  </svg>`);
}

const cap = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 192 192">
  <rect width="192" height="192" fill="none"/>
  <polygon points="96,44 152,76 96,108 40,76" fill="#FFDEAB"/>
  <rect x="64" y="80" width="64" height="10" rx="3" fill="#7B5814"/>
  <line x1="96" y1="56" x2="136" y2="80" stroke="#7B5814" stroke-width="4"/>
  <polygon points="130,76 142,80 130,84 118,80" fill="#FFDEAB"/>
</svg>`;

async function main() {
  // Wide 1280x720
  const wide = frame(1280, 720, `
    <g transform="translate(640,300)">
      ${cap.replace('<svg ', '<svg x="0" y="0" ')}
    </g>
    <text x="640" y="470" font-family="Tahoma, sans-serif" font-size="58" font-weight="bold" fill="#ffdeab" text-anchor="middle">آکادمی هنر و رسانه امام روح‌الله</text>
    <text x="640" y="535" font-family="Tahoma, sans-serif" font-size="28" fill="#ffffff" fill-opacity="0.7" text-anchor="middle">دوره‌ها · اعلان‌ها · دسترسی سریع</text>
  `);
  await sharp(wide).png().toFile("public/icons/screenshot-wide.png");

  // Narrow 640x1136
  const narrow = frame(640, 1136, `
    <g transform="translate(320,430)">
      ${cap.replace('<svg ', '<svg x="0" y="0" ')}
    </g>
    <text x="320" y="640" font-family="Tahoma, sans-serif" font-size="52" font-weight="bold" fill="#ffdeab" text-anchor="middle">آکادمی امام روح‌الله</text>
    <text x="320" y="700" font-family="Tahoma, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.7" text-anchor="middle">دریافت اعلان و دسترسی سریع به دوره‌ها</text>
  `);
  await sharp(narrow).png().toFile("public/icons/screenshot-narrow.png");

  console.log("Wrote screenshots");
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });