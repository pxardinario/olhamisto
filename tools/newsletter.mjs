// Gera a newsletter semanal (Substack) a partir de newsletter/nNNN.json e das edições publicadas.
// Uso: node tools/newsletter.mjs newsletter/n001.json
// Saída em newsletter/nNNN/: email.html (para copiar e colar no editor do Substack), notas.md (Notes),
// imagens/ (cópias das imagens de partilha, para carregar à mão se a colagem não as trouxer) e LEIAME.md.
// Falha (exit 1) se algum número escrito à mão não constar das peças/correções de origem,
// se um parágrafo sair dos 40–70 palavras ou se uma peça em destaque não estiver verificada.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ORIGIN = process.env.SITE_ORIGIN || "https://olhamisto.com";
const srcArg = process.argv[2];
if (!srcArg) { console.error("Uso: node tools/newsletter.mjs newsletter/nNNN.json"); process.exit(1); }
const src = JSON.parse(fs.readFileSync(path.resolve(ROOT, srcArg), "utf8"));
const OUT = path.join(ROOT, "newsletter", `n${String(src.number).padStart(3, "0")}`);

const ED = path.join(ROOT, "site/data/editions");
const editions = fs.readdirSync(ED).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
  .map((f) => JSON.parse(fs.readFileSync(path.join(ED, f), "utf8")))
  .filter((e) => src.editions.includes(e.number));
assert.equal(editions.length, src.editions.length, "Há edições pedidas que não existem");
const corrections = JSON.parse(fs.readFileSync(path.join(ROOT, "site/data/corrections.json"), "utf8")).corrections;

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const edUrl = (d) => `/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/`;
const pieceUrl = (d, id) => ORIGIN + edUrl(d) + id + "/";
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const longDate = (d) => `${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const words = (s) => s.trim().split(/\s+/).length;
// Números escritos (vírgula decimal, espaço nos milhares) → valores comparáveis
const nums = (s) => (String(s).match(/\d+(?:[  ]\d{3})*(?:,\d+)?/g) || []).map((t) => parseFloat(t.replace(/[  ]/g, "").replace(",", ".")));
const sameNumbers = (text, sourceText, label) => {
  const pool = new Set(nums(sourceText));
  for (const n of nums(text)) check(pool.has(n), `${label}: o número ${String(n).replace(".", ",")} não consta da fonte`);
};

const pieces = new Map();
for (const e of editions) for (const p of e.pieces) pieces.set(p.id, { ...p, date: e.date, number: e.number });
const pieceText = (p) => [p.title, p.question, p.finding, p.context, p.interpretation, p.period].join(" ");

for (const [i, t] of src.intro.entries()) { const w = words(t); check(w >= 40 && w <= 70, `Introdução §${i + 1}: ${w} palavras (40–70)`); }
for (const h of src.highlights) {
  const p = pieces.get(h.piece);
  check(p, `Destaque ${h.piece}: peça não existe nas edições ${src.editions.join(", ")}`);
  if (!p) continue;
  check(p.verification?.status === "verificada", `Destaque ${h.piece}: verificação «${p.verification?.status}» (só peças verificadas podem ser destaque)`);
  const w = words(h.text); check(w >= 40 && w <= 70, `Destaque ${h.piece}: ${w} palavras (40–70)`);
  sameNumbers(h.text, pieceText(p), `Destaque ${h.piece}`);
}
for (const n of src.notes) {
  const p = pieces.get(n.piece);
  check(p, `Nota ${n.piece}: peça não existe`);
  if (p) sameNumbers(n.text, pieceText(p), `Nota ${n.piece}`);
  check(n.text.length + 15 <= 140, `Nota ${n.piece}: ${n.text.length} caracteres (máx. 140)`);
}
const inRange = corrections.filter((c) => src.editions.includes(editions.find((e) => e.date === c.edition)?.number));
for (const c of inRange) {
  const key = `${c.date}|${c.piece}`;
  const t = src.correctionsNote?.[key];
  check(t, `Correção ${key} sem texto na newsletter (correctionsNote)`);
  if (t) sameNumbers(t, [c.date.slice(8, 10), c.title, c.change].join(" "), `Correção ${key}`);
}
if (errors.length) { console.error("newsletter: FALHOU\n- " + errors.join("\n- ")); process.exit(1); }

// ---------- HTML (estrutura simples: o editor do Substack ignora CSS) ----------
const hl = new Set(src.highlights.map((h) => h.piece));
const html = [];
html.push(`<h1>${esc(src.title)}</h1>`, `<h3>${esc(src.subtitle)}</h3>`);
for (const t of src.intro) html.push(`<p>${esc(t)}</p>`);
html.push(`<hr>`, `<h2>Os destaques</h2>`);
for (const h of src.highlights) {
  const p = pieces.get(h.piece);
  const url = pieceUrl(p.date, p.id);
  html.push(`<h3>${esc(p.title)}</h3>`,
    `<p><a href="${url}"><img src="${ORIGIN}/og/${p.id}.png" alt="${esc(p.title)}" width="600"></a></p>`,
    `<p>${esc(h.text)}</p>`,
    `<p><em>${esc(p.themeLabel)} · Edição n.º ${p.number}, ${longDate(p.date)} · Fonte: ${esc(p.sources[0].name.split(" — ")[0].split(",")[0])}</em><br><a href="${url}">Ver o gráfico interativo, as fontes e o método →</a></p>`);
}
html.push(`<hr>`, `<h2>Também nestas edições</h2>`);
for (const e of editions) {
  const rest = e.pieces.filter((p) => !hl.has(p.id));
  if (!rest.length) continue;
  html.push(`<p><strong><a href="${ORIGIN + edUrl(e.date)}">Edição n.º ${e.number} · ${longDate(e.date)}</a></strong></p><ul>`);
  for (const p of rest) html.push(`<li><a href="${pieceUrl(e.date, p.id)}">${esc(p.title)}</a>${p.verification?.status === "parcial" ? " <em>(verificação parcial)</em>" : ""}</li>`);
  html.push(`</ul>`);
}
html.push(`<hr>`, `<h2>As Chaves do Dia</h2>`, `<p>Cada edição fecha com uma lição sobre um conceito, sem gráfico de dados.</p><ul>`);
for (const e of editions) if (e.chave) html.push(`<li><a href="${ORIGIN + edUrl(e.date)}#chave-${e.chave.id}"><strong>${esc(e.chave.title)}</strong></a> (${esc(e.chave.axisLabel)}). ${esc(e.chave.concept)}</li>`);
html.push(`</ul>`);
if (inRange.length) {
  html.push(`<hr>`, `<h2>Correções</h2>`);
  for (const c of inRange) html.push(`<p>${esc(src.correctionsNote[`${c.date}|${c.piece}`])}</p>`);
  html.push(`<p>Todas as correções estão em <a href="${ORIGIN}/correcoes/">olhamisto.com/correcoes</a>.</p>`);
}
html.push(`<hr>`,
  `<p><em>Feito por IA. O Olhamisto é investigado, escrito, visualizado e verificado por agentes de inteligência artificial, sem revisão humana prévia. Cada peça indica as fontes e o método, e os erros corrigem-se em público. <a href="${ORIGIN}/metodologia/">Como funciona</a>.</em></p>`,
  `<p>${esc(src.signoff)}</p>`, `<p><strong>Olhamisto</strong> — Antes de opinar, olha-me isto.</p>`);

const doc = `<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Olhamisto — newsletter n.º ${src.number}</title>
<style>body{max-width:640px;margin:2rem auto;padding:0 16px;font:17px/1.55 Georgia,serif;color:#1d1b18;background:#fbf8f2}img{max-width:100%;height:auto}a{color:#b23a1e}h1,h2,h3{font-family:Georgia,serif;line-height:1.2}</style>
</head><body>
${html.join("\n")}
</body></html>
`;

fs.mkdirSync(path.join(OUT, "imagens"), { recursive: true });
fs.writeFileSync(path.join(OUT, "email.html"), doc);
for (const id of new Set([...src.highlights, ...src.notes].map((x) => x.piece))) fs.copyFileSync(path.join(ROOT, "public/og", `${id}.png`), path.join(OUT, "imagens", `${id}.png`));

const notes = src.notes.map((n, i) => {
  const p = pieces.get(n.piece);
  return `## Nota ${i + 1}\n\n${n.text} Feito por IA.\n\nImagem: \`imagens/${n.piece}.png\` · Ligação (opcional, na resposta à nota): ${pieceUrl(p.date, p.id)}\n`;
}).join("\n");
fs.writeFileSync(path.join(OUT, "notas.md"), `# Notes da newsletter n.º ${src.number}\n\nUma por dia, a partir do dia do envio. Texto curto, sem pedir subscrições. A etiqueta «Feito por IA.» faz parte do texto de cada nota (AI Act, art. 50.º, n.º 4): não a retires.\n\n${notes}`);

fs.writeFileSync(path.join(OUT, "LEIAME.md"), `# Newsletter n.º ${src.number} — como publicar no Substack

**Título:** ${src.title}
**Subtítulo:** ${src.subtitle}

1. Abrir \`email.html\` num navegador, selecionar tudo (Ctrl/Cmd+A) e copiar.
2. No Substack: *New post* → colar no corpo. Apagar o primeiro título e o subtítulo colados e escrevê-los nos campos próprios (acima).
3. Confirmar que as ${src.highlights.length} imagens aparecem. Se alguma faltar, carregá-la a partir de \`imagens/\`.
4. Pré-visualizar no telemóvel (*Preview* → *Email*), enviar um teste a ti próprio e agendar.
5. Publicar as Notes de \`notas.md\`, uma por dia, com a imagem indicada.

Gerado por \`node tools/newsletter.mjs ${srcArg}\` a ${new Date().toISOString().slice(0, 10)}. Números conferidos automaticamente contra as peças; texto sujeito a verificação independente (agente H).
`);

console.log(`newsletter n.º ${src.number}: OK → ${path.relative(ROOT, OUT)}/ (${src.highlights.length} destaques, ${src.notes.length} notas, ${inRange.length} correções)`);
