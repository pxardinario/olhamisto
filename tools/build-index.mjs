// Gera site/data/index.json a partir de site/data/editions/*.json.
// O índice alimenta o arquivo (pesquisa, filtros) e é o registo de memória editorial.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ED = path.join(ROOT, "site", "data", "editions");
const files = fs.readdirSync(ED).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
const editions = files.map((f) => {
  const e = JSON.parse(fs.readFileSync(path.join(ED, f), "utf8"));
  if (e.status !== "publicada") return null;
  return {
    date: e.date, number: e.number, lead: e.lead, opening: e.opening,
    pieces: e.pieces.map((p) => ({
      id: p.id, title: p.title, kind: p.kind, theme: p.theme, themeLabel: p.themeLabel,
      vizType: p.vizType, vizLabel: p.vizLabel, interactive: p.interactive,
      question: p.question, finding: p.finding, period: p.period, dataset: p.chart.dataset,
      sourceNames: p.sources.map((s) => s.name), verification: p.verification?.status,
    })),
    ...(e.chave ? { chave: { id: e.chave.id, title: e.chave.title, axis: e.chave.axis, verification: e.chave.verification?.status } } : {}),
  };
}).filter(Boolean);
// Salvaguarda do arquivo: edições já indexadas cujo ficheiro não esteja presente localmente
// (p. ex. descarga incompleta numa execução diária) são mantidas tal como estavam. Nunca se perdem edições.
const idxPath = path.join(ROOT, "site", "data", "index.json");
if (fs.existsSync(idxPath)) {
  const prev = JSON.parse(fs.readFileSync(idxPath, "utf8"));
  const have = new Set(editions.map((e) => e.date));
  const kept = (prev.editions || []).filter((e) => !have.has(e.date));
  if (kept.length) console.log(`AVISO: ${kept.length} edição(ões) mantida(s) do índice anterior sem ficheiro local: ${kept.map((e) => e.date).join(", ")}`);
  editions.push(...kept);
  editions.sort((a, b) => b.date.localeCompare(a.date));
}
const index = { schema: "ronda-visual/index@1", updated: new Date().toISOString(), latest: editions[0]?.date, editions };
fs.writeFileSync(path.join(ROOT, "site", "data", "index.json"), JSON.stringify(index, null, 1));
console.log(`index.json: ${editions.length} edições, ${editions.reduce((a, e) => a + e.pieces.length, 0)} peças; mais recente ${index.latest}`);
