// Teste genérico do site publicado em public/ (não depende das peças do dia).
// Uso: (cd public && python3 -m http.server 8790 &) ; node tests/site.mjs [http://127.0.0.1:8790] [pasta-capturas]
// Percorre todas as URLs do sitemap em desktop e iPhone: zero erros de consola, gráficos montados,
// sem scroll horizontal, metadados de partilha, rotas antigas (#hash) redirecionadas, interações básicas.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("playwright-core"); }
const base = process.argv.find((a) => a.startsWith("http")) || "http://127.0.0.1:8790";
const shots = process.argv.slice(2).find((a) => !a.startsWith("http")) || "/tmp/olha-shots";
fs.mkdirSync(shots, { recursive: true });
const sitemap = fs.readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");
const paths = [...sitemap.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map((m) => m[1]);
const fails = []; const ok = (c, m) => { if (!c) { fails.push(m); console.log("FALHA " + m); } };

const browser = await pw.chromium.launch();
for (const [name, opts] of [["desktop", { viewport: { width: 1280, height: 900 } }], ["mobile", { ...pw.devices["iPhone 13"] }]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  let errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  for (const p of paths) {
    errs = [];
    await page.goto(base + p, { waitUntil: "networkidle" });
    const isContent = /^\/(\d{4}\/|$)/.test(p);
    if (isContent) {
      try { await page.waitForSelector(".piece .chart svg", { timeout: 15000 }); } catch { ok(false, `${name} ${p}: gráfico não montado`); }
      await page.waitForTimeout(400);
      const charts = await page.$$eval(".piece .chart", (a) => a.map((c) => c.querySelectorAll("svg").length));
      ok(charts.length > 0 && charts.every((n) => n > 0), `${name} ${p}: todos os gráficos com SVG ${JSON.stringify(charts)}`);
      ok(await page.$(".ai-banner") !== null, `${name} ${p}: etiqueta de IA`);
    } else {
      await page.waitForTimeout(400);
    }
    const ovf = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(ovf <= 1, `${name} ${p}: scroll horizontal ${ovf}px`);
    ok(errs.length === 0, `${name} ${p}: erros ${JSON.stringify(errs.slice(0, 2))}`);
    if (name === "desktop") {
      const meta = await page.evaluate(() => ({ t: document.title, og: document.querySelector('meta[property="og:image"]')?.content, c: document.querySelector('link[rel="canonical"]')?.href }));
      ok(meta.t && meta.og && meta.c, `${p}: metadados de partilha`);
      const img = meta.og?.replace(/^https?:\/\/[^/]+/, "");
      if (img && isContent) { const r = await page.request.get(base + img); ok(r.ok(), `${p}: imagem de partilha ${img} existe`); }
    }
  }
  // Interações na página inicial
  await page.goto(base + "/", { waitUntil: "networkidle" }); await page.waitForSelector(".piece .chart svg"); await page.waitForTimeout(400);
  const segs = await page.$$(".piece .seg button[aria-pressed=false]");
  for (const b of segs.slice(0, 6)) { await b.click(); await page.waitForTimeout(80); }
  ok(errs.length === 0, `${name}: alternadores sem erros`);
  const fav = await page.$('.piece [data-act="fav"]'); await fav.click();
  ok((await fav.getAttribute("aria-pressed")) === "true", `${name}: favorito`);
  ok((await page.$$eval(".fb:not([hidden])", (a) => a.length)) === 0, `${name}: avaliações escondidas fora do Claude`);
  await page.click("#btn-theme"); ok((await page.getAttribute("html", "data-theme")) === "dark", `${name}: modo escuro`);
  await page.screenshot({ path: `${shots}/${name}-inicio-escuro.png` }); await page.click("#btn-theme");
  await page.goto(base + "/", { waitUntil: "networkidle" }); await page.waitForSelector(".piece .chart svg"); await page.waitForTimeout(500);
  await page.screenshot({ path: `${shots}/${name}-inicio.png`, fullPage: true });
  // Arquivo e pesquisa
  await page.goto(base + "/arquivo/", { waitUntil: "networkidle" }); await page.waitForSelector(".card");
  const n = await page.$$eval(".card", (a) => a.length); await page.fill("#q", "zzzz-inexistente");
  ok(n >= 5 && (await page.$$eval(".card", (a) => a.length)) === 0, `${name}: arquivo (${n}) e pesquisa`);
  await page.goto(base + "/favoritos/", { waitUntil: "networkidle" }); await page.waitForSelector(".card");
  ok((await page.$$eval(".card", (a) => a.length)) >= 1, `${name}: favoritos persistem`);
  // Rotas antigas
  await page.goto(base + "/#arquivo"); await page.waitForURL(/\/arquivo\/$/, { timeout: 8000 }).catch(() => ok(false, `${name}: redirecionamento #arquivo`));
  await page.goto(base + "/#e-2026-11-03--onu-crescimento"); await page.waitForURL(/\/2026\/11\/03\/onu-crescimento\/$/, { timeout: 8000 }).catch(() => ok(false, `${name}: redirecionamento #e-…`));
  // 404
  const r404 = await page.request.get(base + "/404.html"); ok(r404.ok(), "404.html existe");
  await ctx.close();
}
await browser.close();
console.log(`${paths.length} URLs × 2 dispositivos. ${fails.length ? fails.length + " FALHAS" : "TODOS OS TESTES PASSARAM"}`);
process.exit(fails.length ? 1 : 0);
