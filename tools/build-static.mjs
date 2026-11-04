// Gera o site publicável em public/ a partir de site/ (fonte) e site/data/ (conteúdo).
// Uso: node tools/build-static.mjs
// Produz: uma página HTML por edição (/AAAA/MM/DD/) e por peça (/AAAA/MM/DD/<id>/), páginas fixas,
// feed RSS (/feed.xml), sitemap, robots.txt e 404. O conteúdo textual vai pré-renderizado no HTML
// (motores de pesquisa, pré-visualizações nas redes, leitura sem JavaScript); os gráficos são montados
// no navegador pelo assets/js/app.js. Imagens de partilha: tools/og-images.mjs (passo seguinte).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "site");
const OUT = path.join(ROOT, "public");
export const ORIGIN = process.env.SITE_ORIGIN || "https://olhamisto.com";
const SITE = "Olhamisto";
const TAGLINE = "Antes de opinar, olha-me isto.";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const edUrl = (d) => `/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/`;
const pieceUrl = (d, id) => `${edUrl(d)}${id}/`;
const dateLong = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const clip = (s, n = 200) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n - 1)) + "…"; };

function copyDir(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const e of fs.readdirSync(a, { withFileTypes: true })) {
    const s = path.join(a, e.name), d = path.join(b, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
function write(rel, content) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

// --- Limpa public/ preservando as imagens de partilha já geradas (cache)
const ogKeep = path.join(ROOT, ".og-cache");
if (fs.existsSync(path.join(OUT, "og"))) { fs.rmSync(ogKeep, { recursive: true, force: true }); fs.renameSync(path.join(OUT, "og"), ogKeep); }
// Esvazia public/ sem apagar a própria pasta (um servidor local a servi-la continua a funcionar)
fs.mkdirSync(OUT, { recursive: true });
for (const e of fs.readdirSync(OUT)) fs.rmSync(path.join(OUT, e), { recursive: true, force: true });
copyDir(path.join(SRC, "assets"), path.join(OUT, "assets"));
copyDir(path.join(SRC, "data"), path.join(OUT, "data"));
fs.copyFileSync(path.join(SRC, "favicon.svg"), path.join(OUT, "favicon.svg"));
if (fs.existsSync(ogKeep)) { fs.renameSync(ogKeep, path.join(OUT, "og")); } else fs.mkdirSync(path.join(OUT, "og"));

// Versões dos ficheiros (impressão digital do conteúdo): cada alteração muda o endereço e obriga o navegador a recarregar
import crypto from "node:crypto";
const ver = (rel) => crypto.createHash("sha1").update(fs.readFileSync(path.join(SRC, rel))).digest("hex").slice(0, 10);
const V = { V_CSS: ver("assets/css/main.css"), V_APP: ver("assets/js/app.js") + ver("assets/js/charts.js").slice(0, 4) };
const appOut = path.join(OUT, "assets/js/app.js");
fs.writeFileSync(appOut, fs.readFileSync(appOut, "utf8").replace('from "./charts.js"', `from "./charts.js?v=${ver("assets/js/charts.js")}"`));
const TPL = fs.readFileSync(path.join(SRC, "template.html"), "utf8").replace(/\{\{(V_CSS|V_APP)\}\}/g, (_, k) => V[k]);
const index = JSON.parse(fs.readFileSync(path.join(SRC, "data", "index.json"), "utf8"));
const editions = index.editions.map((e) => JSON.parse(fs.readFileSync(path.join(SRC, "data", "editions", `${e.date}.json`), "utf8")));

function page({ url, title, ogTitle, description, ogType = "website", ogImage, route, mastDate = "", content, jsonld }) {
  const fill = {
    TITLE: esc(title), OG_TITLE: esc(ogTitle || title), DESCRIPTION: esc(clip(description, 200)),
    CANONICAL: ORIGIN + url, OG_TYPE: ogType, OG_IMAGE: ORIGIN + (ogImage || "/og/site.png"),
    ROUTE: JSON.stringify(route).replace(/</g, "\\u003c"), MAST_DATE: esc(mastDate), CONTENT: content,
    JSONLD: jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : "",
  };
  return TPL.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in fill ? fill[k] : ""));
}

// Pré-renderização textual de uma peça (substituída pela versão interativa quando o JavaScript corre)
function pieceStatic(p, date, i, heading = "h2") {
  const src = p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></li>`).join("");
  return `<article class="piece" id="p-${p.id}">
  <div class="kicker"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="kind">${p.kind === "atualidade" ? "Atualidade" : "Descoberta"}</span><span>${esc(p.themeLabel)}</span><span class="ai-tag">Feito por IA</span></div>
  <${heading}><a class="title-link" href="${pieceUrl(date, p.id)}">${esc(p.title)}</a></${heading}>
  <p class="text">${esc(p.context)}</p>
  <figure class="figure"><p class="fig-title">${esc(p.unit)}</p><p class="fig-sub">${esc(p.period)}</p>
    <p class="empty">Visualização interativa: ative o JavaScript para a ver. Descoberta principal: ${esc(p.finding)}</p></figure>
  <p class="text">${esc(p.interpretation)}</p>
  <details class="meta"><summary>Fontes e método</summary><div class="meta-body"><ul>${src}</ul><ul>${p.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div></details>
</article>`;
}
const aiNote = `<p class="ai-banner"><strong>Feito por IA.</strong> Investigado, escrito e visualizado por agentes de inteligência artificial e verificado por um segundo agente. <a href="/metodologia/">Como funciona</a> · <a href="/correcoes/">Correções</a></p>`;
const org = { "@type": "Organization", name: SITE, url: ORIGIN, email: "contacto@olhamisto.com", founder: { "@type": "Person", name: "Pedro Silva", url: "https://pedroxaviersilva.eu/" } };

const urls = [];
function edition(ed, { home = false } = {}) {
  const lead = ed.pieces.find((p) => p.id === ed.lead) || ed.pieces[0];
  const url = home ? "/" : edUrl(ed.date);
  const title = home ? `${SITE} — ${TAGLINE}` : `Edição n.º ${ed.number}, ${dateLong(ed.date)} — ${SITE}`;
  const content = `<h1 class="sr-only">${esc(home ? `${SITE}: edição n.º ${ed.number}` : `Edição n.º ${ed.number}`)}</h1>
<div class="edition-bar"><span><strong>Edição n.º ${ed.number}</strong> · ${esc(dateLong(ed.date))}</span><span class="edition-nav"><a href="/arquivo/">Arquivo</a></span></div>${aiNote}
<p class="opening">${esc(ed.opening)}</p>
${ed.pieces.map((p, i) => pieceStatic(p, ed.date, i)).join("\n")}`;
  return page({
    url, title, ogTitle: home ? `${SITE}: ${lead.title}` : title,
    description: `${ed.opening}`, ogImage: `/og/${lead.id}.png`,
    route: { view: "edition", date: ed.date }, mastDate: dateLong(ed.date), content,
    jsonld: { "@context": "https://schema.org", "@type": "CollectionPage", name: title, url: ORIGIN + url, datePublished: ed.date, publisher: org, isAccessibleForFree: true, inLanguage: "pt-PT",
      hasPart: ed.pieces.map((p) => ({ "@type": "NewsArticle", headline: p.title, url: ORIGIN + pieceUrl(ed.date, p.id) })) },
  });
}

editions.forEach((ed, k) => {
  if (k === 0) { write("index.html", edition(ed, { home: true })); urls.push({ loc: "/", lastmod: ed.date }); }
  write(path.join(edUrl(ed.date), "index.html"), edition(ed)); urls.push({ loc: edUrl(ed.date), lastmod: ed.date });
  ed.pieces.forEach((p, i) => {
    const url = pieceUrl(ed.date, p.id);
    write(path.join(url, "index.html"), page({
      url, title: `${p.title} — ${SITE}`, ogTitle: p.title, description: p.finding || p.context, ogType: "article", ogImage: `/og/${p.id}.png`,
      route: { view: "piece", date: ed.date, piece: p.id }, mastDate: dateLong(ed.date),
      content: `<div class="edition-bar"><span><a href="${edUrl(ed.date)}"><strong>Edição n.º ${ed.number}</strong></a> · ${esc(dateLong(ed.date))}</span></div>${aiNote}\n${pieceStatic(p, ed.date, i, "h1")}`,
      jsonld: { "@context": "https://schema.org", "@type": "NewsArticle", headline: p.title, description: p.finding, datePublished: ed.date, dateModified: p.verification?.date || ed.date,
        image: [ORIGIN + `/og/${p.id}.png`], author: org, publisher: org, isAccessibleForFree: true, inLanguage: "pt-PT", mainEntityOfPage: ORIGIN + url,
        citation: p.sources.map((s) => s.url), about: p.themeLabel },
    }));
    urls.push({ loc: url, lastmod: p.verification?.date || ed.date });
  });
});

// A redação: os agentes, com nomes e manias inventados; cargos e regras reais
const STAFF = [
  ["A", "Edite", "Diretora editorial", "Escolhe as cinco histórias do dia entre 12 a 20 candidatas, garante a variedade de temas e decide qual abre a edição.", "Tem sempre razão. Quando não tem, chama o Tomé."],
  ["B", "Aurora", "Repórter de atualidade", "Procura o que aconteceu nos últimos dias e que os números explicam melhor do que as manchetes.", "Entra às 7h15 e às 7h16 já leu tudo."],
  ["C", "Cristóvão", "Caçador de descobertas", "Vai atrás de séries longas, estudos esquecidos e relações inesperadas, que não precisam de ser notícia para valerem a pena.", "Já descobriu três vezes o caminho marítimo para o Eurostat."],
  ["D", "Fonseca", "Investigador de dados", "Encontra as fontes primárias, transcreve os dados sem lhes tocar e regista de onde vieram e quando.", "Nunca arredonda sem avisar. Nunca."],
  ["E", "Mediana", "Analista estatística", "Faz as contas, verifica se as comparações fazem sentido e trava conclusões que os dados não sustentam.", "Recusa-se a ser confundida com a média."],
  ["F", "Íris", "Jornalista visual", "Escolhe a forma de cada gráfico, o título, as anotações e o que o olho deve ver primeiro.", "Tem uma relação complicada com os gráficos circulares."],
  ["G", "Gil", "Designer e programador", "Desenha os gráficos, os mapas e as interações e garante que tudo funciona no telemóvel.", "Alinha píxeis por desporto."],
  ["H", "Tomé", "Verificador independente", "Não participa na produção. Confere valores, escalas, legendas e afirmações contra as fontes antes de qualquer peça ser publicada.", "Desconfia de tudo, incluindo desta frase."],
];
const staffHTML = `<div class="page-head prose"><h1>A redação</h1>
<p class="text">Todas as manhãs, uma equipa de oito agentes de inteligência artificial (todos instâncias de Claude, da Anthropic) faz uma edição do princípio ao fim. Os cargos e as regras são reais. Os nomes e as manias foram inventados por nós.</p></div>
<div class="staff">${STAFF.map(([l, n, r, d, q]) => `<article><div class="letter" aria-hidden="true">${l}</div><h2>${esc(n)}</h2><p class="role">${esc(r)}</p><p>${esc(d)}</p><p class="quirk">${esc(q)}</p></article>`).join("")}
<article class="human"><div class="letter" aria-hidden="true">✦</div><h2>Pedro Silva</h2><p class="role">O humano</p><p>Concebeu a redação, escreveu as regras editoriais e de rigor e montou o processo de verificação e publicação. Não escreve as peças.</p><p class="quirk">É o único da equipa que bebe café.</p><p><a href="https://pedroxaviersilva.eu/" rel="author">pedroxaviersilva.eu</a></p></article></div>
<p class="text">Horário de serviço: de segunda a sexta, a partir das 7h15. A edição sai por volta das 8h00. <a href="/metodologia/">Como funciona, em detalhe</a>.</p>`;
write("redacao/index.html", page({ url: "/redacao/", title: `A redação — ${SITE}`, description: "Os oito agentes de inteligência artificial que fazem o Olhamisto todas as manhãs, e o humano que os pôs a trabalhar.", route: { view: "redacao" }, mastDate: "A redação", content: staffHTML }));
urls.push({ loc: "/redacao/", lastmod: editions[0].date });

// Páginas fixas (conteúdo montado pela aplicação; texto mínimo pré-renderizado)
const fixed = {
  arquivo: ["Arquivo", "Todas as edições e peças, com pesquisa e filtros por tema e tipo de visualização."],
  favoritos: ["Favoritos", "As peças que guardou neste navegador."],
  metodologia: ["Como funciona", "Como são escolhidas, verificadas e visualizadas as cinco histórias diárias, feitas por agentes de inteligência artificial."],
  correcoes: ["Correções", "Registo público de correções às peças publicadas."],
};
for (const [slug, [t, d]] of Object.entries(fixed)) {
  write(`${slug}/index.html`, page({ url: `/${slug}/`, title: `${t} — ${SITE}`, description: d, route: { view: slug }, mastDate: t,
    content: `<div class="page-head prose"><h1>${esc(t)}</h1><p class="text">${esc(d)}</p></div>` }));
  if (slug !== "favoritos") urls.push({ loc: `/${slug}/`, lastmod: editions[0].date });
}
write("404.html", page({ url: "/404.html", title: `Página não encontrada — ${SITE}`, description: "Esta página não existe.", route: { view: "edition" },
  content: `<div class="page-head prose"><h1>Olha-me isto… não está aqui.</h1><p class="text">Dois agentes procuraram esta página e nenhum a encontrou. Pode ter mudado de sítio ou nunca ter existido.</p><p class="text"><a href="/">Ver a edição mais recente</a> ou <a href="/arquivo/">procurar no arquivo</a>.</p></div>` }));

// Imagens de partilha: tamanho real (exigido pelo RSS) — corre build-static de novo depois de og-images se forem novas
const ogSize = (id) => { try { return fs.statSync(path.join(OUT, "og", `${id}.png`)).size; } catch { return 0; } };
// RSS: um item por edição (adequado a envio automático por email a partir do feed)
const rfc822 = (d) => new Date(d + "T07:00:00Z").toUTCString();
const items = editions.slice(0, 30).map((ed) => {
  const lead = ed.pieces.find((p) => p.id === ed.lead) || ed.pieces[0];
  const html = `<p>${esc(ed.opening)}</p><ul>${ed.pieces.map((p) => `<li><a href="${ORIGIN + pieceUrl(ed.date, p.id)}"><strong>${esc(p.title)}</strong></a><br>${esc(p.finding)}</li>`).join("")}</ul><p><em>Feito por IA: investigado, escrito e visualizado por agentes de inteligência artificial e verificado por um segundo agente.</em></p>`;
  return `<item><title>${esc(`Edição n.º ${ed.number}: ${lead.title}`)}</title><link>${ORIGIN + edUrl(ed.date)}</link><guid isPermaLink="true">${ORIGIN + edUrl(ed.date)}</guid><pubDate>${rfc822(ed.date)}</pubDate>${ogSize(lead.id) ? `<enclosure url="${ORIGIN}/og/${lead.id}.png" type="image/png" length="${ogSize(lead.id)}"/>` : ""}<description>${esc(html)}</description></item>`;
}).join("\n");
write("feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${SITE}</title><link>${ORIGIN}/</link><description>${esc(TAGLINE)} Cinco histórias por dia útil, contadas em gráficos. Feito por IA.</description><language>pt-PT</language>
<atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/><lastBuildDate>${rfc822(editions[0].date)}</lastBuildDate>
${items}
</channel></rss>`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${ORIGIN + u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}\n</urlset>`);
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);
write("_headers", `/assets/vendor/*\n  Cache-Control: public, max-age=604800\n/assets/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n/assets/geo/*\n  Cache-Control: public, max-age=604800\n/assets/js/*\n  Cache-Control: public, max-age=3600\n/assets/css/*\n  Cache-Control: public, max-age=3600\n/og/*\n  Cache-Control: public, max-age=86400\n/data/*\n  Cache-Control: public, max-age=300\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n`);
console.log(`public/: ${urls.length} URLs no sitemap, ${editions.length} edições, ${editions.reduce((a, e) => a + e.pieces.length, 0)} peças; feed com ${Math.min(30, editions.length)} itens`);
