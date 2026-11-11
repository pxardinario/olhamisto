// Pesquisa no catálogo de indicadores do INE (cerca de 13 mil) por palavras-chave e devolve o código (varcd)
// de cada indicador, pronto para a API: https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=<código>&lang=PT
// Uso: node tools/ine-search.mjs <termo> [termo…] [--max=30] [--refresh]
//   Todos os termos têm de aparecer (sem distinguir maiúsculas nem acentos) no título, descrição, tema ou palavras-chave.
//   O catálogo (≈ 21 MB) fica em cache em .cache/ine-catalogo.xml durante 7 dias; --refresh força nova descarga.
// Exemplo: node tools/ine-search.mjs nados-vivos mae estrangeiro
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache", "ine-catalogo.xml");
const URL_CAT = "https://www.ine.pt/ine/xml_indic.jsp?opc=2&lang=PT";
const args = process.argv.slice(2);
const max = Number((args.find((a) => a.startsWith("--max=")) || "--max=30").slice(6));
const terms = args.filter((a) => !a.startsWith("--"));
if (!terms.length) { console.error("Uso: node tools/ine-search.mjs <termo> [termo…] [--max=30] [--refresh]"); process.exit(1); }

const stale = !fs.existsSync(CACHE) || Date.now() - fs.statSync(CACHE).mtimeMs > 7 * 864e5;
if (stale || args.includes("--refresh")) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  console.error("A descarregar o catálogo do INE (≈ 21 MB)…");
  try {
    execFileSync("curl", ["-sS", "--fail", "-m", "300", "-o", CACHE + ".tmp", URL_CAT], { stdio: ["ignore", "ignore", "inherit"] });
    fs.renameSync(CACHE + ".tmp", CACHE);
  } catch {
    console.error("Falhou a descarga do catálogo do INE. Corre node tools/net-check.mjs e regista em limitations.");
    process.exit(2);
  }
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cdata = (blk, tag) => (blk.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`)) || [])[1]?.trim() || "";
const xml = fs.readFileSync(CACHE, "utf8");
const want = terms.map(norm);
const hits = [];
for (const blk of xml.split("<indicator ").slice(1)) {
  const title = cdata(blk, "title");
  const hay = norm([title, cdata(blk, "description"), cdata(blk, "theme"), cdata(blk, "subtheme"), (blk.match(/<keywords>([\s\S]*?)<\/keywords>/) || [])[1] || ""].join(" "));
  if (!want.every((t) => hay.includes(t))) continue;
  hits.push({
    varcd: cdata(blk, "varcd"), title, theme: `${cdata(blk, "theme")} › ${cdata(blk, "subtheme")}`,
    last: cdata(blk, "last_period_available"), updated: cdata(blk, "last_update"), periodicity: cdata(blk, "periodicity"),
    geo: cdata(blk, "geo_lastlevel"), source: cdata(blk, "source"),
  });
}
hits.sort((a, b) => b.updated.split("-").reverse().join("").localeCompare(a.updated.split("-").reverse().join("")));
console.log(`${hits.length} indicador(es) com «${terms.join(" ")}»${hits.length > max ? ` (mostram-se ${max}, mais recentes primeiro)` : ""}\n`);
for (const h of hits.slice(0, max)) {
  console.log(`${h.varcd}  ${h.title}`);
  console.log(`         ${h.theme} · ${h.periodicity.trim()} · último período ${h.last} · atualizado ${h.updated} · nível geográfico mais fino: ${h.geo}`);
  console.log(`         fonte: ${h.source}`);
}
if (hits.length) console.log(`\nDados: curl -sS "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${hits[0].varcd}&lang=PT"  (acrescentar &Dim1=T para todos os períodos)`);
