// Transformação reprodutível dos dados brutos da edição de 2026-11-17.
// Uso: node tools/prepare-2026-11-17.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, bars, dumbbell, columns — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

function jstat(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const d = j.dimension, ids = j.id, sz = j.size;
  const idx = (o) => { let k = 0; for (let i = 0; i < ids.length; i++) { const c = o[ids[i]] ?? Object.keys(d[ids[i]].category.index)[0]; const n = d[ids[i]].category.index[c]; if (n == null) return undefined; k = k * sz[i] + n; } return k; };
  const v = (o) => { const k = idx(o); return k == null ? undefined : j.value[k]; };
  const st = (o) => { const k = idx(o); return k == null ? undefined : (j.status || {})[k]; };
  return { j, v, st };
}
function csv(file, sep = ",") {
  const txt = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur.replace(/\r$/, "")); out.push(row); row = []; cur = ""; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  const [h, ...rs] = out; return rs.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
let fails = 0;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); fails++; process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}
const rawFiles = (dir) => fs.readdirSync(path.join(RAW, dir)).map((f) => path.join(RAW, dir, f));
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const PT_EU = { AT: "Áustria", BE: "Bélgica", BG: "Bulgária", HR: "Croácia", CY: "Chipre", CZ: "Chéquia", DK: "Dinamarca", EE: "Estónia", FI: "Finlândia", FR: "França", DE: "Alemanha", EL: "Grécia", HU: "Hungria", IE: "Irlanda", IT: "Itália", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", MT: "Malta", NL: "Países Baixos", PL: "Polónia", PT: "Portugal", RO: "Roménia", SK: "Eslováquia", SI: "Eslovénia", ES: "Espanha", SE: "Suécia" };
const pct = (a, b) => (b / a - 1) * 100;

// 1. Pedidos de asilo na UE (Eurostat migr_asyappctzm)
{
  const E = jstat(path.join(RAW, "asilo-ue", "eurostat_migr_asyappctzm_EU27_total_SY.json"));
  const ti = E.j.dimension.time.category.index;
  const months = Object.keys(ti).sort((a, b) => ti[a] - ti[b]);
  const g = (cit, m, ap = "FRST") => E.v({ freq: "M", unit: "PER", citizen: cit, sex: "T", applicant: ap, age: "TOTAL", geo: "EU27_2020", time: m });
  const ms = months.filter((m) => g("TOTAL", m) != null);
  const last = ms.at(-1);
  assert(ms[0] === "2014-01" && last === "2026-08" && ms.length === 152, "152 meses com valor, de janeiro de 2014 a agosto de 2026");
  assert(months.filter((m) => m > last).every((m) => g("TOTAL", m) == null), "setembro e outubro de 2026 ainda sem valor");
  const C = jstat(path.join(RAW, "asilo-ue", "eurostat_migr_asyappctzm_paises_2026.json"));
  const geos = Object.keys(C.j.dimension.geo.category.index);
  const missing = (m) => geos.filter((gg) => gg in PT_EU && C.v({ freq: "M", unit: "PER", citizen: "TOTAL", sex: "T", applicant: "TOTAL", age: "TOTAL", geo: gg, time: m }) == null);
  assert(["2026-06", "2026-07", "2026-08"].every((m) => missing(m).length === 0), "os 27 países da UE declararam junho, julho e agosto de 2026");
  const peak = ms.reduce((a, m) => (g("TOTAL", m) > g("TOTAL", a) ? m : a));
  const sum = (cit, y, upto = 8) => Array.from({ length: upto }, (_, i) => g(cit, `${y}-${String(i + 1).padStart(2, "0")}`)).reduce((s, x) => s + x, 0);
  const s = {
    peak, peakV: g("TOTAL", peak), last: g("TOTAL", last), lastTotal: g("TOTAL", last, "TOTAL"),
    oct23: g("TOTAL", "2023-10"), syOct23: g("SY", "2023-10"),
    jan8_24: sum("TOTAL", 2024), jan8_25: sum("TOTAL", 2025), jan8_26: sum("TOTAL", 2026),
    sy24: sum("SY", 2024), sy26: sum("SY", 2026), syLast: g("SY", last), syNov24: g("SY", "2024-11"),
  };
  // mínimo desde quando? último mês com valor igual ou inferior ao de agosto de 2026
  const lowerBefore = ms.filter((m) => m < "2026-06" && g("TOTAL", m) <= Math.min(g("TOTAL", "2026-07"), g("TOTAL", "2026-08")));
  s.lowerBefore = lowerBefore;
  s.minMonth26 = ["2026-06", "2026-07", "2026-08"].reduce((a, m) => (g("TOTAL", m) < g("TOTAL", a) ? m : a));
  // por cidadania, requerentes pela primeira vez, jan.–ago. 2024 vs 2026
  const P = jstat(path.join(RAW, "asilo-ue", "eurostat_migr_asyappctzm_EU27_FRST_por_cidadania.json"));
  const cl = P.j.dimension.citizen.category;
  const sumC = (cit, y) => Array.from({ length: 8 }, (_, i) => P.v({ freq: "M", unit: "PER", citizen: cit, sex: "T", applicant: "FRST", age: "TOTAL", geo: "EU27_2020", time: `${y}-${String(i + 1).padStart(2, "0")}` }) || 0).reduce((a, b) => a + b, 0);
  const cits = Object.keys(cl.index).filter((c) => c.length === 2);
  const drops = cits.map((c) => ({ c, label: cl.label[c], a: sumC(c, 2024), b: sumC(c, 2026) })).map((q) => ({ ...q, d: q.b - q.a })).sort((p, q) => p.d - q.d);
  s.topDrops = drops.slice(0, 5);
  s.totC24 = sumC("TOTAL", 2024); s.totC26 = sumC("TOTAL", 2026);
  console.log(JSON.stringify(s));
  globalThis.ASY = { g, ms, s };
}
{
  const { g, ms, s } = globalThis.ASY;
  assert(s.peak === "2015-10" && s.peakV === 162050, "máximo da série: outubro de 2015, 162 050 pedidos pela primeira vez");
  assert(g("TOTAL", "2026-07") === 34175 && g("TOTAL", "2026-08") === 34860 && s.minMonth26 === "2026-07", "julho de 2026: 34 175 (mínimo de 2026); agosto: 34 860");
  assert(s.lowerBefore.at(-1) === "2021-05" && s.lowerBefore.filter((m) => m >= "2014-05" && m < "2020-03").length === 0, "julho de 2026: o valor mais baixo desde maio de 2021; fora da pandemia (2020–2021), desde abril de 2014");
  assert(s.oct23 === 114835 && r1(pct(s.oct23, 34175)) === -70.2, "outubro de 2023: 114 835; julho de 2026 fica 70% abaixo");
  assert(s.jan8_24 === 613350 && s.jan8_26 === 338390 && r1(pct(s.jan8_24, s.jan8_26)) === -44.8, "janeiro a agosto: 613 350 em 2024, 338 390 em 2026 (−44,8%)");
  assert(s.totC24 === s.jan8_24 && s.totC26 === s.jan8_26, "soma do ficheiro por cidadania coincide com o total");
  assert(s.sy24 === 97640 && s.sy26 === 12060 && r1(pct(s.sy24, s.sy26)) === -87.6, "sírios, janeiro a agosto: 97 640 em 2024, 12 060 em 2026 (−87,6%)");
  const share = Math.round(((s.sy24 - s.sy26) / (s.jan8_24 - s.jan8_26)) * 100);
  assert(share === 31, "os sírios explicam 31% da descida entre jan.–ago. de 2024 e de 2026");
  assert(s.topDrops.map((q) => q.c).join() === "SY,CO,TR,AF,VE" && s.topDrops[1].d === -28070 && s.topDrops[2].d === -21395, "maiores descidas: Síria, Colômbia (−28 070), Turquia (−21 395), Afeganistão, Venezuela");
  assert(r1((s.sy24 / s.jan8_24) * 100) === 15.9 && r1((s.sy26 / s.jan8_26) * 100) === 3.6, "peso dos sírios: 15,9% em 2024, 3,6% em 2026");
  const rows = ms.map((m) => { const [y, mm] = m.split("-").map(Number); return { x: r2(y + (mm - 0.5) / 12), label: `${MES[mm - 1]} ${y}`, total: r2(g("TOTAL", m) / 1000), sy: r2(g("SY", m) / 1000) }; });
  write("pedidos-asilo-ue-2014-2026", {
    rows,
    config: {
      x: { label: "Mês", tableLabel: "Mês", min: 2014, max: 2026.67, ticks: [2014, 2015, 2016, 2018, 2020, 2022, 2024, 2026] },
      y: { label: "Pedidos de asilo pela primeira vez na UE, por mês (milhares)", suffix: " mil", decimals: 1, logDefault: false, linMin: 0, linMax: 170 },
      series: [
        { key: "total", label: "Todas as nacionalidades", short: "Total", color: "--accent-2", width: 2.6 },
        { key: "sy", label: "Cidadãos sírios", short: "Síria", color: "--ink-3", width: 1.6 },
      ],
      labelMargin: [64, 120], shortEndLabels: true, scaleToggle: false,
      shade: [{ from: 2020.17, to: 2021.5, exact: true, label: "pandemia", short: "covid", top: true }],
      annotations: [
        { x: 2015.79, key: "total", text: "out. 2015: 162 mil", short: "162 mil", anchor: "start", dx: 8, dy: 4 },
        { x: 2023.79, key: "total", text: "out. 2023: 115 mil", short: "115 mil", anchor: "end", dx: -8, dy: -6 },
        { x: 2024.96, key: "sy", text: "dez. 2024: queda de Assad", short: "queda de Assad", anchor: "start", dx: 6, dy: -14 },
      ],
      howToRead: "Cada linha soma, mês a mês, as pessoas que pediram asilo pela primeira vez num dos 27 países da UE. A linha azul conta todas as nacionalidades; a cinzenta, só os cidadãos sírios. A faixa marca os meses de confinamentos e fronteiras fechadas da pandemia.",
    },
    summary: { ...s, share, lastMonth: "2026-08" },
  }, rawFiles("asilo-ue"));
}

// 2. Mortos na estrada na UE (Eurostat tran_sf_roadus)
{
  const E = jstat(path.join(RAW, "estrada-ue", "eurostat_tran_sf_roadus.json"));
  const v = (geo, t, unit = "P_MHAB") => E.v({ freq: "A", sex: "T", age: "TOTAL", unit, pers_cat: "TOTAL", geo, time: t });
  const C = Object.keys(PT_EU);
  assert(C.every((c) => [2019, 2024].every((y) => typeof v(c, String(y)) === "number" && typeof v(c, String(y), "NR") === "number")), "27 países com taxa e número em 2019 e 2024");
  const eu19 = v("EU27_2020", "2019", "NR"), eu24 = v("EU27_2020", "2024", "NR");
  const sumNR = (y) => C.reduce((a, c) => a + v(c, y, "NR"), 0);
  console.log("soma países", sumNR("2019"), sumNR("2024"), eu19, eu24);
  assert(eu19 === 22757 && eu24 === 19933 && r1(pct(eu19, eu24)) === -12.4, "UE: 22 757 mortos em 2019, 19 933 em 2024 (−12,4%)");
  assert(sumNR("2019") === eu19 && sumNR("2024") === eu24, "a soma dos 27 países é igual ao total da UE");
  assert(v("EU27_2020", "2019") === 51 && v("EU27_2020", "2024") === 44, "UE: 51 mortos por milhão em 2019, 44 em 2024");
  assert(v("PT", "2019", "NR") === 688 && v("PT", "2024", "NR") === 618 && r1(pct(688, 618)) === -10.2, "Portugal: 688 mortos em 2019, 618 em 2024 (−10,2%)");
  assert(v("PT", "2019") === 67 && v("PT", "2024") === 58, "Portugal: 67 por milhão em 2019, 58 em 2024");
  const rank = [...C].sort((a, b) => v(b, "2024") - v(a, "2024"));
  console.log("ordem 2024", rank.map((c) => c + ":" + v(c, "2024")).join(" "));
  const ptRank = rank.indexOf("PT") + 1;
  assert(ptRank === 6 && rank.slice(0, 5).join() === "RO,BG,EL,HR,LV", "2024: Portugal com a 6.ª taxa mais alta (atrás de Roménia, Bulgária, Grécia, Croácia e Letónia)");
  const ch = C.map((c) => ({ c, d: pct(v(c, "2019", "NR"), v(c, "2024", "NR")) })).sort((a, b) => a.d - b.d);
  console.log("variação", ch.map((q) => q.c + ":" + r1(q.d)).join(" "));
  const halfway = ch.filter((q) => q.d <= -25).map((q) => q.c);
  const up = ch.filter((q) => q.d > 0).map((q) => q.c);
  assert(halfway.join() === "PL,LT,SI,BE,DK,MT", "só seis países baixaram os mortos em 25% ou mais entre 2019 e 2024: Polónia (−34,8%), Lituânia, Eslovénia, Bélgica, Dinamarca e Malta");
  assert(up.join() === "ES,IE,EE", "três países com mais mortos em 2024 do que em 2019: Espanha, Irlanda e Estónia");
  assert(r1(ch.find((q) => q.c === "PL").d) === -34.8, "Polónia: −34,8%");
  assert(v("PT", "2001") === 162 && r1(pct(v("PT", "2001", "NR"), 618)) < -50, "Portugal: 162 por milhão em 2001");
  assert(v("PT", "2001") > Math.max(...C.map((c) => v(c, "2024"))), "Portugal em 2001 (162) acima de qualquer país em 2024 (máximo: Roménia, 78)");
  assert(pct(688, 618) > pct(eu19, eu24), "Portugal desceu menos (−10,2%) do que a UE (−12,4%)");
  const target = Math.round(eu19 / 2), cut = eu19 - eu24, need = eu24 - target;
  assert(target === 11379 && cut === 2824 && need === 8554 && Math.round(need / cut) === 3, "meta: 11 379 mortos; cortados 2 824 entre 2019 e 2024; faltam 8 554, três vezes mais");
  const rows = C.map((c) => ({ label: PT_EU[c], a: v(c, "2019"), b: v(c, "2024"), c: r1(v(c, "2019") / 2), highlight: c === "PT", n19: v(c, "2019", "NR"), n24: v(c, "2024", "NR") }));
  write("mortos-estrada-ue-2019-2024", {
    rows,
    config: {
      aLabel: "2019", bLabel: "2024", cLabel: "Metade da taxa de 2019 (referência da meta da UE)", ref: 44, refLabel: "UE em 2024: 44",
      unit: "", decimals: 0, domain: [0, 100], itemLabel: "país",
      sorts: [["b", "Por taxa em 2024"], ["delta", "Por variação"]],
      howToRead: "Cada linha é um país da UE: vai do número de mortos na estrada por milhão de habitantes em 2019 (ponto cinzento) ao de 2024 (ponto azul). O anel marca metade da taxa de 2019 de cada país, uma referência para a meta europeia, que é para a UE no seu conjunto e em número de mortos. A linha tracejada é a taxa do conjunto da UE em 2024. Portugal aparece destacado a terracota.",
    },
    summary: { eu19, eu24, ptRank, halfway, up, pt: { n19: 688, n24: 618, r19: 67, r24: 58, r01: v("PT", "2001") }, euRate: { 2019: 51, 2024: 44 } },
  }, rawFiles("estrada-ue"));
}

// 3. Emissões fósseis de CO2 em 2025 (Global Carbon Budget 2026)
{
  const rs = csv(path.join(RAW, "co2-gcb-2026", "GCB2026v11_MtCO2_flat.csv"));
  const S = {};
  for (const r of rs) (S[r.Country] ??= {})[+r.Year] = r.Total === "" ? null : +r.Total;
  const EU = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"];
  assert(EU.every((c) => S[c] && typeof S[c][2025] === "number"), "27 países da UE com valor em 2025");
  const G = S.Global;
  assert(Math.max(...Object.keys(G).map(Number)) === 2025, "último ano: 2025");
  const yrs = Object.keys(G).map(Number).filter((y) => G[y] != null);
  const maxY = yrs.reduce((a, y) => (G[y] > G[a] ? y : a));
  assert(maxY === 2025 && r1(G[2025] / 1000) === 39 && r1(pct(G[2024], G[2025])) === 0.9, "2025: recorde de 39,0 mil milhões de toneladas, mais 0,9% do que em 2024");
  const eu = (y) => EU.reduce((a, c) => a + S[c][y], 0);
  const bunk = (y) => S["International Aviation"][y] + S["International Shipping"][y];
  const groups = [
    ["China", "China"], ["USA", "EUA"], ["India", "Índia"], [null, "UE (27)"], ["Russia", "Rússia"], ["Japan", "Japão"], ["Indonesia", "Indonésia"], ["Iran", "Irão"], ["Saudi Arabia", "Arábia Saudita"], ["Brazil", "Brasil"], ["bunk", "Aviação e navios int."],
  ];
  const val = (k, y) => (k === null ? eu(y) : k === "bunk" ? bunk(y) : S[k][y]);
  // controlo: soma de todos os países + bancas = total mundial
  const allC = Object.keys(S).filter((c) => !["Global", "International Aviation", "International Shipping"].includes(c));
  const sumAll = (y) => allC.reduce((a, c) => a + (S[c][y] ?? 0), 0) + bunk(y);
  console.log("controlo soma 2025", sumAll(2025), G[2025], "2019", sumAll(2019), G[2019]);
  assert(Math.abs(sumAll(2025) - G[2025]) < 1 && Math.abs(sumAll(2019) - G[2019]) < 1 && Math.abs(sumAll(2024) - G[2024]) < 1, "a soma dos países e das bancas internacionais é igual ao total mundial (diferença < 1 Mt) em 2019, 2024 e 2025");
  const listed = (y) => groups.reduce((a, [k]) => a + val(k, y), 0);
  const rows = groups.map(([k, label]) => ({ label, d25: r1(val(k, 2025) - val(k, 2024)), d19: r1(val(k, 2025) - val(k, 2019)), v25: r1(val(k, 2025)) }));
  rows.push({ label: "Resto do mundo", d25: r1(G[2025] - listed(2025) - (G[2024] - listed(2024))), d19: r1(G[2025] - listed(2025) - (G[2019] - listed(2019))), v25: r1(G[2025] - listed(2025)) });
  rows.unshift({ label: "Mundo", d25: r1(G[2025] - G[2024]), d19: r1(G[2025] - G[2019]), v25: r1(G[2025]) });
  for (const q of rows) console.log(q.label, q.d25, q.d19, q.v25);
  const dW = G[2025] - G[2024];
  assert(r1(dW) === 347.7, "mundo: mais 347,7 Mt em 2025");
  assert(r1(S.USA[2025] - S.USA[2024]) === 123.8 && r1(pct(S.USA[2024], S.USA[2025])) === 2.5 && Math.round(((S.USA[2025] - S.USA[2024]) / dW) * 100) === 36, "EUA: +123,8 Mt (+2,5%), 36% da subida mundial");
  assert(r1(pct(S.China[2024], S.China[2025])) === 0.1 && r1(S.China[2025] - S.China[2024]) === 16.4, "China: +0,1% (+16,4 Mt)");
  assert(r1(pct(S.India[2024], S.India[2025])) === 0.9, "Índia: +0,9%");
  assert(r1(eu(2025) - eu(2024)) === -6.9 && r1(pct(eu(2024), eu(2025))) === -0.3, "UE: −6,9 Mt (−0,3%)");
  assert(r1(bunk(2025) - bunk(2024)) === 52.8, "aviação e navegação internacionais: +52,8 Mt");
  assert(r1(S.China[2025] - S.China[2019]) === 1742.7 && r1(S.USA[2025] - S.USA[2019]) === -202.3 && r1(eu(2025) - eu(2019)) === -491.8, "2019–2025: China +1 742,7 Mt; EUA −202,3; UE −491,8");
  assert(r1((S.China[2025] / G[2025]) * 100) === 31.8 && r1((S.USA[2025] / G[2025]) * 100) === 12.9, "2025: China 31,8% do total mundial, EUA 12,9%");
  assert(Math.round(((S.China[2025] + S.India[2025]) / G[2025]) * 100) === 40 && S.China[2025] > S.China[2024] && S.India[2025] > S.India[2024], "China e Índia: 40% do total mundial em 2025, ambas a subir");
  assert(S.China[2025] === Math.max(...Object.values(S.China).filter((x) => x != null)), "China: 2025 é o máximo da série");
  write("emissoes-co2-fosseis-2025", {
    rows,
    config: {
      unit: " Mt", decimals: 1, pinned: ["Mundo"], posLabel: "Aumento", negLabel: "Diminuição", independentScale: true,
      views: [
        { id: "d25", label: "2025 face a 2024", key: "d25", axisLabel: "Variação das emissões fósseis de CO₂ em 2025 face a 2024 (milhões de toneladas)", axisShort: "2025 vs. 2024 (Mt de CO₂)" },
        { id: "d19", label: "2025 face a 2019", key: "d19", axisLabel: "Variação das emissões fósseis de CO₂ entre 2019 e 2025 (milhões de toneladas)", axisShort: "2025 vs. 2019 (Mt de CO₂)" },
      ],
      sorts: [["value", "Por variação"], ["label", "Alfabética"]],
      howToRead: "Cada barra é um país, um bloco ou um grupo de emissões e mostra quantos milhões de toneladas de CO₂ fóssil emitiu a mais (azul) ou a menos (ocre) do que no ano de comparação. «Aviação e navios int.» soma os combustíveis da aviação e da navegação internacionais, que não entram nas contas de nenhum país. O Mundo fica fixo no topo. Os botões mudam entre a variação de um ano e a variação desde 2019, antes da pandemia.",
    },
    summary: { world: { 2019: r1(G[2019]), 2024: r1(G[2024]), 2025: r1(G[2025]) }, usShareOfRise: 36, china: { 2024: r1(S.China[2024]), 2025: r1(S.China[2025]) }, usa: { 2024: r1(S.USA[2024]), 2025: r1(S.USA[2025]) }, eu: { 2019: r1(eu(2019)), 2024: r1(eu(2024)), 2025: r1(eu(2025)) } },
  }, rawFiles("co2-gcb-2026"));
}

// 4. Espetáculos ao vivo (INE, Inquérito aos espetáculos ao vivo)
{
  const load = (c) => {
    const d = JSON.parse(fs.readFileSync(path.join(RAW, "espetaculos-ao-vivo", `ine_${c}.json`), "utf8"))[0];
    const out = {};
    for (const [y, lst] of Object.entries(d.Dados)) for (const r of lst) if (r.geocod === "PT" && r.dim_4 === "T") (out[y] ??= {})[r.dim_3] = +r.valor;
    return out;
  };
  const E = load("0007578"), R = load("0007579");
  const ys = Object.keys(E).sort();
  assert(ys[0] === "2011" && ys.at(-1) === "2025" && ys.length === 15, "15 anos, 2011–2025");
  const tops = ["1", "10", "2", "3", "4", "5", "6", "7", "8", "9"];
  assert(ys.every((y) => Math.abs(tops.reduce((a, k) => a + E[y][k], 0) - E[y].T) <= 2 && Math.abs(tops.reduce((a, k) => a + R[y][k], 0) - R[y].T) <= 2), "as dez modalidades somam o total (espetadores e receitas), todos os anos");
  assert(ys.every((y) => Math.abs(["31", "32", "33", "34", "35", "36"].reduce((a, k) => a + E[y][k], 0) - E[y]["3"]) <= 2), "os seis géneros de música somam o total da música");
  const maxY = ys.reduce((a, y) => (E[y].T > E[a].T ? y : a));
  assert(maxY === "2025" && E["2025"].T === 19688616 && E["2019"].T === 16926411 && r1(pct(E["2019"].T, E["2025"].T)) === 16.3, "espetadores: recorde de 19,7 milhões em 2025, mais 16,3% do que em 2019");
  assert(E["2020"].T === 2517028 && E["2011"].T === 8484295, "2020: 2,5 milhões; 2011: 8,5 milhões");
  assert(E["2025"]["3"] === 10895190 && r1((E["2025"]["3"] / E["2025"].T) * 100) === 55.3, "música: 10,9 milhões de espetadores em 2025, 55,3% do total");
  assert(R["2025"].T === 193731136 && R["2024"].T === 206444501 && R["2019"].T === 125314014 && r1(pct(R["2019"].T, R["2025"].T)) === 54.6, "receitas: 193,7 milhões de euros em 2025 (206,4 em 2024; 125,3 em 2019; +54,6% face a 2019, valores nominais)");
  assert(R["2025"]["35"] === 62614734 && R["2024"]["35"] === 88441402 && r1(pct(R["2024"]["35"], R["2025"]["35"])) === -29.2, "pop/rock: receitas de 88,4 milhões em 2024 e 62,6 em 2025 (−29,2%)");
  assert(E["2025"]["2"] === 59837 && E["2025"]["33"] === 463252 && r1(pct(E["2019"]["33"], E["2025"]["33"])) === 11.1, "fado: 463 mil espetadores em 2025 (+11,1% face a 2019)");
  assert(E["2024"]["35"] === 4569712 && E["2025"]["35"] === 4231337 && r1(pct(E["2024"]["35"], E["2025"]["35"])) === -7.4, "pop/rock: espetadores −7,4% em 2025 (4,57 → 4,23 milhões)");
  assert(R["2025"].T < R["2024"].T && E["2025"].T > E["2024"].T, "2025: receitas abaixo de 2024, espetadores acima");
  const V = load("0007576"), O = load("0007577");
  assert(ys.every((y) => V[y].T + O[y].T === E[y].T), "espetadores = bilhetes vendidos + bilhetes oferecidos, todos os anos");
  assert(Math.round((O["2025"].T / E["2025"].T) * 100) === 62 && Math.round((O["2019"].T / E["2019"].T) * 100) === 64, "bilhetes oferecidos: 62% dos espetadores em 2025, 64% em 2019");
  assert(V["2025"].T === 7489800 && V["2024"].T === 7591610 && V["2019"].T === 6037822 && r1(pct(V["2019"].T, V["2025"].T)) === 24.0, "bilhetes vendidos: 7,49 milhões em 2025 (7,59 em 2024; 6,04 em 2019; +24,0%)");
  const price = (y) => R[y].T / V[y].T;
  assert(r2(price("2019")) === 20.75 && r2(price("2025")) === 25.87 && Math.round(pct(price("2019"), price("2025"))) === 25, "preço médio do bilhete vendido: 20,75 € em 2019, 25,87 € em 2025 (+25%, nominal)");
  const avg = (y) => R[y].T / E[y].T;
  assert(Math.round(pct(avg("2019"), avg("2025"))) === 33, "receita por espetador: +33% nominal entre 2019 e 2025");
  assert(r2(avg("2019")) === 7.4 && r2(avg("2025")) === 9.84, "receita por espetador: 7,40 € em 2019, 9,84 € em 2025 (nominal)");
  // cinema (peça de 2026-11-16, mesmo INE): 2019 e 2025
  const cin = JSON.parse(fs.readFileSync(path.join(OUT, "cinema-espetadores-portugal-2006-2025", "data.json"), "utf8")).summary.tot;
  assert(cin["2019"] === 15540742 && cin["2025"] === 10955126, "cinema: 15,5 milhões de espetadores em 2019, 11,0 milhões em 2025 (peça de 16/11)");
  const M = (x) => r2(x / 1e6);
  const rows = ys.map((y) => ({
    cat: y, alt: y === "2020" || y === "2021",
    mus: M(E[y]["3"]), tea: M(E[y]["1"]), out: M(E[y].T - E[y]["3"] - E[y]["1"]), tot: M(E[y].T),
    rmus: M(R[y]["3"]), rtea: M(R[y]["1"]), rout: M(R[y].T - R[y]["3"] - R[y]["1"]), rtot: M(R[y].T),
  }));
  write("espetaculos-ao-vivo-portugal-2011-2025", {
    rows,
    views: [
      { id: "esp", label: "Espetadores", yMax: 23, yLabel: "Espetadores de espetáculos ao vivo em Portugal, por ano (milhões)", unit: " milhões", decimals: 2, labelEvery: 2, labelEveryNarrow: 4,
        series: [
          { key: "out", label: "Outras modalidades (dança, circo, variedades, ópera…)", color: "--ink-3" },
          { key: "tea", label: "Teatro", color: "--accent-3" },
          { key: "mus", label: "Música", color: "--accent-2" },
        ],
        tipExtra: [{ key: "tot", label: "Total", suffix: " milhões" }],
        notes: [{ cat: "2019", text: "2019: 16,9 milhões", short: "16,9" }, { cat: "2025", text: "2025: 19,7", short: "19,7" }] },
      { id: "rec", label: "Receitas", yMax: 235, yLabel: "Receitas de bilheteira dos espetáculos ao vivo em Portugal (milhões de euros, valores nominais)", unit: " M€", decimals: 1, labelEvery: 2, labelEveryNarrow: 4,
        series: [
          { key: "rout", label: "Outras modalidades (dança, circo, variedades, ópera…)", color: "--ink-3" },
          { key: "rtea", label: "Teatro", color: "--accent-3" },
          { key: "rmus", label: "Música", color: "--accent-2" },
        ],
        tipExtra: [{ key: "rtot", label: "Total", suffix: " M€" }],
        notes: [{ cat: "2019", text: "2019: 125 M€", short: "125" }, { cat: "2024", text: "2024: 206 M€", short: "206" }] },
    ],
    summary: { esp: Object.fromEntries(ys.map((y) => [y, E[y].T])), rec: Object.fromEntries(ys.map((y) => [y, R[y].T])), mus2025: E["2025"]["3"], cinema: { 2019: cin["2019"], 2025: cin["2025"] }, avg2019: r2(avg("2019")), avg2025: r2(avg("2025")), sold: { 2019: V["2019"].T, 2024: V["2024"].T, 2025: V["2025"].T }, offered2025: O["2025"].T, price2019: r2(price("2019")), price2025: r2(price("2025")) },
  }, rawFiles("espetaculos-ao-vivo"));
}

// 5. Casamentos católicos (INE)
{
  const load = (c) => {
    const d = JSON.parse(fs.readFileSync(path.join(RAW, "casamentos-catolicos", `ine_${c}.json`), "utf8"))[0];
    const out = {};
    for (const [y, lst] of Object.entries(d.Dados)) for (const r of lst) (out[y] ??= {})[r.geocod] = r.valor === undefined || r.valor === "" ? null : +r.valor;
    return out;
  };
  const A = load("0000602"), B = load("0008209"), C = load("0012705");
  const G = ["PT", "11", "15", "20", "30"];
  for (const y of ["2011", "2012", "2013"]) assert(G.every((g) => A[y][g] === B[y][g]), `${y}: 0000602 e 0008209 iguais para Portugal, Norte, Algarve, Açores e Madeira`);
  for (const y of ["2021", "2022", "2023"]) assert(G.every((g) => B[y][g] === C[y][g]), `${y}: 0008209 e 0012705 iguais para Portugal, Norte, Algarve, Açores e Madeira`);
  const S = {};
  for (const [src, from, to] of [[A, 1995, 2010], [B, 2011, 2020], [C, 2021, 2025]]) for (let y = from; y <= to; y++) S[y] = src[String(y)];
  const ys = Object.keys(S).map(Number);
  assert(ys.length === 31 && ys.every((y) => G.every((g) => typeof S[y][g] === "number")), "31 anos (1995–2025), sem valores em falta");
  assert(S[1995].PT === 68.8 && S[2025].PT === 18.6 && S[2020].PT === 12.3 && S[2019].PT === 30.8, "Portugal: 68,8% em 1995; 30,8% em 2019; 12,3% em 2020; 18,6% em 2025");
  assert(S[1995]["11"] === 82.5 && S[2025]["11"] === 24.5 && S[1995]["15"] === 46.5 && S[2025]["15"] === 8.7, "Norte: 82,5% → 24,5%; Algarve: 46,5% → 8,7%");
  assert(S[1995]["20"] === 38.4 && S[2005]["20"] === 21.2 && S[2025]["20"] === 24.5 && S[1995]["30"] === 56.3 && S[2025]["30"] === 23.1, "Açores: 38,4% (1995), 21,2% (2005), 24,5% (2025); Madeira: 56,3% → 23,1%");
  const firstBelowHalf = ys.find((y) => S[y].PT < 50);
  assert(firstBelowHalf === 2007 && S[2007].PT === 47.4, "2007: primeiro ano com menos de metade dos casamentos católicos (47,4%)");
  assert(ys.filter((y) => y > 2020).every((y) => S[y].PT < S[y - 1].PT || y === 2021), "desde 2021, a proporção desce todos os anos");
  assert(S[2025]["11"] === Math.max(...G.slice(1).map((g) => S[2025][g])) && S[2025]["11"] === S[2025]["20"], "2025: Norte e Açores empatados na proporção mais alta (24,5%) das cinco séries");
  assert(r1(S[1995]["11"] - S[2025]["11"]) === 58 && ["15", "20", "30"].every((g) => S[1995][g] - S[2025][g] < 58), "Norte: −58 pontos, a maior descida das quatro regiões");
  assert(S[2025]["20"] > S[2005]["20"] && ["11", "15", "30", "PT"].every((g) => S[2025][g] < S[2005][g]), "Açores: única série que sobe entre 2005 e 2025");
  assert(S[2018]["20"] === 33.5 && S[1995]["15"] < 50 && S[1995]["20"] < 50, "Açores: 33,5% em 2018; Algarve e Açores já abaixo de 50% em 1995");
  assert(ys.every((y) => ["11", "15", "20", "30"].every((g) => S[2025][g] < S[1995][g])), "todas as regiões abaixo de 1995");
  const rows = ys.map((y) => ({ x: y, pt: S[y].PT, norte: S[y]["11"], alg: S[y]["15"], acores: S[y]["20"], madeira: S[y]["30"] }));
  write("casamentos-catolicos-portugal-1995-2025", {
    rows,
    config: {
      x: { label: "Ano", tableLabel: "Ano", min: 1995, max: 2025, ticks: [1995, 2000, 2005, 2010, 2015, 2020, 2025] },
      y: { label: "Casamentos católicos, em % dos casamentos entre pessoas de sexo oposto", suffix: "%", decimals: 1, logDefault: false, linMin: 0, linMax: 90 },
      series: [
        { key: "norte", label: "Norte", short: "Norte", color: "--accent-2", width: 1.8 },
        { key: "madeira", label: "R. A. da Madeira", short: "Madeira", color: "--accent-4", width: 1.6 },
        { key: "acores", label: "R. A. dos Açores", short: "Açores", color: "--accent-3", width: 1.6 },
        { key: "alg", label: "Algarve", short: "Algarve", color: "--ink-3", width: 1.6 },
        { key: "pt", label: "Portugal", short: "Portugal", color: "--accent", width: 3 },
      ],
      labelMargin: [70, 112], shortEndLabels: true, scaleToggle: false, dots: false,
      refLine: { value: 50, label: "metade dos casamentos", short: "50%", at: 2001 },
      annotations: [
        { x: 2007, key: "pt", text: "2007: 47,4%", short: "47%", anchor: "start", dx: 8, dy: 16 },
        { x: 2020, key: "pt", text: "2020: 12,3% (pandemia)", short: "2020: 12%", anchor: "end", dx: -8, dy: 14 },
      ],
      howToRead: "Cada linha mostra, ano a ano, a percentagem de casamentos celebrados na Igreja Católica entre todos os casamentos de pessoas de sexo oposto registados nessa região (os outros são civis ou de outras religiões). A linha grossa terracota é o total do país. A tracejada marca metade dos casamentos.",
    },
    summary: { pt: { 1995: S[1995].PT, 2007: S[2007].PT, 2019: S[2019].PT, 2020: S[2020].PT, 2025: S[2025].PT }, norte: { 1995: S[1995]["11"], 2025: S[2025]["11"] }, alg: { 1995: S[1995]["15"], 2025: S[2025]["15"] }, acores: { 1995: S[1995]["20"], 2005: S[2005]["20"], 2025: S[2025]["20"] }, madeira: { 1995: S[1995]["30"], 2025: S[2025]["30"] } },
  }, rawFiles("casamentos-catolicos"));
}
if (fails) console.error(`\n${fails} verificação(ões) falharam.`); else console.log("\nTodas as verificações passaram.");
