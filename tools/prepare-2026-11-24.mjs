// Transformação reprodutível dos dados brutos da edição de 2026-11-24.
// Uso: node tools/prepare-2026-11-24.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: columns (empilhadas e com negativos), lines (escala log ⇄ linear), dumbbell — ver assets/js/charts.js.
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

function parseCSV(text) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === "") q = true; // aspas só abrem no início do campo (o CSV dos pregos tem 2" a meio de um cabeçalho)
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [h, ...body] = rows;
  return body.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
// JSON-stat do Eurostat: devolve {value, status} para uma combinação de categorias
function jsonstat(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const get = (sel) => {
    let idx = 0;
    for (let i = 0; i < d.id.length; i++) {
      const dim = d.id[i], cats = d.dimension[dim].category.index;
      const c = sel[dim] ?? Object.keys(cats)[0];
      if (!(c in cats)) return { value: null, status: null };
      idx = idx * d.size[i] + cats[c];
    }
    return { value: d.value[idx] ?? null, status: d.status?.[idx] ?? null };
  };
  const cats = (dim) => Object.keys(d.dimension[dim].category.index);
  const label = (dim, c) => d.dimension[dim].category.label[c];
  return { get, cats, label, raw: d };
}
const MES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const EU27 = ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "EL", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE"];
const NOME = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };

// 1. Primeiras autorizações de residência em Portugal por motivo, 2008–2025 (Eurostat migr_resfirst; dados da AIMA/SEF)
{
  const J = jsonstat(path.join(RAW, "autorizacoes-residencia", "eurostat_migr_resfirst_PT.json"));
  const years = J.cats("time");
  assert(years[0] === "2008" && years.at(-1) === "2025" && years.length === 18, "série de Portugal de 2008 a 2025 (18 anos)");
  const g = (reason, t) => J.get({ reason, geo: "PT", time: t, unit: "PER" });
  const rows = years.map((t) => ({ cat: t, trabalho: g("EMP", t).value, familia: g("FAM", t).value, estudo: g("EDUC", t).value, outros: g("OTH", t).value, total: g("TOTAL", t).value }));
  assert(rows.every((r) => [r.trabalho, r.familia, r.estudo, r.outros, r.total].every((v) => Number.isInteger(v))), "sem valores em falta");
  assert(rows.every((r) => r.trabalho + r.familia + r.estudo + r.outros === r.total), "a soma dos quatro motivos é igual ao total em todos os anos");
  const breaks = years.filter((t) => g("TOTAL", t).status === "b");
  assert(breaks.join() === "2025" && g("EMP", "2025").status === "b", "o Eurostat marca quebra de série («b») só em 2025 (total e trabalho)");
  const R = (t) => rows.find((r) => r.cat === t);
  const s = {
    tot25: R("2025").total, tot24: R("2024").total, emp25: R("2025").trabalho, emp24: R("2024").trabalho, fam25: R("2025").familia, edu25: R("2025").estudo, oth25: R("2025").outros,
    tot08: R("2008").total, tot17: R("2017").total, emp17: R("2017").trabalho,
  };
  s.ratioTot = r2(s.tot25 / s.tot24); s.ratioEmp = r2(s.emp25 / s.emp24); s.empShare25 = r1((s.emp25 / s.tot25) * 100); s.empShare24 = r1((s.emp24 / s.tot24) * 100);
  s.maxBefore = Math.max(...rows.filter((r) => r.cat < "2025").map((r) => r.total)); s.maxBeforeYear = rows.find((r) => r.total === s.maxBefore).cat;
  s.empIncrease = s.emp25 - s.emp24; s.totIncrease = s.tot25 - s.tot24; s.empShareOfIncrease = r1((s.empIncrease / s.totIncrease) * 100);
  s.sum2008_2017 = rows.filter((r) => r.cat <= "2017").reduce((a, r) => a + r.total, 0);
  console.log(s);
  assert(s.tot25 === 310639 && s.tot24 === 121872 && s.ratioTot === 2.55, "2025: 310 639 primeiras autorizações, 2,55 vezes as 121 872 de 2024");
  assert(s.emp25 === 240523 && s.emp24 === 60553 && s.ratioEmp === 3.97, "por motivo de trabalho: 240 523 em 2025, quase quatro vezes as 60 553 de 2024");
  assert(s.empShare25 === 77.4 && s.empShare24 === 49.7, "o trabalho passou de 49,7% para 77,4% do total");
  assert(s.maxBefore === 135907 && s.maxBeforeYear === "2023", "máximo anterior: 135 907 em 2023");
  assert(s.fam25 === 25435 && s.edu25 === 11389 && s.oth25 === 33292, "2025: família 25 435, estudo 11 389, outros 33 292");
  assert(s.empShareOfIncrease === 95.3, "o trabalho explica 95,3% do aumento de 2024 para 2025");
  s.minTot = Math.min(...rows.map((r) => r.total)); s.minTotYear = rows.find((r) => r.total === s.minTot).cat;
  assert(s.tot08 === 63715 && s.tot17 === 34073 && s.minTot === 25728 && s.minTotYear === "2016", "2008: 63 715; mínimo de 25 728 em 2016; 2017: 34 073");
  // comparação europeia por mil habitantes (2025)
  const A = jsonstat(path.join(RAW, "autorizacoes-residencia", "eurostat_migr_resfirst_todos_2024_2025.json"));
  const P = jsonstat(path.join(RAW, "autorizacoes-residencia", "eurostat_demo_gind_pop_2025.json"));
  const per = [...EU27, "EU27_2020"].map((c) => {
    const t = A.get({ reason: "TOTAL", geo: c, time: "2025", unit: "PER" }).value, e = A.get({ reason: "EMP", geo: c, time: "2025", unit: "PER" }).value, p = P.get({ geo: c, time: "2025", indic_de: "JAN" }).value;
    return { c, t, e, p, perK: r1((t / p) * 1000), perKemp: r1((e / p) * 1000) };
  });
  assert(per.every((o) => o.t > 0 && o.p > 0), "todos os 27 países e a UE têm dados de 2025 e população");
  const rk = per.filter((o) => o.c !== "EU27_2020").sort((a, b) => b.perK - a.perK);
  const rkE = per.filter((o) => o.c !== "EU27_2020").sort((a, b) => b.perKemp - a.perKemp);
  const eu = per.find((o) => o.c === "EU27_2020"), pt = per.find((o) => o.c === "PT"), es = per.find((o) => o.c === "ES");
  Object.assign(s, { ptPerK: pt.perK, ptPerKemp: pt.perKemp, euPerK: eu.perK, euPerKemp: eu.perKemp, esPerK: es.perK, rankPT: rk.findIndex((o) => o.c === "PT") + 1, rankPTemp: rkE.findIndex((o) => o.c === "PT") + 1, top: rk.slice(0, 3).map((o) => `${o.c} ${o.perK}`), topEmp: rkE.slice(0, 3).map((o) => `${o.c} ${o.perKemp}`), euTot: eu.t, euEmp: eu.e, ptShareEUemp: r1((pt.e / eu.e) * 100), ptPop: pt.p });
  console.log(s);
  assert(s.ptPerK === 27.3 && s.euPerK === 8.6 && s.rankPT === 3 && s.top.join() === "MT 56.9,CY 46.7,PT 27.3", "por mil habitantes: Portugal 27,3 (3.º na UE, depois de Malta 56,9 e Chipre 46,7); média da UE 8,6");
  assert(s.ptPerKemp === 21.1 && s.euPerKemp === 2.9 && s.rankPTemp === 3, "por trabalho: 21,1 por mil habitantes em Portugal, 2,9 na UE (3.º lugar)");
  assert(s.ptShareEUemp === 18.6 && s.euEmp === 1295687, "Portugal emitiu 18,6% das 1 295 687 primeiras autorizações por trabalho da UE");
  assert(s.esPerK === 12.9, "Espanha: 12,9 por mil habitantes");
  s.ptPopShare = r1((pt.p / eu.p) * 100);
  assert(s.ptPopShare === 2.5, "Portugal tem 2,5% da população da UE a 1/1/2025");
  write("autorizacoes-residencia-portugal-2025", {
    rows,
    views: [
      { id: "motivo", label: "Por motivo", yLabel: "Primeiras autorizações de residência emitidas a cidadãos de fora da UE, Portugal", unit: "", decimals: 0, marginLeft: [44, 56], labelEvery: 1, labelEveryNarrow: 3,
        series: [{ key: "outros", label: "Outros motivos", color: "--muted" }, { key: "estudo", label: "Estudo", color: "--accent-3" }, { key: "familia", label: "Família", color: "--ink-3" }, { key: "trabalho", label: "Trabalho", color: "--accent-2" }],
        tipExtra: [{ key: "total", label: "Total", suffix: "" }],
        notes: [{ cat: "2025", text: "2025: 310 639 (quebra de série)", short: "310 639" }] },
    ],
    summary: s,
  }, rawFiles("autorizacoes-residencia"));
}

// 2. Construção de centros de dados e de escritórios nos EUA, mensal, 2014–2026 (U.S. Census Bureau, via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "centros-dados-eua", "owid_catalog_datacenter_construction_2026-10-02.csv"), "utf8"))
    .map((o) => ({ date: o.date, dc: +o.datacenter_construction_spending, of: +o.general_office_construction_spending, dcR: +o.datacenter_construction_spending_real, ofR: +o.general_office_construction_spending_real }));
  assert(all.length === 152 && all[0].date === "2014-01-01" && all.at(-1).date === "2026-08-01", "152 meses, de janeiro de 2014 a agosto de 2026");
  assert(all.every((o, i) => i === 0 || +o.date.slice(5, 7) === (+all[i - 1].date.slice(5, 7) % 12) + 1), "meses consecutivos, sem falhas");
  const at = (d) => all.find((o) => o.date === d);
  const firstAbove = all.find((o) => o.dc > o.of).date;
  const lastBelow = [...all].reverse().find((o) => o.dc <= o.of).date;
  const ja = (y) => all.filter((o) => o.date.startsWith(String(y)) && +o.date.slice(5, 7) <= 8);
  const sum = (a, k) => a.reduce((t, o) => t + o[k], 0);
  const fy = (y) => all.filter((o) => o.date.startsWith(String(y)));
  const s = {
    dcAug26: r3(at("2026-08-01").dc / 1e9), ofAug26: r3(at("2026-08-01").of / 1e9), dcAug25: r3(at("2025-08-01").dc / 1e9), dcJan14: r3(at("2014-01-01").dc / 1e9), ofJan14: r3(at("2014-01-01").of / 1e9),
    firstAbove, lastBelow,
    ja26: r1(sum(ja(2026), "dc") / 1e9), ja25: r1(sum(ja(2025), "dc") / 1e9), ja14: r2(sum(ja(2014), "dc") / 1e9), fy25: r1(sum(fy(2025), "dc") / 1e9), fy24: r1(sum(fy(2024), "dc") / 1e9),
    ofJa26: r1(sum(ja(2026), "of") / 1e9), ofJa25: r1(sum(ja(2025), "of") / 1e9),
    ja26R: r1(sum(ja(2026), "dcR") / 1e9), ja25R: r1(sum(ja(2025), "dcR") / 1e9), ja14R: r2(sum(ja(2014), "dcR") / 1e9),
  };
  s.ofChgJA = r1(pct(s.ofJa25, s.ofJa26));
  s.ratioAug = r2(s.dcAug26 / s.ofAug26); s.chgAug = r1(pct(s.dcAug25, s.dcAug26)); s.multJA = r1(sum(ja(2026), "dc") / sum(ja(2014), "dc")); s.multJAR = r1(sum(ja(2026), "dcR") / sum(ja(2014), "dcR")); s.ofChgJAR = r1(pct(sum(ja(2025), "ofR"), sum(ja(2026), "ofR"))); s.share26of25 = r1((s.ja26 / s.fy25) * 100);
  s.chgJA = r1(pct(s.ja25, s.ja26)); s.chgJAR = r1(pct(s.ja25R, s.ja26R));
  console.log(s);
  assert(s.dcAug26 === 7.535 && s.ofAug26 === 4.058 && s.ratioAug === 1.86, "agosto de 2026: 7,535 mil milhões de dólares em centros de dados, 4,058 em escritórios (1,86 vezes)");
  assert(s.dcAug25 === 4.312 && s.chgAug === 74.7, "centros de dados: +74,7% face a agosto de 2025 (4,312 mil milhões)");
  assert(s.firstAbove === "2025-04-01" && s.lastBelow === "2025-08-01", "os centros de dados passaram os escritórios pela primeira vez em abril de 2025 e estão sempre acima desde setembro de 2025");
  assert(s.ja26 === 45.2 && s.ja25 === 31.9 && s.chgJA === 41.7 && s.fy25 === 49.7 && s.share26of25 === 90.9 && s.ofJa26 === 30.4 && s.ofJa25 === 34.2, "janeiro–agosto de 2026: 45,2 mil milhões (+41,7% face aos 31,9 de 2025; 90,9% dos 49,7 de todo o ano de 2025); escritórios 34,2 → 30,4");
  assert(s.ja14 === 1.16 && s.multJA === 38.9, "janeiro–agosto: 1,16 mil milhões em 2014, 38,9 (≈39) vezes menos do que em 2026 (valores nominais)");
  assert(s.multJAR === 22.2 && s.chgJAR === 36.7 && s.ofChgJAR === -15, "em dólares constantes de 2021: 22,2 vezes mais do que em 2014; +36,7% face a 2025; escritórios −15,0%");
  assert(s.ofChgJA === -11.1, "escritórios: −11,1% de janeiro a agosto face a 2025");
  assert(s.dcJan14 === 0.124 && s.ofJan14 === 2.46, "janeiro de 2014: 0,124 mil milhões em centros de dados, 2,46 em escritórios");
  const rows = all.map((o) => { const [y, m] = o.date.split("-").map(Number); return { x: r3(y + (m - 1) / 12), label: `${MES[m - 1]} ${y}`, dc: r3(o.dc / 1e9), of: r3(o.of / 1e9) }; });
  write("centros-dados-escritorios-eua-2014-2026", {
    rows,
    config: {
      x: { min: 2014, max: 2026.75, ticks: [2014, 2016, 2018, 2020, 2022, 2024, 2026], tableLabel: "Mês" },
      y: { label: "Despesa mensal em construção (mil milhões de dólares)", suffix: " mil M$", decimals: 2, linMin: 0, linMax: 8, logDefault: false, linTicks: [0, 2, 4, 6, 8] },
      series: [
        { key: "dc", label: "Centros de dados", short: "Centros dados", color: "--accent-2", width: 2.6 },
        { key: "of", label: "Escritórios", short: "Escritórios", color: "--accent-3", width: 2 },
      ],
      labelMargin: [96, 112],
      shortEndLabels: true,
      shade: [{ from: r3(2025 + 8 / 12), to: 2026.75, exact: true }],
      howToRead: "Cada linha é a despesa de um mês em obras de construção privada nos EUA, em dólares correntes, sem ajuste de sazonalidade. Não inclui servidores nem outro equipamento informático, nem o terreno. A faixa sombreada marca os meses desde setembro de 2025, todos com mais despesa em centros de dados do que em escritórios.",
    },
    summary: s,
  }, rawFiles("centros-dados-eua"));
}

// 3. Gelo marinho: anomalia da extensão média anual face a 1981–2010, Antártida e Ártico (NSIDC, via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "gelo-marinho", "owid_catalog_sea_ice_index_2026-11-11.csv"), "utf8")).map((o) => ({ loc: o.location, y: +o.date.slice(0, 4), m: +o.date.slice(5, 7), v: +o.sea_ice_extent }));
  assert(all.length === 1148, "1 148 médias mensais (dois hemisférios)");
  const annual = (loc) => {
    const out = {};
    for (let y = 1979; y <= 2025; y++) { const a = all.filter((o) => o.loc === loc && o.y === y); out[y] = a.length === 12 ? a.reduce((t, o) => t + o.v, 0) / 12 : null; }
    return out;
  };
  const S = annual("Southern Hemisphere"), N = annual("Northern Hemisphere");
  const incomplete = Object.keys(S).filter((y) => S[y] == null);
  assert(incomplete.join() === "1987,1988" && Object.keys(N).filter((y) => N[y] == null).join() === "1987,1988", "anos incompletos (falha do satélite em dez. 1987–jan. 1988): 1987 e 1988, deixados em branco");
  const base = (A) => { const ys = Object.keys(A).filter((y) => y >= 1981 && y <= 2010 && A[y] != null); return { n: ys.length, mean: ys.reduce((t, y) => t + A[y], 0) / ys.length }; };
  const bS = base(S), bN = base(N);
  assert(bS.n === 28 && bN.n === 28, "média de referência 1981–2010 com 28 anos completos");
  const rows = Object.keys(S).map((y) => ({ cat: y, ant: S[y] == null ? null : r2(S[y] - bS.mean), arc: N[y] == null ? null : r2(N[y] - bN.mean), antExt: S[y] == null ? null : r2(S[y]), arcExt: N[y] == null ? null : r2(N[y]) }));
  const valid = rows.filter((r) => r.ant != null);
  const lowS = [...valid].sort((a, b) => a.antExt - b.antExt), lowN = [...valid].sort((a, b) => a.arcExt - b.arcExt);
  const maxS = [...valid].sort((a, b) => b.antExt - a.antExt)[0];
  // mês de setembro (máximo antártico) e março (máximo ártico) de 2026
  const sep = all.filter((o) => o.loc === "Southern Hemisphere" && o.m === 9).sort((a, b) => a.v - b.v);
  const s = {
    baseS: r2(bS.mean), baseN: r2(bN.mean), max: maxS.cat, maxAnom: maxS.ant, maxExt: maxS.antExt,
    low7: lowS.slice(0, 7).map((r) => r.cat), low8: lowS[7].cat, min: lowS[0].cat, minAnom: lowS[0].ant, minExt: lowS[0].antExt,
    a2025: rows.find((r) => r.cat === "2025").ant, a2015: rows.find((r) => r.cat === "2015").ant, a2016: rows.find((r) => r.cat === "2016").ant,
    lowN3: lowN.slice(0, 3).map((r) => r.cat), n2025: rows.find((r) => r.cat === "2025").arc,
    negSince: valid.filter((r) => +r.cat >= 2016).every((r) => r.ant < 0), posBefore: valid.filter((r) => +r.cat >= 2012 && +r.cat <= 2015).every((r) => r.ant > 0),
    arcNegSince: valid.filter((r) => r.arc >= 0).map((r) => r.cat).at(-1),
    sep26: r2(sep.find((o) => o.y === 2026).v), sep26rank: sep.findIndex((o) => o.y === 2026) + 1, sepN: sep.length, sepLow: sep.slice(0, 3).map((o) => o.y),
  };
  console.log(s);
  assert(s.baseS === 11.6 && s.baseN === 11.62, "média anual de referência 1981–2010: Antártida 11,60 milhões de km², Ártico 11,62");
  assert(s.max === "2014" && s.maxAnom === 1.13 && s.maxExt === 12.73, "máximo antártico da série: 2014, 12,73 milhões de km² (+1,13 face à referência)");
  assert(s.low7.slice().sort().join() === "2017,2018,2019,2022,2023,2024,2025" && s.low8 === "1986", "os sete anos com menos gelo antártico são todos de 2017 a 2025; o oitavo é 1986");
  assert(s.min === "2023" && s.minAnom === -1.71 && s.minExt === 9.89, "mínimo antártico: 2023, 9,89 milhões de km² (−1,71)");
  assert(s.negSince && s.posBefore && s.a2016 === -0.42 && s.a2025 === -1.01, "Antártida: acima da referência de 2012 a 2015 e abaixo em todos os anos desde 2016 (2025: −1,01)");
  assert(s.lowN3.join() === "2025,2020,2016" && s.n2025 === -1.47 && s.arcNegSince === "2001", "Ártico: 2025 é o ano com menos gelo (−1,47); o último ano acima da referência foi 2001");
  assert(s.sep26 === 17.32 && s.sep26rank === 3 && s.sepN === 48 && s.sepLow.join() === "2023,2024,2026", "setembro de 2026 (máximo antártico): 17,32 milhões de km², terceiro mais baixo em 48 anos");
  write("gelo-marinho-antartida-artico-1979-2025", {
    rows,
    views: [
      { id: "ant", label: "Antártida", yLabel: "Extensão média anual do gelo marinho face à média de 1981–2010 (milhões de km²)", unit: " M km²", decimals: 2, marginLeft: [34, 40], labelEvery: 4, labelEveryNarrow: 8,
        series: [{ key: "ant", label: "Antártida", color: "--accent-2", negColor: "--accent-3" }],
        tipExtra: [{ key: "antExt", label: "Extensão média", suffix: " milhões de km²" }],
        notes: [{ cat: "2014", text: "2014: máximo", short: "2014" }, { cat: "2023", text: "2023: mínimo", short: "2023" }] },
      { id: "arc", label: "Ártico", yLabel: "Extensão média anual do gelo marinho face à média de 1981–2010 (milhões de km²)", unit: " M km²", decimals: 2, marginLeft: [34, 40], labelEvery: 4, labelEveryNarrow: 8,
        series: [{ key: "arc", label: "Ártico", color: "--accent-2", negColor: "--accent-3" }],
        tipExtra: [{ key: "arcExt", label: "Extensão média", suffix: " milhões de km²" }],
        notes: [{ cat: "2025", text: "2025: mínimo", short: "2025" }] },
    ],
    summary: s,
  }, rawFiles("gelo-marinho"));
}

// 4. Preço real de um prego desde 1695 (Sichel, 2022; cópia owid-datasets)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "pregos-sichel", "Price_of_nails_since_1695_(Daniel_Sichels_(2017)).csv"), "utf8"));
  const K = "Matched Model, Real price (cents/nail 2010$) (Daniel Sichel (2017))";
  const pts = all.filter((o) => o[K] !== "").map((o) => ({ y: +o.Year, v: +o[K] }));
  assert(pts.length === 317 && pts[0].y === 1695 && pts.at(-1).y === 2011 && pts.every((p, i) => i === 0 || p.y === pts[i - 1].y + 1), "317 anos seguidos, de 1695 a 2011");
  const at = (y) => pts.find((p) => p.y === y).v;
  const avg = (a, b) => { const s = pts.filter((p) => p.y >= a && p.y <= b); return s.reduce((t, p) => t + p.v, 0) / s.length; };
  const min = pts.reduce((m, p) => (p.v < m.v ? p : m)), max = pts.reduce((m, p) => (p.v > m.v ? p : m));
  const s = {
    v1695: at(1695), v2011: at(2011), min: min.v, minYear: min.y, max: max.v, maxYear: max.y,
    avg1700s: r2(avg(1700, 1799)), avg1750s: r2(avg(1750, 1799)), avg1930s: r2(avg(1930, 1939)), avg1940s: r2(avg(1940, 1949)), avg2000s: r2(avg(2000, 2011)), v1800: at(1800), v1890: at(1890), v1950: at(1950),
  };
  s.fall1750sTo1930s = r1((1 - s.avg1930s / s.avg1750s) * 100); s.factor = r1(avg(1750, 1799) / avg(1930, 1939)); s.riseFromMin = r1(s.v2011 / s.min); s.vs1695 = r1((s.v2011 / s.v1695) * 100);
  console.log(s);
  assert(s.v1695 === 1.54 && s.v2011 === 0.53, "1695: 1,54 cêntimos por prego; 2011: 0,53 (dólares de 2010)");
  assert(s.min === 0.17 && s.minYear === 1944 && s.max === 2.81 && s.maxYear === 1732, "mínimo 0,17 em 1944; máximo 2,81 em 1732");
  assert(s.avg1750s === 1.74 && s.avg1930s === 0.24 && s.avg1940s === 0.24 && s.factor === 7.2 && s.fall1750sTo1930s === 86.2, "média 1750–1799: 1,74 cêntimos; médias dos anos 1930 e 1940: 0,24 — 7,2 vezes menos (−86,2%)");
  assert(s.riseFromMin === 3.1 && s.avg2000s === 0.37 && s.vs1695 === 34.4, "em 2011 o prego custava 3,1 vezes o mínimo de 1944 e 34,4% do preço de 1695; média 2000–2011: 0,37");
  assert(s.v1800 === 1.4 && s.v1890 === 0.48 && s.v1950 === 0.34, "1800: 1,40; 1890: 0,48; 1950: 0,34");
  const rows = pts.map((p) => ({ x: p.y, v: p.v }));
  write("preco-pregos-1695-2011", {
    rows,
    config: {
      x: { min: 1695, max: 2011, ticks: [1700, 1750, 1800, 1850, 1900, 1950, 2000], tableLabel: "Ano" },
      y: { label: "Preço real de um prego de 2 polegadas (cêntimos de dólar de 2010)", suffix: " cênt.", decimals: 2, logDefault: false, logMin: 0.1, logMax: 4, linMin: 0, linMax: 3, linTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3], logTicks: [0.1, 0.2, 0.5, 1, 2] },
      series: [{ key: "v", label: "Preço real por prego", color: "--accent-2", width: 1.8 }],
      scaleToggle: true,
      shade: [{ from: 1814, to: 1889, label: "Pregos cortados à máquina", short: "Cortados", top: true }],
      annotations: [
        { x: 1944, key: "v", text: "1944: 0,17 cêntimos, o mínimo", short: "1944: mínimo", dx: 0, dy: -48, anchor: "middle" },
        { x: 2011, key: "v", text: "2011: 0,53", short: "0,53", dx: -6, dy: -12, anchor: "end" },
      ],
      howToRead: "A linha mostra quanto custaria hoje, descontada a inflação, um prego comum de 2 polegadas em cada ano. Até 1792 os preços são ingleses; depois, dos EUA. A faixa sombreada marca a era dos pregos cortados à máquina; antes eram forjados à mão, depois feitos de arame.",
    },
    summary: s,
  }, rawFiles("pregos-sichel"));
}

// 5. Cesarianas por 100 nados-vivos, UE, 2015 → 2024 (Eurostat hlth_co_ces)
{
  const J = jsonstat(path.join(RAW, "cesarianas-ue", "eurostat_hlth_co_ces.json"));
  const g = (c, t) => J.get({ icha_hc: "TOT_PAT", unit: "P_TLBRTH", geo: c, time: String(t) }).value;
  const ptSeries = []; for (let y = 1990; y <= 2024; y++) ptSeries.push({ y, v: g("PT", y) });
  assert(ptSeries.every((o) => o.v != null) && g("PT", 2025) == null, "Portugal: série completa de 1990 a 2024; 2025 ainda sem dados");
  const ptMax = ptSeries.reduce((m, o) => (o.v > m.v ? o : m));
  const prev = ptSeries.filter((o) => o.y <= 2014).reduce((m, o) => (o.v > m.v ? o : m));
  const minAfter = ptSeries.filter((o) => o.y >= 2010).reduce((m, o) => (o.v < m.v ? o : m));
  const incl = EU27.filter((c) => g(c, 2015) != null && g(c, 2024) != null);
  const excl = EU27.filter((c) => !incl.includes(c));
  assert(excl.join() === "BE,EL", "excluídos por falta de 2015: Bélgica e Grécia");
  const rows = incl.map((c) => ({ label: NOME[c], a: r1(g(c, 2015) / 10), b: r1(g(c, 2024) / 10), highlight: c === "PT" || undefined }));
  const all24 = EU27.map((c) => ({ c, v: r1(g(c, 2024) / 10) })).sort((a, b) => b.v - a.v);
  const up = incl.filter((c) => g(c, 2024) > g(c, 2015));
  const s = {
    pt24: r1(g("PT", 2024) / 10), pt15: r1(g("PT", 2015) / 10), pt12: r1(g("PT", 2012) / 10), pt10: r1(g("PT", 2010) / 10), pt90: r1(g("PT", 1990) / 10),
    ptMaxYear: ptMax.y, prevMaxYear: prev.y, prevMax: r1(prev.v / 10), minAfterYear: minAfter.y,
    eu24: r1(g("EU27_2020", 2024) / 10), eu23: r1(g("EU27_2020", 2023) / 10),
    rankPT: all24.findIndex((o) => o.c === "PT") + 1, top: all24.slice(0, 7).map((o) => `${o.c} ${o.v}`), low: all24.at(-1), nUp: up.length, nIncl: incl.length,
    it15: r1(g("IT", 2015) / 10), it24: r1(g("IT", 2024) / 10), es15: r1(g("ES", 2015) / 10), es24: r1(g("ES", 2024) / 10), nl24: r1(g("NL", 2024) / 10),
    ptN24: g("PT", 2024) && J.get({ icha_hc: "TOT_PAT", unit: "NR", geo: "PT", time: "2024" }).value,
  };
  s.ptRisePts = r1((g("PT", 2024) - g("PT", 2015)) / 10);
  console.log(s);
  assert(s.pt24 === 38.3 && s.ptMaxYear === 2024, "Portugal 2024: 38,3 cesarianas por 100 nados-vivos, o valor mais alto desde 1990");
  assert(s.pt12 === 36.9 && s.prevMaxYear === 2012 && s.pt15 === 32 && s.minAfterYear === 2015 && s.ptRisePts === 6.2, "pico anterior 36,9 em 2012; mínimo de 32,0 em 2015; +6,2 pontos até 2024 (valores não arredondados)");
  assert(s.pt90 === 18.6, "1990: 18,6");
  assert(s.eu24 === 30.2 && s.rankPT === 7 && s.top.join() === "CY 62.9,RO 57.2,EL 51.4,BG 47.1,PL 42.8,IE 39.9,PT 38.3", "UE 2024: 30,2; Portugal é o 7.º mais alto (depois de Chipre, Roménia, Grécia, Bulgária, Polónia e Irlanda)");
  assert(s.low.c === "NL" && s.nl24 === 16, "o valor mais baixo é o dos Países Baixos: 16,0");
  assert(s.nIncl === 25 && s.nUp === 20, "entre 2015 e 2024, a taxa subiu em 20 dos 25 países com dados");
  assert(s.it15 === 35.7 && s.it24 === 31.3 && s.es15 === 24.7 && s.es24 === 24.7, "Itália desceu de 35,7 para 31,3; Espanha ficou em 24,7");
  assert(s.ptN24 === 32392, "Portugal 2024: 32 392 cesarianas");
  write("cesarianas-ue-2015-2024", {
    rows,
    config: {
      aLabel: "2015", bLabel: "2024", unit: "", decimals: 1, domain: [10, 70], ref: 30.2, refLabel: "UE, 2024: 30,2",
      itemLabel: "país", sorts: [["b", "Valor de 2024"], ["delta", "Variação desde 2015"]],
      howToRead: "Cada linha é um país. O ponto cinzento é o número de cesarianas por cada 100 nados-vivos em 2015 e o ponto colorido o de 2024; o comprimento do traço é a mudança. A linha tracejada é a média da UE em 2024.",
    },
    summary: s,
  }, rawFiles("cesarianas-ue"));
}
