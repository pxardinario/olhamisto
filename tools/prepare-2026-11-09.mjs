// Transformação reprodutível dos dados brutos da edição de 2026-11-09.
// Uso: node tools/prepare-2026-11-09.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines (agora com eixo negativo e rótulos mensais), columns, dumbbell, bars — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

function csv(file) {
  const [head, ...rows] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const split = (line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
  const cols = split(head);
  return rows.map((r) => { const v = split(r); return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""])); });
}
function jstat(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const G = j.dimension.geo.category.index, T = j.dimension.time.category.index, nt = Object.keys(T).length;
  return { j, v: (g, t) => j.value[G[g] * nt + T[t]], times: Object.keys(T) };
}
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
let fails = 0;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); fails++; process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}
const EU27 = ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "EL", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE"];
const NAME = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };
const MES = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

// 1. Crédito à habitação: taxa de variação anual, Portugal e zona euro, 2004–2026 (BCE, BSI)
{
  const D = path.join(RAW, "credito-habitacao-pt");
  const fPT = path.join(D, "ecb_BSI.M.PT.N.A.A22.A.I.U2.2250.Z01.A.csv"), fEA = path.join(D, "ecb_BSI.M.U2.N.A.A22.A.I.U2.2250.Z01.A.csv"), fST = path.join(D, "ecb_BSI.M.PT.N.A.A22.A.1.U2.2250.Z01.E.csv");
  const rd = (f) => new Map(csv(f).map((r) => [r.TIME_PERIOD, +r.OBS_VALUE]));
  const pt = rd(fPT), ea = rd(fEA), st = rd(fST);
  const months = [...pt.keys()];
  assert(months[0] === "2004-01" && months.at(-1) === "2026-09" && months.length === 273, `Portugal: 273 meses, ${months[0]} a ${months.at(-1)}`);
  assert(months.every((m) => ea.has(m)), "zona euro com valor em todos os meses de Portugal");
  const rows = months.map((m) => { const [y, mo] = m.split("-").map(Number); return { x: r2(y + (mo - 1) / 12), label: `${MES[mo - 1]} ${y}`, month: m, pt: r1(pt.get(m)), ea: r1(ea.get(m)) }; });
  const last = pt.get("2026-09"), eaLast = ea.get("2026-09");
  assert(r1(last) === 11.1 && r1(eaLast) === 3.0, `setembro de 2026: Portugal ${r1(last)}%, zona euro ${r1(eaLast)}%`);
  assert(r1(last / eaLast) === 3.7, `Portugal cresce ${r1(last / eaLast)} vezes o ritmo da zona euro`);
  const maxPT = [...pt].reduce((a, b) => (b[1] > a[1] ? b : a));
  assert(maxPT[0] === "2026-09", "setembro de 2026 é o valor mais alto da série de Portugal (desde 2004)");
  const pre = [...pt].filter(([m]) => m < "2009").reduce((a, b) => (b[1] > a[1] ? b : a));
  assert(pre[0] === "2006-01" && r1(pre[1]) === 10.6, `máximo antes de 2009: ${pre[0]} (${r1(pre[1])}%)`);
  assert(r1(ea.get("2006-01")) === 11.7 && ea.get("2006-01") > pt.get("2006-01"), "janeiro de 2006: zona euro 11,7%, acima de Portugal");
  const minPT = [...pt].reduce((a, b) => (b[1] < a[1] ? b : a));
  assert(minPT[0] === "2014-12" && r1(minPT[1]) === -3.8, `mínimo: ${minPT[0]} (${r1(minPT[1])}%)`);
  const negRecent = months.filter((m) => m >= "2020" && pt.get(m) < 0);
  assert(negRecent[0] === "2023-08" && negRecent.at(-1) === "2024-05" && negRecent.length === 10, "taxa negativa de agosto de 2023 a maio de 2024 (10 meses)");
  const trough = negRecent.reduce((a, b) => (pt.get(b) < pt.get(a) ? b : a));
  assert(trough === "2023-12" && r1(pt.get(trough)) === -1.3, `mínimo recente: dezembro de 2023 (${r1(pt.get(trough))}%)`);
  const ea26 = months.filter((m) => m >= "2026").map((m) => r1(ea.get(m)));
  assert(Math.min(...ea26) === 2.8 && Math.max(...ea26) === 3, "zona euro em 2026: entre 2,8% e 3,0%");
  const incr = months.filter((m) => m >= "2024-01").every((m, i, a) => i === 0 || pt.get(m) >= pt.get(a[i - 1]));
  assert(incr, "desde janeiro de 2024, a taxa nunca desceu de um mês para o outro");
  const eaMax = [...ea].filter(([m]) => m >= "2004").reduce((a, b) => (b[1] > a[1] ? b : a));
  assert(eaMax[0] === "2006-04" && r1(eaMax[1]) === 12.2, `zona euro, máximo desde 2004: ${eaMax[0]} (${r1(eaMax[1])}%)`);
  const sLast = st.get("2026-09"), peak11 = [...st].filter(([m]) => m < "2020").reduce((a, b) => (b[1] > a[1] ? b : a));
  assert(r1(sLast / 1000) === 122.4, `saldo em setembro de 2026: ${r1(sLast / 1000)} mil milhões de euros`);
  assert(peak11[0] === "2011-03" && r1(peak11[1] / 1000) === 115.4, `máximo anterior do saldo: ${peak11[0]} (${r1(peak11[1] / 1000)} mil milhões)`);
  const firstAbove = [...st].find(([m, v]) => m > "2012" && v > peak11[1]);
  assert(firstAbove[0] === "2026-03", `primeiro mês acima do máximo de 2011: ${firstAbove[0]}`);
  assert(Math.max(...[...st.values()]) === sLast, "setembro de 2026: saldo mais alto da série (desde 2003)");
  const s2019 = Math.min(...[...st].filter(([m]) => m >= "2015" && m < "2021").map(([, v]) => v));
  console.log("saldo mínimo 2015–2020:", s2019);
  write("credito-habitacao-crescimento-2026", {
    rows: rows.map(({ month, ...r }) => r),
    config: { x: { label: "Mês", tableLabel: "Mês", min: 2004, max: 2026.67, ticks: [2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026] },
      y: { label: "Variação anual do crédito à habitação às famílias (%)", suffix: "%", decimals: 1, logDefault: false, linMin: -6, linMax: 14 },
      series: [{ key: "pt", label: "Portugal", short: "PT", color: "--accent", width: 3 }, { key: "ea", label: "Zona euro", short: "ZE", color: "--accent-2", width: 2 }],
      scaleToggle: false, dots: false, labelMargin: [56, 104],
      annotations: [{ x: 2006, key: "pt", text: "jan. 2006: 10,6%", short: "2006: 10,6%", anchor: "start", dx: 6, dy: -10 },
        { x: 2014.92, key: "pt", text: "dez. 2014: −3,8%", short: "2014: −3,8%", anchor: "middle", dy: 20 },
        { x: 2023.92, key: "pt", text: "dez. 2023: −1,3%", short: "2023: −1,3%", anchor: "end", dx: -8, dy: 16 }] },
    summary: { last: r2(last), eaLast: r2(eaLast), ratio: r1(last / eaLast), pre2009: { month: pre[0], value: r2(pre[1]) }, min: { month: minPT[0], value: r2(minPT[1]) }, trough: { month: trough, value: r2(pt.get(trough)) }, negRecent: [negRecent[0], negRecent.at(-1)], eaMax: { month: eaMax[0], value: r2(eaMax[1]) }, stockLast: r1(sLast), stockPeak2011: { month: peak11[0], value: peak11[1] }, firstAbove: firstAbove[0] },
  }, [fPT, fEA, fST, path.join(D, "FONTE.md")]);
}

// 2. CO₂ em Mauna Loa: aumento anual (diferença entre médias anuais), 1960–2025, com as COP (NOAA GML)
{
  const f = path.join(RAW, "co2-cop", "datasets_co2-ppm_co2-annmean-mlo.csv");
  const all = csv(f).map((r) => ({ y: +r.Year, c: +r.Mean }));
  assert(all[0].y === 1959 && all.at(-1).y === 2025 && all.length === 67, "67 médias anuais, 1959–2025");
  const C = Object.fromEntries(all.map((r) => [r.y, r.c]));
  assert(C[1959] === 315.98 && C[1995] === 360.97 && C[2015] === 401.01 && C[2025] === 427.35, "1959: 315,98; 1995: 360,97; 2015: 401,01; 2025: 427,35 ppm");
  const rows = all.slice(1).map((r, i) => ({ cat: String(r.y), inc: r2(r.c - all[i].c), level: r.c }));
  const before = r2(C[1995] - C[1959]), after = r2(C[2025] - C[1995]);
  assert(before === 44.99 && after === 66.38 && after > before, `1959→1995: +${before} ppm em 36 anos; 1995→2025: +${after} ppm em 30 anos`);
  const dec = (a, b) => r2(mean(rows.filter((r) => +r.cat >= a && +r.cat <= b).map((r) => r.inc)));
  const d60 = dec(1960, 1969), d90 = dec(1990, 1999), d10 = dec(2010, 2019), last10 = dec(2016, 2025);
  assert(d60 === 0.86 && d90 === 1.53 && d10 === 2.4 && last10 === 2.63, `aumento médio anual: anos 1960 ${d60}; anos 1990 ${d90}; anos 2010 ${d10}; 2016–2025 ${last10} ppm`);
  assert(r1(last10 / d60) === 3.1, `ritmo da última década ≈ ${r1(last10 / d60)} vezes o dos anos 1960`);
  const mx = rows.reduce((a, b) => (b.inc > a.inc ? b : a));
  assert(mx.cat === "2024" && mx.inc === 3.53, "maior aumento anual: 2024 (+3,53 ppm)");
  assert(rows.find((r) => r.cat === "2025").inc === 2.74, "2025: +2,74 ppm");
  const after95 = rows.filter((r) => +r.cat > 1995), before95 = rows.filter((r) => +r.cat <= 1995);
  assert(after95.every((r) => r.inc > 0) && Math.min(...after95.map((r) => r.inc)) > 1.1, "desde 1996, a concentração subiu todos os anos");
  const neverAbove2Before = rows.filter((r) => +r.cat < 1995 && r.inc >= 2).map((r) => r.cat);
  assert(neverAbove2Before.join() === "1973,1988", "antes de 1995, só 1973 e 1988 tiveram aumentos de 2 ppm ou mais");
  const I = (y) => rows.find((r) => r.cat === String(y)).inc;
  assert([1998, 2016, 2024].every((y) => I(y) > I(y - 1) && I(y) > I(y + 1 > 2025 ? y - 1 : y + 1)) && I(1998) === 2.96 && I(2016) === 3.4, "1998 (+2,96), 2016 (+3,40) e 2024 (+3,53) são picos locais do aumento anual");
  const since2010 = rows.filter((r) => +r.cat >= 2010 && r.inc < 2).map((r) => r.cat);
  console.log("anos desde 2010 abaixo de 2 ppm:", since2010.join(", "));
  write("co2-atmosfera-cop31", {
    rows,
    views: [{ id: "inc", label: "Aumento anual", yLabel: "Aumento da concentração média anual de CO₂ em Mauna Loa face ao ano anterior (partes por milhão)", unit: " ppm", decimals: 2, labelEvery: 5, labelEveryNarrow: 10,
      series: [{ key: "inc", label: "Aumento face ao ano anterior", color: "--accent-2" }],
      tipExtra: [{ key: "level", label: "Concentração média do ano", suffix: " ppm" }],
      notes: [{ cat: "1995", text: "1995: 1.ª COP, Berlim", short: "1.ª COP" }, { cat: "2015", text: "2015: Acordo de Paris", short: "Paris" }] }],
    summary: { c1959: C[1959], c1995: C[1995], c2015: C[2015], c2025: C[2025], before, after, d60, d90, d10, last10, max: mx, neverAbove2Before, since2010Below2: since2010 },
  }, [f, path.join(RAW, "co2-cop", "datasets_co2-ppm_datapackage.json"), path.join(RAW, "co2-cop", "FONTE.md")]);
}

// 3. Empresas que usam IA, UE-27, 2021 → 2025 (Eurostat isoc_eb_ai)
{
  const f = path.join(RAW, "ia-empresas-ue", "eurostat_isoc_eb_ai_E_AI_TANY_GE10.json");
  const { v, times } = jstat(f);
  assert(times.join() === "2021,2023,2024,2025", "anos disponíveis: 2021, 2023, 2024, 2025");
  assert(EU27.every((c) => times.every((t) => v(c, t) != null)), "27 países com valor nos quatro anos");
  const rows = EU27.map((c) => ({ label: NAME[c], a: r1(v(c, "2021")), b: r1(v(c, "2025")), c: r1(v(c, "2024")), highlight: c === "PT" }));
  const eu = { a: v("EU27_2020", "2021"), b: v("EU27_2020", "2025"), c: v("EU27_2020", "2024") };
  assert(r1(v("PT", "2021")) === 7.2 && r1(eu.a) === 7.7, "2021: Portugal 7,2%, UE 7,7%");
  assert(r1(v("PT", "2025")) === 11.5 && r1(eu.b) === 20, "2025: Portugal 11,5%, UE 20,0%");
  assert(r1(v("PT", "2024")) === 8.6 && r1(eu.c) === 13.5, "2024: Portugal 8,6%, UE 13,5%");
  const rank = (t) => [...EU27].sort((x, y) => v(y, t) - v(x, t)).indexOf("PT") + 1;
  assert(rank("2021") === 14 && rank("2025") === 21, `posição de Portugal entre os 27: 14.ª em 2021, ${rank("2025")}.ª em 2025`);
  const deltas = EU27.map((c) => [c, v(c, "2025") - v(c, "2021")]).sort((x, y) => x[1] - y[1]);
  assert(deltas[0][0] === "RO" && deltas[1][0] === "PT" && r1(deltas[1][1]) === 4.3, `menor aumento 2021→2025: Roménia (${r1(deltas[0][1])} pp), depois Portugal (${r1(deltas[1][1])} pp)`);
  assert(r1(eu.b - eu.a) === 12.3, `UE: +${r1(eu.b - eu.a)} pp`);
  const below = EU27.filter((c) => v(c, "2025") < v("PT", "2025")).map((c) => NAME[c]);
  assert(below.length === 6, `abaixo de Portugal em 2025: ${below.join(", ")}`);
  const top = [...EU27].sort((x, y) => v(y, "2025") - v(x, "2025")).slice(0, 3);
  assert(top.join() === "DK,FI,SE" && r1(v("DK", "2025")) === 42, `2025: Dinamarca ${r1(v("DK", "2025"))}%, Finlândia ${r1(v("FI", "2025"))}%, Suécia ${r1(v("SE", "2025"))}%`);
  assert(r1(v("ES", "2025")) === 20.3 && r1(v("ES", "2021")) === 7.7, "Espanha: 7,7% → 20,3%");
  write("ia-empresas-ue-2021-2025", {
    rows,
    config: { aLabel: "2021", bLabel: "2025", cLabel: "2024", ref: r1(eu.b), refLabel: `UE 2025: ${r1(eu.b).toFixed(1).replace(".", ",")}%`, unit: "%", decimals: 1, domain: [0, 45],
      howToRead: "Cada linha é um país: vai da percentagem de empresas que usavam inteligência artificial em 2021 (ponto cinzento) à de 2025 (ponto azul). O anel marca 2024. Quanto mais comprida a linha, mais depressa a IA entrou nas empresas. A linha tracejada é a média da UE em 2025. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por valor em 2025"], ["delta", "Por aumento"]] },
    summary: { pt: { y2021: r2(v("PT", "2021")), y2024: r2(v("PT", "2024")), y2025: r2(v("PT", "2025")) }, eu: { y2021: r2(eu.a), y2024: r2(eu.c), y2025: r2(eu.b) }, rank2021: rank("2021"), rank2025: rank("2025"), below2025: below, smallestRises: deltas.slice(0, 3).map(([c, d]) => [NAME[c], r2(d)]) },
  }, [f, path.join(RAW, "ia-empresas-ue", "FONTE.md")]);
}

// 4. Pessoas que não podem pagar uma semana de férias fora de casa, UE-27, 2010 → 2025 (Eurostat ilc_mdes02)
{
  const f = path.join(RAW, "ferias-ue", "eurostat_ilc_mdes02_TOTAL.json");
  const { v } = jstat(f);
  assert(EU27.every((c) => v(c, "2010") != null && v(c, "2025") != null), "27 países com valor em 2010 e 2025");
  const rows = EU27.map((c) => ({ label: NAME[c], a: v(c, "2010"), b: v(c, "2025"), highlight: c === "PT" }));
  assert(v("PT", "2010") === 64.6 && v("PT", "2025") === 33.1, "Portugal: 64,6% (2010) → 33,1% (2025)");
  assert(v("EU27_2020", "2010") === 38.8 && v("EU27_2020", "2025") === 27.5, "UE-27: 38,8% → 27,5%");
  const ptSeries = ["2004", "2005", "2006", "2007", "2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"].map((t) => [t, v("PT", t)]);
  assert(ptSeries.reduce((a, b) => (b[1] > a[1] ? b : a))[0] === "2010", "2010 é o máximo da série portuguesa (desde 2004)");
  assert(v("PT", "2013") === 59.8 && v("PT", "2019") === 40 && v("PT", "2023") === 38.9, "Portugal: 2013 59,8%; 2019 40,0%; 2023 38,9%");
  const rk = (t) => [...EU27].sort((x, y) => v(y, t) - v(x, t)).indexOf("PT") + 1;
  assert(rk("2010") === 4 && rk("2025") === 6, `Portugal: 4.º valor mais alto em 2010, ${rk("2025")}.º em 2025`);
  const drops = EU27.map((c) => [c, r1(v(c, "2025") - v(c, "2010"))]).sort((x, y) => x[1] - y[1]);
  assert(drops.findIndex((d) => d[0] === "PT") === 5 && drops.find((d) => d[0] === "PT")[1] === -31.5, "Portugal: 6.ª maior descida (−31,5 pp)");
  assert(drops[0][0] === "PL" && drops[0][1] === -35.4, "maior descida: Polónia (−35,4 pp)");
  assert(v("EL", "2010") === 46.3 && v("EL", "2025") === 46.6 && v("IT", "2025") === 35.7 && v("ES", "2025") === 32.2, "Grécia 46,3 → 46,6; Itália 35,7 e Espanha 32,2 em 2025");
  const worse = EU27.filter((c) => v(c, "2025") > v("PT", "2025")).map((c) => NAME[c]);
  assert(worse.join() === "Bulgária,Grécia,Itália,Hungria,Roménia", `acima de Portugal em 2025: ${worse.join(", ")}`);
  assert(v("RO", "2025") === 61.4 && v("LU", "2025") === 10.6, "extremos 2025: Roménia 61,4%, Luxemburgo 10,6%");
  write("ferias-privacao-ue-2010-2025", {
    rows,
    config: { aLabel: "2010", bLabel: "2025", ref: 27.5, refLabel: "UE 2025: 27,5%", unit: "%", decimals: 1, domain: [0, 80],
      howToRead: "Cada linha é um país: vai da percentagem de pessoas sem dinheiro para uma semana de férias fora de casa em 2010 (ponto cinzento) à de 2025 (ponto azul). Linha para a esquerda: menos pessoas privadas de férias. A linha tracejada é a média da UE em 2025. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por valor em 2025"], ["delta", "Por variação"]] },
    summary: { pt: Object.fromEntries(ptSeries), eu2010: 38.8, eu2025: 27.5, rank2010: rk("2010"), rank2025: rk("2025"), drops: drops.slice(0, 6), worse2025: worse },
  }, [f, path.join(RAW, "ferias-ue", "FONTE.md")]);
}

// 5. Livros por habitante na Europa, por meio século, 1450–1800 (Buringh e van Zanden, 2009, via OWID)
{
  const D = path.join(RAW, "livros-europa");
  const f = path.join(D, "owid_Books_-_Buringh_and_Van_Zanden_2009.csv");
  const col = "Annual per capita consumption of books";
  const all = csv(f).filter((r) => r[col] !== "");
  const V = {}; for (const r of all) (V[r.Entity] ??= {})[r.Year] = +r[col] * 100;
  const P = { Netherlands: "Países Baixos", "Great Britain": "Grã-Bretanha", Sweden: "Suécia", Germany: "Alemanha", France: "França", Italy: "Itália", Ireland: "Irlanda", Belgium: "Bélgica", Switzerland: "Suíça", Spain: "Espanha", Poland: "Polónia", Russia: "Rússia", "Western Europe": "Europa ocidental (total)" };
  assert(Object.keys(P).every((k) => ["1475", "1525", "1575", "1625", "1675", "1725", "1775"].every((y) => V[k][y] != null)), "13 entidades com valor nos 7 meios séculos");
  const rows = Object.entries(P).filter(([k]) => k !== "Western Europe").map(([k, label]) => ({ label, y1525: r2(V[k]["1525"]), y1575: r2(V[k]["1575"]), y1675: r2(V[k]["1675"]), y1775: r2(V[k]["1775"]) }));
  const R = (k, y) => r2(V[k][y]);
  assert(R("Netherlands", "1775") === 48.83 && R("Western Europe", "1775") === 12.24 && R("Spain", "1775") === 2.83 && R("Italy", "1775") === 8.65, "1775: Países Baixos 48,83; Europa ocidental 12,24; Itália 8,65; Espanha 2,83 livros por 100 habitantes");
  assert(r1(V.Netherlands["1775"] / V["Western Europe"]["1775"]) === 4 && r1(V.Netherlands["1775"] / V.Italy["1775"]) === 5.6 && r0(V.Netherlands["1775"] / V.Spain["1775"]) === 17, "Países Baixos: 4 vezes a Europa ocidental, 5,6 vezes a Itália, 17 vezes a Espanha");
  const ord = (y) => Object.keys(P).filter((k) => k !== "Western Europe").sort((a, b) => V[b][y] - V[a][y]);
  assert(ord("1575").slice(0, 2).join() === "Switzerland,Italy" && ord("1575").indexOf("Netherlands") === 5, "1575: Suíça e Itália à frente; Países Baixos em 6.º");
  assert(ord("1525").indexOf("Netherlands") === 6 && V.Netherlands["1525"] < V["Western Europe"]["1525"], "1525: Países Baixos abaixo do total da Europa ocidental (7.º)");
  assert(ord("1625")[0] === "Netherlands" && ord("1675")[0] === "Netherlands" && ord("1725")[0] === "Netherlands" && ord("1775")[0] === "Netherlands", "Países Baixos em 1.º desde 1625");
  assert(ord("1775").slice(0, 3).join() === "Netherlands,Sweden,Great Britain" && R("Sweden", "1775") === 20.89 && R("Great Britain", "1775") === 19.2, "1775: Suécia 20,89 e Grã-Bretanha 19,20");
  assert(ord("1575").indexOf("Italy") === 1 && ord("1775").indexOf("Italy") === 5, "Itália: 2.ª em 1575, 6.ª em 1775");
  assert(R("Italy", "1575") === 5.1 && R("Switzerland", "1575") === 7.85, "1575: Suíça 7,85; Itália 5,10");
  assert(r1(V.Netherlands["1775"] / V.France["1775"]) === 4.1 && r1(V.Netherlands["1775"] / V.Germany["1775"]) === 4, "1775: Países Baixos 4,1 vezes a França e 4,0 vezes a Alemanha");
  assert(R("Western Europe", "1775") === R("Germany", "1775"), "aviso: o total «Europa ocidental» de 1775 na OWID é igual ao valor da Alemanha (suspeito; excluído do gráfico)");
  const growthWE = r0(V["Western Europe"]["1775"] / V["Western Europe"]["1525"]);
  assert(growthWE === 7, `Europa ocidental: de ${r2(V["Western Europe"]["1525"])} (1525) para 12,24 (1775), cerca de ${growthWE} vezes`);
  write("livros-europa-1450-1800", {
    rows,
    config: { unit: "", decimals: 1, signed: false, posLabel: "Livros por 100 habitantes, por ano",
      howToRead: "Cada barra mostra quantos livros impressos havia, em média, por cada 100 habitantes e por ano, segundo a estimativa dos historiadores. Os botões mudam o meio século.",
      views: [
        { id: "y1775", key: "y1775", label: "1750–1800", axisLabel: "Livros por 100 habitantes e por ano, média de 1750–1800 (estimativa)", axisShort: "Livros por 100 hab./ano, 1750–1800" },
        { id: "y1675", key: "y1675", label: "1650–1700", axisLabel: "Livros por 100 habitantes e por ano, média de 1650–1700 (estimativa)", axisShort: "Livros por 100 hab./ano, 1650–1700" },
        { id: "y1575", key: "y1575", label: "1550–1600", axisLabel: "Livros por 100 habitantes e por ano, média de 1550–1600 (estimativa)", axisShort: "Livros por 100 hab./ano, 1550–1600" },
        { id: "y1525", key: "y1525", label: "1500–1550", axisLabel: "Livros por 100 habitantes e por ano, média de 1500–1550 (estimativa)", axisShort: "Livros por 100 hab./ano, 1500–1550" }],
      sorts: [["value", "Por valor"], ["label", "Por nome"]] },
    summary: { nl1775: R("Netherlands", "1775"), we1775: R("Western Europe", "1775"), it1775: R("Italy", "1775"), es1775: R("Spain", "1775"), se1775: R("Sweden", "1775"), gb1775: R("Great Britain", "1775"), ch1575: R("Switzerland", "1575"), it1575: R("Italy", "1575"), nl1525: R("Netherlands", "1525"), we1525: R("Western Europe", "1525"), order1575: ord("1575"), order1775: ord("1775") },
  }, [f, path.join(D, "owid_README.md"), path.join(D, "owid_datapackage.json"), path.join(D, "FONTE.md")]);
}
function r0(x) { return Math.round(x); }

if (fails) console.error(`\n${fails} verificação(ões) falharam.`); else console.log("\nTodas as verificações passaram.");
