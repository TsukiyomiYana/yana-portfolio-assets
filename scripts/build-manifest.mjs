// scripts/build-manifest.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const WORKS_DIR = path.join(ROOT, "works");
const THUMBS_DIR = path.join(ROOT, "thumbs");

// 你的分類「固定成資料夾」：works/<key>/...
const CATEGORY_ORDER = [
  { k: "chars",  l: "3D Chars" },
  { k: "props",  l: "3D Props" },
  { k: "live2d", l: "Live2D" },
  { k: "game",   l: "Game Development" },
  { k: "sketch", l: "Sketch" },
];

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

// GitHub Pages base（對應你的 assets repo）
const BASE = "https://tsukiyomiyana.github.io/yana-portfolio-assets/";

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function sortNewestFirst(a, b) {
  // 你檔名有 001/002/003 padding，直接字典序反向就會是新→舊
  return b.localeCompare(a, "en");
}

function makeTitleFromFilename(filename) {
  // 預設不顯示標題最乾淨：回傳空字串即可
  // 想顯示就把這行改成：return filename.replace(/\.[^.]+$/, "");
  return "";
}

async function listImagesInCategory(catKey) {
  const dir = path.join(WORKS_DIR, catKey);
  if (!(await exists(dir))) return [];

  const ents = await fs.readdir(dir, { withFileTypes: true });
  const files = ents
    .filter(e => e.isFile())
    .map(e => e.name)
    .filter(name => IMG_EXT.has(path.extname(name).toLowerCase()))
    .sort(sortNewestFirst);

  const items = [];
  for (const name of files) {
    const rel = `works/${catKey}/${name}`;
    const absThumb1 = path.join(THUMBS_DIR, catKey, name);           // thumbs/<cat>/<file>
    const absThumb2 = path.join(THUMBS_DIR, "works", catKey, name);  // thumbs/works/<cat>/<file>

    let thRel = null;
    if (await exists(absThumb1)) thRel = `thumbs/${catKey}/${name}`;
    else if (await exists(absThumb2)) thRel = `thumbs/works/${catKey}/${name}`;

    const s  = BASE + rel;
    const th = thRel ? (BASE + thRel) : s;

    items.push({
      t: "image",
      s,
      th,
      ti: makeTitleFromFilename(name),
    });
  }

  return items;
}

async function main() {
  const cats = [];
  for (const c of CATEGORY_ORDER) {
    const items = await listImagesInCategory(c.k);
    cats.push({ k: c.k, l: c.l, i: items });
  }

  const now = new Date().toISOString();
  const json = {
    version: 1,
    generatedAt: now,
    base: BASE,
    cats,
  };

  const outJson = path.join(ROOT, "manifest.json");
  const outJs   = path.join(ROOT, "manifest.js");

  await fs.writeFile(outJson, JSON.stringify(json, null, 2) + "\n", "utf8");

  // 直接輸出成你現有系統可吃的 window.YANA_PORTFOLIO_CATS
  const js = [
    "/* Auto-generated. Do not edit by hand. */",
    `window.YANA_PORTFOLIO_CATS = ${JSON.stringify(cats, null, 2)};`,
    `window.YANA_PORTFOLIO_MANIFEST = ${JSON.stringify({ generatedAt: now, base: BASE }, null, 2)};`,
    ""
  ].join("\n");

  await fs.writeFile(outJs, js, "utf8");

  console.log(`[manifest] generated ${cats.reduce((n,c)=>n+(c.i?.length||0),0)} items @ ${now}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
