// Transformação reprodutível dos dados brutos da edição de 2026-11-26.
// Uso: node tools/prepare-2026-11-26.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: columns, lines, bars — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

const r0 = (x) => Math.round(x);
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
// CSV simples (aspas só no início do campo)
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const split = (l) => { const out = []; let cur = "", q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"' && cur === "") q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
  const h = split(lines[0]);
  return lines.slice(1).map((l) => { const r = split(l); return Object.fromEntries(h.map((k, i) => [k, r[i]])); });
}
const num = (s) => (s === "" || s == null ? null : +s);
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MES_CURTO = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

// 1. Temperatura média de janeiro a outubro em Portugal, 1940–2026 (Copernicus ERA5)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "temperatura-portugal-2026", "owid_copernicus_era5_surface_temperature_portugal_world.csv"), "utf8"));
  const serie = (c) => all.filter((o) => o.country === c).map((o) => ({ y: +o.time.slice(0, 4), m: +o.time.slice(5, 7), t: +o.temperature_2m, an: num(o.temperature_anomaly) }));
  const pt = serie("Portugal"), w = serie("World");
  assert(pt[0].y === 1940 && pt[0].m === 1 && pt.at(-1).y === 2026 && pt.at(-1).m === 10, "Portugal: série mensal de jan. 1940 a out. 2026");
  assert(pt.length === 87 * 12 - 2, "Portugal: 1 042 meses, sem falhas");
  const janOut = (s) => { const out = {}; for (let y = 1940; y <= 2026; y++) { const v = s.filter((o) => o.y === y && o.m <= 10); if (v.length !== 10) throw new Error("ano incompleto " + y); out[y] = v.reduce((a, o) => a + o.t, 0) / 10; } return out; };
  const P = janOut(pt), Wd = janOut(w);
  const base = (S) => { let s = 0; for (let y = 1991; y <= 2020; y++) s += S[y]; return s / 30; };
  const bP = base(P), bW = base(Wd);
  const rows = Object.keys(P).map((y) => ({ cat: y, an: r2(P[y] - bP), temp: r2(P[y]), alt: y === "2026" || undefined }));
  const rk = [...rows].sort((a, b) => b.an - a.an);
  const rkW = Object.keys(Wd).sort((a, b) => Wd[b] - Wd[a]);
  const m26 = pt.filter((o) => o.y === 2026);
  const recMonths = m26.filter((o) => pt.filter((q) => q.m === o.m).every((q) => q.t <= o.t)).map((o) => o.m);
  const s = {
    base: r2(bP), t26: r2(P[2026]), an26: r2(P[2026] - bP), first: rk[0].cat, second: rk[1].cat, an2nd: rk[1].an, gapRecord: r2(rk[0].an - rk[1].an),
    top5: rk.slice(0, 5).map((q) => `${q.cat} ${q.an}`), last10InTop: rk.slice(0, 10).filter((q) => +q.cat >= 2016).length,
    recMonths, sep26: r2(m26.find((o) => o.m === 9).t), sepAn: r2(m26.find((o) => o.m === 9).an), allMonthsAbove: m26.every((o) => o.an > 0),
    worldRank26: rkW.indexOf("2026") + 1, worldFirst: rkW[0], worldAn26: r2(Wd[2026] - bW),
    coldest: rk.at(-1).cat, top6min: Math.min(...rk.slice(0, 6).map((q) => +q.cat)),
    julRank: pt.filter((q) => q.m === 7 && q.t > m26.find((o) => o.m === 7).t).length + 1, augRank: pt.filter((q) => q.m === 8 && q.t > m26.find((o) => o.m === 8).t).length + 1,
  };
  assert(s.top6min === 2017 && s.julRank === 7 && s.augRank === 33, "os seis anos mais quentes (jan.–out.) são de 2017 em diante; julho de 2026 foi o 7.º mais quente, agosto o 33.º");
  console.log(s);
  assert(s.base === 16.24, "média de jan.–out. de 1991–2020 em Portugal: 16,24 °C");
  assert(s.t26 === 17.61 && s.an26 === 1.36 && s.first === "2026", "jan.–out. de 2026: 17,61 °C, +1,36 °C face a 1991–2020, o mais quente desde 1940");
  assert(s.second === "2023" && s.an2nd === 1.01 && s.gapRecord === 0.35, "o recorde anterior era 2023 (+1,01 °C); 2026 ficou 0,35 °C acima");
  assert(s.top5.join() === "2026 1.36,2023 1.01,2025 0.99,2017 0.91,2022 0.86", "os cinco mais quentes: 2026, 2023, 2025, 2017, 2022");
  assert(s.recMonths.join() === "9" && s.sep26 === 23.1 && s.sepAn === 3.08, "só setembro bateu o recorde do mês: 23,1 °C, +3,08 °C acima da média de 1991–2020");
  assert(s.allMonthsAbove, "os dez meses de 2026 ficaram acima da média de 1991–2020 do respetivo mês");
  assert(s.worldRank26 === 2 && s.worldFirst === "2024", "no mundo, jan.–out. de 2026 é o segundo mais quente, depois de 2024");
  write("temperatura-portugal-jan-out-1940-2026", {
    rows,
    views: [{
      id: "an", label: "Desvio", yLabel: "Temperatura média de janeiro a outubro em Portugal: diferença para a média de 1991–2020 (°C)", unit: " °C", decimals: 2,
      marginLeft: [34, 40], labelEvery: 10, labelEveryNarrow: 20,
      series: [{ key: "an", label: "Acima da média de 1991–2020", color: "--ink-3", negColor: "--accent-2", altColor: "--accent", altLabel: "2026 (até outubro)" }],
      tipExtra: [{ key: "temp", label: "Média de jan. a out.", suffix: " °C" }],
      notes: [{ cat: "2026", text: "2026: +1,36 °C", short: "2026" }],
    }],
    summary: s,
  }, rawFiles("temperatura-portugal-2026"));
}

// 2. Preços pagos aos agricultores: azeite, ovos, bovinos e total, 2020–set. 2026 (INE, base 2020)
{
  const j = JSON.parse(fs.readFileSync(path.join(RAW, "precos-agricolas", "ine_0014466.json"), "utf8"))[0];
  const COD = { az: "080000", ov: "122000", bv: "111000", tot: "140000", lt: "121100", vh: "070000" };
  const rows = [];
  for (const [per, list] of Object.entries(j.Dados)) {
    const [mes, , ano] = per.split(" ");
    const m = MESES.indexOf(mes) + 1;
    if (m < 1) throw new Error("mês desconhecido " + per);
    const row = { x: r3(+ano + (m - 0.5) / 12), label: `${MES_CURTO[m - 1]} ${ano}`, y: +ano, m };
    for (const [k, c] of Object.entries(COD)) {
      const rr = list.filter((q) => q.geocod === "PT" && q.dim_3 === c);
      if (rr.length > 1) throw new Error("duplicado " + per + c);
      row[k] = rr.length && rr[0].valor != null ? +rr[0].valor : null;
    }
    rows.push(row);
  }
  rows.sort((a, b) => a.x - b.x);
  assert(rows.length === 81 && rows[0].label === "jan. 2020" && rows.at(-1).label === "set. 2026", "81 meses, de janeiro de 2020 a setembro de 2026");
  assert(["ov", "bv", "tot"].every((k) => rows.every((q) => q[k] != null)), "ovos, bovinos e total sem meses em falta");
  const avg20 = (k) => r2(rows.filter((q) => q.y === 2020 && q[k] != null).reduce((a, q) => a + q[k], 0) / rows.filter((q) => q.y === 2020 && q[k] != null).length);
  const peak = (k) => { const v = rows.filter((q) => q[k] != null); const mx = Math.max(...v.map((q) => q[k])); return { v: mx, at: v.find((q) => q[k] === mx).label }; };
  const L = rows.at(-1), Y = rows.find((q) => q.label === "set. 2025");
  const azMiss = rows.filter((q) => q.az == null).map((q) => q.label);
  const s = {
    az26: L.az, az25: Y.az, azPeak: peak("az"), azFromPeak: r1((L.az / peak("az").v - 1) * 100), azYoy: r1((L.az / Y.az - 1) * 100), azMissing: azMiss.length,
    ov26: L.ov, ovPeak: peak("ov"), bv26: L.bv, bvPeak: peak("bv"), tot26: L.tot, totPeak: peak("tot"), lt26: L.lt, vh26: L.vh,
    avg20tot: avg20("tot"), avg20az: avg20("az"),
  };
  s.azPeakRatio = r1(s.azPeak.v / 100);
  console.log(s, azMiss.join(" "));
  assert(s.azPeak.v === 547.48 && s.azPeak.at === "jun. 2024" && s.azPeakRatio === 5.5, "azeite: máximo de 547,48 em junho de 2024 (5,5 vezes a média de 2020)");
  assert(s.az26 === 143.51 && s.azFromPeak === -73.8, "azeite em setembro de 2026: 143,51, −73,8% face ao máximo");
  assert(s.az25 === 168.39 && s.azYoy === -14.8, "azeite: −14,8% face a setembro de 2025");
  assert(s.ov26 === 212.59 && s.ovPeak.v === 251.03 && s.ovPeak.at === "dez. 2025", "ovos: 212,59 em setembro de 2026 (máximo de 251,03 em dezembro de 2025)");
  assert(s.bv26 === 205.85 && s.bvPeak.v === 241.54 && s.bvPeak.at === "jan. 2026", "bovinos: 205,85 em setembro de 2026 (máximo de 241,54 em janeiro de 2026)");
  assert(s.tot26 === 141.2 && s.totPeak.v === 172.04 && s.totPeak.at === "nov. 2023", "conjunto dos bens agrícolas: 141,2 em setembro de 2026 (máximo de 172,04 em novembro de 2023)");
  assert(Math.abs(s.avg20tot - 100) < 0.6, "a média de 2020 do total é ~100 (base do índice)");
  assert(s.azMissing === 12, "azeite: 12 meses sem valor (fora da campanha), deixados em branco");
  write("precos-agricolas-produtor-2020-2026", {
    rows: rows.map(({ y, m, lt, vh, ...q }) => q),
    config: {
      x: { min: 2020, max: 2026.75, ticks: [2020, 2021, 2022, 2023, 2024, 2025, 2026], tableLabel: "Mês" },
      y: { label: "Índice de preços no produtor (média de 2020 = 100)", suffix: "", decimals: 1, linMin: 0, linMax: 600, logDefault: false, logMin: 60, logMax: 600, linTicks: [0, 100, 200, 300, 400, 500, 600], logTicks: [60, 100, 200, 300, 600] },
      scaleToggle: true,
      gaps: true,
      series: [
        { key: "az", label: "Azeite", short: "Azeite", color: "--accent-4", width: 2.8 },
        { key: "ov", label: "Ovos", short: "Ovos", color: "--accent-2", width: 2.2 },
        { key: "bv", label: "Bovinos", short: "Bovinos", color: "--accent-3", width: 2.2 },
        { key: "tot", label: "Todos os bens agrícolas", short: "Total", color: "--ink", width: 1.6 },
      ],
      labelMargin: [92, 120],
      shortEndLabels: true,
      refLine: { value: 100, label: "Média de 2020 = 100", short: "2020 = 100", at: 2024.9 },
      annotations: [{ x: 2024.458, key: "az", text: "Jun. 2024: 5,5 vezes o preço de 2020", short: "5,5 × 2020", dx: 8, dy: -2, anchor: "start" }],
      howToRead: "Cada linha é o preço pago ao produtor por um produto agrícola em Portugal, em índice: 100 é o preço médio de 2020, 200 é o dobro. Mede os preços à saída da exploração ou do lagar, sem IVA, não os preços nas lojas. O azeite tem meses em branco, sem vendas registadas fora da campanha. A escala logarítmica mostra as subidas e descidas em proporção.",
    },
    summary: s,
  }, rawFiles("precos-agricolas"));
}

// 3. Fecundidade em Portugal: índice sintético e índice ajustado ao adiamento, 1960–2024 (Human Fertility Database)
{
  const P = parseCSV(fs.readFileSync(path.join(RAW, "fecundidade-hfd", "owid_hfd_period_total.csv"), "utf8")).filter((o) => o.country === "Portugal");
  const C = parseCSV(fs.readFileSync(path.join(RAW, "fecundidade-hfd", "owid_hfd_cohort_total.csv"), "utf8")).filter((o) => o.country === "Portugal");
  const byY = Object.fromEntries(P.map((o) => [+o.year, { tfr: num(o.tfr), adj: num(o.adjtfr), mab: num(o.mab) }]));
  const ccf = Object.fromEntries(C.filter((o) => o.ccf !== "").map((o) => [+o.cohort, +o.ccf]));
  const years = Object.keys(byY).map(Number).sort((a, b) => a - b);
  assert(years[0] === 1940 && years.at(-1) === 2024, "período: 1940–2024");
  const rows = years.filter((y) => y >= 1960).map((y) => ({ x: y, label: String(y), tfr: r2(byY[y].tfr), adj: byY[y].adj == null ? null : r2(byY[y].adj), mab: r1(byY[y].mab) }));
  const minT = Math.min(...rows.map((q) => q.tfr)), minY = rows.find((q) => q.tfr === minT).x;
  const lastAdj = rows.filter((q) => q.adj != null).at(-1);
  const s = {
    tfrMin: byY[minY].tfr, tfrMinYear: minY, adjMinYear: byY[minY].adj, tfr24: byY[2024].tfr, tfr60: byY[1960].tfr,
    mab84: r1(byY[1984].mab), mab21: r1(byY[2021].mab), mab24: r1(byY[2024].mab), mabMax: r1(Math.max(...years.map((y) => byY[y].mab))),
    ccf1974: ccf[1974], ccf1950: ccf[1950], ccfLast: Math.max(...Object.keys(ccf).map(Number)), lastAdjYear: lastAdj.x,
    below21Since: rows.find((q, i) => rows.slice(i).every((z) => z.tfr < 2.1)).x,
    yearsAdjAbove: rows.filter((q) => q.adj != null && q.x >= 1985 && q.x <= 2020 && q.adj > q.tfr).length,
  };
  s.gap2013 = r2(s.adjMinYear - s.tfrMin);
  const rec = [2021, 2022, 2023].flatMap((y) => [r2(byY[y].tfr), r2(byY[y].adj)]);
  assert(Math.min(...rec) >= 1.35 && Math.max(...rec) <= 1.45 + 1e-9, "2021–2023: os dois índices entre 1,35 e 1,45");
  console.log(s);
  assert(s.tfrMin === 1.213 && s.tfrMinYear === 2013, "mínimo do índice sintético: 1,21 filhos por mulher em 2013");
  assert(s.adjMinYear === 1.616 && s.gap2013 === 0.4, "em 2013, descontado o adiamento: 1,62 (mais 0,40)");
  assert(s.ccf1974 === 1.598 && s.ccfLast === 1974, "as mulheres nascidas em 1974 (última geração completa) tiveram 1,60 filhos");
  assert(s.ccf1950 === 2.093, "as nascidas em 1950 tiveram 2,09");
  assert(s.mab84 === 27 && s.mab21 === 31.8 && s.mabMax === 31.8 && s.mab24 === 31.7, "idade média da mãe ao nascimento: 27,0 anos em 1984, 31,8 em 2021 (máximo), 31,7 em 2024");
  assert(s.tfr24 === 1.407 && s.lastAdjYear === 2023, "índice sintético de 2024: 1,41; o índice ajustado vai até 2023");
  assert(s.below21Since === 1982 && s.yearsAdjAbove === 36, "abaixo de 2,1 desde 1982; de 1985 a 2020, o ajustado ficou sempre acima do sintético (36 anos)");
  write("fecundidade-portugal-adiamento-1960-2024", {
    rows,
    config: {
      x: { min: 1960, max: 2024, ticks: [1960, 1970, 1980, 1990, 2000, 2010, 2020], tableLabel: "Ano" },
      y: { label: "Filhos por mulher", suffix: "", decimals: 2, linMin: 0, linMax: 3.5, logDefault: false, linTicks: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
      series: [
        { key: "tfr", label: "Índice sintético de fecundidade", short: "Sintético", color: "--accent", width: 2.8 },
        { key: "adj", label: "Ajustado ao adiamento (Bongaarts-Feeney)", short: "Ajustado", color: "--accent-2", width: 2 },
      ],
      labelMargin: [80, 118],
      shortEndLabels: true,
      dots: false,
      refLine: { value: 2.1, label: "2,1: nível de substituição das gerações", short: "Substituição: 2,1", at: 1996 },
      annotations: [{ x: 2013, key: "tfr", text: "2013: 1,21", short: "1,21", dx: 0, dy: 16, anchor: "middle" }, { x: 2013, key: "adj", text: "1,62", short: "1,62", dx: 0, dy: -10, anchor: "middle" }],
      howToRead: "A linha cor de terracota é o índice sintético de fecundidade: quantos filhos teria uma mulher se vivesse toda a vida fértil com as taxas de cada idade desse ano. A linha azul é o mesmo índice corrigido do adiamento dos nascimentos: quando as mães têm filhos cada vez mais tarde, os nascimentos espalham-se por mais anos e o índice de cada ano fica abaixo do que as mulheres acabam por ter. A distância entre as linhas mede esse efeito.",
    },
    summary: s,
  }, rawFiles("fecundidade-hfd"));
}

// 4. Exoplanetas confirmados por ano de descoberta e método, 1992–2025 (NASA Exoplanet Archive)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "exoplanetas", "owid_nasa_exoplanets.csv"), "utf8"));
  const K = { Transit: "tr", "Radial velocity": "rv", Microlensing: "mi", "Other methods": "ot" };
  const by = {};
  for (const o of all) { const y = o.year; by[y] ??= { cat: y, tr: 0, rv: 0, mi: 0, ot: 0 }; if (!(o.method in K)) throw new Error("método " + o.method); by[y][K[o.method]] = +o.n_planets; }
  const rows = Object.values(by).sort((a, b) => a.cat - b.cat).map((q) => ({ ...q, total: q.tr + q.rv + q.mi + q.ot }));
  assert(rows[0].cat === "1992" && rows.at(-1).cat === "2025" && rows.length === 34, "1992–2025, 34 anos");
  const T = rows.reduce((a, q) => a + q.total, 0), sum = (k) => rows.reduce((a, q) => a + q[k], 0);
  const R = Object.fromEntries(rows.map((q) => [q.cat, q]));
  const by14_16 = rows.filter((q) => q.cat === "2014" || q.cat === "2016").reduce((a, q) => a + q.total, 0);
  const since17 = rows.filter((q) => +q.cat >= 2017);
  const s = {
    total: T, tr: sum("tr"), rv: sum("rv"), mi: sum("mi"), ot: sum("ot"), trShare: r1((sum("tr") / T) * 100), rvShare: r1((sum("rv") / T) * 100),
    y2016: R["2016"].total, y2016tr: R["2016"].tr, y2014: R["2014"].total, share14_16: r1((by14_16 / T) * 100),
    min17: Math.min(...since17.map((q) => q.total)), max17: Math.max(...since17.map((q) => q.total)), max17y: since17.find((q) => q.total === Math.max(...since17.map((z) => z.total))).cat,
    y2025: R["2025"].total, rvFirstOvertaken: rows.find((q) => q.tr > q.rv).cat, rvBefore2010: rows.filter((q) => +q.cat < 2010).reduce((a, q) => a + q.rv, 0), allBefore2010: rows.filter((q) => +q.cat < 2010).reduce((a, q) => a + q.total, 0),
    y1995: by["1995"].rv, mi2022: by["2022"].mi, miMax: Math.max(...rows.map((q) => q.mi)),
  };
  s.rvShareBefore2010 = r1((s.rvBefore2010 / s.allBefore2010) * 100);
  console.log(s);
  assert(s.total === 6070, "6 070 exoplanetas confirmados de 1992 a 2025 (cópia de 8-1-2026)");
  assert(s.tr === 4478 && s.trShare === 73.8, "trânsito: 4 478 planetas, 73,8%");
  assert(s.rv === 1158 && s.rvShare === 19.1, "velocidade radial: 1 158, 19,1%");
  assert(s.y2016 === 1496 && s.y2016tr === 1432 && s.y2014 === 869 && s.share14_16 === 39, "2016: 1 496 (1 432 por trânsito); 2014: 869; os dois anos somam 39,0% do total");
  assert(s.min17 === 152 && s.max17 === 554 && s.max17y === "2021", "desde 2017, entre 152 e 554 por ano (máximo em 2021)");
  assert(s.y2025 === 233, "2025: 233 (pode estar incompleto)");
  assert(s.rvFirstOvertaken === "2010" && s.rvShareBefore2010 === 77.1, "antes de 2010, 77,1% dos planetas vinham da velocidade radial; o trânsito passou à frente em 2010");
  assert(s.mi2022 === 51 && s.miMax === 51, "microlente: máximo de 51 em 2022");
  write("exoplanetas-descobertas-1992-2025", {
    rows,
    views: [{
      id: "n", label: "Por ano", yLabel: "Exoplanetas confirmados por ano de descoberta e método", unit: "", decimals: 0,
      marginLeft: [36, 44], labelEvery: 4, labelEveryNarrow: 8,
      series: [
        { key: "ot", label: "Outros métodos", color: "--muted" },
        { key: "mi", label: "Microlente gravitacional", color: "--accent-4" },
        { key: "rv", label: "Velocidade radial", color: "--accent-3" },
        { key: "tr", label: "Trânsito", color: "--accent-2" },
      ],
      tipExtra: [{ key: "total", label: "Total", suffix: "" }],
      notes: [{ cat: "2014", text: "2014 e 2016: validações em massa do Kepler", short: "Kepler" }],
    }],
    summary: s,
  }, rawFiles("exoplanetas"));
}

// 5. Refugiados que regressaram ao país de origem em 2025, por país, e série desde 1965 (ACNUR)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "refugiados-regressos", "owid_unhcr_refugee_data_origin.csv"), "utf8"));
  const byYear = {};
  for (const o of all) { const v = num(o.returned_refugees); if (v != null) byYear[o.year] = (byYear[o.year] || 0) + v; }
  const ys = Object.keys(byYear).sort((a, b) => byYear[b] - byYear[a]);
  const y25 = all.filter((o) => o.year === "2025");
  const ref = (c, y) => num(all.find((o) => o.country === c && o.year === y)?.refugees);
  const NOME = { Afghanistan: "Afeganistão", Syria: "Síria", Sudan: "Sudão", "South Sudan": "Sudão do Sul", Ukraine: "Ucrânia", Burundi: "Burundi", "Central African Republic": "República Centro-Africana", Iraq: "Iraque", Nigeria: "Nigéria", Myanmar: "Myanmar", "Democratic Republic of Congo": "R. D. do Congo", Cameroon: "Camarões", Somalia: "Somália", Mali: "Mali", Mozambique: "Moçambique", Venezuela: "Venezuela", "Cote d'Ivoire": "Costa do Marfim", Rwanda: "Ruanda", Ethiopia: "Etiópia" };
  const top = y25.filter((o) => num(o.returned_refugees) > 0).sort((a, b) => num(b.returned_refugees) - num(a.returned_refugees)).slice(0, 10);
  const miss = top.filter((o) => !NOME[o.country]).map((o) => o.country);
  if (miss.length) throw new Error("sem nome: " + miss.join());
  const rows = top.map((o) => ({ label: NOME[o.country], ret: r1(num(o.returned_refugees) / 1000), ref: r1((num(o.refugees) || 0) / 1000), highlight: undefined }));
  const total25 = byYear["2025"];
  const top3 = top.slice(0, 3).reduce((a, o) => a + num(o.returned_refugees), 0);
  const s = {
    total25, total24: byYear["2024"], total23: byYear["2023"], rank25: ys.indexOf("2025") + 1, firstYear: ys[0], first: byYear[ys[0]], third: ys[2], thirdV: byYear[ys[2]],
    afg: num(top[0].returned_refugees), syr: num(top[1].returned_refugees), sud: num(top[2].returned_refugees), top3Share: r1((top3 / total25) * 100), top: top.map((o) => o.country),
    syrRef24: ref("Syria", "2024"), syrRef25: ref("Syria", "2025"), syrRef21: ref("Syria", "2021"), ukrRef25: ref("Ukraine", "2025"),
    ratio2524: r1(byYear["2025"] / byYear["2024"]),
  };
  s.ind72 = num(all.find((o) => o.country === "India" && o.year === "1972")?.returned_refugees);
  console.log(s);
  assert(s.total25 === 4362272 && s.rank25 === 2 && s.firstYear === "1972", "2025: 4 362 272 regressos, o segundo valor da série, depois de 1972");
  assert(s.first === 9913600 && s.ind72 === 9799410, "1972: 9 913 600 regressos, dos quais 9 799 410 atribuídos na base à Índia (regresso ao Bangladesh, 1971–1972)");
  assert(s.third === "1994" && s.thirdV === 3036966, "terceiro: 1994 (3 036 966)");
  assert(s.total24 === 1615821 && s.ratio2524 === 2.7, "2024: 1 615 821; 2025 foi 2,7 vezes 2024");
  assert(s.top.slice(0, 3).join() === "Afghanistan,Syria,Sudan" && s.afg === 1947183 && s.syr === 1341148 && s.sud === 651456, "Afeganistão 1 947 183, Síria 1 341 148, Sudão 651 456");
  assert(s.top3Share === 90.3, "os três somam 90,3% dos regressos de 2025");
  assert(s.syrRef24 === 5952174 && s.syrRef25 === 4865764, "refugiados sírios no mundo: 5 952 174 no fim de 2024, 4 865 764 no fim de 2025");
  const maxRef25 = y25.filter((o) => !["Unknown Origin", "Stateless"].includes(o.country)).sort((a, b) => num(b.refugees) - num(a.refugees))[0].country;
  assert(maxRef25 === "Ukraine" && s.ukrRef25 === 5224131, "a Ucrânia tem o maior número de refugiados no estrangeiro no fim de 2025 (5 224 131)");
  write("refugiados-regressos-2025", {
    rows,
    config: {
      views: [
        { id: "ret", label: "Regressaram em 2025", key: "ret", axisLabel: "Refugiados que regressaram ao país de origem em 2025 (milhares)", axisShort: "Regressos em 2025 (milhares)" },
        { id: "ref", label: "Ainda refugiados", key: "ref", axisLabel: "Refugiados desse país no estrangeiro no fim de 2025 (milhares)", axisShort: "Refugiados no fim de 2025 (milhares)" },
      ],
      unit: " mil", decimals: 0, signed: false, independentScale: true,
      posLabel: "Milhares de pessoas",
      howToRead: "Cada barra é um país de origem: os dez com mais refugiados regressados em 2025, segundo o ACNUR. A vista «Ainda refugiados» mostra quantos continuavam fora do país no fim do ano. Os regressos contam pessoas que voltaram durante o ano, incluindo as que foram expulsas ou pressionadas a sair do país de acolhimento.",
    },
    summary: s,
  }, rawFiles("refugiados-regressos"));
}
