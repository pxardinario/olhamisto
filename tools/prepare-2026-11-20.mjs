// Transformação reprodutível dos dados brutos da edição de 2026-11-20.
// Uso: node tools/prepare-2026-11-20.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, columns — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

const r1 = (x) => Math.round(x * 10) / 10;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}
const rawFiles = (dir) => fs.readdirSync(path.join(RAW, dir)).map((f) => path.join(RAW, dir, f));
const pct = (a, b) => (b / a - 1) * 100;

// Achata um ficheiro JSON-stat do Eurostat numa lista de observações {dim: código, ..., v}
function jsonstat(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const cats = j.id.map((d) => Object.entries(j.dimension[d].category.index).sort((a, b) => a[1] - b[1]).map((e) => e[0]));
  const out = [];
  for (const [i, v] of Object.entries(j.value)) {
    let r = +i; const o = {};
    for (let k = j.id.length - 1; k >= 0; k--) { o[j.id[k]] = cats[k][r % j.size[k]]; r = Math.floor(r / j.size[k]); }
    o.v = v; out.push(o);
  }
  return { j, obs: out };
}

// 1. Estudantes do ensino superior vindos do estrangeiro (mobilidade de grau), Portugal, 2013–2024
{
  const dir = path.join(RAW, "estudantes-estrangeiros");
  const { obs } = jsonstat(path.join(dir, "eurostat_educ_uoe_mobs02_PT_ED5-8.json"));
  const g = (p, t) => obs.find((o) => o.partner === p && o.time === String(t))?.v ?? null;
  const share = jsonstat(path.join(dir, "eurostat_educ_uoe_mobs03_PT_ED5-8.json")).obs;
  const sh = (t) => share.find((o) => o.time === String(t))?.v ?? null;
  const enr = jsonstat(path.join(dir, "eurostat_educ_uoe_enrt01_PT_ED5-8.json")).obs;
  const en = (t) => enr.find((o) => o.time === String(t) && o.worktime === "TOTAL" && o.sector === "TOT_SEC")?.v ?? null;
  const years = []; for (let y = 2013; y <= 2024; y++) years.push(y);
  assert(g("WRL_X_REP", 2012) == null && g("WRL_X_REP", 2025) == null && years.every((y) => g("WRL_X_REP", y) != null), "série com valores de 2013 a 2024 (2012 e 2025 vazios para Portugal)");
  const REG = ["AFR", "AME_X_N", "EUR", "ASI", "AME_N", "OCE"];
  assert(years.every((y) => REG.reduce((s, k) => s + (g(k, y) || 0), 0) === g("WRL_X_REP", y)), "em todos os anos, a soma das seis regiões de origem é igual ao total");
  const rows = years.map((y) => ({ x: y, label: String(y), afr: g("AFR", y), lat: g("AME_X_N", y), eur: g("EUR", y), asi: g("ASI", y), tot: g("WRL_X_REP", y), br: g("BR", y), gw: g("GW", y), ao: g("AO", y), cv: g("CV", y), share: sh(y) }));
  const s = {
    tot2013: g("WRL_X_REP", 2013), tot2023: g("WRL_X_REP", 2023), tot2024: g("WRL_X_REP", 2024),
    mult1324: r1(g("WRL_X_REP", 2024) / g("WRL_X_REP", 2013)), chg2324: r1(pct(g("WRL_X_REP", 2023), g("WRL_X_REP", 2024))),
    share2013: sh(2013), share2023: sh(2023), share2024: sh(2024), enr2024: en(2024), shareCalc2024: r1((g("WRL_X_REP", 2024) / en(2024)) * 100),
    afr2013: g("AFR", 2013), afr2024: g("AFR", 2024), lat2013: g("AME_X_N", 2013), lat2024: g("AME_X_N", 2024), eur2024: g("EUR", 2024), asi2024: g("ASI", 2024),
    afrShare2024: r1((g("AFR", 2024) / g("WRL_X_REP", 2024)) * 100), latShare2024: r1((g("AME_X_N", 2024) / g("WRL_X_REP", 2024)) * 100),
    br2013: g("BR", 2013), br2020: g("BR", 2020), br2024: g("BR", 2024), gw2013: g("GW", 2013), gw2024: g("GW", 2024), ao2024: g("AO", 2024), cv2024: g("CV", 2024), fr2024: g("FR", 2024),
    gwMult: r1(g("GW", 2024) / g("GW", 2013)),
  };
  s.afrOverLatFrom = years.find((y, i) => years.slice(i).every((z) => g("AFR", z) > g("AME_X_N", z)));
  s.brPeak = years.reduce((m, y) => (g("BR", y) > g("BR", m) ? y : m), 2013);
  s.firstFall = years.slice(1).find((y) => g("WRL_X_REP", y) < g("WRL_X_REP", y - 1));
  s.topCountries2024 = obs.filter((o) => o.time === "2024" && o.partner.length === 2).sort((a, b) => b.v - a.v).slice(0, 5).map((o) => [o.partner, o.v]);
  console.log(s);
  assert(s.tot2013 === 14541 && s.tot2023 === 56775 && s.tot2024 === 55330 && s.mult1324 === 3.8 && s.chg2324 === -2.5, "total: 14 541 (2013), 56 775 (2023), 55 330 (2024); 3,8 vezes mais; −2,5% em 2024");
  assert(s.firstFall === 2024, "2024 é o primeiro ano da série com descida do total");
  assert(s.share2013 === 4 && s.share2023 === 13.3 && s.share2024 === 12.9 && s.shareCalc2024 === 12.9 && s.enr2024 === 430226, "peso no total de inscritos: 4,0% (2013), 13,3% (2023), 12,9% (2024; 55 330 em 430 226, recalculado)");
  assert(s.afr2013 === 4230 && s.afr2024 === 22720 && s.lat2013 === 5235 && s.lat2024 === 17145 && s.afrShare2024 === 41.1 && s.latShare2024 === 31, "África 4 230 → 22 720 (41,1% em 2024); América Latina e Caraíbas 5 235 → 17 145 (31,0%)");
  assert(s.afrOverLatFrom === 2022 && g("AFR", 2021) < g("AME_X_N", 2021), "desde 2022 há mais estudantes vindos de África do que da América Latina (em 2021 ainda não)");
  assert(s.br2013 === 4769 && s.br2020 === 18081 && s.brPeak === 2020 && s.br2024 === 15234, "Brasil: 4 769 (2013), máximo de 18 081 em 2020, 15 234 em 2024");
  assert(s.gw2013 === 134 && s.gw2024 === 6276 && s.gwMult === 46.8, "Guiné-Bissau: 134 (2013) → 6 276 (2024), 46,8 vezes mais");
  assert(s.topCountries2024.map((c) => c[0]).join() === "BR,GW,AO,CV,FR" && s.ao2024 === 5856 && s.cv2024 === 5144 && s.fr2024 === 3625, "cinco primeiros países em 2024: Brasil, Guiné-Bissau, Angola (5 856), Cabo Verde (5 144), França (3 625)");
  assert(s.eur2024 === 10689 && s.asi2024 === 4296, "Europa 10 689 e Ásia 4 296 em 2024");
  s.luso4Share2024 = r1(((s.br2024 + s.gw2024 + s.ao2024 + s.cv2024) / s.tot2024) * 100);
  s.cv2023 = g("CV", 2023); s.br2023 = g("BR", 2023);
  s.brOfLat2024 = r1((s.br2024 / s.lat2024) * 100);
  assert(s.brOfLat2024 === 88.9, "o Brasil é 88,9% dos estudantes vindos da América Latina em 2024 («quase nove em cada dez»)");
  assert(s.luso4Share2024 === 58.8, "Brasil, Guiné-Bissau, Angola e Cabo Verde: 58,8% dos estudantes vindos de fora em 2024");
  assert(s.cv2023 === 6449 && s.br2023 === 17028 && s.cv2024 < s.cv2023 && s.br2024 < s.br2023, "em 2024 desceram os brasileiros (17 028 → 15 234) e os cabo-verdianos (6 449 → 5 144)");
  write("estudantes-estrangeiros-ensino-superior-2013-2024", {
    rows,
    config: {
      x: { min: 2013, max: 2024, ticks: [2013, 2015, 2017, 2019, 2021, 2023, 2024], tableLabel: "Ano" },
      y: { label: "Estudantes vindos do estrangeiro (número)", suffix: "", decimals: 0, linMin: 0, linMax: 25000, logDefault: false, linTicks: [0, 5000, 10000, 15000, 20000, 25000] },
      series: [
        { key: "afr", label: "África", short: "África", color: "--accent-2", width: 2.8 },
        { key: "lat", label: "América Latina e Caraíbas", short: "Am. Lat.", color: "--accent-3", width: 2.4 },
        { key: "eur", label: "Europa", short: "Europa", color: "--accent-4", width: 1.8 },
        { key: "asi", label: "Ásia", short: "Ásia", color: "--ink-3", width: 1.6 },
      ],
      labelMargin: [70, 92],
      shortEndLabels: true,
      dots: true,
      annotations: [
        { x: 2022, key: "afr", text: "2022: África passa à frente", short: "2022", dx: -8, dy: -12, anchor: "end" },
      ],
      howToRead: "Cada linha conta os estudantes inscritos no ensino superior em Portugal que vieram de outro país para estudar, agrupados pela região de origem. O ponto assinala o ano em que a linha de África passou a da América Latina, onde quase nove em cada dez são brasileiros.",
    },
    summary: s,
  }, rawFiles("estudantes-estrangeiros"));
}

// 2. Declarações de falência de empresas, índice trimestral corrigido de sazonalidade, rebaseado à média de 2019
{
  const { obs } = jsonstat(path.join(RAW, "falencias-ue", "eurostat_sts_rb_q_SCA_I21.json"));
  const b = obs.filter((o) => o.indic_bt === "BKRT" && o.s_adj === "SCA" && o.unit === "I21");
  const g = (geo, t) => b.find((o) => o.geo === geo && o.time === t)?.v ?? null;
  const GEOS = [["EU27_2020", "eu"], ["PT", "pt"], ["FR", "fr"], ["DE", "de"], ["IT", "it"]];
  const base = Object.fromEntries([...GEOS, ["ES", "es"], ["NL", "nl"]].map(([geo]) => [geo, ["Q1", "Q2", "Q3", "Q4"].reduce((s, q) => s + g(geo, `2019-${q}`), 0) / 4]));
  const quarters = [...new Set(b.map((o) => o.time))].sort();
  assert(quarters[0] === "2015-Q1" && quarters.at(-1) === "2026-Q3" && quarters.length === 47, "47 trimestres, do 1.º de 2015 ao 3.º de 2026");
  assert(g("DE", "2026-Q3") == null && GEOS.filter(([k]) => k !== "DE").every(([k]) => g(k, "2026-Q3") != null), "falta só a Alemanha no 3.º trimestre de 2026");
  const reb = (geo, t) => (g(geo, t) == null ? null : r1((g(geo, t) / base[geo]) * 100));
  const TRIM = ["1.º", "2.º", "3.º", "4.º"];
  const rows = quarters.map((t) => { const [y, q] = t.split("-Q").map(Number); return Object.assign({ x: Math.round((y + (q - 1) / 4 + 0.125) * 1000) / 1000, label: `${TRIM[q - 1]} trim. ${y}` }, Object.fromEntries(GEOS.map(([geo, k]) => [k, reb(geo, t)]))); });
  const euMax = quarters.reduce((m, t) => (g("EU27_2020", t) > g("EU27_2020", m) ? t : m), quarters[0]);
  const s = {
    base2019: Object.fromEntries(Object.entries(base).map(([k, v]) => [k, Math.round(v * 1000) / 1000])),
    euQ2_26: reb("EU27_2020", "2026-Q2"), euQ3_26: reb("EU27_2020", "2026-Q3"), euMax, euMaxI21: g("EU27_2020", euMax), eu15Q1I21: g("EU27_2020", "2015-Q1"),
    ptQ3_26: reb("PT", "2026-Q3"), frQ3_26: reb("FR", "2026-Q3"), itQ3_26: reb("IT", "2026-Q3"), deQ2_26: reb("DE", "2026-Q2"), esQ3_26: reb("ES", "2026-Q3"), nlQ3_26: reb("NL", "2026-Q3"),
    euMin: quarters.reduce((m, t) => (g("EU27_2020", t) < g("EU27_2020", m) ? t : m), quarters[0]), pt15Q1: reb("PT", "2015-Q1"),
    eu21avg: r1(["Q1", "Q2", "Q3", "Q4"].reduce((s, q) => s + reb("EU27_2020", `2021-${q}`), 0) / 4),
  };
  s.euMinVal = reb("EU27_2020", s.euMin);
  s.ptAbove2019Since2022 = quarters.filter((t) => t >= "2022-Q1" && reb("PT", t) >= 100);
  const reg = obs.filter((o) => o.indic_bt === "REG" && o.s_adj === "SCA" && o.unit === "I21");
  const gr = (geo, t) => reg.find((o) => o.geo === geo && o.time === t)?.v;
  const rbase = (geo) => ["Q1", "Q2", "Q3", "Q4"].reduce((acc, q) => acc + gr(geo, `2019-${q}`), 0) / 4;
  s.regEuQ3_26 = r1((gr("EU27_2020", "2026-Q3") / rbase("EU27_2020")) * 100); s.regPtQ3_26 = r1((gr("PT", "2026-Q3") / rbase("PT")) * 100);
  console.log(s);
  assert(s.euMax === "2026-Q2" && s.euMaxI21 === 195.2 && s.eu15Q1I21 === 187.5, "UE: máximo da série no 2.º trimestre de 2026 (195,2, base 2021), acima do 1.º de 2015 (187,5)");
  assert(s.euQ2_26 === 141.4 && s.euQ3_26 === 140.4, "UE, média de 2019 = 100: 141,4 no 2.º trim. de 2026 e 140,4 no 3.º");
  assert(s.ptQ3_26 === 90.6 && s.itQ3_26 === 95.4 && s.frQ3_26 === 141.1 && s.deQ2_26 === 136.5, "3.º trim. 2026 (2019 = 100): Portugal 90,6; Itália 95,4; França 141,1; Alemanha 136,5 no 2.º trim.");
  assert(s.ptAbove2019Since2022.length === 0, "desde 2022, Portugal nunca chegou ao nível médio de 2019");
  s.ptLastAt100 = quarters.filter((t) => reb("PT", t) >= 100).at(-1);
  assert(s.ptLastAt100 === "2020-Q3", "o último trimestre em que Portugal esteve ao nível de 2019 ou acima foi o 3.º de 2020");
  assert(s.pt15Q1 === 198.5, "Portugal no 1.º trim. de 2015: 198,5 (quase o dobro de 2019)");
  assert(s.esQ3_26 === 287.9, "Espanha, fora do gráfico: 287,9 no 3.º trim. de 2026 (2019 = 100)");
  assert(s.euMin === "2020-Q2" && s.euMinVal === 68.1, "mínimo da UE no 2.º trim. de 2020 (68,1)");
  write("falencias-empresas-ue-2015-2026", {
    rows,
    config: {
      x: { min: 2015, max: 2026.75, ticks: [2015, 2017, 2019, 2021, 2023, 2025], tableLabel: "Trimestre" },
      y: { label: "Declarações de falência (média de 2019 = 100)", suffix: "", decimals: 1, linMin: 0, linMax: 220, logDefault: false, linTicks: [0, 50, 100, 150, 200] },
      series: [
        { key: "eu", label: "União Europeia", short: "UE", color: "--accent-2", width: 2.8 },
        { key: "pt", label: "Portugal", short: "PT", color: "--accent", width: 2.8 },
        { key: "fr", label: "França", short: "FR", color: "--muted", width: 1.4 },
        { key: "de", label: "Alemanha", short: "DE", color: "--muted", width: 1.4 },
        { key: "it", label: "Itália", short: "IT", color: "--muted", width: 1.4 },
      ],
      labelMargin: [62, 128],
      refLine: { value: 100, label: "Média de 2019", short: "2019", at: 2016.2 },
      shade: [{ from: 2020.0, to: 2021.75, exact: true, label: "Pandemia e moratórias", short: "Pandemia", top: true }],
      annotations: [
        { x: rows.find((q) => q.label === "2.º trim. 2026").x, key: "eu", text: "Máximo desde 2015", short: "Máximo", dx: -8, dy: -12, anchor: "end" },
      ],
      howToRead: "Cada linha compara as declarações de falência de um país com a sua própria média de 2019, que vale 100: 140 quer dizer mais 40% do que nesse ano. Os níveis não se comparam entre países, só a evolução. Valores trimestrais corrigidos de sazonalidade.",
    },
    summary: s,
  }, rawFiles("falencias-ue"));
}

// 3. Testes de armas nucleares por país e ano, 1945–2019 (Arms Control Association, via OWID)
{
  const lines = fs.readFileSync(path.join(RAW, "testes-nucleares", "owid_nuclear_weapons_tests_aca_2020.csv"), "utf8").trim().split("\n");
  assert(lines[0] === "Entity,Year,nuclear_weapons_tests", "cabeçalho esperado do CSV da OWID");
  const data = lines.slice(1).map((l) => { const [e, y, v] = l.split(","); return { e, y: +y, v: +v }; });
  const N = (e, y) => data.find((d) => d.e === e && d.y === y)?.v ?? 0;
  const ENT = ["United States", "Russia", "France", "United Kingdom", "China", "India", "Pakistan", "North Korea"];
  assert(new Set(data.map((d) => d.e)).size === 8 && ENT.every((e) => data.some((d) => d.e === e)), "oito países no ficheiro");
  assert(Math.min(...data.map((d) => d.y)) === 1945 && Math.max(...data.map((d) => d.y)) === 2019 && data.length === 600, "600 linhas: 8 países × 75 anos (1945–2019)");
  const rawTotal = data.reduce((s, d) => s + d.v, 0);
  assert(rawTotal === 2059 && N("North Korea", 2010) === 3, "o ficheiro soma 2 059 testes, incluindo 3 da Coreia do Norte em 2010");
  // exclusão documentada: a contagem da ACA não inclui testes norte-coreanos em 2010
  const adj = (e, y) => (e === "North Korea" && y === 2010 ? 0 : N(e, y));
  const years = []; for (let y = 1945; y <= 2019; y++) years.push(y);
  const tot = (y) => ENT.reduce((s, e) => s + adj(e, y), 0);
  const byC = Object.fromEntries(ENT.map((e) => [e, years.reduce((s, y) => s + adj(e, y), 0)]));
  const total = years.reduce((s, y) => s + tot(y), 0);
  console.log(byC, total);
  assert(total === 2056, "total depois da exclusão: 2 056 testes, como na contagem da ACA");
  assert(byC["United States"] === 1030 && byC.Russia === 715 && byC.France === 210 && byC["United Kingdom"] === 45 && byC.China === 45 && byC.India === 3 && byC.Pakistan === 2 && byC["North Korea"] === 6, "por país, como na ACA: EUA 1 030, URSS/Rússia 715, França 210, Reino Unido 45, China 45, Índia 3, Paquistão 2, Coreia do Norte 6");
  const peak = years.reduce((m, y) => (tot(y) > tot(m) ? y : m), 1945);
  const sum = (a, b) => years.filter((y) => y >= a && y <= b).reduce((s, y) => s + tot(y), 0);
  const s = {
    total, byCountry: byC, peak, peakN: tot(peak), us1962: adj("United States", 1962), su1962: adj("Russia", 1962),
    usShare: r1((byC["United States"] / total) * 100), usSuShare: r1(((byC["United States"] + byC.Russia) / total) * 100),
    n1945_1963: sum(1945, 1963), n1964_1989: sum(1964, 1989), avg1964_1989: r1(sum(1964, 1989) / 26), avg1955_1962: r1(sum(1955, 1962) / 8),
    n1990_1996: sum(1990, 1996), n1997_2019: sum(1997, 2019), last: Math.max(...years.filter((y) => tot(y) > 0)),
    n1963: tot(1963), n1959: tot(1959), n1958: tot(1958), n1961: tot(1961),
    yearsWith40plus_after1963: years.filter((y) => y > 1963 && tot(y) >= 40).length,
    lastYear40: Math.max(...years.filter((y) => tot(y) >= 40)),
  };
  s.peakShareUsSu = r1(((s.us1962 + s.su1962) / s.peakN) * 100);
  console.log(s);
  assert(s.peak === 1962 && s.peakN === 178 && s.us1962 === 96 && s.su1962 === 79 && s.peakShareUsSu === 98.3, "pico em 1962: 178 testes (EUA 96, URSS 79; 98,3% dos dois)");
  assert(s.usShare === 50.1 && s.usSuShare === 84.9, "EUA: 50,1% de todos os testes; EUA e URSS/Rússia: 84,9%");
  assert(s.n1964_1989 === 1393 && s.avg1964_1989 === 53.6, "1964–1989: 1 393 testes, 53,6 por ano em média");
  assert(s.n1945_1963 === 600 && s.n1990_1996 === 53 && s.n1997_2019 === 10, "1945–1963: 600; 1990–1996: 53; 1997–2019: 10 (Índia, Paquistão, Coreia do Norte)");
  assert(s.n1959 === 0 && s.n1958 === 116 && s.n1961 === 71 && s.n1963 === 50, "moratória de 1959 (zero testes), 116 em 1958, 71 em 1961, 50 em 1963");
  assert(s.last === 2017 && s.lastYear40 === 1988, "último teste em 2017; último ano com 40 ou mais testes: 1988");
  assert(s.avg1955_1962 === 60, "1955–1962: 60,0 testes por ano em média (antes do tratado de 1963)");
  const COL = [["United States", "us"], ["Russia", "su"], ["France", "fr"], ["United Kingdom", "uk"], ["China", "cn"]];
  const rows = years.map((y) => Object.assign({ cat: String(y) }, Object.fromEntries(COL.map(([e, k]) => [k, adj(e, y)])), { oth: adj("India", y) + adj("Pakistan", y) + adj("North Korea", y), tot: tot(y) }));
  assert(rows.every((r) => r.us + r.su + r.fr + r.uk + r.cn + r.oth === r.tot), "em cada ano, as séries empilhadas somam o total");
  write("testes-nucleares-1945-2019", {
    rows,
    views: [
      { id: "pais", label: "Por país", yLabel: "Testes de armas nucleares por ano", unit: "", decimals: 0, labelEvery: 10, labelEveryNarrow: 20,
        series: [
          { key: "us", label: "Estados Unidos", color: "--accent-2" },
          { key: "su", label: "URSS / Rússia", color: "--accent-3" },
          { key: "fr", label: "França", color: "--accent-4" },
          { key: "uk", label: "Reino Unido", color: "--ink-3" },
          { key: "cn", label: "China", color: "--ink-2" },
          { key: "oth", label: "Índia, Paquistão e Coreia do Norte", color: "--muted" },
        ],
        tipExtra: [{ key: "tot", label: "Total", suffix: "" }],
        notes: [{ cat: "1963", text: "1963: fim dos testes na atmosfera (EUA, URSS, RU)", short: "1963" }, { cat: "1996", text: "1996: Tratado de Proibição Total", short: "1996" }] },
      { id: "total", label: "Total", yLabel: "Testes de armas nucleares por ano, todos os países", unit: "", decimals: 0, labelEvery: 10, labelEveryNarrow: 20,
        series: [{ key: "tot", label: "Total de testes", color: "--accent-2" }],
        notes: [{ cat: "1963", text: "1963: fim dos testes na atmosfera (EUA, URSS, RU)", short: "1963" }, { cat: "1996", text: "1996: Tratado de Proibição Total", short: "1996" }] },
    ],
    summary: s,
  }, rawFiles("testes-nucleares"));
}

// 4. Investimento direto estrangeiro em Portugal (posição no fim de 2025): país do investidor imediato vs. do investidor final
{
  const { obs } = jsonstat(path.join(RAW, "ide-portugal", "eurostat_bop_fdi6_pos_PT_NI_DIRE.json"));
  const g = (c, p, t = "2025") => obs.find((o) => o.counterp === c && o.partner === p && o.time === t)?.v ?? null;
  for (let y = 2013; y <= 2025; y++) assert(Math.abs(g("ULT", "WRL_REST", String(y)) + g("ULT", "PT", String(y)) - g("IMM", "WRL_REST", String(y))) < 0.5, `${y}: total do investidor final (sem Portugal) + Portugal = total da contraparte imediata`);
  const total = g("IMM", "WRL_REST");
  const C = [["ES", "Espanha"], ["PT", "Portugal"], ["FR", "França"], ["LU", "Luxemburgo"], ["US", "Estados Unidos", "EUA"], ["UK", "Reino Unido"], ["CN_X_HK", "China (sem Hong Kong)", "China"], ["DE", "Alemanha"], ["NL", "Países Baixos"], ["AO", "Angola"], ["BR", "Brasil"], ["IT", "Itália"], ["CH", "Suíça"], ["BE", "Bélgica"], ["HK", "Hong Kong"]];
  const bn = (v) => Math.round(v / 100) / 10;
  const rows = C.map(([k, lab, short]) => ({ label: lab, ...(short ? { short } : {}), a: bn(g("IMM", k) ?? 0), b: bn(g("ULT", k)), highlight: k === "PT", imm: g("IMM", k) ?? 0, ult: g("ULT", k) }));
  const s = {
    total, totalBn: bn(total), ptUlt: g("ULT", "PT"), ptShare: r1((g("ULT", "PT") / total) * 100), ptImm: g("IMM", "PT"),
    es: [g("IMM", "ES"), g("ULT", "ES")], lu: [g("IMM", "LU"), g("ULT", "LU")], nl: [g("IMM", "NL"), g("ULT", "NL")], us: [g("IMM", "US"), g("ULT", "US")], cn: [g("IMM", "CN_X_HK"), g("ULT", "CN_X_HK")],
    luNlImmShare: r1(((g("IMM", "LU") + g("IMM", "NL")) / total) * 100), luNlUltShare: r1(((g("ULT", "LU") + g("ULT", "NL")) / total) * 100),
    usMult: r1(g("ULT", "US") / g("IMM", "US")), cnMult: r1(g("ULT", "CN_X_HK") / g("IMM", "CN_X_HK")),
    ptShare2013: r1((g("ULT", "PT", "2013") / g("IMM", "WRL_REST", "2013")) * 100), ptShare2019: r1((g("ULT", "PT", "2019") / g("IMM", "WRL_REST", "2019")) * 100),
    total2013: g("IMM", "WRL_REST", "2013"),
  };
  s.ultRank = obs.filter((o) => o.counterp === "ULT" && o.time === "2025" && (o.partner.length === 2 || o.partner === "CN_X_HK")).sort((a, b) => b.v - a.v).slice(0, 6).map((o) => o.partner);
  s.immRank = obs.filter((o) => o.counterp === "IMM" && o.time === "2025" && (o.partner.length === 2 || o.partner === "CN_X_HK")).sort((a, b) => b.v - a.v).slice(0, 3).map((o) => o.partner);
  console.log(s);
  assert(s.total === 217446.3 && s.totalBn === 217.4, "posição total do investimento direto estrangeiro em Portugal no fim de 2025: 217 446,3 milhões de euros");
  assert(s.ptImm === 0 && s.ptUlt === 28536.2 && s.ptShare === 13.1, "Portugal como investidor final: 28 536,2 milhões (13,1% do total); como contraparte imediata: 0");
  assert(s.ultRank.join() === "ES,PT,FR,LU,US,UK" && s.immRank.join() === "ES,LU,NL", "investidor final: Espanha, Portugal, França, Luxemburgo, EUA, Reino Unido; contraparte imediata: Espanha, Luxemburgo, Países Baixos");
  assert(s.lu[0] === 41966.8 && s.lu[1] === 18208 && s.nl[0] === 34588.7 && s.nl[1] === 10532.3 && s.luNlImmShare === 35.2 && s.luNlUltShare === 13.2, "Luxemburgo 42,0 → 18,2 mil milhões; Países Baixos 34,6 → 10,5; juntos, 35,2% → 13,2% do total");
  assert(s.us[0] === 5004.3 && s.us[1] === 16990.9 && s.usMult === 3.4 && s.cn[0] === 3600.5 && s.cn[1] === 14852.7 && s.cnMult === 4.1, "EUA 5,0 → 17,0 mil milhões (3,4 vezes); China sem Hong Kong 3,6 → 14,9 (4,1 vezes)");
  assert(s.es[0] === 43904.5 && s.es[1] === 30969.8, "Espanha 43,9 → 31,0 mil milhões");
  assert(s.ptShare2013 === 29.9 && s.ptShare2019 === 17.6, "peso de Portugal como investidor final: 29,9% em 2013, 17,6% em 2019");
  assert(rows.length === 15 && rows.every((q) => q.b != null), "15 países, todos com valor do investidor final");
  write("investimento-estrangeiro-portugal-2025", {
    rows,
    config: {
      aLabel: "Pelo país do investidor imediato", bLabel: "Pelo país do investidor final", ref: 0, refLabel: "", unit: "", decimals: 1, domain: [0, 45], itemLabel: "país",
      sorts: [["b", "Pelo investidor final"], ["delta", "Pela diferença"]],
      howToRead: "Cada linha é um país. O ponto cinzento mostra o investimento direto em Portugal (posição no fim de 2025, em mil milhões de euros) atribuído ao país da empresa que detém diretamente o investimento; o ponto azul, ao país de quem o controla no fim da cadeia. Portugal, a terracota, só aparece do lado do investidor final: é capital português que volta através de empresas no estrangeiro.",
    },
    summary: s,
  }, rawFiles("ide-portugal"));
}
