// Olhamisto — aplicação (sem compilação; módulos ES nativos).
import { CHARTS, dataTable, toCSV } from "./charts.js?v=eadcfdeeed";
import { chaveHTML } from "./chave.js?v=98a2bedc36";

const $ = (s, el = document) => el.querySelector(s);
const main = $("#conteudo");
const store = {
  get(k, d) { try { const v = localStorage.getItem("rv." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("rv." + k, JSON.stringify(v)); } catch { /* armazenamento indisponível */ } },
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SITE = "Olhamisto";
export const edUrl = (d) => `/${d.slice(0, 4)}/${d.slice(5, 7)}/${d.slice(8, 10)}/`;
export const pieceUrl = (d, id) => `${edUrl(d)}${id}/`;
const dateLong = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateShort = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short", year: "numeric" });
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2400); }

let INDEX = null;
const editionCache = new Map();
const datasetCache = new Map();
const live = []; // gráficos ativos (para destruir ao mudar de vista)

async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }
const loadIndex = async () => (INDEX ??= await getJSON("/data/index.json"));
async function loadEdition(date) { if (!editionCache.has(date)) editionCache.set(date, await getJSON(`/data/editions/${date}.json`)); return editionCache.get(date); }
async function loadDataset(id) { if (!datasetCache.has(id)) datasetCache.set(id, await getJSON(`/data/datasets/${id}/data.json`)); return datasetCache.get(id); }

/* ---------- Capacidades da plataforma (opcionais) ---------- */
let dbP = null, dlP = null;
function useCap(name) { try { return window.claude?.use ? window.claude.use(name) : Promise.resolve(null); } catch { return Promise.resolve(null); } }
const getDB = () => (dbP ??= useCap("db").catch(() => null));
const getDownloads = () => (dlP ??= useCap("downloads").catch(() => null));

/* ---------- Preferências ---------- */
function applyTheme(t) { document.documentElement.dataset.theme = t; store.set("theme", t); live.forEach((c) => c.redraw?.()); }
$("#btn-theme").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
function applySize(l) { document.body.classList.toggle("size-l", l); $("#btn-size").setAttribute("aria-pressed", String(l)); store.set("size", l ? "l" : "m"); }
$("#btn-size").addEventListener("click", () => applySize(!document.body.classList.contains("size-l")));
applySize(store.get("size", "m") === "l");
if (!store.get("theme", null)) { /* respeita o sistema até haver escolha */ }

/* ---------- Favoritos, histórico, feedback ---------- */
const favs = () => store.get("favs", []);
function toggleFav(id) { const f = favs(); const i = f.indexOf(id); i >= 0 ? f.splice(i, 1) : f.unshift(id); store.set("favs", f); return i < 0; }
function markSeen(id) { const h = store.get("seen", {}); if (!h[id]) { h[id] = new Date().toISOString(); store.set("seen", h); } }
const votes = () => store.get("votes", {});
async function vote(piece, edition, v) {
  const all = votes(); all[piece.id] = all[piece.id] === v ? null : v; store.set("votes", all);
  const db = await getDB();
  if (db) {
    try {
      const ref = db.doc(`feedback/${piece.id}`);
      if (all[piece.id]) await ref.set({ pieceId: piece.id, edition, theme: piece.theme, vizType: piece.vizType, vote: all[piece.id], at: new Date().toISOString() });
      else await ref.delete();
    } catch (e) { console.warn("feedback não sincronizado", e); }
  }
  return all[piece.id];
}

/* ---------- Exportação ---------- */
function inlineStyles(src, dst) {
  const props = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-size", "font-weight", "font-family", "paint-order", "text-anchor"];
  const a = src.querySelectorAll("*"), b = dst.querySelectorAll("*");
  a.forEach((el, i) => { const cs = getComputedStyle(el); b[i].setAttribute("style", props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";")); });
}
function svgString(svg, title) {
  const c = svg.cloneNode(true); inlineStyles(svg, c);
  const vb = svg.viewBox.baseVal;
  c.insertAdjacentHTML("afterbegin", `<rect x="0" y="0" width="${vb.width}" height="${vb.height}" fill="${getComputedStyle(document.documentElement).getPropertyValue("--card")}"/><title>${esc(title)}</title>`);
  return new XMLSerializer().serializeToString(c);
}
async function saveFile(filename, data, mime) {
  const dl = await getDownloads();
  if (dl) {
    try { await dl.save({ filename, data: data instanceof Blob ? data : new Blob([data], { type: mime }) }); toast("Ficheiro guardado"); return; }
    catch (e) { if (e?.code === "cancelled" || /cancel|declin/i.test(e?.message || "")) return; console.warn(e); }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return;
  } catch { /* segue para a cópia */ }
  if (typeof data === "string") {
    try { await navigator.clipboard.writeText(data); toast("Conteúdo copiado"); return; } catch { /* sem clipboard */ }
  }
  toast("Exportação indisponível neste visualizador");
}
// PNG completo: título da peça, título e período do gráfico, gráfico, legenda, «como ler», fonte e assinatura.
// O SVG do gráfico é rasterizado e o resto é desenhado no canvas com as fontes do site.
function wrapLines(ctx, text, maxW) {
  const out = []; let line = "";
  for (const w of String(text || "").split(/\s+/).filter(Boolean)) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function figureMeta(fig) {
  if (!fig) return {};
  const txt = (sel) => fig.querySelector(sel)?.textContent.trim() || "";
  const legend = [...fig.querySelectorAll(".fig-legend .legend li")].map((li) => {
    const i = li.querySelector("i"), cs = i ? getComputedStyle(i) : null;
    return { label: li.textContent.trim(), color: cs ? (cs.backgroundColor !== "rgba(0, 0, 0, 0)" ? cs.backgroundColor : cs.borderTopColor) : "#888",
      line: i?.classList.contains("line"), dot: i?.classList.contains("dot"), ring: cs && cs.backgroundColor === "rgba(0, 0, 0, 0)", opacity: cs ? +cs.opacity : 1 };
  });
  const src = fig.querySelector(".fig-foot > span:first-child")?.cloneNode(true);
  src?.querySelectorAll(".badge").forEach((b) => b.remove());
  return { figTitle: txt(".fig-title"), sub: txt(".fig-sub"), howTo: txt(".fig-legend .how-to-read"), legend,
    source: (src?.textContent || "").replace(/\s*·\s*$/, "").replace(/\s+/g, " ").trim(), verified: !!fig.querySelector(".badge.ok") };
}
async function exportPNG(svg, filename, title, fig) {
  const s = svgString(svg, title); const vb = svg.viewBox.baseVal; const k = 2;
  const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
  await img.decode();
  try { await Promise.all(["600 15px 'IBM Plex Sans'", "400 12px 'IBM Plex Sans'", "700 22px Fraunces"].map((f) => document.fonts.load(f))); } catch { /* usa as fontes de recurso */ }
  const m = figureMeta(fig), cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue(n).trim();
  const SANS = "'IBM Plex Sans', 'Segoe UI', system-ui, sans-serif", SERIF = "Fraunces, Georgia, serif";
  const pad = 28, W = Math.round(vb.width) + pad * 2, inner = W - pad * 2;
  const probe = document.createElement("canvas").getContext("2d");
  // 1) medir
  probe.font = `700 22px ${SERIF}`; const head = wrapLines(probe, title, inner);
  probe.font = `600 14px ${SANS}`; const ft = m.figTitle ? wrapLines(probe, m.figTitle, inner) : [];
  probe.font = `400 12px ${SANS}`; const sub = m.sub ? wrapLines(probe, m.sub, inner) : [];
  const how = m.howTo ? wrapLines(probe, m.howTo, inner) : [];
  probe.font = `400 12.5px ${SANS}`;
  const legRows = []; let row = [], x = 0;
  for (const it of m.legend || []) { const w = 22 + probe.measureText(it.label).width + 18; if (x + w > inner && row.length) { legRows.push(row); row = []; x = 0; } row.push({ ...it, x }); x += w; }
  if (row.length) legRows.push(row);
  probe.font = `400 11.5px ${SANS}`; const src = m.source ? wrapLines(probe, m.source, inner) : [];
  const H = pad + head.length * 28 + 10 + ft.length * 19 + sub.length * 17 + 10 + vb.height + 10 + legRows.length * 22 + how.length * 17 + 6 + 8 + src.length * 16 + 30 + pad + 40; // margem; recorta-se no fim
  // 2) desenhar
  const cv = document.createElement("canvas"); cv.width = W * k; cv.height = Math.ceil(H) * k;
  const g = cv.getContext("2d"); g.scale(k, k); g.textBaseline = "alphabetic";
  g.fillStyle = v("--card") || "#fbf9f4"; g.fillRect(0, 0, W, H);
  let y = pad;
  g.fillStyle = v("--ink"); g.font = `700 22px ${SERIF}`; for (const l of head) { y += 24; g.fillText(l, pad, y); y += 4; }
  y += 10;
  g.font = `600 14px ${SANS}`; for (const l of ft) { y += 16; g.fillText(l, pad, y); y += 3; }
  g.fillStyle = v("--ink-3"); g.font = `400 12px ${SANS}`; for (const l of sub) { y += 14; g.fillText(l, pad, y); y += 3; }
  y += 10;
  g.drawImage(img, pad, y, vb.width, vb.height); y += vb.height + 10;
  g.font = `400 12.5px ${SANS}`;
  for (const r of legRows) {
    y += 16;
    for (const it of r) {
      const sx = pad + it.x; g.globalAlpha = it.opacity || 1;
      if (it.line) { g.fillStyle = it.color; g.fillRect(sx, y - 6, 18, 3); }
      else if (it.ring) { g.strokeStyle = it.color; g.lineWidth = 2; g.beginPath(); g.arc(sx + 6, y - 5, 5, 0, Math.PI * 2); g.stroke(); }
      else if (it.dot) { g.fillStyle = it.color; g.beginPath(); g.arc(sx + 6, y - 5, 6, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = it.color; g.fillRect(sx, y - 11, 12, 12); }
      g.globalAlpha = 1; g.fillStyle = v("--ink-2"); g.fillText(it.label, sx + 22, y);
    }
    y += 6;
  }
  g.fillStyle = v("--ink-2"); g.font = `400 12px ${SANS}`; for (const l of how) { y += 14; g.fillText(l, pad, y); y += 3; }
  if (how.length) y += 6;
  y += 8; g.fillStyle = v("--ink-3"); g.font = `400 11.5px ${SANS}`; for (const l of src) { y += 13; g.fillText(l, pad, y); y += 3; }
  y += 12; g.strokeStyle = v("--rule"); g.lineWidth = 1; g.beginPath(); g.moveTo(pad, y); g.lineTo(W - pad, y); g.stroke();
  y += 18; g.fillStyle = v("--ink"); g.font = `700 13px ${SERIF}`; g.fillText("Olhamisto", pad, y);
  const brandW = g.measureText("Olhamisto").width;
  g.fillStyle = v("--ink-3"); g.font = `400 11.5px ${SANS}`; g.fillText(" · olhamisto.com", pad + brandW, y);
  g.textAlign = "right"; g.fillText(m.verified ? "Feito por IA · verificado" : "Feito por IA", W - pad, y); g.textAlign = "left";
  const Hf = Math.ceil(y + pad - 8), out = document.createElement("canvas"); out.width = W * k; out.height = Hf * k;
  out.getContext("2d").drawImage(cv, 0, 0, W * k, Hf * k, 0, 0, W * k, Hf * k);
  const blob = await new Promise((r) => out.toBlob(r, "image/png"));
  await saveFile(filename, blob, "image/png");
}

/* ---------- Renderização de uma peça ---------- */
function pieceHTML(p, i, edition, opts = {}) {
  const fav = favs().includes(p.id), v = votes()[p.id];
  const ver = p.verification || {};
  const badge = ver.status === "verificada" ? `<span class="badge ok">verificada</span>` : `<span class="badge partial" title="${esc(ver.note || "")}">verificação parcial</span>`;
  return `
  <article class="piece ${opts.cls || ""}" id="p-${p.id}" data-id="${p.id}" aria-labelledby="h-${p.id}">
    <div class="piece-text">
      <div class="kicker"><span class="num">${String(i + 1).padStart(2, "0")}</span><span class="kind">${p.kind === "atualidade" ? "Atualidade" : "Descoberta"}</span><span>${esc(p.themeLabel)}</span><span>${esc(p.vizLabel)}</span><a class="ai-tag" href="/metodologia/" title="Investigado, escrito e visualizado por IA; verificado por um agente verificador independente de IA">Feito por IA</a></div>
      <h2 id="h-${p.id}"><a class="title-link" href="${pieceUrl(edition, p.id)}">${esc(p.title)}</a></h2>
      <p class="text context">${esc(p.context)}</p>
    </div>
    <figure class="figure" aria-labelledby="h-${p.id}">
      <div class="fig-head"><div><p class="fig-title">${esc(p.unit)}</p><p class="fig-sub">${esc(p.period)}</p></div><div class="fig-controls"></div></div>
      <div class="chart" data-chart="${p.chart.type}"></div>
      <div class="fig-legend"></div>
      <figcaption class="fig-foot">
        <span>Fonte: ${[...new Set(p.sources.filter((s) => !/secundária|geometrias|cópia/.test(s.name)).map((s) => s.name.split(" — ")[0].split(",")[0].replace(/ \(.*$/, "")))].map(esc).join("; ")} · ${badge}</span>
        <span class="fig-actions">
          <button class="icon-btn" data-act="zoom" type="button">Ampliar</button>
          <button class="icon-btn" data-act="png" type="button">PNG</button>
          <button class="icon-btn" data-act="svg" type="button">SVG</button>
          <button class="icon-btn" data-act="csv" type="button">Dados</button>
        </span>
      </figcaption>
    </figure>
    <p class="text after interpretation">${esc(p.interpretation)}</p>
    <div class="fig-actions" style="margin-top:.2rem">
      <button class="icon-btn up fb" hidden data-act="up" type="button" aria-pressed="${v === "up"}">Gostei</button>
      <button class="icon-btn down fb" hidden data-act="down" type="button" aria-pressed="${v === "down"}">Não me interessou</button>
      <button class="icon-btn" data-act="fav" type="button" aria-pressed="${fav}">${fav ? "★ Guardado" : "☆ Guardar"}</button>
      <a class="icon-btn" href="${pieceUrl(edition, p.id)}" data-act="link">Ligação</a>
      <button class="icon-btn" data-act="share" type="button">Partilhar</button>
    </div>
    <details class="meta">
      <summary>Fontes, método e dados</summary>
      <div class="meta-body">
        <dl class="meta-grid">
          <dt>Pergunta</dt><dd>${esc(p.question)}</dd>
          <dt>Descoberta</dt><dd>${esc(p.finding)}</dd>
          <dt>Período</dt><dd>${esc(p.period)}</dd>
          <dt>Unidade</dt><dd>${esc(p.unit)}</dd>
          <dt>Verificação</dt><dd>${badge} ${esc(ver.date || "")} ${ver.note ? "— " + esc(ver.note) : ""}</dd>
          <dt>Identificador</dt><dd><code>${edition}/${p.id}</code></dd>
        </dl>
        <strong>Fontes</strong>
        <ul>${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a> <span style="color:var(--ink-3)">(consultado ${dateShort(s.accessed)})</span></li>`).join("")}</ul>
        <strong>Notas metodológicas</strong>
        <ul>${p.method.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>
        <strong>Dados</strong>
        <div class="data-table"><button class="icon-btn" data-act="table" type="button">Mostrar tabela de dados</button></div>
        <p style="font-size:.78rem;color:var(--ink-3)">Ficheiros: <code>data/datasets/${p.chart.dataset}/data.json</code> (transformados) e <code>data/datasets/${p.chart.dataset}/raw/</code> (originais transcritos).</p>
      </div>
    </details>
  </article>`;
}

async function mountPiece(article, p, edition, ctx = {}) {
  const data = await loadDataset(p.chart.dataset);
  const host = { chart: $(".chart", article), controls: $(".fig-controls", article), legend: $(".fig-legend", article) };
  host.chart.innerHTML = ""; host.controls.innerHTML = ""; host.legend.innerHTML = "";
  const c = CHARTS[p.chart.type](host, data, ctx);
  live.push(c);
  const svgOf = () => host.chart.querySelector(".map svg") || host.chart.querySelector("svg");
  getDB().then((db) => { if (db) article.querySelectorAll(".fb").forEach((b) => (b.hidden = false)); });
  article.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const act = b.dataset.act;
    if (act === "share") {
      const url = location.origin + pieceUrl(edition, p.id);
      try { if (navigator.share) { await navigator.share({ title: p.title, text: `${p.title} — ${SITE}`, url }); return; } } catch { return; }
      try { await navigator.clipboard.writeText(url); toast("Ligação copiada"); } catch { toast(url); }
    } else if (act === "zoom") openModal(p, edition);
    else if (act === "png") exportPNG(svgOf(), `olhamisto-${edition}-${p.id}.png`, p.title, article.querySelector(".figure")).catch(() => toast("Não foi possível gerar o PNG"));
    else if (act === "svg") saveFile(`olhamisto-${edition}-${p.id}.svg`, svgString(svgOf(), p.title), "image/svg+xml");
    else if (act === "csv") saveFile(`olhamisto-${edition}-${p.id}.csv`, toCSV(p.chart.type, data), "text/csv");
    else if (act === "fav") { const on = toggleFav(p.id); b.setAttribute("aria-pressed", String(on)); b.textContent = on ? "★ Guardado" : "☆ Guardar"; toast(on ? "Guardado nos favoritos" : "Removido dos favoritos"); }
    else if (act === "up" || act === "down") {
      const res = await vote(p, edition, act);
      article.querySelectorAll('[data-act="up"],[data-act="down"]').forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.act === res)));
      toast(res ? "Obrigado — avaliação registada" : "Avaliação removida");
    } else if (act === "table") { b.parentElement.innerHTML = dataTable(p.chart.type, data); }
  });
}

/* ---------- Vistas ---------- */
function clearLive() { while (live.length) live.pop().destroy?.(); }
const seenObserver = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting && e.intersectionRatio > 0.4) markSeen(e.target.dataset.id); }), { threshold: [0.4] });

async function viewEdition(date, focusId) {
  const idx = await loadIndex();
  date ??= idx.latest;
  const ed = await loadEdition(date);
  const pos = idx.editions.findIndex((e) => e.date === date);
  const prev = idx.editions[pos + 1], next = idx.editions[pos - 1];
  $("#mast-date").textContent = dateLong(date);
  const lead = ed.pieces.find((p) => p.id === ed.lead) || ed.pieces[0];
  const rest = ed.pieces.filter((p) => p !== lead);
  const layout = ["split", "wide", "split flip", "wide"];
  main.innerHTML = `
    <div class="edition-bar"><span><strong>Edição n.º ${ed.number}</strong> · ${dateLong(date)}<span class="ed-sched">${schedText()}</span></span>
      <span class="edition-nav">${prev ? `<a href="${edUrl(prev.date)}">← ${dateShort(prev.date)}</a>` : ""}${next ? `<a href="${edUrl(next.date)}">${dateShort(next.date)} →</a>` : ""}<a href="/arquivo/">Arquivo</a></span></div>
    <p class="ai-banner"><strong>Feito por IA.</strong> Esta edição foi investigada, escrita e visualizada por agentes de inteligência artificial e verificada por um agente verificador independente. Sem revisão humana prévia. <a href="/metodologia/">Como funciona</a> · <a href="/correcoes/">Correções</a></p>
    <p class="opening">${esc(ed.opening)}</p>
    ${pieceHTML(lead, 0, date, { cls: "lead" })}
    <div class="rest">${rest.map((p, i) => pieceHTML(p, i + 1, date, { cls: layout[i % layout.length] })).join("")}</div>
    ${chaveHTML(ed.chave, esc)}
    ${ed.limitations?.length ? `<aside class="notice"><strong>Notas de edição.</strong><ul>${ed.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></aside>` : ""}`;
  for (const p of ed.pieces) { const a = $(`#p-${p.id}`); await mountPiece(a, p, date); seenObserver.observe(a); }
  if (focusId) $(`#p-${focusId}`)?.scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
}

async function viewPiece(date, id) {
  const idx = await loadIndex();
  const ed = await loadEdition(date);
  const p = ed.pieces.find((x) => x.id === id);
  if (!p) return viewEdition(date);
  const i = ed.pieces.indexOf(p);
  $("#mast-date").textContent = dateLong(date);
  const others = ed.pieces.filter((x) => x !== p);
  main.innerHTML = `
    <div class="edition-bar"><span><a href="${edUrl(date)}"><strong>Edição n.º ${ed.number}</strong></a> · ${dateLong(date)}</span><span class="edition-nav"><a href="${edUrl(date)}">Edição completa</a><a href="/arquivo/">Arquivo</a></span></div>
    <p class="ai-banner"><strong>Feito por IA.</strong> Investigado, escrito e visualizado por agentes de inteligência artificial e verificado por um agente verificador independente. <a href="/metodologia/">Como funciona</a> · <a href="/correcoes/">Correções</a></p>
    ${pieceHTML(p, i, date, { cls: "lead" })}
    <section class="page-head"><h2 style="font-size:1.4rem">Na mesma edição</h2></section>
    <div class="cards">${others.map((x) => cardHTML({ ...x, date })).join("")}</div>`;
  const a = $(`#p-${p.id}`); await mountPiece(a, p, date); seenObserver.observe(a);
  void idx;
}
async function viewCorrections() {
  $("#mast-date").textContent = "Correções";
  let list = [];
  try { list = (await getJSON("/data/corrections.json")).corrections || []; } catch { /* sem ficheiro */ }
  main.innerHTML = `<div class="page-head prose"><h2>Correções</h2>
    <p class="text"><strong>Errar é humano. Os agentes também conseguem.</strong> Quando acontece, fica aqui registado. Quando um valor, uma escala, uma fonte ou uma afirmação estiver errada, corrigimos a peça e registamos aqui o que mudou, quando e porquê. Nenhuma correção é silenciosa.</p>
    <p class="text">Encontrou um erro? Escreva para <strong>correcoes@olhamisto.com</strong> com a ligação da peça e a fonte que o demonstra.</p></div>
    ${list.length ? `<div class="cards">${list.map((c) => `<article class="card"><div class="kicker"><span class="kind">${dateShort(c.date)}</span></div><h3><a href="${pieceUrl(c.edition, c.piece)}">${esc(c.title)}</a></h3><p>${esc(c.change)}</p></article>`).join("")}</div>` : `<p class="empty">Ainda não há correções registadas.</p>`}`;
}
function allPieces(idx) { return idx.editions.flatMap((e) => e.pieces.map((p) => ({ ...p, date: e.date }))); }
function cardHTML(p) {
  const seen = store.get("seen", {})[p.id];
  return `<article class="card"><div class="kicker"><span class="kind">${p.kind === "atualidade" ? "Atualidade" : "Descoberta"}</span><span>${esc(p.themeLabel)}</span></div>
    <h3><a href="${pieceUrl(p.date, p.id)}">${esc(p.title)}</a></h3><p>${esc(p.finding)}</p>
    <p style="color:var(--ink-3);font-size:.78rem">${dateShort(p.date)} · ${esc(p.vizLabel)}${seen ? " · visto" : ""}${favs().includes(p.id) ? " · ★" : ""}</p></article>`;
}
async function viewArchive() {
  const idx = await loadIndex();
  const items = allPieces(idx);
  const themes = [...new Map(items.map((p) => [p.theme, p.themeLabel])).entries()];
  const vizs = [...new Set(items.map((p) => p.vizType))];
  $("#mast-date").textContent = "Arquivo";
  main.innerHTML = `<div class="page-head"><h2>Arquivo</h2><p class="text">${idx.editions.length} ${idx.editions.length === 1 ? "edição" : "edições"}, ${items.length} peças.</p></div>
    <ul class="edition-list">${idx.editions.map((e) => `<li><a href="${edUrl(e.date)}">${dateShort(e.date)} · n.º ${e.number}</a></li>`).join("")}</ul>
    <div class="filters" role="search">
      <label class="sr-only" for="q">Pesquisar</label><input id="q" type="search" placeholder="Pesquisar títulos, descobertas, fontes…">
      <label class="sr-only" for="ft">Tema</label><select id="ft"><option value="">Todos os temas</option>${themes.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select>
      <label class="sr-only" for="fv">Visualização</label><select id="fv"><option value="">Todas as visualizações</option>${vizs.map((v) => `<option>${v}</option>`).join("")}</select>
      <label class="sr-only" for="fk">Tipo</label><select id="fk"><option value="">Atualidade e descoberta</option><option value="atualidade">Atualidade</option><option value="descoberta">Descoberta</option></select>
    </div><div class="cards" id="cards"></div>`;
  const draw = () => {
    const q = $("#q").value.trim().toLowerCase(), t = $("#ft").value, v = $("#fv").value, k = $("#fk").value;
    const list = items.filter((p) => (!t || p.theme === t) && (!v || p.vizType === v) && (!k || p.kind === k)
      && (!q || [p.title, p.finding, p.question, p.themeLabel, ...(p.sourceNames || [])].join(" ").toLowerCase().includes(q)));
    $("#cards").innerHTML = list.length ? list.map(cardHTML).join("") : `<p class="empty">Nenhuma peça corresponde aos filtros.</p>`;
  };
  ["q", "ft", "fv", "fk"].forEach((id) => $("#" + id).addEventListener("input", draw));
  draw();
}
async function viewFavorites() {
  const idx = await loadIndex();
  const f = favs(); const items = allPieces(idx).filter((p) => f.includes(p.id)).sort((a, b) => f.indexOf(a.id) - f.indexOf(b.id));
  const seen = store.get("seen", {});
  const recent = allPieces(idx).filter((p) => seen[p.id]).sort((a, b) => seen[b.id].localeCompare(seen[a.id])).slice(0, 12);
  $("#mast-date").textContent = "Favoritos";
  main.innerHTML = `<div class="page-head"><h2>Favoritos</h2><p class="text">Guardados neste navegador.</p></div>
    <div class="cards">${items.length ? items.map(cardHTML).join("") : `<p class="empty">Ainda não guardou nenhuma peça. Use «☆ Guardar» por baixo de cada gráfico.</p>`}</div>
    <div class="page-head"><h2 style="font-size:1.5rem">Vistos recentemente</h2></div>
    <div class="cards">${recent.length ? recent.map(cardHTML).join("") : `<p class="empty">Sem histórico.</p>`}</div>`;
}
function viewMethod() {
  $("#mast-date").textContent = "Metodologia";
  main.innerHTML = `<div class="page-head prose"><h2>Metodologia editorial</h2>
  <p class="text"><strong>${SITE}</strong> publica, de segunda a sexta, até cinco histórias contadas sobretudo através de visualizações. Quando não há cinco com dados que aguentem verificação, publica menos. A regra principal: primeiro a história, depois o gráfico.</p>
  <h3>Feito por inteligência artificial</h3><p class="text">Cada edição é investigada, escrita e visualizada por agentes de inteligência artificial (Claude, da Anthropic), que pesquisam fontes públicas, transcrevem os dados, calculam, desenham os gráficos e redigem os textos. Um agente verificador independente, que não participou na produção, verifica valores, cálculos, escalas e afirmações contra as fontes antes da publicação. As edições são publicadas sem revisão humana prévia. Os erros são corrigidos e registados na página de <a href="/correcoes/">correções</a>.</p>
  <h3>Horário</h3><p class="text">Há uma edição nova de segunda a sexta-feira. Os agentes entram ao serviço às 7h15 (hora de Lisboa) e a edição é publicada por volta das 8h00, depois de verificada. Também se pode receber pelo <a href="/feed.xml">feed RSS</a>.</p>
  <h3>Seleção</h3><p class="text">Cada edição parte de 12 a 20 candidatas, avaliadas por importância (30%), potencial visual (25%), qualidade dos dados (25%), surpresa (10%) e interesse para o leitor (10%). Candidatas sem dados verificáveis são rejeitadas e registadas nas notas de edição.</p>
  <h3>Rigor</h3><p class="text">Nenhum dado é inventado ou interpolado sem indicação. As barras começam sempre no zero. É a única regra que nem a diretora editorial pode quebrar (e é uma agente muito teimosa). Séries de índice podem começar noutro valor, sempre assinalado.  Valores absolutos, percentagens e pontos percentuais são distinguidos. Correlação não é apresentada como causalidade.</p>
  <h3>Verificação</h3><p class="text">Um agente diferente do que constrói o gráfico confere valores, escalas, legendas, cálculos e correspondência com as fontes. O estado aparece em cada peça: <span class="badge ok">verificada</span> ou <span class="badge partial">verificação parcial</span>.</p>
  <h3>Dados</h3><p class="text">Os dados originais (transcritos sem alteração) e os transformados ficam separados em <code>/data/datasets/&lt;peça&gt;/raw/</code> e <code>data.json</code>, e cada peça permite descarregar os dados em CSV. O código e os scripts de transformação são públicos no <a href="https://github.com/pxardinario/olhamisto">repositório do projeto</a>.</p>
  <h3>Quem está por trás</h3><p class="text">${SITE} é um projeto de <a href="https://pedroxaviersilva.eu/" rel="author">Pedro Silva</a>, que concebeu o projeto e definiu as regras editoriais e de rigor, a equipa de agentes, o processo de verificação e a publicação automática. As peças são produzidas pelos agentes de IA; a responsabilidade pelo projeto é dele. Contacto: <strong>contacto@olhamisto.com</strong>.</p>
  <h3>Privacidade</h3><p class="text">Não há publicidade, cookies de rastreio nem contas. Favoritos, histórico e preferências de leitura ficam apenas no seu navegador.</p></div>`;
}

/* ---------- Modal ---------- */
async function openModal(p, edition) {
  const m = $("#modal"), body = $("#modal-body");
  body.innerHTML = `<h2 style="font-family:var(--serif);margin:.5rem 0 1rem">${esc(p.title)}</h2>
    <figure class="figure"><div class="fig-head"><div><p class="fig-title">${esc(p.unit)}</p><p class="fig-sub">${esc(p.period)}</p></div><div class="fig-controls"></div></div><div class="chart"></div><div class="fig-legend"></div></figure>`;
  m.classList.add("open"); document.body.style.overflow = "hidden";
  const data = await loadDataset(p.chart.dataset);
  const c = CHARTS[p.chart.type]({ chart: $(".chart", body), controls: $(".fig-controls", body), legend: $(".fig-legend", body) }, data, { large: true });
  m._chart = c; $("#modal-close").focus();
}
function closeModal() { const m = $("#modal"); if (!m.classList.contains("open")) return; m._chart?.destroy?.(); m.classList.remove("open"); $("#modal-body").innerHTML = ""; document.body.style.overflow = ""; }
$("#modal-close").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---------- Encaminhamento por endereço (com compatibilidade para #hash antigos) ---------- */
function parsePath() {
  const R = window.__OLHA__ || {};
  if (R.view) return R;
  const m = location.pathname.match(/^\/(\d{4})\/(\d{2})\/(\d{2})\/(?:([a-z0-9-]+)\/)?$/);
  if (m) return m[4] ? { view: "piece", date: `${m[1]}-${m[2]}-${m[3]}`, piece: m[4] } : { view: "edition", date: `${m[1]}-${m[2]}-${m[3]}` };
  const seg = location.pathname.split("/").filter(Boolean)[0];
  if (["arquivo", "favoritos", "metodologia", "correcoes", "redacao"].includes(seg)) return { view: seg };
  return { view: "edition" };
}
async function legacyHash() {
  const h = location.hash.slice(1);
  if (h.startsWith("e-")) { const [d, pid] = h.slice(2).split("--"); location.replace(pid ? pieceUrl(d, pid) : edUrl(d)); return true; }
  if (h.startsWith("p-") && !document.getElementById(h)) {
    const idx = await loadIndex(); const id = h.slice(2); const ed = idx.editions.find((e) => e.pieces.some((p) => p.id === id));
    if (ed) { location.replace(pieceUrl(ed.date, id)); return true; }
  }
  if (["arquivo", "favoritos", "metodologia"].includes(h)) { location.replace(`/${h}/`); return true; }
  return false;
}
async function route() {
  if (await legacyHash()) return;
  closeModal(); clearLive();
  const r = parsePath();
  const nav = (n) => document.querySelector(`[data-nav="${n}"]`)?.setAttribute("aria-current", "page");
  try {
    if (r.view === "arquivo") { nav("arquivo"); await viewArchive(); }
    else if (r.view === "favoritos") { nav("favoritos"); await viewFavorites(); }
    else if (r.view === "metodologia") { nav("metodologia"); viewMethod(); }
    else if (r.view === "redacao") { nav("redacao"); $("#mast-date").textContent = "A redação"; }
    else if (r.view === "correcoes") { viewCorrections(); await Promise.resolve(); }
    else if (r.view === "piece") { nav("hoje"); await viewPiece(r.date, r.piece); }
    else { nav("hoje"); await viewEdition(r.date, location.hash.startsWith("#p-") ? location.hash.slice(3) : undefined); }
  } catch (e) {
    console.error(e);
    main.innerHTML = `<p class="empty">Não foi possível carregar este conteúdo. ${esc(e.message)}</p>`;
  }
}
(function mobileMenu() {
  const btn = document.getElementById("menu-btn"), menu = document.getElementById("menu");
  if (!btn || !menu) return;
  const set = (open) => { menu.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  menu.addEventListener("click", (e) => { if (e.target.closest("nav a")) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { set(false); btn.focus(); } });
  document.addEventListener("click", (e) => { if (!e.target.closest(".mast-top")) set(false); });
})();
function schedText() {
  let wd = "";
  try { wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", weekday: "short" }).format(new Date()); } catch { /* sem Intl */ }
  return wd === "Sat" || wd === "Sun" ? "Fim de semana. Até os agentes precisam de desligar. Próxima edição: segunda-feira, por volta das 8h00." : "Sai de segunda a sexta, por volta das 8h00. Os agentes entram ao serviço às 7h15.";
}
loadIndex().then((idx) => { $("#foot-version").textContent = `Última edição: ${dateLong(idx.latest)} · ${idx.editions.length} ${idx.editions.length === 1 ? "edição" : "edições"} no arquivo.`; }).catch(() => {});
route();
