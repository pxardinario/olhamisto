// Transformação reprodutível dos dados brutos da edição de 2026-11-27.
// Uso: node tools/prepare-2026-11-27.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, bars, dumbbell — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}
const rawFiles = (dir) => fs.readdirSync(path.join(RAW, dir)).map((f) => path.join(RAW, dir, f));
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const split = (l) => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"' && cur === "") q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
  const h = split(lines[0]);
  return lines.slice(1).map((l) => { const r = split(l); return Object.fromEntries(h.map((k, i) => [k, r[i]])); });
}
const num = (s) => (s === "" || s == null ? null : +s);
// JSON-stat 2.0 do Eurostat: valor por coordenadas {dim: código}; dimensões omitidas têm de ter tamanho 1.
function jsonstat(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const strides = []; let s = 1;
  for (let i = d.id.length - 1; i >= 0; i--) { strides[i] = s; s *= d.size[i]; }
  const get = (c) => {
    let k = 0;
    d.id.forEach((dim, i) => {
      const idx = d.dimension[dim].category.index;
      const code = c[dim] ?? (d.size[i] === 1 ? Object.keys(idx)[0] : undefined);
      if (code === undefined || idx[code] === undefined) throw new Error(`dimensão ${dim}: código ${code} em falta`);
      k += idx[code] * strides[i];
    });
    const v = d.value[String(k)];
    return v == null ? null : v;
  };
  const flag = (c) => { let k = 0; d.id.forEach((dim, i) => { const idx = d.dimension[dim].category.index; const code = c[dim] ?? Object.keys(idx)[0]; k += idx[code] * strides[i]; }); return d.status?.[String(k)] ?? null; };
  return { d, get, flag, updated: d.updated };
}

// 1. Black Friday: quanto dezembro vende a mais do que novembro no comércio a retalho não alimentar, 2005–2025
{
  const C = { PT: "Portugal", ES: "Espanha", FR: "França", IT: "Itália", DE: "Alemanha" };
  const J = Object.fromEntries(Object.keys(C).map((g) => [g, jsonstat(path.join(RAW, "black-friday-retalho", `eurostat_sts_trtu_m_${g}.json`))]));
  const v = (g, nace, y, m) => J[g].get({ nace_r2: nace, time: `${y}-${String(m).padStart(2, "0")}` });
  const decNov = (g, nace, y) => { const n = v(g, nace, y, 11), dd = v(g, nace, y, 12); return n && dd ? r1((dd / n - 1) * 100) : null; };
  const novOct = (g, nace, y) => { const o = v(g, nace, y, 10), n = v(g, nace, y, 11); return o && n ? r1((n / o - 1) * 100) : null; };
  const NF = "G47_NFOOD_X_G473";
  const rows = [];
  for (let y = 2005; y <= 2025; y++) {
    const r = { x: y };
    for (const g of Object.keys(C)) r[g.toLowerCase()] = decNov(g, NF, y);
    rows.push(r);
  }
  assert(rows.every((r) => Object.keys(C).every((g) => r[g.toLowerCase()] != null)), "não alimentar (sem combustível): os cinco países têm outubro, novembro e dezembro de 2005 a 2025");
  const pt = (y) => rows.find((r) => r.x === y).pt;
  const s = {
    pt05: pt(2005), pt10: pt(2010), pt14: pt(2014), pt15: pt(2015), pt25: pt(2025), pt21: pt(2021),
    ptMax: Math.max(...rows.map((r) => r.pt)), ptMaxYear: rows.find((r) => r.pt === Math.max(...rows.map((q) => q.pt))).x,
    ptMin: Math.min(...rows.map((r) => r.pt)),
    ptNovOct14: novOct("PT", NF, 2014), ptNovOct25: novOct("PT", NF, 2025),
    ptAvg0514: r1(rows.filter((r) => r.x <= 2014).reduce((a, r) => a + r.pt, 0) / 10),
    ptAvg2125: r1(rows.filter((r) => r.x >= 2021).reduce((a, r) => a + r.pt, 0) / 5),
    es14: rows.find((r) => r.x === 2014).es, es25: rows.find((r) => r.x === 2025).es,
    fr14: rows.find((r) => r.x === 2014).fr, fr25: rows.find((r) => r.x === 2025).fr,
    it14: rows.find((r) => r.x === 2014).it, it25: rows.find((r) => r.x === 2025).it,
    de14: rows.find((r) => r.x === 2014).de, de25: rows.find((r) => r.x === 2025).de,
    ict14: decNov("PT", "G474", 2014), ict25: decNov("PT", "G474", 2025), ict13: decNov("PT", "G474", 2013),
    ictNovOct14: novOct("PT", "G474", 2014), ictNovOct25: novOct("PT", "G474", 2025),
    webNovOct25: novOct("PT", "G4791", 2025),
    ptOct25: v("PT", NF, 2025, 10), ptNov25: v("PT", NF, 2025, 11), ptDec25: v("PT", NF, 2025, 12),
    updated: J.PT.updated,
  };
  console.log(s);
  assert(s.pt10 === 44.9 && s.pt10 === s.ptMax && s.ptMaxYear === 2010, "Portugal: em 2010, dezembro vendeu mais 44,9% do que novembro, o máximo da série 2005–2025");
  assert(s.pt14 === 36.1 && s.pt25 === 15.6, "Portugal: +36,1% em 2014, +15,6% em 2025");
  assert(s.ptMin === 15.6 && rows.filter((r) => r.pt === 15.6).length === 1 && pt(2021) === 15.9, "Portugal: 2025 é o mínimo da série (+15,6%); 2021 ficou em +15,9%");
  assert(s.ptNovOct14 === -1.7 && s.ptNovOct25 === 10.5, "Portugal: novembro vendeu −1,7% do que outubro em 2014 e +10,5% em 2025");
  assert(s.ptAvg0514 === 37 && s.ptAvg2125 === 18.6, "Portugal: média de +37,0% em 2005–2014 e +18,6% em 2021–2025");
  assert(s.ict14 === 58.3 && s.ict25 === 2.8 && s.ict13 === 95.1, "eletrónica e informática (G474): dezembro +95,1% em 2013, +58,3% em 2014, +2,8% em 2025");
  assert(s.ictNovOct14 === 0.1 && s.ictNovOct25 === 17.3, "eletrónica e informática: novembro face a outubro +0,1% em 2014 e +17,3% em 2025");
  assert(s.es14 === 28 && s.es25 === 17.8 && s.fr14 === 32.7 && s.fr25 === 19.7 && s.it14 === 31 && s.it25 === 19.9 && s.de14 === 15.4 && s.de25 === 3.6, "Espanha 28,0→17,8; França 32,7→19,7; Itália 31,0→19,9; Alemanha 15,4→3,6 (2014→2025)");
  write("black-friday-dezembro-novembro-2005-2025", {
    rows,
    config: {
      x: { min: 2005, max: 2025, ticks: [2005, 2010, 2015, 2020, 2025], tableLabel: "Ano" },
      y: { label: "Vendas de dezembro face a novembro (%)", suffix: "%", decimals: 1, linMin: -10, linMax: 70, logDefault: false, linTicks: [-10, 0, 10, 20, 30, 40, 50, 60, 70] },
      scaleToggle: false,
      dots: false,
      series: [
        { key: "pt", label: "Portugal", short: "Portugal", color: "--accent", width: 3 },
        { key: "it", label: "Itália", short: "Itália", color: "--accent-2", width: 1.8 },
        { key: "fr", label: "França", short: "França", color: "--accent-3", width: 1.8 },
        { key: "es", label: "Espanha", short: "Espanha", color: "--accent-4", width: 1.8 },
        { key: "de", label: "Alemanha", short: "Alemanha", color: "--ink-3", width: 1.8 },
      ],
      labelMargin: [96, 96],
      shortEndLabels: true,
      refLine: { value: 0, label: "Dezembro igual a novembro", short: "Igual", at: 2015 },
      annotations: [{ x: 2010, key: "pt", text: "2010: +44,9%", short: "+44,9%", dx: 6, dy: -6, anchor: "start" }],
      howToRead: "Cada linha mostra, para cada ano, quanto o volume de vendas de dezembro superou o de novembro no comércio a retalho não alimentar (sem combustíveis). Um valor de 40% quer dizer que dezembro vendeu 1,4 vezes o que vendeu novembro. Quanto mais baixa a linha, mais as compras de fim de ano passaram para novembro.",
    },
    summary: s,
  }, rawFiles("black-friday-retalho"));
}

// 2. Crimes registados em Portugal por categoria, 2008/2016–2024 (Eurostat, ICCS)
{
  const J = jsonstat(path.join(RAW, "crime-registado-pt", "eurostat_crim_off_cat_PT.json"));
  const CAT = [
    ["ICCS0101", "Homicídio voluntário", "Homicídio"], ["ICCS020111", "Ofensa física grave", "Ofensa grave"], ["ICCS020221", "Rapto e sequestro", "Rapto"],
    ["ICCS0301", "Violência sexual", "Viol. sexual"], ["ICCS0401", "Roubo", "Roubo"], ["ICCS05012", "Furto e roubo em casa", "Furto em casa"], ["ICCS05021", "Furto de veículos", "Furto de veículos"],
    ["ICCS0502", "Furto (todos)", "Furto (todos)"], ["ICCS0601", "Crimes de droga", "Droga"], ["ICCS0701", "Burla e fraude", "Burla e fraude"], ["ICCS0903", "Crimes informáticos", "Informáticos"],
    ["ICCS0703", "Corrupção", "Corrupção"],
  ];
  const rate = (c, y) => J.get({ iccs: c, unit: "P_HTHAB", time: String(y) });
  const nr = (c, y) => J.get({ iccs: c, unit: "NR", time: String(y) });
  const pct = (a, b) => (a != null && b != null ? r1((b / a - 1) * 100) : null);
  const rows = CAT.map(([c, label, short]) => ({ label, short, code: c, d16: pct(rate(c, 2016), rate(c, 2024)), d08: pct(rate(c, 2008), rate(c, 2024)), r08: rate(c, 2008), r16: rate(c, 2016), r24: rate(c, 2024), n24: nr(c, 2024) }));
  assert(rows.every((r) => r.r16 != null && r.r24 != null), "as 12 categorias têm taxa em 2016 e 2024");
  const R = Object.fromEntries(rows.map((r) => [r.code, r]));
  const s = {
    homR08: R.ICCS0101.r08, homR24: R.ICCS0101.r24, homN24: R.ICCS0101.n24, homN08: nr("ICCS0101", 2008), homD08: R.ICCS0101.d08,
    resR08: R.ICCS05012.r08, resR24: R.ICCS05012.r24, resD08: R.ICCS05012.d08, resN24: R.ICCS05012.n24, resN08: nr("ICCS05012", 2008),
    robD08: R.ICCS0401.d08, vehD08: R.ICCS05021.d08, theftD08: R.ICCS0502.d08,
    fraudR16: R.ICCS0701.r16, fraudR24: R.ICCS0701.r24, fraudD16: R.ICCS0701.d16, fraudN24: R.ICCS0701.n24, fraudN16: nr("ICCS0701", 2016), fraudR23: rate("ICCS0701", 2023),
    cyberR16: R.ICCS0903.r16, cyberR24: R.ICCS0903.r24, cyberD16: R.ICCS0903.d16, cyberN24: R.ICCS0903.n24,
    sexD08: R.ICCS0301.d08, sexD16: R.ICCS0301.d16, sexN24: R.ICCS0301.n24,
    drugD16: R.ICCS0601.d16,
    nDown16: rows.filter((r) => r.d16 < 0).length, nUp16: rows.filter((r) => r.d16 > 0).length,
    fraudVsRes24: r1(R.ICCS0701.r24 / R.ICCS05012.r24), fraudVsRob24: r1(R.ICCS0701.r24 / R.ICCS0401.r24),
    updated: J.updated,
  };
  console.log(s, rows.map((r) => `${r.code} ${r.d08} ${r.d16}`).join(" | "));
  assert(s.resR08 === 281.08 && s.resR24 === 74.07 && s.resD08 === -73.6, "furto/roubo em residência: 281,1 → 74,1 por 100 mil (2008→2024), −73,6%");
  assert(s.robD08 === -55.3 && s.vehD08 === -67.2 && s.homD08 === -41.9, "roubo −55,3%, furto de veículos −67,2%, homicídio −41,9% (2008→2024, por habitante)");
  assert(s.homR08 === 1.17 && s.homR24 === 0.68, "homicídio voluntário: 1,17 → 0,68 por 100 mil");
  assert(s.fraudR16 === 188.39 && s.fraudR24 === 427.52 && s.fraudD16 === 126.9 && s.fraudR23 === 496.72, "burla e fraude: 188,4 → 427,5 por 100 mil (2016→2024), +126,9%; máximo de 496,7 em 2023");
  assert(s.cyberR16 === 7.75 && s.cyberR24 === 23.42 && s.cyberD16 === 202.2, "crimes contra sistemas informáticos: 7,75 → 23,42 por 100 mil, +202,2%");
  assert(s.fraudVsRes24 === 5.8, "em 2024, as burlas registadas foram 5,8 vezes os furtos e roubos em residência");
  assert(s.sexD08 === 42.6, "violência sexual: +42,6% por habitante desde 2008");
  write("crime-registado-portugal-2008-2024", {
    rows: rows.map(({ code, r08, r16, n24, ...q }) => ({ ...q, r08, r16, n24 })),
    config: {
      views: [
        { id: "d16", label: "Desde 2016", key: "d16", axisLabel: "Variação da taxa de crimes registados por 100 mil habitantes, 2016–2024 (%)", axisShort: "Variação 2016–2024 (%)" },
        { id: "d08", label: "Desde 2008", key: "d08", axisLabel: "Variação da taxa de crimes registados por 100 mil habitantes, 2008–2024 (%)", axisShort: "Variação 2008–2024 (%)" },
      ],
      unit: "%",
      decimals: 1,
      posLabel: "Subiu",
      negLabel: "Desceu",
      howToRead: "Cada barra é uma categoria de crime registado: quanto mudou o número de crimes registados pela polícia por 100 mil habitantes em Portugal. As barras para a direita são subidas; para a esquerda, descidas. Na vista «Desde 2008» faltam as categorias que só começaram a ser contadas em 2016. Registos policiais não são o total de crimes cometidos.",
    },
    summary: s,
  }, rawFiles("crime-registado-pt"));
}

// 3. Línguas estrangeiras estudadas no 3.º ciclo e no secundário geral, Portugal e UE (Eurostat)
{
  const J = jsonstat(path.join(RAW, "linguas-escolas", "eurostat_educ_uoe_lang01_PT_EU.json"));
  const J3 = jsonstat(path.join(RAW, "linguas-escolas", "eurostat_educ_uoe_lang03_PT_EU.json"));
  const p = (l, lv, g, y) => J.get({ unit: "PC", language: l, isced11: lv, geo: g, time: String(y) });
  const avg = (lv, g, y) => J3.get({ unit: "NR", isced11: lv, geo: g, time: String(y) });
  const L = [["ENG", "Inglês"], ["FRE", "Francês"], ["SPA", "Espanhol"], ["GER", "Alemão"]];
  const LV = [["ED2", "3.º ciclo", "3.º ciclo"], ["ED34", "secundário (cursos gerais)", "sec. geral"]];
  const rows = [];
  for (const [lv, lvl, lvs] of LV) for (const [l, ll] of L) rows.push({ label: `${ll} · ${lvl}`, short: `${ll} · ${lvs}`, a: p(l, lv, "PT", 2013), b: p(l, lv, "PT", 2024), c: p(l, lv, "EU27_2020", 2024) });
  assert(rows.length === 8 && rows.every((r) => r.a != null && r.b != null && r.c != null), "8 linhas (4 línguas × 2 níveis), com Portugal 2013, Portugal 2024 e UE 2024");
  const s = {
    freED2pt24: p("FRE", "ED2", "PT", 2024), freED2eu24: p("FRE", "ED2", "EU27_2020", 2024), freED2pt25: p("FRE", "ED2", "PT", 2025),
    freED34pt24: p("FRE", "ED34", "PT", 2024), freED34eu24: p("FRE", "ED34", "EU27_2020", 2024), freED34pt13: p("FRE", "ED34", "PT", 2013),
    gerED2pt24: p("GER", "ED2", "PT", 2024), gerED2eu24: p("GER", "ED2", "EU27_2020", 2024), gerED34pt24: p("GER", "ED34", "PT", 2024), gerED34eu24: p("GER", "ED34", "EU27_2020", 2024),
    engED34pt24: p("ENG", "ED34", "PT", 2024), engED34eu24: p("ENG", "ED34", "EU27_2020", 2024), engED34pt13: p("ENG", "ED34", "PT", 2013),
    engED2pt24: p("ENG", "ED2", "PT", 2024), engED2eu24: p("ENG", "ED2", "EU27_2020", 2024),
    spaED2pt24: p("SPA", "ED2", "PT", 2024), spaED2eu24: p("SPA", "ED2", "EU27_2020", 2024), spaED34pt24: p("SPA", "ED34", "PT", 2024), spaED34eu24: p("SPA", "ED34", "EU27_2020", 2024),
    avgED2pt24: avg("ED2", "PT", 2024), avgED2eu24: avg("ED2", "EU27_2020", 2024), avgED34pt24: avg("ED34", "PT", 2024), avgED34eu24: avg("ED34", "EU27_2020", 2024),
    avgED34pt13: avg("ED34", "PT", 2013), avgED34pt25: avg("ED34", "PT", 2025),
    updated: J.updated,
  };
  console.log(s);
  assert(s.freED2pt24 === 70.5 && s.freED2eu24 === 29.4, "3.º ciclo, 2024: 70,5% estudam francês em Portugal, 29,4% na UE");
  assert(s.freED34pt24 === 1.7 && s.freED34eu24 === 20 && s.freED34pt13 === 2.6, "secundário geral: francês 2,6% (2013) → 1,7% (2024) em Portugal; 20,0% na UE");
  assert(s.gerED34pt24 === 0.9 && s.gerED34eu24 === 20.8 && s.gerED2pt24 === 1.3 && s.gerED2eu24 === 20.1, "alemão, 2024: 1,3% (3.º ciclo) e 0,9% (secundário geral) em Portugal; 20,1% e 20,8% na UE");
  assert(s.engED34pt24 === 67.3 && s.engED34eu24 === 96.4 && s.engED34pt13 === 59.2, "inglês no secundário geral: 67,3% em Portugal (59,2% em 2013), 96,4% na UE");
  assert(s.avgED2pt24 === 1.9 && s.avgED2eu24 === 1.6 && s.avgED34pt24 === 0.8 && s.avgED34eu24 === 1.6, "línguas estrangeiras por aluno, 2024: 1,9 contra 1,6 no 3.º ciclo; 0,8 contra 1,6 no secundário geral");
  assert(s.spaED34pt24 === 10.4 && s.spaED34eu24 === 27.5, "espanhol no secundário geral: 10,4% em Portugal, 27,5% na UE");
  write("linguas-estrangeiras-escolas-2013-2024", {
    rows,
    config: {
      aLabel: "Portugal, 2013",
      bLabel: "Portugal, 2024",
      cLabel: "UE, 2024",
      unit: "%",
      decimals: 1,
      domain: [0, 100],
      itemLabel: "língua e nível de ensino",
      labelWidth: 210, labelWidthNarrow: 126,
      sorts: [["b", "Portugal, 2024"], ["delta", "Variação desde 2013"]],
      howToRead: "Cada linha é uma língua num nível de ensino: a percentagem dos alunos que a estudam. O ponto cinzento é Portugal em 2013, o ponto azul Portugal em 2024 e o anel a média da UE em 2024. O 3.º ciclo vai do 7.º ao 9.º ano; o secundário geral são os cursos científico-humanísticos (10.º ao 12.º ano), sem os profissionais.",
    },
    summary: s,
  }, rawFiles("linguas-escolas"));
}

// 4. Esperança de vida à nascença e idade média de morte de quem chega aos 10 anos (HMD)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "hmd-esperanca-vida", "owid_hmd_life_tables_period_total_e0_e10_e65.csv"), "utf8"));
  const get = (c, age) => { const m = new Map(); for (const o of all) if (o.country === c && o.age === age) m.set(+o.year, o); return m; };
  const SE0 = get("Sweden", "0"), SE10 = get("Sweden", "10"), PT0 = get("Portugal", "0"), PT10 = get("Portugal", "10"), SE65 = get("Sweden", "65");
  const rows = [];
  for (let y = 1751; y <= 2024; y++) {
    const r = { x: y };
    r.se0 = SE0.has(y) ? r1(+SE0.get(y).life_expectancy) : null;
    r.se10 = SE10.has(y) ? r1(10 + +SE10.get(y).life_expectancy) : null;
    r.pt0 = PT0.has(y) ? r1(+PT0.get(y).life_expectancy) : null;
    r.pt10 = PT10.has(y) ? r1(10 + +PT10.get(y).life_expectancy) : null;
    rows.push(r);
  }
  assert(rows.every((r) => r.se0 != null && r.se10 != null), "Suécia: série anual completa de 1751 a 2024");
  assert(rows.filter((r) => r.pt0 != null).length === 84 && rows.find((r) => r.x === 1940).pt0 != null && rows.find((r) => r.x === 2024).pt0 == null, "Portugal: 1940–2023 (84 anos)");
  const R = (y) => rows.find((r) => r.x === y);
  const surv = (m, y) => +m.get(y).number_survivors;
  const s = {
    se1800: R(1800).se0, se1800at10: R(1800).se10, seDiedBefore10_1800: r1(100 - surv(SE10, 1800) / 1000),
    se1751: R(1751).se0, se1751at10: R(1751).se10,
    se1773: R(1773).se0, se1773at10: R(1773).se10,
    se1850: R(1850).se0, se1850at10: R(1850).se10, seDiedBefore10_1850: r1(100 - surv(SE10, 1850) / 1000),
    se1900: R(1900).se0, se1900at10: R(1900).se10,
    se2024: R(2024).se0, se2024at10: R(2024).se10,
    se65_1800: r1(65 + +SE65.get(1800).life_expectancy), se65_2024: r1(65 + +SE65.get(2024).life_expectancy),
    gapMax: Math.max(...rows.map((r) => r2(r.se10 - r.se0))), gapMaxYear: rows.find((r) => r2(r.se10 - r.se0) === Math.max(...rows.map((q) => r2(q.se10 - q.se0)))).x,
    pt1940: R(1940).pt0, pt1940at10: R(1940).pt10, ptDiedBefore10_1940: r1(100 - surv(PT10, 1940) / 1000),
    pt1960: R(1960).pt0, pt1960at10: R(1960).pt10,
    pt2023: R(2023).pt0, pt2023at10: R(2023).pt10, ptDiedBefore10_2023: r2(100 - surv(PT10, 2023) / 1000),
    se0Gain1800_2024: r1(+SE0.get(2024).life_expectancy - +SE0.get(1800).life_expectancy), se10Gain1800_2024: r1(+SE10.get(2024).life_expectancy - +SE10.get(1800).life_expectancy), gainDiff: r1((+SE0.get(2024).life_expectancy - +SE0.get(1800).life_expectancy) - (+SE10.get(2024).life_expectancy - +SE10.get(1800).life_expectancy)),
    seCross: rows.find((r) => r.x > 1900 && r.se0 >= r.se10 - 1)?.x,
  };
  console.log(s);
  assert(s.se1800 === 32.2 && s.se1800at10 === 54.7 && s.seDiedBefore10_1800 === 42.6, "Suécia, 1800: esperança de vida à nascença de 32,2 anos; quem chegava aos 10 vivia em média até aos 54,7; 42,6% morriam antes dos 10");
  assert(s.se1773 === 18 && s.se1773at10 === 40.8, "Suécia, 1773 (ano de fome): 18,0 anos à nascença; 40,8 para quem chegava aos 10");
  assert(s.se1850 === 44.7 && s.se1850at10 === 58.8 && s.seDiedBefore10_1850 === 24.8, "Suécia, 1850: 44,7 à nascença, 58,8 aos 10; 24,8% morriam antes dos 10");
  assert(s.se2024 === 83.8 && s.se2024at10 === 84.1, "Suécia, 2024: 83,8 à nascença, 84,1 aos 10");
  assert(s.se0Gain1800_2024 === 51.6 && s.se10Gain1800_2024 === 29.3, "de 1800 a 2024: +51,6 anos à nascença, +29,3 anos para quem chegava aos 10");
  assert(s.gainDiff === 22.3, "a diferença entre os dois ganhos (valores não arredondados) é de 22,3 anos");
  assert(s.se65_1800 === 73.7 && s.se65_2024 === 86.3, "Suécia: quem chegava aos 65 vivia até aos 73,7 em 1800 e até aos 86,3 em 2024");
  assert(s.pt1940 === 51.4 && s.pt1940at10 === 65.2 && s.ptDiedBefore10_1940 === 21.6, "Portugal, 1940: 51,4 à nascença, 65,2 aos 10; 21,6% morriam antes dos 10");
  assert(s.pt2023 === 82.3 && s.pt2023at10 === 82.6, "Portugal, 2023: 82,3 à nascença, 82,6 aos 10");
  write("esperanca-vida-nascenca-10-anos-1751-2024", {
    rows,
    config: {
      x: { min: 1751, max: 2024, ticks: [1751, 1800, 1850, 1900, 1950, 2000, 2024], tableLabel: "Ano" },
      y: { label: "Anos de vida esperados (idade média à morte)", suffix: "", decimals: 1, linMin: 0, linMax: 90, logDefault: false, linTicks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90] },
      scaleToggle: false,
      gaps: true,
      series: [
        { key: "se10", label: "Suécia: quem chega aos 10 anos", short: "Suécia, aos 10", color: "--accent-2", width: 2.2, dash: true },
        { key: "se0", label: "Suécia: à nascença", short: "Suécia, nascença", color: "--accent-2", width: 2.2 },
        { key: "pt10", label: "Portugal: quem chega aos 10 anos", short: "Portugal, aos 10", color: "--accent", width: 2.4, dash: true },
        { key: "pt0", label: "Portugal: à nascença", short: "Portugal, nascença", color: "--accent", width: 2.4 },
      ],
      labelMargin: [110, 150],
      shortEndLabels: true,
      annotations: [
        { x: 1800, key: "se0", text: "1800: 32,2 anos à nascença", short: "32,2", dx: 6, dy: 26, anchor: "start" },
        { x: 1800, key: "se10", text: "Aos 10 anos: vivia-se até aos 54,7", short: "54,7", dx: 6, dy: -22, anchor: "start" },
      ],
      howToRead: "A linha contínua é a esperança de vida à nascença. A tracejada é a idade média a que morria quem já tinha feito 10 anos (10 mais a esperança de vida aos 10). O espaço entre as duas é o peso das mortes de crianças: quando quase todas sobrevivem, as linhas juntam-se. Valores do período: retrato da mortalidade de cada ano, não a vida real de uma geração.",
    },
    summary: s,
  }, rawFiles("hmd-esperanca-vida"));
}

// 5. Pobreza multidimensional: primeiro e último inquérito harmonizado (OPHI, MPI 2026)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "pobreza-multidimensional", "owid_ophi_global_mpi_2026_national.csv"), "utf8"))
    .filter((o) => o.flavor === "Harmonized over time" && o.area === "National" && o.headcount_ratio !== "");
  const by = new Map();
  for (const o of all) { if (!by.has(o.country)) by.set(o.country, []); by.get(o.country).push({ y: +o.year, h: +o.headcount_ratio }); }
  const pairs = [];
  for (const [c, l] of by) { if (l.length < 2) continue; l.sort((a, b) => a.y - b.y); pairs.push({ c, y0: l[0].y, h0: l[0].h, y1: l.at(-1).y, h1: l.at(-1).h }); }
  const PT = {
    India: "Índia", Bangladesh: "Bangladexe", Nigeria: "Nigéria", Pakistan: "Paquistão", Ethiopia: "Etiópia", "Democratic Republic of Congo": "RD Congo",
    Tanzania: "Tanzânia", Kenya: "Quénia", Angola: "Angola", Mozambique: "Moçambique", "Sao Tome and Principe": "São Tomé e Príncipe", "Guinea-Bissau": "Guiné-Bissau",
    "East Timor": "Timor-Leste", Afghanistan: "Afeganistão", "Central African Republic": "Rep. Centro-Africana", Chad: "Chade", Niger: "Níger",
  };
  const P = Object.fromEntries(pairs.map((q) => [q.c, q]));
  const rows = Object.entries(PT).map(([c, l]) => { const q = P[c]; if (!q) throw new Error("sem par harmonizado: " + c); return { label: `${l} (${q.y0}→${q.y1})`, short: l, a: r1(q.h0), b: r1(q.h1) }; });
  const down = pairs.filter((q) => q.h1 < q.h0), up = pairs.filter((q) => q.h1 > q.h0);
  const s = {
    nCountries: pairs.length, nDown: down.length, nUp: up.length, up: up.map((q) => q.c).sort(),
    ind: P.India, moz: P.Mozambique, ago: P.Angola, stp: P["Sao Tome and Principe"], gnb: P["Guinea-Bissau"], tls: P["East Timor"], afg: P.Afghanistan, caf: P["Central African Republic"], nga: P.Nigeria, eth: P.Ethiopia, cod: P["Democratic Republic of Congo"], bgd: P.Bangladesh, pak: P.Pakistan,
    biggestFall: [...pairs].sort((a, b) => (a.h1 - a.h0) - (b.h1 - b.h0))[0].c,
    over50last: pairs.filter((q) => q.h1 >= 50).length,
    spanMin: Math.min(...pairs.map((q) => q.y1 - q.y0)), spanMax: Math.max(...pairs.map((q) => q.y1 - q.y0)), nPre2020: pairs.filter((q) => q.y1 < 2020).length,
  };
  for (const k of ["ind", "moz", "ago", "stp", "gnb", "tls", "afg", "caf", "nga", "eth", "cod", "bgd", "pak"]) s[k] = { y0: s[k].y0, h0: r1(s[k].h0), y1: s[k].y1, h1: r1(s[k].h1) };
  console.log(s);
  assert(s.nCountries === 89 && s.nDown === 86 && s.nUp === 3 && s.up.join() === "Afghanistan,Central African Republic,Montenegro", "89 países com dois ou mais inquéritos harmonizados; 86 desceram; subiram o Afeganistão, a República Centro-Africana e o Montenegro (0,4% → 1,2%)");
  assert(s.biggestFall === "India" && s.ind.h0 === 55.1 && s.ind.h1 === 16.4 && s.ind.y0 === 2005 && s.ind.y1 === 2019, "Índia: 55,1% (2005) → 16,4% (2019), a maior descida");
  assert(s.moz.h0 === 83.9 && s.moz.h1 === 59.9 && s.ago.h0 === 51.8 && s.ago.h1 === 45.5 && s.stp.h0 === 40.7 && s.stp.h1 === 11.6 && s.gnb.h0 === 66 && s.gnb.h1 === 64.4 && s.tls.h0 === 69.6 && s.tls.h1 === 46.9, "Moçambique 83,9→59,9; Angola 51,8→45,5; São Tomé 40,7→11,6; Guiné-Bissau 66,0→64,4; Timor-Leste 69,6→46,9");
  assert(s.afg.h0 === 46.9 && s.afg.h1 === 52.2 && s.caf.h0 === 78.8 && s.caf.h1 === 84.1, "Afeganistão 46,9→52,2 (2015→2022); Rep. Centro-Africana 78,8→84,1 (2010→2018)");
  assert([...pairs].sort((a, b) => b.h1 - a.h1).slice(0, 3).map((q) => q.c).join() === "Niger,Chad,Central African Republic" && rows.length === 17, "as três taxas mais altas no último inquérito: Níger, Chade e Rep. Centro-Africana; 17 países no gráfico");
  assert(r1(P["Guinea-Bissau"].h0 - P["Guinea-Bissau"].h1) === 1.7 && r1(P.Angola.h0 - P.Angola.h1) === 6.3, "Guiné-Bissau −1,7 pontos; Angola −6,3 pontos");
  assert(s.over50last === 20 && s.spanMin === 4 && s.spanMax === 20 && s.nPre2020 === 49, "20 países com 50% ou mais no último inquérito; intervalos entre inquéritos de 4 a 20 anos; 49 dos 89 com o último inquérito antes de 2020");
  write("pobreza-multidimensional-mpi-2026", {
    rows,
    config: {
      aLabel: "Primeiro inquérito",
      bLabel: "Último inquérito",
      unit: "%",
      decimals: 1,
      domain: [0, 100],
      itemLabel: "país",
      labelWidth: 200, labelWidthNarrow: 126,
      sorts: [["b", "Último inquérito"], ["delta", "Variação"]],
      howToRead: "Cada linha é um país, com os anos do primeiro e do último inquérito entre parênteses. O ponto cinzento é a percentagem da população em pobreza multidimensional no primeiro inquérito; o azul, no último. Os períodos diferem de país para país; os valores servem para ver a mudança dentro de cada país, mais do que para comparar países.",
    },
    summary: s,
  }, rawFiles("pobreza-multidimensional"));
}
