// Relatório semanal de saúde editorial (só leitura).
// Uso: node tools/weekly-report.mjs [AAAA-MM-DD]   (data final; por omissão, hoje em Europe/Lisbon)
// Lê site/data/editions/*.json, site/data/corrections.json e editorial/candidatas.json
// e imprime um resumo em texto. Não escreve nada.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const today = process.argv[2] || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
const end = new Date(today + "T12:00:00Z");
const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
const iso = (d) => d.toISOString().slice(0, 10);

const ED = path.join(ROOT, "site/data/editions");
const all = fs.readdirSync(ED).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(ED, f), "utf8")));
const week = all.filter((e) => e.date >= iso(start) && e.date <= iso(end));
const before = all.filter((e) => e.date < iso(start));

// Heurísticas da quota de variedade (indicativas; o critério editorial é o de docs/politica-editorial.md)
const OFFICIAL = /\b(INE|Eurostat|PORDATA|OCDE|OECD|Banco de Portugal|BPstat|Banco Mundial|World Bank|FMI|IMF|BCE|ECB|NATO|Nações Unidas|ONU|UN DESA|DGEG|Diário da República|Portaria|Segurança Social)\b/i;
const PT = /Portugal|portugu[eê]s|portuguesa/i;
const isOfficial = (p) => p.sources.some((s) => OFFICIAL.test(s.name));
const PT_SRC = /\b(INE|PORDATA|Banco de Portugal|BPstat|DGEG|Diário da República|Portaria|Segurança Social)\b/i;
const isPT = (p) => [p.title, p.question, p.finding].some((t) => PT.test(t || "")) || p.sources.some((s) => PT_SRC.test(s.name));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "?"; } };
const count = (arr) => Object.entries(arr.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const fmt = (pairs) => pairs.map(([k, n]) => `${k} ${n}`).join(", ") || "—";

const pieces = week.flatMap((e) => e.pieces.map((p) => ({ ...p, date: e.date })));
const lines = [];
lines.push(`Olhamisto — revisão semanal, ${iso(start)} a ${iso(end)}`);
lines.push("");
if (!week.length) {
  lines.push("Nenhuma edição publicada neste período.");
} else {
  lines.push(`Edições: ${week.length} · peças: ${pieces.length} · média ${(pieces.length / week.length).toFixed(1).replace(".", ",")} por edição`);
  lines.push(`Por edição: ${week.map((e) => `${e.date.slice(5)} n.º ${e.number}: ${e.pieces.length}`).join(" · ")}`);
  lines.push(`Temas: ${fmt(count(pieces.map((p) => p.theme)))}`);
  lines.push(`Atualidade/descoberta: ${fmt(count(pieces.map((p) => p.kind)))}`);
  lines.push(`Tipos de gráfico: ${fmt(count(pieces.map((p) => p.chart.type)))}`);
  lines.push(`Fontes (domínios): ${fmt(count(pieces.flatMap((p) => [...new Set(p.sources.map((s) => host(s.url)))])).slice(0, 8))}`);
  lines.push(`Verificação: ${fmt(count(pieces.map((p) => p.verification?.status || "sem estado")))}`);
  lines.push("");
  lines.push("Quota de variedade (heurística por edição):");
  for (const e of week) {
    const ofPT = e.pieces.filter((p) => isOfficial(p) && isPT(p)).length;
    const nonOff = e.pieces.filter((p) => !isOfficial(p)).length;
    const noPT = e.pieces.filter((p) => !isPT(p)).length;
    const types = count(e.pieces.map((p) => p.chart.type));
    const issues = [];
    if (ofPT > 2) issues.push(`${ofPT} peças oficiais com Portugal (máx. 2)`);
    if (nonOff < 1) issues.push("nenhuma fonte não oficial");
    if (noPT < 1) issues.push("todas com Portugal como ângulo");
    if (types[0] && types[0][1] > 2) issues.push(`${types[0][1]}× ${types[0][0]}`);
    lines.push(`  ${e.date} n.º ${e.number}: ${issues.length ? "ATENÇÃO — " + issues.join("; ") : "ok"}`);
  }
  const lim = week.flatMap((e) => (e.limitations || []).map((l) => `${e.date.slice(5)}: ${l}`));
  const rej = lim.filter((l) => /rejeitad/i.test(l)).length;
  lines.push("");
  lines.push(`Limitações registadas: ${lim.length} (candidatas rejeitadas mencionadas: ${rej})`);
  const oldThemes = new Set(before.slice(-10).flatMap((e) => e.pieces.map((p) => p.dataset || p.chart.dataset)));
  const repeats = pieces.filter((p) => oldThemes.has(p.chart.dataset)).map((p) => p.id);
  if (repeats.length) lines.push(`Datasets repetidos face às 10 edições anteriores: ${repeats.join(", ")}`);
}

const corr = (read("site/data/corrections.json").corrections || []).filter((c) => c.date >= iso(start) && c.date <= iso(end));
lines.push(`Correções nesta semana: ${corr.length}${corr.length ? " — " + corr.map((c) => `${c.piece}: ${c.change}`).join(" | ") : ""}`);

let cand = [];
try { cand = read("editorial/candidatas.json").candidatas || []; } catch { /* sem lista */ }
const st = count(cand.map((c) => c.estado));
lines.push(`Lista de espera: ${cand.length} candidatas (${fmt(st)})`);
const stuck = cand.filter((c) => c.estado === "bloqueada" && (c.tentativas || 0) >= 2).map((c) => c.id);
if (stuck.length) lines.push(`Bloqueadas há 2+ tentativas: ${stuck.join(", ")}`);

console.log(lines.join("\n"));
