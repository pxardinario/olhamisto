// Transformação reprodutível dos dados brutos da edição de 2026-11-12.
// Uso: node tools/prepare-2026-11-12.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, bars, columns, scatter — ver assets/js/charts.js.
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
  const s = (o) => { const k = idx(o); return k == null ? undefined : (j.status || {})[k] || ""; };
  return { j, v, s, times: Object.keys(d.time.category.index) };
}
const ine = (file) => JSON.parse(fs.readFileSync(file, "utf8"))[0];
const dat = (file) => fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#")).map((l) => l.trim().split(/\s+/).map(Number));
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
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const mlabel = (m) => `${MES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

// 1. Inflação da zona euro em cada mandato de presidente do BCE (Eurostat prc_hicp_minr, EA, TOTAL, RCH_A)
{
  const f = path.join(RAW, "bce-mandatos", "eurostat_prc_hicp_minr_EA_TOTAL_RCH_A.json");
  const H = jstat(f);
  const v = (t) => H.v({ time: t });
  const months = H.times.filter((t) => t >= "1999-01" && v(t) != null);
  assert(months[0] === "1999-01" && months.at(-1) === "2026-10" && months.length === 334, "334 meses, de janeiro de 1999 a outubro de 2026");
  assert(H.s({ time: "2026-10" }) === "e" && v("2026-10") === 4 && v("2026-09") === 3.8, "outubro de 2026: 4,0% (estimativa «e»); setembro: 3,8%");
  const M = [
    { key: "duisenberg", name: "Wim Duisenberg", from: "1999-01", to: "2003-10" },
    { key: "trichet", name: "Jean-Claude Trichet", from: "2003-11", to: "2011-10" },
    { key: "draghi", name: "Mario Draghi", from: "2011-11", to: "2019-10" },
    { key: "lagarde", name: "Christine Lagarde", from: "2019-11", to: "2026-10" },
  ];
  const stats = {};
  for (const m of M) {
    const ks = months.filter((t) => t >= m.from && t <= m.to), xs = ks.map(v);
    const avg = xs.reduce((a, b) => a + b, 0) / xs.length;
    const max = ks.reduce((p, k) => (v(k) > v(p) ? k : p)), min = ks.reduce((p, k) => (v(k) < v(p) ? k : p));
    stats[m.key] = { name: m.name, from: m.from, to: m.to, n: ks.length, avg: r1(avg), avg2: r2(avg), max: [max, v(max)], min: [min, v(min)], above25: xs.filter((x) => x > 2.5).length, below15: xs.filter((x) => x < 1.5).length, within: xs.filter((x) => x >= 1.5 && x <= 2.5).length };
  }
  console.log(stats);
  assert(stats.duisenberg.n === 58 && stats.duisenberg.avg === 2, "Duisenberg (jan. 1999–out. 2003, 58 meses): média 2,0%");
  assert(stats.trichet.n === 96 && stats.trichet.avg === 2.1, "Trichet (nov. 2003–out. 2011, 96 meses): média 2,1%");
  assert(stats.draghi.n === 96 && stats.draghi.avg === 1.2 && stats.draghi.below15 === 60, "Draghi (96 meses): média 1,2%; 60 meses abaixo de 1,5%");
  assert(stats.lagarde.n === 84 && stats.lagarde.avg === 3.4 && stats.lagarde.above25 === 40, "Lagarde (nov. 2019–out. 2026, 84 meses): média 3,4%; 40 meses acima de 2,5%");
  assert(stats.lagarde.max[0] === "2022-10" && stats.lagarde.max[1] === 10.6, "máximo: 10,6% em outubro de 2022");
  assert(stats.trichet.max[0] === "2008-07" && stats.trichet.max[1] === 4.1 && stats.trichet.min[1] === -0.7, "Trichet: máximo 4,1% (jul. 2008), mínimo −0,7% (jul. 2009)");
  assert(stats.draghi.min[0] === "2015-01" && stats.draghi.min[1] === -0.6, "Draghi: mínimo −0,6% em janeiro de 2015");
  assert(stats.trichet.within === 63 && stats.duisenberg.within === 43 && stats.draghi.within === 28 && stats.lagarde.within === 27, "meses entre 1,5% e 2,5%: Duisenberg 43, Trichet 63, Draghi 28, Lagarde 27");
  const xOf = (t) => r2(+t.slice(0, 4) + (+t.slice(5) - 1) / 12);
  const rows = months.map((t) => ({ x: xOf(t), label: mlabel(t), hicp: v(t) }));
  const edge = (to) => r2(xOf(to) + 1 / 24); // fronteira entre o último mês de um mandato e o primeiro do seguinte
  const pct = (x) => x.toFixed(1).replace(".", ",") + "%";
  write("bce-inflacao-mandatos-1999-2026", {
    rows,
    config: {
      x: { label: "Mês", tableLabel: "Mês", min: 1999, max: 2027, ticks: [1999, 2003, 2007, 2011, 2015, 2019, 2023, 2027] },
      y: { label: "Inflação homóloga na zona euro (%)", suffix: "%", decimals: 1, logDefault: false, linMin: -2, linMax: 12 },
      series: [{ key: "hicp", label: "Inflação homóloga (IHPC)", color: "--accent-2", width: 2 }],
      scaleToggle: false, dots: false,
      refLine: { value: 2, label: "Objetivo do BCE: 2%", short: "Objetivo: 2%", at: 2015.5 },
      shade: [
        { from: 1999, to: edge("2003-10"), label: `Duisenberg · média ${pct(stats.duisenberg.avg)}`, short: pct(stats.duisenberg.avg), exact: true, labelOnly: true, top: true },
        { from: edge("2003-10"), to: edge("2011-10"), label: `Trichet · média ${pct(stats.trichet.avg)}`, short: pct(stats.trichet.avg), exact: true, top: true },
        { from: edge("2011-10"), to: edge("2019-10"), label: `Draghi · média ${pct(stats.draghi.avg)}`, short: pct(stats.draghi.avg), exact: true, labelOnly: true, top: true },
        { from: edge("2019-10"), to: 2027, label: `Lagarde · média ${pct(stats.lagarde.avg)}`, short: pct(stats.lagarde.avg), exact: true, top: true },
      ],
      annotations: [{ x: xOf("2022-10"), key: "hicp", text: "out. 2022: 10,6%", short: "10,6%", anchor: "end", dx: -8, dy: 4, strong: false }],
      howToRead: "A linha é a inflação homóloga da zona euro, mês a mês. As faixas alternadas marcam os mandatos dos quatro presidentes do BCE, com a média de cada um no topo; a linha tracejada é o objetivo de 2%.",
    },
    summary: { stats, last: ["2026-10", v("2026-10")], allAvg: r2(months.map(v).reduce((a, b) => a + b, 0) / months.length) },
  }, [f]);
}

// 2. PIB no 3.º trimestre de 2026: variação homóloga por país (Eurostat namq_10_gdp)
{
  const f = path.join(RAW, "pib-t3-2026", "eurostat_namq_10_gdp_CLV_PCH_SM_SCA.json");
  const G = jstat(f);
  const g = (geo, t = "2026-Q3") => G.v({ geo, time: t });
  const EU27 = ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "EL", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE"];
  const NAME = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };
  const have = EU27.filter((c) => g(c) != null);
  assert(have.length === 15 && have.join() === "BE,CZ,DE,EE,IE,ES,FR,IT,LT,HU,NL,AT,PT,FI,SE", "15 países da UE com estimativa do 3.º trimestre de 2026 (os outros 12 ainda não publicaram)");
  assert(g("PT") === 2.4 && g("EA") === 1.3 && g("EU27_2020") === 1.5, "3.º trim. 2026: Portugal 2,4%, zona euro 1,3%, UE 1,5%");
  assert(g("FR") === -0.1 && g("DE") === 1.2 && g("ES") === 2.7 && g("IT") === 0.8 && g("IE") === 3.6, "França −0,1%, Alemanha 1,2%, Espanha 2,7%, Itália 0,8%, Irlanda 3,6%");
  const ts = G.times;
  const lastNegFR = [...ts].reverse().find((t) => t < "2026-Q3" && g("FR", t) < 0);
  assert(lastNegFR === "2020-Q4" && g("FR", "2020-Q4") === -4, "França: última variação homóloga negativa antes desta foi no 4.º trimestre de 2020 (−4,0%)");
  let streak = 0; for (const t of ts) streak = g("PT", t) > g("EA", t) ? streak + 1 : 0;
  assert(streak === 22 && g("PT", "2021-Q1") <= g("EA", "2021-Q1"), "Portugal acima da zona euro há 22 trimestres seguidos (desde o 2.º trim. de 2021)");
  assert(g("FR", "2025-Q3") === 0.8 && g("PT", "2025-Q3") === 2.1 && g("EA", "2025-Q3") === 1.1, "3.º trim. 2025: França 0,8%, Portugal 2,1%, zona euro 1,1%");
  const above = have.filter((c) => g(c) > g("PT"));
  assert(above.join() === "IE,ES,SE", "acima de Portugal: Irlanda, Espanha e Suécia");
  assert(g("FR", "2026-Q2") === 0.5 && ["2026-Q1", "2026-Q2", "2026-Q3"].every((t) => g("PT", t) >= 2.4) && g("PT", "2025-Q4") === 1.9, "França 0,5% no 2.º trim. 2026; Portugal ≥ 2,4% nos três trimestres de 2026 (1,9% no 4.º de 2025)");
  assert(["2023-Q1", "2023-Q2", "2023-Q3", "2023-Q4"].every((t) => g("DE", t) < 0) && ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"].every((t) => g("DE", t) <= 0.4), "Alemanha: quatro trimestres negativos em 2023 e no máximo 0,4% em 2024");
  console.log("status PT/FR/EA:", G.s({ geo: "PT", time: "2026-Q3" }), G.s({ geo: "FR", time: "2026-Q3" }), G.s({ geo: "EA", time: "2026-Q3" }));
  const rows = have.map((c) => ({ label: NAME[c], q3_2026: g(c), q3_2025: g(c, "2025-Q3"), highlight: c === "PT" || undefined }));
  rows.push({ label: "Zona euro", q3_2026: g("EA"), q3_2025: g("EA", "2025-Q3") }, { label: "UE-27", q3_2026: g("EU27_2020"), q3_2025: g("EU27_2020", "2025-Q3") });
  write("pib-t3-2026-ue", {
    rows,
    config: {
      unit: "%", decimals: 1, signed: true, independentScale: false, pinned: ["Zona euro", "UE-27"], posLabel: "Crescimento", negLabel: "Contração", highlightLabel: "Portugal",
      howToRead: "Cada barra é a variação do PIB em volume face ao mesmo trimestre do ano anterior, com ajuste sazonal. Aparecem só os 15 países da UE que já publicaram a estimativa do 3.º trimestre de 2026; a segunda vista mostra o mesmo trimestre de 2025.",
      views: [
        { id: "t26", key: "q3_2026", label: "3.º trim. 2026", axisLabel: "PIB em volume, variação homóloga no 3.º trimestre de 2026 (%)", axisShort: "Var. homóloga, 3.º trim. 2026 (%)" },
        { id: "t25", key: "q3_2025", label: "3.º trim. 2025", axisLabel: "PIB em volume, variação homóloga no 3.º trimestre de 2025 (%)", axisShort: "Var. homóloga, 3.º trim. 2025 (%)" },
      ],
      sorts: [["value", "Por valor"], ["label", "Alfabética"]],
    },
    summary: { pt: g("PT"), ea: g("EA"), eu: g("EU27_2020"), fr: g("FR"), de: g("DE"), es: g("ES"), lastNegFR, streak, n: have.length },
  }, [f]);
}

// 3. Dormidas por país de residência, 2015–2025 (INE 0009182)
{
  const f = path.join(RAW, "turismo-mercados", "ine_0009182_dormidas_pais_residencia.json");
  const D = ine(f).Dados;
  const years = Object.keys(D);
  assert(years.length === 11 && years[0] === "2015" && years.at(-1) === "2025", "11 anos, 2015–2025");
  const get = (y, name) => { const r = D[y].find((q) => q.geocod === "PT" && q.dim_3_t.trim() === name); return r ? +r.valor : null; };
  const US = "Estados Unidos da América", UK = "Reino Unido da Grã-Bretanha e Irlanda do Norte", CA = "Canadá";
  assert(get("2015", US) === 1062201 && get("2025", US) === 5476069 && get("2019", US) === 2713437, "EUA: 1 062 201 (2015), 2 713 437 (2019), 5 476 069 (2025)");
  assert(r1(get("2025", US) / get("2015", US)) === 5.2 && r1(get("2025", US) / get("2019", US)) === 2, "EUA: ×5,2 desde 2015 e ×2,0 desde 2019");
  assert(get("2015", CA) === 468876 && get("2025", CA) === 1831564 && r1(get("2025", CA) / get("2015", CA)) === 3.9, "Canadá: 468 876 → 1 831 564 (×3,9)");
  const tot = (y) => get(y, "Total"), est = (y) => get(y, "Estrangeiro");
  assert(est("2015") === 36915807 && est("2025") === 56987667 && r1((est("2025") / est("2015") - 1) * 100) === 54.4, "dormidas de não residentes: 36,9 → 57,0 milhões (+54,4%)");
  assert(tot("2025") === 82011658, "total de dormidas em 2025: 82 011 658");
  const sh = (y) => r1((get(y, US) / est(y)) * 100);
  assert(sh("2015") === 2.9 && sh("2025") === 9.6, "quota dos EUA nas dormidas de não residentes: 2,9% → 9,6%");
  const countries = (y) => D[y].filter((q) => q.geocod === "PT" && !["Total", "Estrangeiro", "Portugal"].includes(q.dim_3_t.trim()) && !["T", "E", "ZZ"].includes(q.dim_3)).map((q) => [q.dim_3_t.trim(), +q.valor]).sort((a, b) => b[1] - a[1]);
  const rank = (y, n) => countries(y).findIndex((c) => c[0] === n) + 1;
  const ranks = Object.fromEntries(years.map((y) => [y, rank(y, US)]));
  console.log("posição dos EUA entre os mercados estrangeiros:", ranks);
  console.log("2025 top 6:", countries("2025").slice(0, 6).map((c) => c[0] + " " + c[1]).join("; "));
  assert(ranks["2015"] === 9 && ranks["2025"] === 3, "EUA: 9.º mercado estrangeiro em 2015, 3.º em 2025");
  assert(countries("2025").slice(0, 3).map((c) => c[0]).join() === [UK, "Alemanha", US].join(), "2025: Reino Unido, Alemanha e EUA nos três primeiros");
  const firstThird = years.find((y) => rank(y, US) <= 3);
  assert(firstThird === "2025" && rank("2024", US) === 4 && rank("2023", US) === 5, "EUA chegaram ao 3.º lugar pela primeira vez em 2025 (4.º em 2024, 5.º em 2023)");
  console.log("2015 top 10:", countries("2015").slice(0, 10).map((c) => c[0]).join("; "));
  const ser = [["uk", UK, "Reino Unido", "R. Unido", "--muted"], ["de", "Alemanha", "Alemanha", "Alem.", "--muted"], ["us", US, "Estados Unidos", "EUA", "--accent-2"], ["es", "Espanha", "Espanha", "Esp.", "--muted"], ["fr", "França", "França", "Fra.", "--muted"], ["br", "Brasil", "Brasil", "Bras.", "--muted"], ["ca", CA, "Canadá", "Can.", "--accent-4"]];
  for (const [, n] of ser) assert(years.every((y) => get(y, n) != null), `série completa: ${n}`);
  const rows = years.map((y) => Object.fromEntries([["x", +y], ...ser.map(([k, n]) => [k, r2(get(y, n) / 1e6)])]));
  const v25 = Object.fromEntries(ser.map(([k, n]) => [k, get("2025", n)]));
  assert(v25.uk === 10060777 && v25.de === 6456008 && v25.es === 5170345 && v25.fr === 4241229 && v25.br === 2365797, "2025: R. Unido 10 060 777; Alemanha 6 456 008; Espanha 5 170 345; França 4 241 229; Brasil 2 365 797");
  const dEst = est("2025") - est("2015"), dUS = get("2025", US) - get("2015", US), dAm = dUS + (get("2025", CA) - get("2015", CA)) + (get("2025", "Brasil") - get("2015", "Brasil"));
  assert(r1((dUS / dEst) * 100) === 22 && r1((dAm / dEst) * 100) === 33.5, "EUA explicam 22,0% do aumento das dormidas de não residentes; EUA, Canadá e Brasil, 33,5%");
  assert(r1((get("2025", UK) / get("2015", UK) - 1) * 100) === 16.8 && r1((get("2025", "Alemanha") / get("2015", "Alemanha") - 1) * 100) === 23.7, "Reino Unido +16,8% e Alemanha +23,7% (abaixo dos +54,4% do total estrangeiro)");
  const EUR = [UK, "Alemanha", "Espanha", "França", "Países Baixos (Reino dos)", "Irlanda", "Itália", "Polónia", "Bélgica", "Suíça"];
  assert(EUR.every((n) => get("2025", n) > 1e6) && countries("2025").filter((c) => c[1] > 1e6).length === 13, "mercados estrangeiros com mais de 1 milhão de dormidas em 2025: 13 (10 europeus, EUA, Brasil e Canadá)");
  console.log("mercados > 1 milhão:", countries("2025").filter((c) => c[1] > 1e6).map((c) => c[0]).join("; "));
  const grow = EUR.map((n) => [n, get("2025", n) / get("2015", n)]).sort((a, b) => b[1] - a[1]);
  assert(grow[0][0] === "Polónia" && r1(grow[0][1]) === 2.4, "entre os europeus com mais de 1 milhão, a Polónia cresceu mais (×2,4)");
  assert(get("2015", "Espanha") === 3939607 && get("2015", "França") === 3679475 && get("2015", UK) === 8610160, "2015: Espanha 3 939 607; França 3 679 475; R. Unido 8 610 160");
  write("turismo-dormidas-mercados-2015-2025", {
    rows,
    config: {
      x: { label: "Ano", tableLabel: "Ano", min: 2015, max: 2025, ticks: [2015, 2017, 2019, 2021, 2023, 2025] },
      y: { label: "Dormidas de residentes em cada país (milhões)", suffix: " milhões", decimals: 2, logDefault: false, linMin: 0, linMax: 12 },
      series: ser.map(([k, , label, short, color]) => ({ key: k, label, short, color, width: color === "--muted" ? 1.4 : 3 })),
      scaleToggle: false, dots: true, labelMargin: [88, 120],
      shade: [{ from: 2020, to: 2021, label: "Pandemia", short: "Pandemia", top: true }],
      annotations: [{ x: 2025, key: "us", text: "3.º mercado em 2025", short: "3.º", anchor: "end", dx: -8, dy: -12, strong: false }],
    },
    summary: { us: { y2015: get("2015", US), y2019: get("2019", US), y2025: get("2025", US), share2015: sh("2015"), share2025: sh("2025"), ranks }, ca: { y2015: get("2015", CA), y2025: get("2025", CA) }, foreign: { y2015: est("2015"), y2025: est("2025") }, total2025: tot("2025"), top2025: countries("2025").slice(0, 10) },
  }, [f]);
}

// 4. Nados-vivos por nacionalidade da mãe, 2011–2025 (INE 0008087 até 2020; 0012437 desde 2021)
{
  const fA = path.join(RAW, "nados-vivos-mae", "ine_0008087_nados_vivos_nacionalidade_mae_2011_2023.json");
  const fB = path.join(RAW, "nados-vivos-mae", "ine_0012437_nados_vivos_nacionalidade_mae.json");
  const A = ine(fA).Dados, B = ine(fB).Dados;
  const val = (src, y, geo, cat) => { const r = src[y]?.find((q) => q.geocod === geo && q.dim_3 === cat); return r ? +r.valor : null; };
  for (const y of ["2021", "2022", "2023"]) for (const c of ["T", "1", "2"]) assert(val(A, y, "PT", c) === val(B, y, "PT", c), `${y}, nacionalidade ${c}: as duas séries do INE coincidem (${val(B, y, "PT", c)})`);
  const years = [...Array(15)].map((_, i) => String(2011 + i));
  const pick = (y, c) => (+y <= 2020 ? val(A, y, "PT", c) : val(B, y, "PT", c));
  const rows = years.map((y) => {
    const T = pick(y, "T"), P = pick(y, "1"), E = pick(y, "2");
    const other = T - P - E;
    return { cat: y, pt: P, est: E, total: T, other, share: r1((E / T) * 100) };
  });
  for (const r of rows) assert(r.other >= 0 && r.other <= 20, `${r.cat}: total = portuguesa + estrangeira (+ ${r.other} ignorada/outra)`);
  const R = Object.fromEntries(rows.map((r) => [r.cat, r]));
  assert(R["2025"].total === 87764 && R["2025"].est === 25257 && R["2025"].pt === 62507 && R["2025"].share === 28.8, "2025: 87 764 nados-vivos, 25 257 de mãe estrangeira (28,8%), 62 507 de mãe portuguesa");
  assert(R["2021"].total === 79582 && R["2021"].est === 10808 && R["2021"].share === 13.6, "2021: 79 582 nados-vivos, 10 808 de mãe estrangeira (13,6%)");
  assert(R["2011"].pt === 86853 && R["2011"].est === 10003 && R["2011"].share === 10.3, "2011: 86 853 de mãe portuguesa, 10 003 de mãe estrangeira (10,3%)");
  assert(r1((R["2025"].pt / R["2011"].pt - 1) * 100) === -28 , "mãe portuguesa: −28,0% entre 2011 e 2025");
  const dT = R["2025"].total - R["2021"].total, dE = R["2025"].est - R["2021"].est, dP = R["2025"].pt - R["2021"].pt;
  assert(dT === 8182 && dE === 14449 && dP === -6265, "2021→2025: +8 182 nascimentos no total; +14 449 de mãe estrangeira; −6 265 de mãe portuguesa");
  const minPT = rows.reduce((a, b) => (b.pt < a.pt ? b : a));
  assert(minPT.cat === "2024" && minPT.pt === 62498, "mínimo de nascimentos de mãe portuguesa: 2024 (62 498); 2025 ficou em 62 507");
  assert(R["2015"].est === 7164 && R["2014"].est === 7200 && R["2015"].share === 8.4, "2015: 7 164 de mãe estrangeira (8,4%), perto do mínimo da série (7 164)");
  const minE = rows.reduce((a, b) => (b.est < a.est ? b : a));
  assert(minE.cat === "2015", "mínimo de mãe estrangeira em 2015");
  assert(r1((R["2011"].pt / R["2025"].pt - 1) * 100) === 38.9, "2011 teve 38,9% mais nascimentos de mãe portuguesa do que 2025");
  const minT = rows.reduce((a, b) => (b.total < a.total ? b : a));
  assert(minT.cat === "2021" && R["2011"].total === 96856 && R["2014"].total === 82367, "mínimo do total: 2021 (79 582); 2011: 96 856; 2014: 82 367");
  assert(R["2025"].total > R["2013"].total && R["2025"].total > R["2014"].total && R["2025"].total < R["2012"].total, "2025 teve mais nascimentos do que 2013 e 2014, menos do que 2012");
  const REG = { "11": "Norte", "19": "Centro", "1D": "Oeste e Vale do Tejo", "1A": "Grande Lisboa", "1B": "Península de Setúbal", "1C": "Alentejo", "15": "Algarve", "20": "R. A. Açores", "30": "R. A. Madeira" };
  const regions = Object.entries(REG).map(([c, n]) => ({ code: c, name: n, s2021: r1((val(B, "2021", c, "2") / val(B, "2021", c, "T")) * 100), s2025: r1((val(B, "2025", c, "2") / val(B, "2025", c, "T")) * 100) }));
  console.log(regions);
  const RG = Object.fromEntries(regions.map((r) => [r.code, r]));
  assert(RG["1A"].s2025 === 41.9 && RG["1B"].s2025 === 41.4 && RG["15"].s2025 === 40.1, "2025: Grande Lisboa 41,9%; Península de Setúbal 41,4%; Algarve 40,1%");
  assert(RG["20"].s2025 === 5.2 && RG["30"].s2025 === 12.6 && RG["11"].s2025 === 17.6, "2025: Açores 5,2%; Madeira 12,6%; Norte 17,6%");
  const sumReg = Object.keys(REG).reduce((s, c) => s + val(B, "2025", c, "T"), 0);
  assert(sumReg === R["2025"].total, "soma das 9 regiões NUTS II = total nacional de 2025");
  write("nados-vivos-mae-estrangeira-2011-2025", {
    rows: rows.map(({ cat, pt, est, total, share }) => ({ cat, pt: r2(pt / 1000), est: r2(est / 1000), total: r2(total / 1000), share })),
    views: [
      { id: "n", label: "Nascimentos", yLabel: "Nados-vivos por nacionalidade da mãe (milhares)", unit: " mil", decimals: 2, labelEvery: 2, labelEveryNarrow: 3,
        series: [{ key: "pt", label: "Mãe portuguesa (milhares)", color: "--ink-3" }, { key: "est", label: "Mãe estrangeira (milhares)", color: "--accent-2" }],
        tipExtra: [{ key: "total", label: "Total (milhares)", suffix: " mil" }] },
      { id: "p", label: "Percentagem", yLabel: "Nados-vivos de mãe com nacionalidade estrangeira (% do total)", unit: "%", decimals: 1, labelEvery: 2, labelEveryNarrow: 3, valueLabels: true,
        series: [{ key: "share", label: "Mãe estrangeira (% do total)", color: "--accent-2" }] },
    ],
    summary: { y2011: R["2011"], y2021: R["2021"], y2025: R["2025"], d2021_2025: { total: dT, est: dE, pt: dP }, minPT: [minPT.cat, minPT.pt], regions },
  }, [fA, fB]);
}

// 5. Microprocessadores, 1971–2021 (K. Rupp, CC BY 4.0)
{
  const D = path.join(RAW, "processadores");
  const files = ["frequency", "transistors", "cores", "specint"].map((n) => path.join(D, n + ".dat"));
  const [F, T, C, S] = files.map(dat);
  assert(F.length === 101 && T.length === 99 && C.length === 90 && S.length === 74, "pontos: frequência 101, transístores 99, núcleos 90, desempenho 74");
  const maxIn = (A, a, b) => Math.max(...A.filter((r) => r[0] >= a && r[0] < b).map((r) => r[1]));
  assert(F[0][1] < 1 && r1(F[0][0]) === 1971.9, "primeiro processador da série (1971): menos de 1 MHz");
  const fBefore = maxIn(F, 1970, 2005), fAfter = maxIn(F, 2005, 2023), fLate = maxIn(F, 2015, 2023);
  assert(r1(fBefore) === 3651.7 && r1(fAfter) === 4655.5 && fLate === 4000, "frequência máxima: 3 652 MHz até 2004; 4 656 MHz depois (2007); 4 000 MHz entre 2015 e 2021");
  const tBefore = maxIn(T, 2000, 2005), tLate = maxIn(T, 2015, 2023);
  assert(Math.round(tBefore) === 273842 && tLate === 58200000 && Math.round(tLate / tBefore) === 213, "transístores: máximo de 274 milhões (2000–2004) para 58 200 milhões (2015–2021), ×213");
  const sBefore = maxIn(S, 1985, 2005), sLate = maxIn(S, 2015, 2023), sFirst = S[0];
  assert(Math.round(sBefore) === 21097 && sLate === 105300 && r1(sLate / sBefore) === 5, "desempenho de um só fio: máximo 21 097 até 2004, 105 300 até 2021 (×5,0)");
  assert(r1(sFirst[0]) === 1988.7 && Math.round(sBefore / sFirst[1]) === 253, "desempenho: ×253 entre 1988 e 2004");
  const cBefore = maxIn(C, 1970, 2005), cLate = maxIn(C, 2015, 2023);
  assert(cBefore === 2 && cLate === 272, "núcleos lógicos: no máximo 2 até 2004; até 272 entre 2015 e 2021");
  const yr = (a) => a; // anos decimais tal como no ficheiro original
  const rows = [
    ...F.map(([x, v]) => ({ x: r2(yr(x)), label: "Processador", freq: r1(v) })),
    ...T.map(([x, v]) => ({ x: r2(yr(x)), label: "Processador", trans: Math.round(v * 100) / 100 })),
    ...S.map(([x, v]) => ({ x: r2(yr(x)), label: "Processador", perf: r1(v) })),
    ...C.map(([x, v]) => ({ x: r2(yr(x)), label: "Processador", cores: v })),
  ];
  const peryear = (a, b, y) => r1((Math.pow(b / a, 1 / y) - 1) * 100);
  write("processadores-frequencia-1971-2021", {
    rows,
    config: {
      x: { label: "Ano de lançamento", short: "Ano", tipLabel: "Ano (aprox.)", min: 1970, max: 2022, ticks: [1970, 1980, 1990, 2000, 2010, 2020], decimals: 0, tipDecimals: 1 },
      y: { label: "", min: 1, max: 10 },
      groups: [{ key: "p", label: "Cada ponto é um processador", color: "--accent-2" }],
      views: [
        { id: "freq", key: "freq", label: "Frequência", y: { label: "Frequência do relógio (MHz)", short: "Frequência (MHz)", tipLabel: "Frequência (MHz)", log: true, min: 0.3, max: 10000, ticks: [1, 10, 100, 1000, 10000], decimals: 0, tipDecimals: 1 },
          notes: [{ x: 2005, y: 7000, text: "Desde 2005, abaixo de 5 GHz na série", short: "2005: o teto", anchor: "middle" }] },
        { id: "trans", key: "trans", label: "Transístores", y: { label: "Transístores por processador (milhares)", short: "Transístores (milhares)", tipLabel: "Transístores (milhares)", log: true, min: 1, max: 1e8, ticks: [1, 100, 10000, 1000000, 100000000], decimals: 0, tipDecimals: 0 } },
        { id: "perf", key: "perf", label: "Desempenho", y: { label: "Desempenho de um só fio (SpecINT × 1000)", short: "Desempenho (SpecINT×10³)", tipLabel: "Desempenho de um só fio (SpecINT × 1000)", log: true, min: 10, max: 300000, ticks: [10, 100, 1000, 10000, 100000], decimals: 0, tipDecimals: 0 } },
        { id: "cores", key: "cores", label: "Núcleos", y: { label: "Núcleos lógicos por processador", short: "Núcleos lógicos", tipLabel: "Núcleos lógicos", log: true, min: 0.7, max: 1000, ticks: [1, 10, 100, 1000], decimals: 0, tipDecimals: 0 } },
      ],
      howToRead: "Cada ponto é um processador, colocado no ano em que foi lançado. Os botões trocam a medida no eixo vertical; todas usam escala logarítmica, em que cada linha da grelha vale dez vezes a anterior (cem vezes, nos transístores).",
    },
    summary: { fBefore: r1(fBefore), fAfter: r1(fAfter), fLate, tBefore: Math.round(tBefore), tLate, tRatio: Math.round(tLate / tBefore), sBefore: Math.round(sBefore), sLate, sRatio: r1(sLate / sBefore), sEarly: [r1(sFirst[0]), sFirst[1]], perYear: { s1988_2004: peryear(sFirst[1], sBefore, 2004.86 - sFirst[0]), s2004_2021: peryear(sBefore, sLate, 2021.3 - 2004.86) }, cBefore, cLate },
  }, files.concat([path.join(D, "LICENSE.txt"), path.join(D, "README.md")]));
}

if (fails) console.error(`\n${fails} verificação(ões) falharam.`);
else console.log("\nTodas as verificações passaram.");
