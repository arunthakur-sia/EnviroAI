// Extracts the teal slash pixels from the wordmark tile onto a transparent
// square canvas -> public/brand/SiaNexus_mark.png (the "mark" logo variant).
import { chromium } from "playwright";
import fs from "node:fs";

const svg = fs.readFileSync("C:/npckms/public/brand/SiaNexus_logo.svg", "utf8");
const m = /xlink:href="(data:image\/png;base64,[^"]+)"/.exec(svg);
if (!m) throw new Error("no embedded tile");

const b = await chromium.launch({ channel: "msedge" });
const p = await b.newPage();
const dataUrl = await p.evaluate(async (src) => {
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = src;
  });
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  const isTeal = (i) => d[i + 3] > 40 && d[i] < 120 && d[i + 1] > 130 && d[i + 2] > 120;
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (isTeal(i)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        d[i + 3] = 0; // everything that is not the slash becomes transparent
      }
    }
  }
  ctx.putImageData(im, 0, 0);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const side = Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = side;
  out.height = side;
  const octx = out.getContext("2d");
  octx.drawImage(c, minX, minY, w, h, Math.round((side - w) / 2), Math.round((side - h) / 2), w, h);
  return out.toDataURL("image/png");
}, m[1]);
const base64 = dataUrl.split(",")[1];
fs.writeFileSync("C:/npckms/public/brand/SiaNexus_mark.png", Buffer.from(base64, "base64"));
console.log("saved SiaNexus_mark.png,", Buffer.from(base64, "base64").length, "bytes");
await b.close();
