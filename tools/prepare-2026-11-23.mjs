// Transformação reprodutível dos dados brutos da edição de 2026-11-23.
// Uso: node tools/prepare-2026-11-23.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, columns, scatter (com as opções novas y.sci, trends e xLabel), bars — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}
const rawFiles = (dir) => fs.readdirSync(path.join(RAW, dir)).map((f) => path.join(RAW, dir, f));
const pct = (a, b) => (b / a - 1) * 100;

// CSV simples com aspas (RFC 4180)
function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...body] = rows;
  return body.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const MES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dayFrac = (iso) => { const d = new Date(iso + "T00:00:00Z"); const y = d.getUTCFullYear(); const s = Date.UTC(y, 0, 1), e = Date.UTC(y + 1, 0, 1); return y + (d - s) / (e - s); };
const dLabel = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MES[m - 1]} ${y}`; };

// 1. Combustíveis: preços semanais em Portugal, gasóleo e gasolina 95, com e sem impostos (Boletim Petrolífero da Comissão Europeia)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "combustiveis-2026", "wob_prices_history_PT_EU_euro95_diesel.csv"), "utf8")).map((o) => ({
    date: o.date, gD: +o.PT_price_with_tax_diesel, gG: +o.PT_price_with_tax_euro95, nD: +o.PT_price_wo_tax_diesel, nG: +o.PT_price_wo_tax_euro95,
    euD: +o.EU_price_with_tax_diesel, euG: +o.EU_price_with_tax_euro95,
  }));
  assert(all.length === 1093 && all[0].date === "2005-01-03" && all.at(-1).date === "2026-11-16", "1 093 boletins semanais, de 3/1/2005 a 16/11/2026");
  assert(all.every((o) => o.gD > 0 && o.gG > 0 && o.nD > 0 && o.nG > 0), "sem valores em falta para Portugal");
  const at = (d) => all.find((o) => o.date === d);
  const pre = at("2026-02-23"), last = at("2026-11-16");
  // primeiro boletim de 2026 em que o gasóleo final ficou acima da gasolina
  const y26 = all.filter((o) => o.date >= "2026-01-01");
  const firstDieselAbove26 = y26.find((o) => o.gD > o.gG).date;
  const weeksAbove = all.filter((o) => o.gD > o.gG);
  const yearsAbove = [...new Set(weeksAbove.map((o) => o.date.slice(0, 4)))];
  const maxD = all.reduce((m, o) => (o.gD > m.gD ? o : m));
  const max2022D = all.filter((o) => o.date.startsWith("2022")).reduce((m, o) => (o.gD > m.gD ? o : m));
  const taxD = (o) => o.gD - o.nD, taxG = (o) => o.gG - o.nG;
  const s = {
    preDate: pre.date, lastDate: last.date,
    preD: r3(pre.gD / 1000), preG: r3(pre.gG / 1000), lastD: r3(last.gD / 1000), lastG: r3(last.gG / 1000),
    preND: r3(pre.nD / 1000), preNG: r3(pre.nG / 1000), lastND: r3(last.nD / 1000), lastNG: r3(last.nG / 1000),
    chgND: r1(pct(pre.nD, last.nD)), chgNG: r1(pct(pre.nG, last.nG)), chgD: r1(pct(pre.gD, last.gD)), chgG: r1(pct(pre.gG, last.gG)),
    gapLast: r3((last.gD - last.gG) / 1000), gapPre: r3((pre.gG - pre.gD) / 1000),
    taxDpre: r3(taxD(pre) / 1000), taxDlast: r3(taxD(last) / 1000), taxGpre: r3(taxG(pre) / 1000), taxGlast: r3(taxG(last) / 1000),
    maxD: r3(maxD.gD / 1000), maxDdate: maxD.date, max2022D: r3(max2022D.gD / 1000), max2022Ddate: max2022D.date,
    maxND: r3(maxD.nD / 1000), firstDieselAbove26, yearsAbove, weeksAbove: weeksAbove.length,
    euLastD: r3(last.euD / 1000), euLastG: r3(last.euG / 1000),
  };
  console.log(s);
  assert(s.preD === 1.6 && s.preG === 1.686 && s.lastD === 2.078 && s.lastG === 1.887, "preço final: gasóleo 1,600 → 2,078 €/l; gasolina 1,686 → 1,887 €/l (23/2 → 16/11/2026)");
  assert(s.preND === 0.766 && s.lastND === 1.236 && s.preNG === 0.714 && s.lastNG === 0.915, "sem impostos: gasóleo 0,766 → 1,236 €/l; gasolina 0,714 → 0,915 €/l");
  assert(s.chgND === 61.4 && s.chgNG === 28.1 && s.chgD === 29.9 && s.chgG === 11.9, "subidas desde 23/2: gasóleo sem impostos +61,4%, gasolina sem impostos +28,1%; preço final +29,9% e +11,9%");
  assert(s.gapLast === 0.191 && s.gapPre === 0.086, "o gasóleo passou de 8,6 cêntimos abaixo da gasolina para 19,1 cêntimos acima");
  assert(s.taxDpre === 0.834 && s.taxDlast === 0.842, "impostos no gasóleo: 0,834 €/l (23/2) e 0,842 €/l (16/11) — quase iguais");
  // impostos sem IVA (ISP e outros impostos indiretos), assumindo IVA de 23% sobre o preço sem IVA (taxa do continente)
  const nonVat = (g, n) => g / 1.23 - n;
  s.isoDpre = r3(nonVat(pre.gD, pre.nD) / 1000); s.isoDlast = r3(nonVat(last.gD, last.nD) / 1000);
  s.isoGpre = r3(nonVat(pre.gG, pre.nG) / 1000); s.isoGlast = r3(nonVat(last.gG, last.nG) / 1000);
  assert(s.taxGpre === 0.972 && s.taxGlast === 0.972, "impostos na gasolina: 0,972 €/l nas duas datas");
  assert(s.isoDpre === 0.535 && s.isoDlast === 0.453 && s.isoGpre === 0.657 && s.isoGlast === 0.619, "impostos sem IVA (com IVA a 23%): gasóleo 0,535 → 0,453 €/l (−8 cêntimos); gasolina 0,657 → 0,619 €/l (−4 cêntimos)");
  assert(s.euLastD === 2.05 && s.euLastG === 1.829, "média da UE a 16/11: gasóleo 2,050 €/l, gasolina 1,829 €/l");
  assert(s.maxD === 2.21 &&s.maxDdate === "2026-09-21" && s.max2022D === 2.08 && s.max2022Ddate === "2022-06-20", "máximo do gasóleo desde 2005: 2,210 €/l a 21/9/2026; em 2022, 2,080 €/l a 20/6");
  assert(s.yearsAbove.join() === "2022,2026" && s.firstDieselAbove26 === "2026-03-09", "desde 2005, o gasóleo só ficou acima da gasolina em 2022 e em 2026 (desde 9/3/2026)");
  // gráfico: semanas desde janeiro de 2021
  const rows = all.filter((o) => o.date >= "2021-01-01").map((o) => ({ x: r3(dayFrac(o.date)), label: dLabel(o.date), gD: r3(o.gD / 1000), gG: r3(o.gG / 1000), nD: r3(o.nD / 1000), nG: r3(o.nG / 1000) }));
  assert(rows.length === 303 && rows[0].label === "11 jan. 2021", "303 semanas no gráfico (11/1/2021 a 16/11/2026)");
  const xOf = (d) => rows.find((q) => q.label === dLabel(d)).x;
  write("combustiveis-portugal-2021-2026", {
    rows,
    config: {
      x: { min: 2021, max: 2026.9, ticks: [2021, 2022, 2023, 2024, 2025, 2026], tableLabel: "Semana (boletim)" },
      y: { label: "Preço médio por litro (euros)", suffix: " €", decimals: 3, linMin: 0, linMax: 2.4, logDefault: false, linTicks: [0, 0.5, 1, 1.5, 2] },
      series: [
        { key: "gD", label: "Gasóleo, preço final", short: "Gasóleo", color: "--accent-2", width: 2.8 },
        { key: "gG", label: "Gasolina 95, preço final", short: "Gasolina", color: "--accent-3", width: 2.4 },
        { key: "nD", label: "Gasóleo, sem impostos", short: "Gas. s/ imp.", color: "--accent-2", width: 1.3 },
        { key: "nG", label: "Gasolina 95, sem impostos", short: "Gasol. s/ imp.", color: "--accent-3", width: 1.3 },
      ],
      labelMargin: [112, 116],
      shortEndLabels: true,
      shade: [{ from: xOf("2026-03-02"), to: 2026.9, exact: true, label: "Desde março de 2026", short: "2026" }],
      annotations: [
        { x: xOf("2026-09-21"), key: "gD", text: "2,210 €: máximo desde 2005", short: "Máximo", dx: -8, dy: -10, anchor: "end", strong: false },
      ],
      howToRead: "As duas linhas grossas são o preço médio pago na bomba em Portugal, com impostos; as finas, o mesmo combustível antes de impostos. A distância entre a grossa e a fina de cada cor é a carga fiscal por litro. Valores semanais do Boletim Petrolífero da Comissão Europeia.",
    },
    summary: s,
  }, rawFiles("combustiveis-2026"));
}

// 2. Crédito à habitação: prestação média (juros + capital), taxa de juro implícita e capital em dívida, Portugal, 2009–2026 (INE)
{
  const load = (v) => {
    const j = JSON.parse(fs.readFileSync(path.join(RAW, "prestacao-habitacao", `ine_${v}.json`), "utf8"))[0];
    const out = [];
    for (const [k, arr] of Object.entries(j.Dados)) { const a = arr.find((o) => o.geocod === "PT"); const [mes, , ano] = k.split(" "); out.push({ k, y: +ano, m: MESES.indexOf(mes[0].toUpperCase() + mes.slice(1)) + 1, v: a && a.valor != null ? +a.valor : null }); }
    return out;
  };
  const tx = load("0008867"), cap = load("0008868"), pr = load("0008869"), ju = load("0008870"), am = load("0008871");
  assert([tx, cap, pr, ju, am].every((s) => s.length === 214 && s[0].k === "Janeiro de 2009" && s.at(-1).k === "Outubro de 2026" && s.every((o) => o.v != null && o.m >= 1)), "cinco séries mensais completas, de janeiro de 2009 a outubro de 2026 (214 meses)");
  const bad = pr.filter((o, i) => Math.abs(o.v - (ju[i].v + am[i].v)) > 1);
  assert(bad.length === 1 && bad[0].k === "Agosto de 2017" && pr.every((o, i) => Math.abs(o.v - (ju[i].v + am[i].v)) <= 2), "juros + capital amortizado = prestação média (diferença de 1 € por arredondamento; 2 € em agosto de 2017)");
  const get = (s, y, m) => s.find((o) => o.y === y && o.m === m).v;
  const last = pr.at(-1);
  const prevMax = pr.slice(0, -1).reduce((m, o) => (o.v > m.v ? o : m));
  const txMax = tx.reduce((m, o) => (o.v > m.v ? o : m));
  const txMin = tx.reduce((m, o) => (o.v < m.v ? o : m));
  const prMinPost = pr.filter((o) => o.y >= 2025).reduce((m, o) => (o.v < m.v ? o : m));
  const firstRecord = pr.find((o, i) => i > 0 && o.v > Math.max(...pr.slice(0, i).map((q) => q.v)) && o.y >= 2025);
  const s = {
    pr: last.v, ju: get(ju, 2026, 10), am: get(am, 2026, 10), tx: get(tx, 2026, 10), cap: get(cap, 2026, 10),
    prevMax: prevMax.v, prevMaxK: prevMax.k, txMax: txMax.v, txMaxK: txMax.k, txMin: txMin.v, txMinK: txMin.k,
    prJan24: get(pr, 2024, 1), juJan24: get(ju, 2024, 1), amJan24: get(am, 2024, 1), txJan24: get(tx, 2024, 1), capJan24: get(cap, 2024, 1),
    prOct21: get(pr, 2021, 10), txOct21: get(tx, 2021, 10), capOct21: get(cap, 2021, 10), amOct21: get(am, 2021, 10),
    prMinPost: prMinPost.v, prMinPostK: prMinPost.k, firstRecordK: firstRecord?.k,
    capChg2426: r1(pct(get(cap, 2024, 1), get(cap, 2026, 10))), amChg2426: r1(pct(get(am, 2024, 1), get(am, 2026, 10))),
    prJan20: get(pr, 2020, 1), prJul20: get(pr, 2020, 7),
  };
  s.amShare = r1((s.am / s.pr) * 100); s.amShareJan24 = r1((s.amJan24 / s.prJan24) * 100);
  console.log(s);
  assert(s.pr === 427 && s.ju === 217 && s.am === 210 && s.tx === 3.231 && s.cap === 81471, "outubro de 2026: prestação 427 € (217 de juros + 210 de capital), taxa 3,231%, capital em dívida 81 471 €");
  assert(s.prevMax === 423 && s.prevMaxK === "Setembro de 2026" && pr.filter((o) => o.v >= 427).length === 1, "427 € é o valor mais alto da série desde janeiro de 2009 (antes: 423 € em setembro de 2026)");
  assert(s.firstRecordK === "Junho de 2026" && [6, 7, 8, 9, 10].map((m) => get(pr, 2026, m)).join() === "411,414,418,423,427", "desde junho de 2026, cada mês bate o máximo anterior: 411, 414, 418, 423, 427 €");
  assert(get(pr, 2009, 1) === 361 && get(tx, 2009, 1) === 5.798, "janeiro de 2009: 361 €, com a taxa a 5,798%");
  assert(Math.max(...pr.filter((o) => o.y <= 2024).map((o) => o.v)) === 405, "máximo até 2024: 405 €");
  const peak24 = tx.filter((o) => o.y >= 2022).reduce((m, o) => (o.v > m.v ? o : m));
  s.txPeak = peak24.v; s.txPeakK = peak24.k; s.txDropPts = r2(s.txPeak - s.tx);
  assert(s.txPeak === 4.657 && s.txPeakK === "Janeiro de 2024" && s.txDropPts === 1.43, "pico do ciclo de subida: 4,657% em janeiro de 2024; hoje 1,43 pontos abaixo");
  assert(s.prJan24 === 404 && s.juJan24 === 248 && s.amJan24 === 156, "janeiro de 2024: prestação 404 € (248 de juros, 156 de capital)");
  assert(s.capJan24 === 64790 && s.capChg2426 === 25.7 && s.amChg2426 === 34.6, "capital médio em dívida: 64 790 € → 81 471 € (+25,7%); capital amortizado +34,6%");
  assert(s.amShare === 49.2 && s.amShareJan24 === 38.6, "o capital pesa 49,2% da prestação (38,6% em janeiro de 2024)");
  assert(s.prOct21 === 251 && s.txOct21 === 0.81 && s.capOct21 === 57190, "outubro de 2021: prestação 251 €, taxa 0,810%, capital em dívida 57 190 €");
  const txMin26 = tx.filter((o) => o.y === 2026).reduce((m, o) => (o.v < m.v ? o : m));
  s.txMin26 = txMin26.v; s.txMin26K = txMin26.k;
  assert(s.txMin26 === 3.065 && s.txMin26K === "Maio de 2026" && [6, 7, 8, 9, 10].every((m) => get(tx, 2026, m) > get(tx, 2026, m - 1)), "a taxa desceu até maio de 2026 (3,065%) e subiu todos os meses desde junho");
  assert(get(tx, 2025, 1) === 3.984 && get(tx, 2025, 12) === 3.13, "em 2025 a taxa desceu de 3,984% (janeiro) para 3,130% (dezembro)");
  assert(s.prJan20 === 247 && s.prJul20 === 226, "quebra de 2020 (247 € em janeiro, 226 € em julho): período das moratórias");
  // gráfico: valores de outubro de cada ano
  const years = []; for (let y = 2009; y <= 2026; y++) years.push(y);
  const rows = years.map((y) => ({ cat: String(y), juros: get(ju, y, 10), capital: get(am, y, 10), prestacao: get(pr, y, 10), taxa: get(tx, y, 10), divida: get(cap, y, 10) }));
  write("prestacao-credito-habitacao-2009-2026", {
    rows,
    views: [
      { id: "prestacao", label: "Prestação", yLabel: "Prestação média mensal em outubro de cada ano (euros)", unit: " €", decimals: 0, marginLeft: [34, 44],
        series: [{ key: "capital", label: "Capital amortizado", color: "--accent-2" }, { key: "juros", label: "Juros", color: "--accent-3" }],
        tipExtra: [{ key: "prestacao", label: "Prestação média", suffix: " €" }],
        notes: [{ cat: "2026", text: "427 €: máximo desde 2009", short: "427 €" }] },
      { id: "taxa", label: "Taxa de juro", yLabel: "Taxa de juro implícita em outubro de cada ano (%)", unit: "%", decimals: 2, valueLabels: true, marginLeft: [30, 36],
        series: [{ key: "taxa", label: "Taxa de juro implícita", color: "--accent-3" }] },
      { id: "divida", label: "Capital em dívida", yLabel: "Capital médio em dívida por contrato em outubro de cada ano (euros)", unit: " €", decimals: 0, marginLeft: [46, 54],
        series: [{ key: "divida", label: "Capital médio em dívida", color: "--accent-2" }] },
    ],
    summary: s,
  }, rawFiles("prestacao-habitacao"));
}

// 3. Computação de treino dos modelos de IA notáveis, 1950–2026 (Epoch AI, via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "ia-computacao-epoch", "owid_catalog_epoch_2025-03-12.csv"), "utf8"));
  assert(all.length === 1055, "1 055 modelos no ficheiro");
  const pts = all.filter((o) => o.training_computation_petaflop !== "").map((o) => ({ model: o.model, date: o.publication_date, domain: o.domain, org: o.organization_categorization, flop: +o.training_computation_petaflop * 1e15 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  assert(pts.length === 536 && pts[0].date === "1950-07-02" && pts.at(-1).date === "2026-08-07", "536 modelos com computação conhecida, de 2/7/1950 a 7/8/2026");
  const X = (p) => dayFrac(p.date);
  const fit = (a, b) => {
    const s = pts.filter((p) => X(p) >= a && X(p) < b); const n = s.length;
    const mx = s.reduce((t, p) => t + X(p), 0) / n, my = s.reduce((t, p) => t + Math.log10(p.flop), 0) / n;
    const k = s.reduce((t, p) => t + (X(p) - mx) * (Math.log10(p.flop) - my), 0) / s.reduce((t, p) => t + (X(p) - mx) ** 2, 0);
    return { n, k, c: my - k * mx, perYear: r1(10 ** k), doublingMonths: r1((12 * Math.log10(2)) / k) };
  };
  const f1 = fit(1950, 2010), f2 = fit(2010, 2027);
  const by = (name) => pts.find((p) => p.model === name);
  const top = [...pts].sort((a, b) => b.flop - a.flop)[0];
  const s = {
    n: pts.length, nPre: f1.n, nPost: f2.n, perYearPre: f1.perYear, doublingPre: f1.doublingMonths, perYearPost: f2.perYear, doublingPost: f2.doublingMonths,
    top: top.model, topDate: top.date, topFlop: top.flop,
    gpt3: by("GPT-3 175B (davinci)").flop, gpt4: by("GPT-4 (Mar 2023)").flop, alexnet: by("AlexNet").flop, perceptron: by("Perceptron Mark I").flop,
  };
  s.topOverGpt4 = r1(s.topFlop / s.gpt4); s.topOverGpt3 = Math.round(s.topFlop / s.gpt3);
  console.log(s);
  assert(s.perYearPre === 1.5 && s.doublingPre === 20.5 && s.nPre === 62, "1950–2009 (62 modelos): ×1,5 por ano, duplicação a cada 20,5 meses (regressão log-linear)");
  assert(s.perYearPost === 4.3 && s.doublingPost === 5.7 && s.nPost === 474, "2010–2026 (474 modelos): ×4,3 por ano, duplicação a cada 5,7 meses");
  assert(s.top === "Grok 4" && s.topDate === "2025-07-09" && Math.abs(s.topFlop - 5e26) / 5e26 < 0.001, "o maior valor conhecido é o do Grok 4 (julho de 2025): 5 × 10²⁶ FLOP");
  assert(Math.abs(s.gpt3 - 3.14e23) / 3.14e23 < 0.001 && Math.abs(s.gpt4 - 2.1e25) / 2.1e25 < 0.001, "GPT-3: 3,14 × 10²³; GPT-4: 2,1 × 10²⁵ FLOP");
  assert(s.topOverGpt4 === 23.8 && s.topOverGpt3 === 1592, "Grok 4 = 23,8 vezes o GPT-4 e 1 592 vezes o GPT-3");
  const grp = (d) => (d === "Language" ? "lang" : d === "Vision" ? "vis" : d === "Multiple domains" || d === "Multimodal" ? "multi" : "other");
  const ORG = { Industry: "indústria", Academia: "universidade", "Academia and industry collaboration": "universidade e indústria", "Research collective": "coletivo de investigação", Government: "Estado" };
  const rows = pts.map((p) => ({ x: r3(X(p)), y: p.flop, label: p.model, xLabel: dLabel(p.date), sub: ORG[p.org] ? `Origem: ${ORG[p.org]}` : undefined, group: grp(p.domain) }));
  const T = (f, a, b) => ({ x0: a, x1: b, y0: 10 ** (f.c + f.k * a), y1: 10 ** (f.c + f.k * b) });
  write("ia-computacao-treino-1950-2026", {
    rows,
    config: {
      x: { label: "Data de publicação", short: "Ano", min: 1948, max: 2028, ticks: [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020], decimals: 0, tipLabel: "Publicado" },
      y: { label: "Computação usada no treino (FLOP)", short: "Computação (FLOP)", log: true, sci: true, min: 1, max: 1e28, ticks: [1, 1e4, 1e8, 1e12, 1e16, 1e20, 1e24, 1e28], tipLabel: "Computação de treino" },
      groups: [
        { key: "lang", label: "Linguagem", color: "--accent-2" },
        { key: "multi", label: "Vários domínios", color: "--accent-4" },
        { key: "vis", label: "Visão", color: "--accent-3" },
        { key: "other", label: "Outros (jogos, biologia, fala…)", color: "--ink-3" },
      ],
      trends: [
        { ...T(f1, 1950, 2010), text: "1950–2009: ×1,5 por ano", short: "×1,5/ano", anchor: "start", lx: 1966, ly: 10 ** (f1.c + f1.k * 1966) * 3e3 },
        { ...T(f2, 2010, 2026.6), text: "Desde 2010: ×4,3 por ano", short: "×4,3/ano", anchor: "end", lx: 2009, ly: 3e22 },
      ],
      notes: [
        { x: 1957.2, y: 3e3, text: "Perceptron (1957)", short: "Perceptron", anchor: "start" },
        { x: 2019.6, y: 1e25, text: "GPT-3 (2020)", short: "GPT-3", anchor: "end" },
        { x: 2025.3, y: 3e27, text: "Grok 4 (2025)", short: "Grok 4", anchor: "end" },
      ],
      howToRead: "Cada ponto é um modelo de inteligência artificial considerado notável pela Epoch AI, colocado na data de publicação e na quantidade de cálculos usada para o treinar. A escala vertical é logarítmica: cada linha da grelha vale 10 000 vezes a de baixo. As linhas tracejadas são as tendências médias antes e depois de 2010.",
    },
    summary: s,
  }, rawFiles("ia-computacao-epoch"));
}

// 4. Mortes em conflitos armados e número de conflitos, 1989–2025 (UCDP, via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "conflitos-ucdp", "owid_catalog_ucdp_preview_regioes.csv"), "utf8"));
  const REG = [["Africa (UCDP)", "afr", "África"], ["Americas (UCDP)", "ame", "Américas"], ["Asia and Oceania (UCDP)", "asi", "Ásia e Oceânia"], ["Europe (UCDP)", "eur", "Europa"], ["Middle East (UCDP)", "mo", "Médio Oriente"]];
  const g = (c, t, y, f = "number_deaths_ongoing_conflicts") => { const o = all.find((q) => q.country === c && q.conflict_type === t && q.year === String(y)); return o && o[f] !== "" ? +o[f] : null; };
  const years = []; for (let y = 1989; y <= 2025; y++) years.push(y);
  assert(years.every((y) => g("World", "all", y) != null), "mortes no mundo de 1989 a 2025 sem lacunas (2026, preliminar, fica de fora)");
  assert(years.every((y) => REG.reduce((s, r) => s + g(r[0], "all", y), 0) === g("World", "all", y)), "em todos os anos, a soma das cinco regiões é igual ao total mundial");
  const TYP = [["state-based", "est"], ["non-state conflict", "nest"], ["one-sided violence", "uni"]];
  assert(years.every((y) => TYP.reduce((s, t) => s + g("World", t[0], y, "number_ongoing_conflicts"), 0) === g("World", "all", y, "number_ongoing_conflicts")), "em todos os anos, os três tipos somam o número total de conflitos");
  assert(years.every((y) => TYP.reduce((s, t) => s + g("World", t[0], y), 0) === g("World", "all", y)), "em todos os anos, as mortes dos três tipos somam o total");
  const W = (y) => g("World", "all", y), N = (y) => g("World", "all", y, "number_ongoing_conflicts");
  const rank = [...years].sort((a, b) => W(b) - W(a));
  const s = {
    w2025: W(2025), w2024: W(2024), w2022: W(2022), w1994: W(1994), w2021: W(2021), w2019: W(2019), w2005: W(2005),
    lo2025: g("World", "all", 2025, "number_deaths_ongoing_conflicts_low"), hi2025: g("World", "all", 2025, "number_deaths_ongoing_conflicts_high"),
    rank3: rank.slice(0, 4), minYear: rank.at(-1), n2025: N(2025), nMaxYear: years.reduce((m, y) => (N(y) > N(m) ? y : m), 1989), n1989: N(1989), n2010: N(2010),
    afr2025: g("Africa (UCDP)", "all", 2025), eur2025: g("Europe (UCDP)", "all", 2025), mo2025: g("Middle East (UCDP)", "all", 2025), afr1994: g("Africa (UCDP)", "all", 1994),
    uni2025: g("World", "one-sided violence", 2025), uni2024: g("World", "one-sided violence", 2024), est2025: g("World", "state-based", 2025, "number_ongoing_conflicts"),
  };
  s.chg2425 = r1(pct(s.w2024, s.w2025)); s.mult0525 = r1(s.w2025 / s.w2005);
  s.avg0510 = Math.round(years.filter((y) => y >= 2005 && y <= 2010).reduce((t, y) => t + W(y), 0) / 6);
  console.log(s);
  assert(s.w2025 === 244579 && s.w2024 === 187023 && s.chg2425 === 30.8, "2025: 244 579 mortos (melhor estimativa), mais 30,8% do que em 2024 (187 023)");
  assert(s.rank3.join() === "1994,2022,2025,2021" && s.w1994 === 823507 && s.w2022 === 316895, "2025 é o terceiro ano mais mortífero desde 1989, depois de 1994 (823 507) e 2022 (316 895)");
  assert(s.lo2025 === 170016 && s.hi2025 === 350592, "intervalo de 2025: 170 016 a 350 592");
  assert(s.n2025 === 195 && s.nMaxYear === 2025 && s.n1989 === 86 && s.n2010 === 87, "195 conflitos ativos em 2025, o máximo da série (86 em 1989, 87 em 2010)");
  assert(s.minYear === 2005 && s.w2005 === 20445 && s.mult0525 === 12, "mínimo em 2005 (20 445 mortos); 2025 foi 12 vezes mais");
  assert(s.afr2025 === 108907 && s.eur2025 === 94765 && s.mo2025 === 21438, "2025: África 108 907, Europa 94 765, Médio Oriente 21 438");
  assert(s.uni2025 === 76453 && s.uni2024 === 14260, "violência unilateral contra civis: 76 453 mortos em 2025 (14 260 em 2024)");
  assert(s.afr1994 === 791653, "1994: 791 653 mortos em África (genocídio no Ruanda)");
  s.afrEurShare2025 = r1(((s.afr2025 + s.eur2025) / s.w2025) * 100);
  assert(s.afrEurShare2025 === 83.3, "África e Europa: 83,3% das mortes de 2025 («mais de quatro em cada cinco»)");
  const cty = parseCSV(fs.readFileSync(path.join(RAW, "conflitos-ucdp", "owid_catalog_ucdp_preview_sudao_ucrania_2025.csv"), "utf8"));
  const cv = (c, t) => +cty.find((q) => q.country === c && q.conflict_type === t).number_deaths_ongoing_conflicts;
  s.sudanUni2025 = cv("Sudan", "one-sided violence"); s.sudan2025 = cv("Sudan", "all"); s.ukraine2025 = cv("Ukraine", "all");
  assert(s.sudanUni2025 === 62775 && s.sudan2025 === 75164 && s.ukraine2025 === 90345, "2025, por país (atribuição da OWID): Sudão 75 164 mortos, dos quais 62 775 em violência contra civis; Ucrânia 90 345");
  const rows = years.map((y) => ({ cat: String(y), ...Object.fromEntries(REG.map((r) => [r[1], g(r[0], "all", y)])), total: W(y), est: g("World", "state-based", y, "number_ongoing_conflicts"), nest: g("World", "non-state conflict", y, "number_ongoing_conflicts"), uni: g("World", "one-sided violence", y, "number_ongoing_conflicts"), nconf: N(y) }));
  write("conflitos-armados-mortes-1989-2025", {
    rows,
    views: [
      { id: "mortes", label: "Mortes", yLabel: "Mortes em conflitos armados por ano, por região (melhor estimativa)", unit: "", decimals: 0, marginLeft: [50, 60], labelEvery: 4, labelEveryNarrow: 8,
        series: [{ key: "mo", label: "Médio Oriente", color: "--accent-4" }, { key: "asi", label: "Ásia e Oceânia", color: "--ink-3" }, { key: "ame", label: "Américas", color: "--muted" }, { key: "eur", label: "Europa", color: "--accent-3" }, { key: "afr", label: "África", color: "--accent-2" }],
        tipExtra: [{ key: "total", label: "Total", suffix: "" }],
        notes: [{ cat: "1994", text: "1994: genocídio no Ruanda", short: "Ruanda" }] },
      { id: "conflitos", label: "Conflitos", yLabel: "Conflitos ativos por ano, por tipo", unit: "", decimals: 0, marginLeft: [34, 40], labelEvery: 4, labelEveryNarrow: 8,
        series: [{ key: "uni", label: "Violência unilateral contra civis", color: "--accent-3" }, { key: "nest", label: "Entre grupos armados, sem Estado", color: "--ink-3" }, { key: "est", label: "Com um Estado envolvido", color: "--accent-2" }],
        tipExtra: [{ key: "nconf", label: "Total", suffix: "" }] },
    ],
    summary: s,
  }, rawFiles("conflitos-ucdp"));
}

// 5. Minerais críticos: quota do maior produtor e da China na produção mundial de 2025 (USGS, via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "minerais-criticos-usgs", "owid_catalog_usgs_mcs_2026-11-09_2024-2025.csv"), "utf8")).filter((o) => o.year === "2025");
  const PT = { China: "China", "Democratic Republic of Congo": "RD Congo", Brazil: "Brasil", "South Africa": "África do Sul", Indonesia: "Indonésia", Australia: "Austrália", Chile: "Chile" };
  const LIST = [
    ["Gallium", "Processing", "Gálio (refinação)", "Gálio"], ["Magnesium metal", "Smelter", "Magnésio (metal)", "Magnésio"], ["Tungsten", "Mine", "Tungsténio", "Tungsténio"],
    ["Graphite", "Mine", "Grafite natural", "Grafite"], ["Vanadium", "Mine", "Vanádio", "Vanádio"], ["Rare earths", "Mine", "Terras raras", "Terras raras"],
    ["Bismuth", "Refinery", "Bismuto (refinação)", "Bismuto"], ["Fluorspar", "Mine", "Fluorite", "Fluorite"], ["Antimony", "Mine", "Antimónio", "Antimónio"],
    ["Niobium", "Mine", "Nióbio", "Nióbio"], ["Cobalt", "Mine", "Cobalto", "Cobalto"], ["Platinum group metals", "Mine, platinum", "Platina", "Platina"],
    ["Nickel", "Mine", "Níquel", "Níquel"], ["Lithium", "Mine", "Lítio", "Lítio"], ["Copper", "Mine", "Cobre", "Cobre"],
  ];
  const val = (c, s, country) => { const o = all.find((q) => q.commodity === c && q.sub_commodity === s && q.country === country); return o && o.production !== "" ? +o.production : null; };
  const rows = LIST.map(([c, sub, label, short]) => {
    const W = val(c, sub, "World");
    const cands = all.filter((q) => q.commodity === c && q.sub_commodity === sub && !["World", "Other"].includes(q.country) && q.production !== "").sort((a, b) => b.production - a.production);
    const t = cands[0]; const ch = val(c, sub, "China") ?? 0;
    return { label: `${label} — ${PT[t.country] || t.country}`, short: `${short} — ${PT[t.country] || t.country}`, mineral: label, leader: PT[t.country] || t.country, top: r1((+t.production / W) * 100), ch: r1((ch / W) * 100), world: W, highlight: t.country === "China", note: `Produção mundial estimada: ${W.toLocaleString("pt-PT")} t` };
  });
  const R = Object.fromEntries(rows.map((q) => [q.mineral, q]));
  const s = {
    nChinaLeads: rows.filter((q) => q.highlight).length, n: rows.length, chinaOver75: rows.filter((q) => q.ch >= 75).map((q) => q.mineral),
    gallium: R["Gálio (refinação)"].ch, magnesium: R["Magnésio (metal)"].ch, tungsten: R["Tungsténio"].ch, graphite: R["Grafite natural"].ch, rare: R["Terras raras"].ch, vanadium: R["Vanádio"].ch,
    cobalt: R["Cobalto"].top, niobium: R["Nióbio"].top, platinum: R["Platina"].top, nickel: R["Níquel"].top, lithium: R["Lítio"].top, copper: R["Cobre"].top, lithiumChina: R["Lítio"].ch,
    ptTungsten: val("Tungsten", "Mine", "Portugal"), worldTungsten: val("Tungsten", "Mine", "World"),
  };
  s.ptTungstenShare = r1((s.ptTungsten / s.worldTungsten) * 100);
  console.log(s, rows.map((q) => [q.label, q.top, q.ch]));
  assert(s.nChinaLeads === 9 && s.n === 15, "a China é o maior produtor em 9 dos 15 minerais escolhidos");
  assert(s.chinaOver75.join() === "Gálio (refinação),Magnésio (metal),Tungsténio,Grafite natural,Bismuto (refinação)", "a China tem 75% ou mais em cinco: gálio, magnésio, tungsténio, grafite, bismuto");
  assert(s.gallium === 100 && s.magnesium === 86.4 && s.tungsten === 78.8 && s.graphite === 77.8 && s.rare === 69.2 && s.vanadium === 74.5, "China: gálio 100%, magnésio 86,4%, tungsténio 78,8%, grafite 77,8%, vanádio 74,5%, terras raras 69,2%");
  assert(s.cobalt === 74.2 && s.niobium === 92.9 && s.platinum === 70.6 && s.nickel === 66.7, "fora da China: cobalto (RD Congo) 74,2%, nióbio (Brasil) 92,9%, platina (África do Sul) 70,6%, níquel (Indonésia) 66,7%");
  assert(s.lithium === 31.7 && s.lithiumChina === 21.4 && s.copper === 23, "lítio: Austrália 31,7% (China 21,4%); cobre: Chile 23,0%");
  s.ptLithium = val("Lithium", "Mine", "Portugal"); s.ptLithiumShare = r1((s.ptLithium / val("Lithium", "Mine", "World")) * 100);
  assert(s.ptLithium === 380 && s.ptLithiumShare === 0.1, "Portugal: 380 t de lítio, 0,1% do total mundial");
  assert(R["Bismuto (refinação)"].ch === 87.5, "bismuto refinado: China 87,5%");
  assert(s.ptTungsten === 700 && s.ptTungstenShare === 0.8, "Portugal: 700 t de tungsténio, 0,8% do total mundial");
  write("minerais-criticos-concentracao-2025", {
    rows,
    config: {
      views: [
        { id: "top", label: "Maior produtor", key: "top", axisLabel: "Quota do maior produtor na produção mundial de 2025 (%)", axisShort: "Quota do maior produtor (%)" },
        { id: "ch", label: "China", key: "ch", axisLabel: "Quota da China na produção mundial de 2025 (%)", axisShort: "Quota da China (%)" },
      ],
      unit: "%", decimals: 1, signed: false,
      posLabel: "Outro país é o maior produtor", highlightColor: "--accent-3", highlightLabel: "A China é o maior produtor",
      howToRead: "Cada barra é um mineral, com o país que mais produz a seguir ao nome. Na vista «Maior produtor», a barra mede a parte desse país na produção mundial; na vista «China», a parte da China, seja ela a líder ou não. Mineração, salvo indicação de refinação ou fundição.",
    },
    summary: s,
  }, rawFiles("minerais-criticos-usgs"));
}
