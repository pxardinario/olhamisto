// Pesquisa no portal português de dados abertos (dados.gov.pt) e mostra, para cada conjunto, quem o publica,
// a licença e se os ficheiros estão alojados no próprio portal (acessíveis neste ambiente) ou noutro domínio
// (muitas vezes bloqueado pelo proxy, p. ex. transparencia.sns.gov.pt).
// Uso: node tools/dadosgov-search.mjs <termos> [--org=<parte do nome do organismo>] [--sem-ine] [--max=15]
//   --sem-ine exclui o INE (que tem cerca de 13 700 conjuntos espelhados: para esses, usar tools/ine-search.mjs).
// Exemplo: node tools/dadosgov-search.mjs contratos públicos --sem-ine
import { argv } from "node:process";

const API = "https://dados.gov.pt/api/1";
const args = argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=").slice(1).join("=");
const max = Number(opt("max", 15));
const org = opt("org", "").toLowerCase();
const noINE = args.includes("--sem-ine");
const q = args.filter((a) => !a.startsWith("--")).join(" ");
if (!q) { console.error("Uso: node tools/dadosgov-search.mjs <termos> [--org=…] [--sem-ine] [--max=15]"); process.exit(1); }

// Termos do portal: dados de organismos do Estado sem licença indicada ficam sob CC BY 4.0 (dados.gov.pt/pt/terms)
const LIC = { "cc-by": "CC BY 4.0", "cc-by-sa": "CC BY-SA", "cc-zero": "CC0", "odc-by": "ODC-BY", "odc-odbl": "ODbL", "odc-pddl": "PDDL", "other-pd": "domínio público", "lov2": "Licence Ouverte",
  notspecified: "não indicada (CC BY 4.0 por defeito se o organismo for do Estado: confirmar)", "other-nc": "NÃO COMERCIAL: excluir", "cc-by-nc": "NÃO COMERCIAL: excluir" };
let page = 1, shown = 0, total = 0;
const out = [];
while (shown < max && page <= 10) {
  const u = `${API}/datasets/?q=${encodeURIComponent(q)}&page_size=50&page=${page}`;
  let j;
  try { const r = await fetch(u, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); j = await r.json(); }
  catch (e) { console.error(`Falhou o acesso a dados.gov.pt (${e.message}).`); process.exit(2); }
  total = j.total;
  for (const d of j.data) {
    const o = d.organization?.name || d.owner?.slug || "?";
    if (noINE && /Instituto Nacional de Estat/i.test(o)) continue;
    if (org && !o.toLowerCase().includes(org)) continue;
    const res = d.resources.map((r) => { let h = "?"; try { h = new URL(r.url).hostname; } catch {} return { fmt: (r.format || "?").toLowerCase(), host: h, url: r.url }; });
    const local = res.filter((r) => r.host === "dados.gov.pt").length;
    out.push({ d, o, res, local });
    if (++shown >= max) break;
  }
  if (!j.next_page) break;
  page++;
}
console.log(`${total} conjunto(s) no portal para «${q}»${noINE || org ? " (filtrados)" : ""}; mostram-se ${out.length}\n`);
for (const { d, o, res, local } of out) {
  const fmts = [...new Set(res.map((r) => r.fmt))].join(", ");
  const hosts = [...new Set(res.map((r) => r.host))].join(", ");
  console.log(`${d.title}`);
  console.log(`   ${o} · licença: ${LIC[d.license] || d.license} · atualizado ${(d.last_update || d.last_modified || "").slice(0, 10)} · ${res.length} ficheiro(s) [${fmts}]`);
  console.log(`   alojamento: ${hosts}${local === res.length ? " (no portal: acessível)" : local ? " (parte no portal)" : " (fora do portal: testar acesso)"}`);
  console.log(`   https://dados.gov.pt/pt/datasets/${d.slug}/`);
}
