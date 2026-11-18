// Gera boletim.html a partir de data.json (boletim-piloto ACIFF, novembro de 2026).
// Uso: node pilotos/aciff/2026-11/prepare.mjs && node pilotos/aciff/2026-11/build.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const D = JSON.parse(fs.readFileSync(path.join(DIR, "data.json"), "utf8"));
const { turismo: T, desemprego: U, eletricidade: E, credito: C, concursos: K, fundos: F, setor: S } = D;

// ---------- formatação à portuguesa ----------
const NB = " "; // espaço fino inquebrável nos milhares
const MINUS = "−";
function num(x, dec = 0) {
  const neg = x < 0;
  const [i, d] = Math.abs(x).toFixed(dec).split(".");
  const int = i.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return (neg ? MINUS : "") + int + (d ? "," + d : "");
}
const sgn = (x, dec = 1) => (x > 0 ? "+" : "") + num(x, dec);
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesAno = (p) => `${MESL[+p.slice(5, 7) - 1]} de ${p.slice(0, 4)}`;
const data = (iso) => `${+iso.slice(8, 10)} ${MES[+iso.slice(5, 7) - 1].replace(".", "")}.`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const eur = (v) => (v == null ? "sem preço base" : v >= 1e6 ? `${num(v / 1e6, 2)} M€` : `${num(Math.round(v / 1000))} mil €`);

// ---------- gráficos SVG ----------
function spark(serie, { w = 132, h = 38, tone = "ink" } = {}) {
  const v = serie.map((r) => r.valor);
  const lo = Math.min(...v), hi = Math.max(...v);
  const pad = 4;
  const x = (i) => pad + (i * (w - 2 * pad)) / (v.length - 1);
  const y = (val) => h - pad - ((val - lo) / (hi - lo || 1)) * (h - 2 * pad);
  const pts = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`);
  const area = `M${x(0)},${h - pad} L${pts.join(" L")} L${x(v.length - 1)},${h - pad} Z`;
  return `<svg class="spark spark-${tone}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Evolução de ${serie[0].periodo} a ${serie.at(-1).periodo}">
<path d="${area}" class="sp-area"/><polyline points="${pts.join(" ")}" class="sp-line" fill="none"/>
<circle cx="${x(v.length - 1).toFixed(1)}" cy="${y(v.at(-1)).toFixed(1)}" r="3" class="sp-dot"/></svg>`;
}

function chartMAT() {
  const s = E.serie_mat;
  const W = 640, H = 250, L = 36, R = 12, Tp = 34, B = 30;
  const max = 100;
  assert.ok(Math.max(...s.map((r) => r.valor)) < max);
  const bw = (W - L - R) / s.length;
  const y = (v) => Tp + (1 - v / max) * (H - Tp - B);
  let g = "";
  for (const t of [0, 25, 50, 75, 100]) g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${t}</text>`;
  s.forEach((r, i) => {
    const last = i === s.length - 1;
    const x0 = L + i * bw + bw * 0.14;
    g += `<rect x="${x0.toFixed(1)}" y="${y(r.valor).toFixed(1)}" width="${(bw * 0.72).toFixed(1)}" height="${(y(0) - y(r.valor)).toFixed(1)}" class="${last ? "bar-hot" : "bar"}"><title>${mesAno(r.periodo)}: ${num(r.valor, 1)} GWh</title></rect>`;
    if (r.periodo.endsWith("-01")) g += `<text x="${(L + i * bw).toFixed(1)}" y="${H - 10}" class="tick">${r.periodo.slice(0, 4)}</text>`;
  });
  const xl = L + (s.length - 1) * bw + bw / 2;
  g += `<text x="${xl - 8}" y="${y(E.mat) - 8}" class="ann" text-anchor="end">jul. 2026: ${num(E.mat, 1)} GWh</text>`;
  g += `<text x="${L}" y="14" class="axis-title">GWh por mês · média e alta tensão · Figueira da Foz</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Consumo mensal de eletricidade em média e alta tensão na Figueira da Foz, de janeiro de 2024 a julho de 2026. Oscila entre 69 e 100 GWh até junho de 2026 e cai para 45,1 GWh em julho de 2026.">${g}</svg>`;
}

function lines2(a, b, { la, lb, title }) {
  const W = 640, H = 230, L = 34, R = 150, Tp = 30, B = 28;
  const all = [...a, ...b].map((r) => r.valor);
  const lo = 0, hi = Math.ceil(Math.max(...all) + 0.5);
  assert.ok(Math.min(...all) >= lo);
  const x = (i) => L + (i * (W - L - R)) / (a.length - 1);
  const y = (v) => Tp + (1 - (v - lo) / (hi - lo)) * (H - Tp - B);
  let g = "";
  for (let t = 0; t <= hi; t += 2) g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${t}</text>`;
  a.forEach((r, i) => { if (r.periodo.endsWith("-01")) g += `<text x="${x(i)}" y="${H - 8}" class="tick" text-anchor="middle">jan. ${r.periodo.slice(0, 4)}</text>`; });
  const path = (s) => s.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r.valor).toFixed(1)}`).join(" ");
  g += `<path d="${path(b)}" class="ln-b" fill="none"/><path d="${path(a)}" class="ln-a" fill="none"/>`;
  const n = a.length - 1;
  g += `<circle cx="${x(n)}" cy="${y(a[n].valor)}" r="3.5" class="dot-a"/><circle cx="${x(n)}" cy="${y(b[n].valor)}" r="3.5" class="dot-b"/>`;
  g += `<text x="${x(n) + 8}" y="${y(a[n].valor) + 4}" class="lab-a">${la} ${num(a[n].valor, 1)} %</text><text x="${x(n) + 8}" y="${y(b[n].valor) + 4}" class="lab-b">${lb} ${num(b[n].valor, 1)} %</text>`;
  g += `<text x="${L}" y="14" class="axis-title">Variação homóloga dos preços, % · Portugal</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(title)}">${g}</svg>`;
}

function bars(rows, key, { title, goodIsDown }) {
  const W = 300, rowH = 24, L = 104, R = 46, Tp = 8;
  const H = Tp + rows.length * rowH + 6;
  const ext = Math.max(10, ...rows.map((r) => Math.abs(r[key])));
  const mid = L + (W - L - R) / 2;
  const sc = (W - L - R) / 2 / ext;
  let g = `<line x1="${mid}" x2="${mid}" y1="${Tp - 4}" y2="${H - 2}" class="axis"/>`;
  rows.forEach((r, i) => {
    const v = r[key], yy = Tp + i * rowH;
    const ff = r.nome === "Figueira da Foz";
    const x0 = v < 0 ? mid + v * sc : mid;
    const good = goodIsDown ? v < 0 : v > 0;
    g += `<text x="${L - 8}" y="${yy + 15}" class="lbl${ff ? " lbl-ff" : ""}" text-anchor="end">${esc(r.nome)}</text>`;
    g += `<rect x="${x0.toFixed(1)}" y="${yy + 4}" width="${Math.max(1, Math.abs(v * sc)).toFixed(1)}" height="15" class="${ff ? "b-ff" : good ? "b-good" : "b-bad"}"/>`;
    g += `<text x="${v < 0 ? mid + 6 : mid - 6}" y="${yy + 15}" class="val" text-anchor="${v < 0 ? "start" : "end"}">${sgn(v)} %</text>`;
  });
  return `<figure class="mini"><figcaption>${title}</figcaption><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(title)}">${g}</svg></figure>`;
}

// ---------- conteúdo ----------
// O que é e para quem, escrito a partir do texto de cada aviso (factos conferidos em prepare.mjs)
const AVISO = {
  "COMPETE2030-2026-13": ["Promoção externa da oferta portuguesa e captação de investimento.", "Aviso-convite: só a AICEP pode candidatar-se. As empresas não se candidatam diretamente."],
  "MPr-2026-7": ["Projetos que demonstram em situação real uma tecnologia saída de I&D já concluída, incluindo linhas-piloto.", "PME e empresas de pequena-média capitalização, sozinhas ou com universidades e centros de I&D."],
  "MPr-2026-4": ["Cofinanciamento nacional para empresas portuguesas que participam em projetos europeus de I&D.", "PME e empresas de pequena-média capitalização que participam em projetos das redes EUREKA e Eurostars."],
  "MPr-2026-8": ["Investimento produtivo inovador: nova unidade, mais capacidade ou novos produtos.", "Só PME identificadas no plano de investimentos da rede de fornecedores da The Navigator Company, aprovado no âmbito do aviso MPr-2025-8."],
  "MPr-2026-11": ["Investigação industrial e desenvolvimento experimental para criar ou melhorar produtos, processos ou serviços.", "PME e empresas de pequena-média capitalização, sozinhas ou com entidades de I&D."],
  "MPr-2026-1": ["Descarbonização e eficiência energética em grandes projetos (pelo menos 25 M€ ou de interesse estratégico), em regime contratual.", "Só grandes empresas. As fases para empresas de qualquer dimensão fecharam em fevereiro e maio de 2026."],
  "MPr-2026-9": ["I&D e inovação em tecnologias digitais e biotecnologia consideradas críticas pela União Europeia (STEP).", "Empresas de qualquer dimensão, em copromoção com outras empresas ou entidades de I&D."],
  "COMPETE2030-2026-11": ["I&D e inovação em tecnologias de energia consideradas críticas pela União Europeia (STEP).", "Empresas de qualquer dimensão, em copromoção com outras empresas ou entidades de I&D."],
  "MPr-2026-10": ["Investimento para fabricar tecnologias digitais ou biotecnológicas críticas, ou os seus componentes (STEP).", "Empresas de qualquer dimensão."],
  "COMPETE2030-2026-12": ["Investimento para fabricar tecnologias limpas, incluindo tecnologias neutras em carbono, ou os seus componentes (STEP).", "Empresas de qualquer dimensão."],
  "COMPETE2030-2026-15": ["Projetos coletivos para acelerar a descarbonização das empresas, em particular das PME.", "Associações empresariais, câmaras de comércio e indústria, agências de promoção turística e entidades de I&D. A ACIFF é elegível pelo tipo de entidade."],
  "CENTRO2030-2026-13": ["Apoio à contratação de licenciados, mestres e doutorados para reforçar a inovação.", "PME em territórios de baixa densidade da região Centro. A próxima fase fecha a 21 de dezembro."],
  "CENTRO2030-2026-14": ["Apoio à contratação de licenciados, mestres e doutorados para reforçar a inovação.", "PME nos restantes territórios da região Centro. A próxima fase fecha a 21 de dezembro."],
};
for (const f of F.empresas) assert.ok(AVISO[f.codigo], f.codigo);
assert.equal(F.empresas.filter((f) => f.coletiva).length, 2);
const tiles = [
  { lab: "Dormidas", per: "set. 2026", val: num(T.dormidas), chip: `${sgn(T.var_dormidas)} %`, state: "good", note: `Portugal: ${sgn(T.var_portugal)} %`, sp: spark(T.serie) },
  { lab: "Estada média", per: "set. 2026", val: `${num(T.estada, 2)} noites`, chip: `set. 2025: ${num(T.estada_ano_anterior, 2)}`, state: "good", note: `Hóspedes: ${sgn(T.var_hospedes)} %`, sp: "" },
  { lab: "Desemprego registado", per: "set. 2026", val: num(U.valor), chip: `${sgn(U.var)} %`, state: "good", note: `IEFP Centro: ${sgn(U.var_centro)} %`, sp: spark(U.serie) },
  { lab: "Eletricidade · média e alta tensão", per: "jul. 2026", val: `${num(E.mat, 1)} GWh`, chip: `${sgn(E.var_mat)} %`, state: "alert", note: `Portugal: ${sgn(E.var_pais_mat)} %`, sp: spark(E.serie_mat, { tone: "alert" }) },
  { lab: "Eletricidade · baixa tensão", per: "jul. 2026", val: `${num(E.bt, 1)} GWh`, chip: `${sgn(E.var_bt)} %`, state: "flat", note: "Sem alteração relevante", sp: spark(E.serie_bt, { tone: "flat" }) },
  { lab: "Juro · empréstimos novos até 1 M€", per: "set. 2026", val: `${num(C.valor, 2)} %`, chip: `+${num(C.var_pp, 2)} p.p.`, state: "bad", note: `${C.subidas_consecutivas} subidas seguidas · média nacional`, sp: spark(C.serie) },
];

const tres = [
  {
    big: `${num(E.var_mat, 1)} %`, unit: "eletricidade da indústria, jul. 2026 face a jul. 2025",
    h: "O consumo elétrico em média e alta tensão caiu para metade em julho",
    what: `A energia faturada nestes níveis de tensão desceu de ${num(E.mat_ano_anterior, 1)} GWh (julho de 2025) para ${num(E.mat, 1)} GWh. A quebra vem toda da freguesia de Lavos (${num(E.lavos_ano_anterior, 1)} GWh em julho de 2025, ${num(E.lavos, 1)} GWh em julho de 2026); as restantes freguesias, no conjunto, subiram. No país, o mesmo consumo variou ${sgn(E.var_pais_mat)} %.`,
    why: `Em junho, Lavos pesava ${E.peso_lavos_junho} % deste consumo no concelho. A queda pode refletir uma paragem de produção, autoprodução de energia ou um acerto de faturação. Os dados públicos não distinguem estas hipóteses.`,
    act: "Confirmar a causa junto das empresas antes de saírem os dados de agosto. Se for uma paragem, os fornecedores locais serão os primeiros a senti-la.",
  },
  {
    big: `${num(C.valor, 2)} %`, unit: "juro médio dos novos empréstimos até 1 M€ às empresas, set. 2026",
    h: "O crédito novo às empresas encarece há seis meses",
    what: `A taxa média dos novos empréstimos até 1 milhão de euros às empresas, o escalão que mais se aproxima do crédito às PME, era ${num(C.ano_anterior, 2)} % em setembro de 2025. Desde março de 2026 (${num(C.minimo_recente, 2)} %), subiu todos os meses.`,
    why: `Cada 100${NB}000 € de crédito novo custa cerca de ${num(C.var_pp * 1000)} € a mais de juros no primeiro ano do que há um ano (cálculo simples sobre o capital inicial). É uma média nacional; as condições de cada empresa variam.`,
    act: "Quem tem investimento planeado deve comparar o custo do crédito com os apoios europeus abertos, listados mais abaixo.",
  },
  {
    big: `${sgn(T.var_dormidas, 1)} %`, unit: "dormidas na Figueira, set. 2026 face a set. 2025",
    h: "Setembro inverte a quebra de agosto: a Figueira cresce mais do que os concelhos comparáveis",
    what: `Houve ${num(T.dormidas)} dormidas em setembro, mais ${num(T.var_dormidas, 1)} % do que um ano antes; em Portugal, ${sgn(T.var_portugal)} %. É a maior subida entre os sete concelhos comparados. Depois de um agosto em queda (${sgn(T.agosto.var)} %), o acumulado de janeiro a setembro fica em ${sgn(T.var_ytd)} %.`,
    why: `A subida vem quase em partes iguais de mais hóspedes (${sgn(T.var_hospedes)} %) e de estadias mais longas (${num(T.estada, 2)} noites, contra ${num(T.estada_ano_anterior, 2)}). Um mês não faz uma tendência, e os dados de setembro ainda são preliminares.`,
    act: "Para hotelaria e restauração: setembro mostra procura para lá do pico do verão. Comparar com as próprias reservas ajuda a perceber se o efeito se repete em outubro.",
  },
];

const concRows = K.abertos.map((a) => {
  let objeto = a.objeto;
  if (/PARQUÍMETROS/i.test(objeto)) objeto = "Concessão de parquímetros coletivos nas zonas de estacionamento taxado (freguesia de S. Julião)";
  return `<tr><td class="dt">${data(a.prazo)}</td><td><span class="obj">${esc(objeto)}</span><span class="ent">${esc(a.entidade)}${a.alteracao ? " · prazo alterado" : ""}</span></td><td class="num">${eur(a.preco_base)}</td><td><a href="${esc(a.url)}">anúncio</a></td></tr>`;
}).join("\n");

const fundRows = F.empresas.map((f) => {
  const cls = f.associacoes || f.codigo === "MPr-2026-8" ? ' class="hl"' : f.so_aicep ? ' class="dim"' : "";
  const [oque, quem] = AVISO[f.codigo];
  return `<tr${cls}><td class="dt">${data(f.fim)}</td><td><span class="obj">${esc(f.nome)}</span><span class="desc">${esc(oque)} <strong>Para quem:</strong> ${esc(quem)}</span><span class="ent">${esc(f.codigo)} · <a href="${esc(f.url)}">ler o aviso (PDF)</a></span></td><td class="num">${num(f.dotacao_meur, 1)} M€</td></tr>`;
}).join("\n");

const SI = S.ipc, SR = S.retalho, SC = S.confianca;
const setorTiles = [
  { lab: "Preços · serviços de restauração", per: "out. 2026", val: `${sgn(SI.restauracao, 1)} %`, chip: `inflação ${num(SI.total, 1)} %`, state: "info", note: `Acima da inflação total há ${SI.meses_restauracao_acima} meses` },
  { lab: "Inflação total", per: "out. 2026", val: `${num(SI.total, 1)} %`, chip: `out. 2025: ${num(SI.total_ano_anterior, 1)} %`, state: "bad", note: `A mais alta desde ${mesAno(SI.total_maximo_desde)}` },
  { lab: "Vendas no comércio a retalho (volume)", per: "set. 2026", val: `${sgn(SR.total, 1)} %`, chip: `alimentar ${sgn(SR.alimentar, 1)} %`, state: "bad", note: `Total: primeira descida desde ${mesAno(SR.negativo_anterior)} · não alimentar sem combustíveis ${sgn(SR.nao_alimentar, 1)} %` },
  { lab: "Confiança dos consumidores", per: "out. 2026", val: num(SC.consumidores, 1), chip: `set.: ${num(SC.consumidores_mes_anterior, 1)}`, state: "bad", note: `O valor mais baixo desde ${mesAno(SC.consumidores_minimo_desde)}` },
  { lab: "Confiança do comércio a retalho", per: "out. 2026", val: num(SC.retalho, 1), chip: `jun.: ${num(SC.retalho_max_recente, 1)}`, state: "bad", note: "Saldo de respostas; positivo, mas a descer desde junho" },
];
const setorConc = S.concursos.lista.map((c) => `<li><span class="dt">${data(c.data)}</span> ${esc(c.objeto.replace(/\s+/g, " ").slice(0, 110))}${c.objeto.length > 110 ? "…" : ""} <span class="ent">${esc(c.entidade)} · ${eur(c.preco_base)} · <a href="${esc(c.url)}">anúncio</a></span></li>`).join("\n");

const html = `<title>Barómetro Figueira</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Source+Sans+3:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: uma coluna de leitura (boletim), resumo antes do detalhe; mosaicos em grelha que passa a uma coluna no telemóvel */
:root {
  --bg: #f5f7f8; --surface: #ffffff; --ink: #14232b; --muted: #55666f; --line: #d9e1e5;
  --accent: #0f5f78; --accent-soft: #dcecf2;
  --good: #1d7a4f; --good-soft: #def2e7; --bad: #b2412c; --bad-soft: #f8e3dd; --alert: #a86200; --alert-soft: #fbeccf; --flat: #8a989f; --flat-soft: #e8edef;
  --f-display: "Archivo", "Helvetica Neue", Arial, sans-serif; --f-body: "Source Sans 3", "Segoe UI", Arial, sans-serif; --f-data: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0e171c; --surface: #15222a; --ink: #e6eef1; --muted: #9aaab2; --line: #26363f;
  --accent: #6cc0dc; --accent-soft: #173543;
  --good: #5fcf98; --good-soft: #143326; --bad: #f08a72; --bad-soft: #3a1e18; --alert: #f2b24c; --alert-soft: #3a2a10; --flat: #7d8d95; --flat-soft: #1f2c33; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0e171c; --surface: #15222a; --ink: #e6eef1; --muted: #9aaab2; --line: #26363f;
  --accent: #6cc0dc; --accent-soft: #173543;
  --good: #5fcf98; --good-soft: #143326; --bad: #f08a72; --bad-soft: #3a1e18; --alert: #f2b24c; --alert-soft: #3a2a10; --flat: #7d8d95; --flat-soft: #1f2c33; color-scheme: dark }
* { box-sizing: border-box }
body { background: var(--bg); color: var(--ink); font: 17px/1.5 var(--f-body); margin: 0 }
.wrap { max-width: 720px; margin: 0 auto; padding-block: 28px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 40px }
h1, h2, h3 { font-family: var(--f-display); text-wrap: balance; margin: 0; line-height: 1.15 }
h1 { font-size: clamp(2rem, 6vw, 2.7rem); font-weight: 800; letter-spacing: -0.02em }
h2 { font-size: 1.35rem; font-weight: 700; display: flex; gap: 10px; align-items: baseline }
h3 { font-size: 1.12rem; font-weight: 700 }
p { margin: 0 }
a { color: var(--accent) }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }
.eyebrow, .lab, .k { font: 500 0.72rem/1.3 var(--f-data); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted) }
header { display: grid; gap: 10px; border-bottom: 3px solid var(--ink); padding-bottom: 18px }
.meta { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; color: var(--muted); font-size: 0.95rem }
.ia { font: 600 0.72rem/1 var(--f-data); text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid var(--ink); color: var(--ink); padding: 5px 8px; border-radius: 3px }
.lede { font-size: 1.05rem; max-width: 62ch }
section { display: grid; gap: 16px; min-width: 0 }
.sec-n { font: 500 0.8rem var(--f-data); color: var(--accent) }
.three { display: grid; gap: 14px }
.item { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 18px 20px; display: grid; grid-template-columns: 9.5rem 1fr; gap: 6px 20px }
.big { font: 800 2.1rem/1 var(--f-display); letter-spacing: -0.02em; color: var(--accent); font-variant-numeric: tabular-nums }
.big-unit { font-size: 0.82rem; color: var(--muted); margin-top: 6px; line-height: 1.3 }
.item-body { display: grid; gap: 8px; min-width: 0 }
.item-body dl { display: grid; gap: 8px; margin: 0 }
.item-body dt { font: 500 0.7rem var(--f-data); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted) }
.item-body dd { margin: 0 }
.act { background: var(--accent-soft); border-radius: 4px; padding: 8px 10px }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(205px, 1fr)); gap: 12px }
.tile { background: var(--surface); border: 1px solid var(--line); border-top: 4px solid var(--st); border-radius: 6px; padding: 12px 14px; display: grid; gap: 4px; align-content: start; min-width: 0 }
.tile[data-s="good"] { --st: var(--good); --st-soft: var(--good-soft) } .tile[data-s="bad"] { --st: var(--bad); --st-soft: var(--bad-soft) }
.tile[data-s="alert"] { --st: var(--alert); --st-soft: var(--alert-soft) } .tile[data-s="flat"] { --st: var(--flat); --st-soft: var(--flat-soft) }
.tile .v { font: 700 1.55rem/1.1 var(--f-display); font-variant-numeric: tabular-nums }
.tile .row { display: flex; justify-content: space-between; align-items: end; gap: 8px; flex-wrap: wrap }
.chip { font: 500 0.8rem var(--f-data); background: var(--st-soft); color: var(--st); padding: 3px 7px; border-radius: 3px; white-space: nowrap }
.tile .n { font-size: 0.85rem; color: var(--muted) }
.spark { display: block; max-width: 100% }
.sp-area { fill: var(--accent-soft) } .sp-line { stroke: var(--accent); stroke-width: 1.6 } .sp-dot { fill: var(--accent) }
.spark-alert .sp-area { fill: var(--alert-soft) } .spark-alert .sp-line { stroke: var(--alert) } .spark-alert .sp-dot { fill: var(--alert) }
.spark-flat .sp-area { fill: var(--flat-soft) } .spark-flat .sp-line { stroke: var(--flat) } .spark-flat .sp-dot { fill: var(--flat) }
.legend { font-size: 0.85rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 6px 14px }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; background: var(--c); vertical-align: -1px }
.fig { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 18px 16px 12px; display: grid; gap: 10px; overflow-x: auto }
.chart { width: 100%; height: auto; display: block }
.grid { stroke: var(--line); stroke-width: 1 } .axis { stroke: var(--muted); stroke-width: 1 }
.tick, .val { font: 11px var(--f-data); fill: var(--muted) } .axis-title { font: 12px var(--f-data); fill: var(--muted) }
.ann { font: 600 12.5px var(--f-body); fill: var(--alert) }
.bar { fill: var(--flat) } .bar-hot { fill: var(--alert) }
.lbl { font: 13px var(--f-body); fill: var(--ink) } .lbl-ff { font-weight: 700 }
.b-ff { fill: var(--accent) } .b-good { fill: var(--good); opacity: .55 } .b-bad { fill: var(--bad); opacity: .55 }
.note { font-size: 0.88rem; color: var(--muted) }
.pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px }
.mini { margin: 0; display: grid; gap: 6px; min-width: 0 } .mini figcaption { font-weight: 600; font-size: 0.95rem }
.tbl { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 6px }
table { border-collapse: collapse; width: 100%; font-size: 0.93rem }
th { text-align: left; font: 500 0.7rem var(--f-data); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line) }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top }
tr:last-child td { border-bottom: 0 }
tr.hl td { background: var(--accent-soft) }
.dt { font: 500 0.85rem var(--f-data); white-space: nowrap; font-variant-numeric: tabular-nums }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums }
.obj { display: block } .ent { display: block; font-size: 0.82rem; color: var(--muted) }
.callout { border-left: 3px solid var(--accent); padding: 4px 0 4px 14px; max-width: 62ch }
.tile[data-s="info"] { --st: var(--accent); --st-soft: var(--accent-soft) }
.desc { display: block; font-size: 0.88rem; margin: 3px 0 2px; max-width: 60ch }
tr.dim td { color: var(--muted) }
.sector { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 20px; display: grid; gap: 16px; min-width: 0 }
.sector .tiles { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)) }
.sector .tile { background: var(--bg) }
.reading { display: grid; gap: 10px; max-width: 64ch }
.conc { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 0.93rem }
.ln-a { stroke: var(--accent); stroke-width: 2.4 } .ln-b { stroke: var(--flat); stroke-width: 2 }
.dot-a { fill: var(--accent) } .dot-b { fill: var(--flat) }
.lab-a { font: 600 12.5px var(--f-body); fill: var(--accent) } .lab-b { font: 12.5px var(--f-body); fill: var(--muted) }
footer { border-top: 1px solid var(--line); padding-top: 18px; display: grid; gap: 12px; font-size: 0.88rem; color: var(--muted) }
footer ul { margin: 0; padding-left: 18px; display: grid; gap: 4px }
@media (max-width: 560px) { .item { grid-template-columns: 1fr } .big { font-size: 1.9rem } }
</style>

<div class="wrap">
<header>
  <span class="eyebrow">Boletim económico mensal · proposta-piloto para os associados da ACIFF</span>
  <h1>Barómetro Figueira</h1>
  <div class="meta"><span>Edição de 17 de novembro de 2026 · atualizada a 18 de novembro</span><span>Leitura: 2 minutos</span><span class="ia">Feito por IA</span></div>
  <p class="lede">Os números mais recentes das fontes oficiais sobre a economia da Figueira da Foz, com o que mudou, porque importa e o que fazer. Cada fonte publica com o seu próprio atraso; o período de cada número está indicado.</p>
</header>

<section aria-labelledby="s1">
  <h2 id="s1"><span class="sec-n">1</span>Três coisas deste mês</h2>
  <div class="three">
${tres.map((t) => `  <article class="item">
    <div><div class="big">${t.big}</div><div class="big-unit">${t.unit}</div></div>
    <div class="item-body"><h3>${t.h}</h3>
      <dl><div><dt>O que aconteceu</dt><dd>${t.what}</dd></div>
      <div><dt>Porque importa</dt><dd>${t.why}</dd></div>
      <div class="act"><dt>O que fazer</dt><dd>${t.act}</dd></div></dl></div>
  </article>`).join("\n")}
  </div>
</section>

<section aria-labelledby="s2">
  <h2 id="s2"><span class="sec-n">2</span>Painel de sinais</h2>
  <div class="legend"><span style="--c: var(--good)">evolução favorável</span><span style="--c: var(--bad)">desfavorável</span><span style="--c: var(--alert)">fora do padrão, a esclarecer</span><span style="--c: var(--flat)">sem alteração relevante</span></div>
  <div class="tiles">
${tiles.map((t) => `   <div class="tile" data-s="${t.state}"><span class="lab">${t.lab} · ${t.per}</span><div class="row"><span class="v">${t.val}</span><span class="chip">${t.chip}</span></div>${t.sp}<span class="n">${t.note}</span></div>`).join("\n")}
  </div>
  <p class="note">Variações face ao mesmo mês do ano anterior, para neutralizar a sazonalidade. Gráficos: dormidas e eletricidade desde janeiro de 2024; desemprego desde janeiro de 2025; juro desde outubro de 2024.</p>
</section>

<section aria-labelledby="s3">
  <h2 id="s3"><span class="sec-n">3</span>Gráfico do mês</h2>
  <div class="fig">
    <h3>Em julho, o consumo elétrico em média e alta tensão da Figueira caiu para metade</h3>
    ${chartMAT()}
    <p class="note">Energia ativa faturada pela E-REDES. A E-REDES agrega a muito alta, a alta e a média tensão, que abastecem sobretudo a indústria e os grandes consumidores. Em Lavos, a descida foi de ${num(E.lavos_mes_anterior, 1)} GWh (junho) para ${num(E.lavos, 1)} GWh (julho); nos concelhos de Coimbra, Leiria e Ílhavo, o consumo de julho subiu entre 3 % e 7 % face a junho. Por serem dados de faturação, um mês pode ainda ser corrigido.</p>
  </div>
</section>

<section aria-labelledby="s4">
  <h2 id="s4"><span class="sec-n">4</span>A Figueira e os concelhos comparáveis</h2>
  <div class="pair">
    ${bars(T.pares, "var_mes", { title: "Dormidas, setembro de 2026 face a setembro de 2025", goodIsDown: false })}
    ${bars(U.pares, "var", { title: "Desemprego registado, setembro de 2026 face a setembro de 2025", goodIsDown: true })}
  </div>
  <p class="note">A Figueira a azul. Verde: evolução favorável; vermelho: desfavorável. O desemprego desceu em todos os concelhos comparados; na Figueira (${sgn(U.var)} %), desceu mais do que no conjunto da delegação regional do Centro do IEFP (${sgn(U.var_centro)} %). Cada gráfico tem a sua escala.</p>
</section>

<section aria-labelledby="s5">
  <h2 id="s5"><span class="sec-n">5</span>Setor do mês: ${S.nome.toLowerCase()}</h2>
  <div class="sector">
    <h3>Os preços nos restaurantes sobem ${num(SI.restauracao, 1)} % ao ano, e o consumidor está mais pessimista</h3>
    <p class="note">Não há dados mensais por concelho para estes setores. Os indicadores abaixo são nacionais (INE) e servem de enquadramento para a Figueira.</p>
    <div class="tiles">
${setorTiles.map((t) => `     <div class="tile" data-s="${t.state}"><span class="lab">${t.lab} · ${t.per}</span><div class="row"><span class="v">${t.val}</span><span class="chip">${t.chip}</span></div><span class="n">${t.note}</span></div>`).join("\n")}
    </div>
    ${lines2(SI.serie_rest, SI.serie_total, { la: "Restauração", lb: "Inflação total", title: `Variação homóloga dos preços dos serviços de restauração e da inflação total em Portugal, de novembro de 2024 a outubro de 2026. A restauração varia entre ${num(Math.min(...SI.serie_rest.map((r) => r.valor)), 1)} % e ${num(Math.max(...SI.serie_rest.map((r) => r.valor)), 1)} %; a inflação total entre ${num(Math.min(...SI.serie_total.map((r) => r.valor)), 1)} % e ${num(Math.max(...SI.serie_total.map((r) => r.valor)), 1)} %.` })}
    <div class="reading">
      <p><strong>Restauração.</strong> Os preços dos serviços de restauração sobem mais do que a inflação total desde ${mesAno(SI.restauracao_acima_desde)}. Os produtos alimentares, a principal matéria-prima, sobem ${num(SI.alimentares, 1)} %, menos de metade. A diferença pode refletir outros custos, como pessoal e energia, que estes dados não isolam. Na Figueira, as dormidas de setembro subiram ${num(T.var_dormidas, 1)} %, com estadias mais longas do que um ano antes (${num(T.estada, 2)} noites, contra ${num(T.estada_ano_anterior, 2)}).</p>
      <p><strong>Comércio.</strong> O volume de vendas no comércio a retalho caiu ${num(-SR.total, 1)} % em setembro, face a um ano antes. O alimentar subiu ${num(SR.alimentar, 1)} % e o não alimentar sem combustíveis desceu ${num(-SR.nao_alimentar, 1)} %. O vestuário e o calçado estão ${num(-SI.vestuario, 1)} % mais baratos do que há um ano. A confiança dos consumidores caiu para o valor mais baixo desde ${mesAno(SC.consumidores_minimo_desde)}: o comércio entra na época de Natal com clientes mais cautelosos.</p>
      <p class="act"><strong>O que fazer:</strong> rever preços e promoções de Natal com base nos custos reais de cada negócio. A média nacional diz para onde o mercado se move, não o que cada loja ou restaurante deve cobrar.</p>
    </div>
    <div class="reading">
      <h3>Concursos públicos para o setor na região em 2026</h3>
      <p class="note">${S.concursos.n} concursos de refeições, alimentos ou restauração lançados pelas entidades acompanhadas, com ${num(S.concursos.soma_preco_base)} € de preço base somado. Estão todos fechados; o alerta semanal avisaria os associados no dia da publicação.</p>
      <ul class="conc">
${setorConc}
      </ul>
    </div>
    <p class="note">Rotação proposta: comércio e restauração (novembro), indústria e energia (dezembro), construção e imobiliário (janeiro), turismo e alojamento (fevereiro).</p>
  </div>
</section>

<section aria-labelledby="s6">
  <h2 id="s6"><span class="sec-n">6</span>Oportunidades</h2>
  <h3>Concursos públicos da região com propostas ainda abertas</h3>
  <div class="tbl"><table>
    <thead><tr><th>Prazo</th><th>Objeto e entidade</th><th class="num">Preço base</th><th>Fonte</th></tr></thead>
    <tbody>
${concRows}
    </tbody></table></div>
  <p class="callout">Em 2026, ${K.pct_ate_12_dias} % dos ${num(K.n_anuncios_2026)} concursos lançados pelas entidades acompanhadas deram 12 dias ou menos para apresentar propostas, e ${K.pct_ate_10_dias} % deram 10 dias ou menos. Um boletim mensal chega tarde para a maioria: esta secção deve funcionar como alerta semanal, filtrado pelo setor de cada associado.</p>
  <p class="note">Entidades acompanhadas: Município da Figueira da Foz, Junta de Freguesia do Paião, Águas da Figueira, APFF (Porto da Figueira da Foz), ULS do Baixo Mondego, CIM Região de Coimbra, ABMG e municípios de Montemor-o-Velho, Cantanhede e Soure. Anúncios publicados até 13 de novembro de 2026.</p>

  <h3>Apoios europeus abertos a empresas (Portugal 2030, região Centro)</h3>
  <div class="tbl"><table>
    <thead><tr><th>Fecha</th><th>Aviso</th><th class="num">Dotação</th></tr></thead>
    <tbody>
${fundRows}
    </tbody></table></div>
  <p class="callout">Destaques: as ações coletivas para a descarbonização admitem associações empresariais, por isso a ACIFF pode candidatar-se até 8 de janeiro. A rede de fornecedores da The Navigator Company abrange só as PME que integram essa rede; confirme junto da empresa se é o seu caso.</p>
  <p class="note">Dotação total de cada aviso, que pode abranger várias regiões. Inclui os avisos dos sistemas de incentivos às empresas e de ações coletivas com candidaturas abertas a 17 de novembro de 2026.</p>
</section>

<footer>
  <p><strong>Fontes:</strong></p>
  <ul>
    <li>INE, Inquérito à permanência de hóspedes (dormidas e hóspedes, mensal por município; setembro de 2026 preliminar, publicado a 17 de novembro).</li>
    <li>IEFP, Desemprego registado por concelhos (setembro de 2026). «Centro» é a delegação regional do IEFP, que não inclui a Nazaré nem Peniche.</li>
    <li>E-REDES, Dados abertos, consumos faturados por município (CC BY 4.0; julho de 2026).</li>
    <li>Banco de Portugal, BPstat, série 12533747: taxa de juro de novas operações de empréstimos até 1 M€ às empresas não financeiras, incluindo renegociações (setembro de 2026).</li>
    <li>IMPIC, Portal BASE, anúncios de 2026 (dados.gov.pt, atualizado a 15 de novembro de 2026) e Diário da República.</li>
    <li>Portugal 2030, avisos dos programas Centro 2030 e COMPETE 2030 (lista de avisos abertos e texto integral de cada aviso).</li>
    <li>INE, Índice de preços no consumidor (base 2025, outubro de 2026), Índice de volume de negócios no comércio (setembro de 2026) e inquéritos de conjuntura aos consumidores e ao comércio (outubro de 2026).</li>
  </ul>
  <p><strong>Ainda não incluído nesta versão-piloto:</strong> calendário fiscal e contributivo (a confirmar se a ACIFF já o divulga), movimento do Porto da Figueira da Foz e preços dos combustíveis.</p>
  <p><strong>Atualizações e correções:</strong> 18 nov. 2026 — Turismo atualizado para setembro de 2026, publicado pelo INE a 17 de novembro. O INE reviu agosto para ${num(T.agosto.dormidas)} dormidas (antes 61${NB}496), e a variação de agosto passa de −5,8 % para ${sgn(T.agosto.var)} %. Os valores de agosto dos outros concelhos também foram revistos; o maior ajuste foi o de Coimbra, de +9,2 % para +3,5 %. 17 nov. 2026 — A primeira versão indicava que o aviso «Ações Coletivas – Internacionalização» (COMPETE2030-2026-13) estava aberto a associações empresariais. O aviso é um convite dirigido apenas à AICEP.</p>
  <p><strong>Feito por IA.</strong> Textos e números gerados por agentes de IA a partir das fontes oficiais indicadas. Cada número foi conferido automaticamente com os dados de origem e por um verificador independente, sem revisão humana prévia. Não constitui aconselhamento financeiro, fiscal ou jurídico.</p>
  <p>Proposta preparada por Pedro Silva · Dados consultados a 16 de novembro de 2026; turismo a 18 de novembro.</p>
</footer>
</div>
`;
fs.writeFileSync(path.join(DIR, "boletim.html"), html);
console.log("OK — boletim.html", (html.length / 1024).toFixed(0), "KB");
