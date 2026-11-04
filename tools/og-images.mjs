// Gera as imagens de partilha (1200×630) de cada peça em public/og/<id>.png, a partir do gráfico real.
// Uso: (cd public && python3 -m http.server 8790 &) ; node tools/og-images.mjs [http://127.0.0.1:8790] [--all]
// Só gera as imagens em falta (as anteriores ficam em cache), exceto com --all.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("playwright-core"); }

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "og");
const base = process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8790";
const all = process.argv.includes("--all");
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "public", "data", "index.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const fails = [];
async function card(url, file, sel) {
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.waitForSelector(sel ? `${sel} .chart svg` : ".chart svg", { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.evaluate((sel) => {
    const art = sel ? document.querySelector(sel) : document.querySelector(".piece");
    const title = art.querySelector("h1, h2").textContent.trim();
    const kicker = [...art.querySelectorAll(".kicker span")].slice(1, 3).map((s) => s.textContent).join(" · ");
    const svg = (art.querySelector(".map svg") || art.querySelector(".chart svg")).cloneNode(true);
    const cs = getComputedStyle(document.documentElement);
    const wrap = document.createElement("div");
    wrap.id = "og";
    wrap.style.cssText = `position:fixed;inset:0;z-index:99;background:${cs.getPropertyValue("--paper")};display:grid;grid-template-rows:auto auto 1fr auto;padding:40px 56px 30px;gap:10px;font-family:var(--sans)`;
    wrap.innerHTML = `<div style="font:700 15px var(--sans);letter-spacing:.12em;text-transform:uppercase;color:${cs.getPropertyValue("--accent")}">${kicker}</div>
      <div style="font:700 ${title.length > 85 ? 36 : 44}px/1.1 var(--serif);color:${cs.getPropertyValue("--ink")};max-width:1080px">${title}</div>
      <div id="og-chart" style="min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid ${cs.getPropertyValue("--ink")};padding-top:10px">
        <span style="font:800 30px var(--serif);color:${cs.getPropertyValue("--ink")}">Olha-me <span style="color:${cs.getPropertyValue("--accent")}">isto</span></span>
        <span style="font:500 15px var(--sans);color:${cs.getPropertyValue("--ink-3")}">olhamisto.com · feito por IA</span></div>`;
    document.body.appendChild(wrap);
    const box = wrap.querySelector("#og-chart");
    svg.style.width = "100%"; svg.style.height = "100%"; svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    box.appendChild(svg);
  }, sel);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1200, height: 630 } });
}
let made = 0;
for (const ed of index.editions) {
  for (const p of ed.pieces) {
    const file = path.join(OUT, `${p.id}.png`);
    if (!all && fs.existsSync(file)) continue;
    const y = ed.date.slice(0, 4), m = ed.date.slice(5, 7), d = ed.date.slice(8, 10);
    try { await card(`/${y}/${m}/${d}/${p.id}/`, file, `#p-${p.id}`); made++; } catch (e) { fails.push(`${p.id}: ${e.message}`); }
  }
}
// Imagem genérica do site = imagem da peça principal da última edição
const latest = index.editions[0];
const leadImg = path.join(OUT, `${latest.lead}.png`);
if (fs.existsSync(leadImg)) fs.copyFileSync(leadImg, path.join(OUT, "site.png"));
await browser.close();
console.log(`og: ${made} imagens geradas${fails.length ? `; FALHAS: ${fails.join(" | ")}` : ""}`);
process.exit(fails.length ? 1 : 0);
