// Pesquisa nas séries do Banco de Portugal (BPstat, cerca de 70 mil) por palavras-chave e devolve, para cada série,
// o endereço da API com os dados. A API do BPstat não tem pesquisa por texto: esta ferramenta constrói um índice local
// (domínios → datasets → séries, 100 séries por página) e guarda-o em .cache/bpstat-indice.json durante 7 dias.
// Uso: node tools/bpstat-search.mjs <termo> [termo…] [--max=30] [--refresh]
//   Todos os termos têm de aparecer (sem distinguir maiúsculas nem acentos) no nome da série ou do domínio.
// Exemplo: node tools/bpstat-search.mjs taxa juro novos empréstimos habitação
// A primeira execução demora alguns minutos (cerca de 800 pedidos); as seguintes usam a cache.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache", "bpstat-indice.json");
const API = "https://bpstat.bportugal.pt/data/v1";
const args = process.argv.slice(2);
const max = Number((args.find((a) => a.startsWith("--max=")) || "--max=30").slice(6));
const terms = args.filter((a) => !a.startsWith("--"));
if (!terms.length) { console.error("Uso: node tools/bpstat-search.mjs <termo> [termo…] [--max=30] [--refresh]"); process.exit(1); }

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= tries) throw new Error(`${url}: ${e.message}`);
      await new Promise((ok) => setTimeout(ok, 1000 * 2 ** i));
    }
  }
}

async function pool(items, n, fn) {
  const out = []; let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }));
  return out;
}

async function buildIndex() {
  console.error("A construir o índice do BPstat (só na primeira vez ou a cada 7 dias)…");
  const domains = (await get(`${API}/domains/?lang=PT`)).filter((d) => d.has_series);
  const datasets = (await pool(domains, 6, async (d) => {
    const r = await get(d.datasets_href);
    return (r.link?.item || []).map((it) => ({ domain: d.id, domainLabel: d.label, id: it.extension.id, n: it.extension.num_series, updated: it.extension.obs_updated_at }));
  })).flat();
  const pages = datasets.flatMap((ds) => Array.from({ length: Math.ceil(ds.n / 100) }, (_, p) => ({ ds, page: p + 1 })));
  console.error(`${domains.length} domínios, ${datasets.length} datasets, ${pages.length} páginas…`);
  let done = 0;
  const failed = [];
  const series = (await pool(pages, 6, async ({ ds, page }) => {
    let r;
    try { r = await get(`${API}/domains/${ds.domain}/datasets/${ds.id}/?lang=PT&obs_last_n=1&page_size=100&page=${page}`); }
    catch { failed.push(`domínio ${ds.domain} (${ds.domainLabel}), página ${page}`); return []; }
    if (++done % 100 === 0) console.error(`  ${done}/${pages.length}`);
    return (r.extension?.series || []).map((s) => ({ id: s.id, label: s.label, domain: ds.domain, domainLabel: ds.domainLabel, dataset: ds.id, updated: ds.updated }));
  })).flat();
  if (failed.length > pages.length * 0.2) throw new Error(`${failed.length} de ${pages.length} páginas falharam`);
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({ built: new Date().toISOString(), failed, series }));
  console.error(`Índice com ${series.length} séries guardado em ${path.relative(ROOT, CACHE)}.`);
  if (failed.length) console.error(`Aviso: ${failed.length} página(s) falharam e não estão no índice (repetir com --refresh mais tarde):\n  ${[...new Set(failed.map((f) => f.split(", página")[0]))].join("\n  ")}`);
  return series;
}

const stale = !fs.existsSync(CACHE) || Date.now() - fs.statSync(CACHE).mtimeMs > 7 * 864e5;
let series;
try {
  series = stale || args.includes("--refresh") ? await buildIndex() : JSON.parse(fs.readFileSync(CACHE, "utf8")).series;
} catch (e) {
  console.error(`Falhou o acesso ao BPstat (${e.message}). Corre node tools/net-check.mjs e regista em limitations.`);
  process.exit(2);
}

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const want = terms.map(norm);
const hits = series.filter((s) => { const h = norm(`${s.label} ${s.domainLabel}`); return want.every((t) => h.includes(t)); });
hits.sort((a, b) => b.updated.localeCompare(a.updated) || a.label.length - b.label.length);
console.log(`${hits.length} série(s) com «${terms.join(" ")}»${hits.length > max ? ` (mostram-se ${max}, mais recentes e com nome mais curto primeiro)` : ""}\n`);
for (const s of hits.slice(0, max)) {
  console.log(`${s.id}  ${s.label}`);
  console.log(`          domínio ${s.domain}: ${s.domainLabel} · dataset atualizado ${s.updated.slice(0, 10)}`);
}
if (hits.length) {
  const s = hits[0];
  console.log(`\nDados (JSON-stat, série completa): ${API}/domains/${s.domain}/datasets/${s.dataset}/?lang=PT&series_ids=${s.id}`);
  console.log("Os valores estão em .value e as datas nas chaves de .dimension.reference_date.category; metadados da série: " + `${API}/series/?series_ids=${s.id}&lang=PT`);
  console.log("Licença e citação: confirmar nos termos do BPstat e citar «Banco de Portugal, BPstat» com o identificador da série.");
}
