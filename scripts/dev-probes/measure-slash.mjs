// Measures the teal slash geometry inside the SiaNexus wordmark's embedded tile
// via canvas pixel scanning in Edge (no native image libs on this machine).
import { chromium } from "playwright";
import fs from "node:fs";

const svg = fs.readFileSync("C:/npckms/public/brand/SiaNexus_logo.svg", "utf8");
const m = /xlink:href="(data:image\/png;base64,[^"]+)"/.exec(svg);
if (!m) throw new Error("no embedded tile");

const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage();
const result = await p.evaluate(async (dataUrl) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = dataUrl;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  // teal ~ #00DECC: g and b high, r low
  const isTeal = (i) => d[i + 3] > 100 && d[i] < 100 && d[i + 1] > 150 && d[i + 2] > 140;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  const rowsAt = {};
  for (let y = 0; y < c.height; y++) {
    let rMin = 1e9, rMax = -1;
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (isTeal(i)) {
        if (x < rMin) rMin = x;
        if (x > rMax) rMax = x;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (rMax >= 0 && (y === 0 || y % 50 === 0 || y === c.height - 1)) rowsAt[y] = [rMin, rMax];
  }
  return { imgW: img.width, imgH: img.height, minX, maxX, minY, maxY, rowsAt };
}, m[1]);
console.log(JSON.stringify(result, null, 1));
await b.close();
