// Validação estrutural e editorial de uma edição antes da publicação.
// Uso: node tools/validate.mjs [AAAA-MM-DD]   (por omissão: a edição mais recente)
// Falha (exit 1) se alguma regra obrigatória não for cumprida.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = path.join(ROOT, "site");
const ED = path.join(SITE, "data", "editions");
const date = process.argv[2] || fs.readdirSync(ED).filter((f) => f.endsWith(".json")).sort().at(-1).replace(".json", "");
const ed = JSON.parse(fs.readFileSync(path.join(ED, `${date}.json`), "utf8"));
const CHART_TYPES = ["midterms", "ireland-area", "house-lines", "un-map", "forgetting", "columns", "lines", "dumbbell", "bars"];
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);
const words = (s) => (s || "").trim().split(/\s+/).filter(Boolean).length;

if (ed.schema !== "ronda-visual/edition@1") err("schema inválido");
if (ed.date !== date) err("data do ficheiro ≠ campo date");
if (!Array.isArray(ed.pieces) || ed.pieces.length === 0) err("edição sem peças");
if (ed.pieces.length !== 5) warn(`edição com ${ed.pieces.length} peças (objetivo: 5) — justificar em limitations`);
if (ed.pieces.length < 5 && !(ed.limitations || []).length) err("menos de 5 peças sem limitações declaradas");
if (!ed.pieces.some((p) => p.id === ed.lead)) err("lead não corresponde a nenhuma peça");
const ids = new Set();
for (const p of ed.pieces) {
  const where = `[${p.id}]`;
  if (ids.has(p.id)) err(`${where} id duplicado`); ids.add(p.id);
  for (const k of ["title", "context", "interpretation", "question", "finding", "period", "unit", "kind", "theme", "themeLabel", "vizType"]) if (!p[k]) err(`${where} falta ${k}`);
  if (!["atualidade", "descoberta"].includes(p.kind)) err(`${where} kind inválido`);
  const wc = words(p.context), wi = words(p.interpretation);
  if (wc < 30 || wc > 80) warn(`${where} contexto com ${wc} palavras (alvo 40–70)`);
  if (wi < 30 || wi > 80) warn(`${where} interpretação com ${wi} palavras (alvo 40–70)`);
  if (!p.sources?.length) err(`${where} sem fontes`);
  for (const s of p.sources || []) { if (!/^https?:\/\//.test(s.url)) err(`${where} fonte sem URL: ${s.name}`); if (!/^\d{4}-\d{2}-\d{2}$/.test(s.accessed || "")) err(`${where} fonte sem data de consulta: ${s.name}`); }
  if (!p.method?.length) err(`${where} sem notas metodológicas`);
  if (!CHART_TYPES.includes(p.chart?.type)) err(`${where} tipo de gráfico desconhecido: ${p.chart?.type}`);
  const ds = path.join(SITE, "data", "datasets", p.chart?.dataset || "_", "data.json");
  if (!fs.existsSync(ds)) err(`${where} dataset em falta: ${ds}`);
  else {
    const d = JSON.parse(fs.readFileSync(ds, "utf8"));
    const rows = d.rows || d.members || [];
    if (!rows.length) err(`${where} dataset vazio`);
    const bad = JSON.stringify(d).match(/NaN|Infinity|undefined/);
    if (bad) err(`${where} dataset contém ${bad[0]}`);
    const rawDir = path.join(path.dirname(ds), "raw");
    if (!fs.existsSync(rawDir) || !fs.readdirSync(rawDir).length) err(`${where} sem dados brutos em raw/`);
  }
  if (!p.verification?.status) err(`${where} sem estado de verificação`);
  else if (p.verification.status !== "verificada") warn(`${where} verificação: ${p.verification.status} — ${p.verification.note || ""}`);
  if (/[“”]/.test(p.title + p.context + p.interpretation)) warn(`${where} usa aspas inglesas; preferir «»`);
}
// A Chave do Dia (opcional): lição que fecha a edição
if (ed.chave) {
  const c = ed.chave, where = `[chave ${c.id}]`;
  for (const k of ["id", "axis", "title", "concept", "lesson", "motto", "certainty"]) if (!c[k]) err(`${where} falta ${k}`);
  if (!["portugal", "pensamento", "sabedoria", "economia", "geopolitica", "ciencia"].includes(c.axis)) err(`${where} eixo inválido: ${c.axis}`);
  if (!Array.isArray(c.lesson) || c.lesson.length < 2 || c.lesson.length > 3) err(`${where} a lição tem de ter 2 ou 3 parágrafos`);
  for (const [i, t] of (c.lesson || []).entries()) { const w = words(t); if (w < 30 || w > 80) warn(`${where} parágrafo ${i + 1} com ${w} palavras (alvo 40–70)`); }
  if (!c.sources?.length) err(`${where} sem fontes`);
  for (const s of c.sources || []) { if (!/^https?:\/\//.test(s.url)) err(`${where} fonte sem URL: ${s.name}`); if (!/^\d{4}-\d{2}-\d{2}$/.test(s.accessed || "")) err(`${where} fonte sem data de consulta: ${s.name}`); }
  if (c.diagram?.svg && !/^<svg[\s>]/.test(c.diagram.svg.trim())) err(`${where} esquema não é SVG`);
  if (c.diagram?.svg && /<script|on\w+=/i.test(c.diagram.svg)) err(`${where} esquema com código ativo`);
  if (!c.verification?.status) err(`${where} sem estado de verificação`);
  if (/[“”]/.test(c.title + c.concept + (c.lesson || []).join(" "))) warn(`${where} usa aspas inglesas; preferir «»`);
}
const kinds = ed.pieces.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});
const themes = new Set(ed.pieces.map((p) => p.theme));
if (themes.size < 3) warn(`pouca diversidade temática (${themes.size} temas)`);
if (ed.pieces.filter((p) => p.interactive).length < 2) warn("menos de 2 visualizações interativas");
// Repetição face ao histórico
const idxPath = path.join(SITE, "data", "index.json");
if (fs.existsSync(idxPath)) {
  const idx = JSON.parse(fs.readFileSync(idxPath, "utf8"));
  for (const e of idx.editions.filter((e) => e.date !== date)) for (const q of e.pieces) for (const p of ed.pieces)
    if (q.dataset === p.chart.dataset) warn(`[${p.id}] reutiliza o dataset de ${e.date} (${q.id}) — explicar a diferença`);
}
console.log(`Edição ${date}: ${ed.pieces.length} peças · ${JSON.stringify(kinds)} · ${themes.size} temas · ${ed.pieces.filter((p) => p.interactive).length} interativas`);
warns.forEach((w) => console.log("AVISO  " + w));
errors.forEach((e) => console.log("ERRO   " + e));
console.log(errors.length ? `FALHOU (${errors.length} erros)` : "OK");
process.exit(errors.length ? 1 : 0);
