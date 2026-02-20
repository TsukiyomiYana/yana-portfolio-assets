// scripts/build-manifest.mjs
import fs from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL || "").replace(/\/?$/, "/"); // ensure trailing slash
const WORKS_DIR = "works";
const OUT_JSON = "manifest.json";
const OUT_JS = "manifest.js";

// allow images + videos (you can add more if needed)
const ALLOWED_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif",
  ".mp4", ".webm"
]);

function isAllowedFile(name) {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXT.has(ext);
}

function kindFromExt(ext) {
  const e = ext.toLowerCase();
  return (e === ".mp4" || e === ".webm") ? "video" : "image";
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function listSubdirs(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  return ents
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !name.startsWith("."));
}

async function listFiles(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  return ents
    .filter(d => d.isFile())
    .map(d => d.name)
    .filter(isAllowedFile);
}

function sortByFilename(a, b) {
  // your names are zero-padded (ch-001...), normal lex sort is perfect
  return a.localeCompare(b, "en");
}

(async () => {
  if (!BASE_URL) {
    throw new Error("BASE_URL is required. Example: https://tsukiyomiyana.github.io/yana-portfolio-assets/");
  }
  if (!(await exists(WORKS_DIR))) {
    throw new Error(`Missing folder: ${WORKS_DIR}/`);
  }

  const categoryNames = await listSubdirs(WORKS_DIR);

  const categories = {};
  for (const cat of categoryNames) {
    const catDir = path.join(WORKS_DIR, cat);
    const files = (await listFiles(catDir)).sort(sortByFilename);

    categories[cat] = files.map((file) => {
      const ext = path.extname(file);
      const id = path.basename(file, ext);
      const relPath = `${WORKS_DIR}/${cat}/${file}`; // works/chars/xxx.png
      return {
        id,
        kind: kindFromExt(ext),
        src: `${BASE_URL}${relPath}`,
        // if you don't have separate thumbs, just reuse src
        thumb: `${BASE_URL}${relPath}`,
        filename: file
      };
    });
  }

  const manifest = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    categories
  };

  await fs.writeFile(OUT_JSON, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  // manifest.js avoids CORS issues on Carrd:
  // load via <script> then read window.YANA_PORTFOLIO_MANIFEST
  const js = `window.YANA_PORTFOLIO_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
  await fs.writeFile(OUT_JS, js, "utf8");

  console.log(`Wrote ${OUT_JSON} and ${OUT_JS}`);
})();
