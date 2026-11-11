// Pesquisa nos conjuntos de dados (dataflows) da OCDE por palavras-chave e devolve o endereço da API para cada um.
// O catálogo (cerca de 1 500 conjuntos, ≈ 10 MB) fica em cache em .cache/oecd-dataflows.json durante 7 dias.
// Uso: node tools/oecd-search.mjs <termo> [termo…] [--max=20] [--refresh]
//   Termos em inglês (é a língua do catálogo); todos têm de aparecer no nome ou na descrição.
// Exemplo: node tools/oecd-search.mjs average wages
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CACHE = path.join(ROOT, ".cache", "oecd-dataflows.json");
const API = "https://sdmx.oecd.org/public/rest";
const args = process.argv.slice(2);
const max = Number((args.find((a) => a.startsWith("--max=")) || "--max=20").slice(6));
const terms = args.filter((a) => !a.startsWith("--"));
if (!terms.length) { console.error("Uso: node tools/oecd-search.mjs <termo> [termo…] [--max=20] [--refresh]"); process.exit(1); }

let flows;
const stale = !fs.existsSync(CACHE) || Date.now() - fs.statSync(CACHE).mtimeMs > 7 * 864e5;
if (stale || args.includes("--refresh")) {
  console.error("A descarregar o catálogo da OCDE (≈ 10 MB)…");
  try {
    const r = await fetch(`${API}/dataflow/all`, { headers: { Accept: "application/vnd.sdmx.structure+json;version=1.0" }, signal: AbortSignal.timeout(180000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    flows = (await r.json()).data.dataflows.map((d) => ({ agency: d.agencyID, id: d.id, version: d.version, name: d.name, description: (d.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(flows));
  } catch (e) {
    console.error(`Falhou o acesso à OCDE (${e.message}). Corre node tools/net-check.mjs e regista em limitations.`);
    process.exit(2);
  }
} else flows = JSON.parse(fs.readFileSync(CACHE, "utf8"));

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const want = terms.map(norm);
const hits = flows.filter((f) => { const h = norm(`${f.name} ${f.description} ${f.id}`); return want.every((t) => h.includes(t)); });
hits.sort((a, b) => a.name.length - b.name.length);
console.log(`${hits.length} conjunto(s) com «${terms.join(" ")}»${hits.length > max ? ` (mostram-se ${max})` : ""}\n`);
for (const f of hits.slice(0, max)) {
  console.log(`${f.agency},${f.id},${f.version}  ${f.name}${f.agency === "ESTAT" ? "  [cópia do Eurostat: usar a fonte primária]" : ""}`);
  if (f.description) console.log(`          ${f.description.slice(0, 220)}${f.description.length > 220 ? "…" : ""}`);
}
if (hits.length) {
  const f = hits.find((x) => x.agency !== "ESTAT") || hits[0];
  console.log(`\nDados (CSV com rótulos; filtrar depois por REF_AREA, p. ex. PRT): ${API}/data/${f.agency},${f.id},${f.version}/all?startPeriod=2000&format=csvfilewithlabels`);
  console.log("Para conjuntos grandes, restringir a chave (ordem das dimensões em " + `${API}/dataflow/${f.agency}/${f.id}/${f.version}?references=all` + ").");
  console.log("Licença: CC BY 4.0 por defeito para conteúdo da OCDE desde julho de 2024 (anterior: termos equivalentes); excluir material de terceiros assinalado.");
}
