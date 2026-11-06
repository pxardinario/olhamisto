// Transformação reprodutível dos dados brutos da edição de 2026-11-06.
// Uso: node tools/prepare-2026-11-06.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: columns, lines, scatter (novo) — ver assets/js/charts.js.
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
const r0 = (x) => Math.round(x);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
let fails = 0;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); fails++; process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}

// 1. Brent: dias com variação diária de 5% ou mais, 2007–2026 (EIA, preço spot)
{
  const f = path.join(RAW, "brent-volatilidade", "datasets_oil-prices_brent-daily.csv");
  const src = path.join(RAW, "brent-volatilidade", "FONTE.md");
  const all = csv(f).filter((r) => r.Price !== "").map((r) => ({ d: r.Date, p: +r.Price }));
  const by = {};
  for (let i = 1; i < all.length; i++) {
    const y = +all[i].d.slice(0, 4), ch = all[i].p / all[i - 1].p - 1;
    (by[y] ??= { n: 0, up: 0, down: 0 }).n++;
    if (ch >= 0.05) by[y].up++;
    if (ch <= -0.05) by[y].down++;
  }
  const years = Object.keys(by).map(Number).filter((y) => y >= 2007);
  assert(years.length === 20 && years[0] === 2007 && years.at(-1) === 2026, "20 anos, 2007–2026");
  assert(years.filter((y) => y < 2026).every((y) => by[y].n >= 247), "2007–2025: série diária completa (≥ 247 observações por ano)");
  const rows = years.map((y) => ({ cat: String(y), up: by[y].up, down: -by[y].down, total: by[y].up + by[y].down, obs: by[y].n }));
  const R = (y) => rows.find((r) => r.cat === String(y));
  assert(all.at(-1).d === "2026-11-03", `último dia: ${all.at(-1).d}`);
  assert(R(2026).up === 26 && R(2026).down === -16 && R(2026).total === 42, `2026: ${R(2026).up} subidas e ${-R(2026).down} descidas de 5% ou mais (total ${R(2026).total})`);
  assert(R(2020).up === 20 && R(2020).down === -21 && R(2020).total === 41, "2020: 20 subidas, 21 descidas, 41 no total");
  assert(R(2022).total === 21 && R(2022).up === 7, "2022: 21 dias, 7 subidas");
  assert(R(2008).total === 20 && R(2009).total === 28, "2008: 20; 2009: 28");
  const maxUpOther = Math.max(...rows.filter((r) => r.cat !== "2026").map((r) => r.up));
  assert(R(2026).up > maxUpOther && maxUpOther === 20, `2026 tem mais subidas ≥5% do que qualquer outro ano desde 2007 (máximo anterior ${maxUpOther})`);
  assert(rows.filter((r) => r.cat !== "2026").every((r) => r.total < R(2026).total), "2026 já tem mais dias ≥5% do que qualquer ano completo desde 2007");
  const sum1325 = ["2010", "2011", "2012", "2013", "2014", "2017"].map((y) => R(y).total);
  assert(sum1325.every((v) => v <= 4), "anos calmos (2010–2014, 2017): 0 a 4 dias");
  const p26 = all.filter((r) => r.d.startsWith("2026"));
  const first = p26[0], max = p26.reduce((a, b) => (b.p > a.p ? b : a)), last = p26.at(-1);
  assert(first.d === "2026-01-02" && first.p === 61.98, "2 jan. 2026: 61,98 $");
  assert(max.d === "2026-04-07" && max.p === 138.21, "máximo de 2026: 138,21 $ a 7 abr.");
  assert(last.p === 107.03, "3 nov. 2026: 107,03 $");
  const biggest = (() => { let b = { c: 0 }; for (let i = 1; i < all.length; i++) if (all[i].d >= "2026") { const c = all[i].p / all[i - 1].p - 1; if (Math.abs(c) > Math.abs(b.c)) b = { d: all[i].d, c }; } return b; })();
  assert(biggest.d === "2026-10-02" && r1(biggest.c * 100) === 18, `maior variação diária de 2026: ${biggest.d} (${r1(biggest.c * 100)}%)`);
  const mar = all.filter((r, i) => i > 0 && r.d.startsWith("2026-03") && Math.abs(r.p / all[i - 1].p - 1) >= 0.05).length;
  assert(mar === 11, `março de 2026: ${mar} dias`);
  const ref2025 = rows.filter((r) => +r.cat >= 2023 && +r.cat <= 2025).map((r) => r.total);
  assert(ref2025.join() === "5,2,6", "2023–2025: 5, 2 e 6 dias");
  write("brent-dias-5pct", {
    rows,
    views: [
      { id: "split", label: "Subidas e descidas", yLabel: "Dias em que o Brent subiu (acima) ou desceu (abaixo) 5% ou mais face ao dia anterior", unit: " dias", decimals: 0, labelEvery: 1, labelEveryNarrow: 3,
        series: [{ key: "down", label: "Dias a descer 5% ou mais", color: "--accent-2" }, { key: "up", label: "Dias a subir 5% ou mais", color: "--accent-3" }],
        notes: [{ cat: "2026", text: "2026, até 3 de novembro", short: "2026 (até 3/11)" }] },
      { id: "total", label: "Total", yLabel: "Dias com variação diária de 5% ou mais, para cima ou para baixo", unit: " dias", decimals: 0, valueLabels: true, labelEveryNarrow: 3,
        series: [{ key: "total", label: "Dias com variação de 5% ou mais", color: "--accent-2" }],
        notes: [{ cat: "2026", text: "2026, até 3 de novembro", short: "2026 (até 3/11)" }] },
    ],
    summary: { y2026: R(2026), y2020: R(2020), y2022: R(2022), y2008: R(2008), y2009: R(2009), maxUpOther, first, max, last, biggest: { d: biggest.d, pct: r1(biggest.c * 100) }, march2026: mar },
  }, [f, src]);
}

// 2. PIB por habitante de Portugal em % do de outros países, médias por década, 1530–2018 (Maddison 2020)
{
  const f = path.join(RAW, "maddison-pt", "owid_maddison2020_selected.csv");
  const src = path.join(RAW, "maddison-pt", "FONTE.md");
  const all = csv(f).filter((r) => r["GDP per capita"] !== "");
  const v = {};
  for (const r of all) (v[r.Entity] ??= {})[+r.Year] = +r["GDP per capita"];
  const K = { "United Kingdom": "uk", Netherlands: "nl", Spain: "es", Italy: "it" };
  // razão das médias por década, só com anos em que existem os dois países
  const rows = [];
  for (let dec = 1530; dec <= 2010; dec += 10) {
    const row = { x: dec };
    for (const [c, k] of Object.entries(K)) {
      const ys = []; for (let y = dec; y < dec + 10; y++) if (v.Portugal[y] != null && v[c][y] != null) ys.push(y);
      row[k] = ys.length ? r1((mean(ys.map((y) => v.Portugal[y])) / mean(ys.map((y) => v[c][y]))) * 100) : null;
    }
    rows.push(row);
  }
  const R = (d) => rows.find((r) => r.x === d);
  assert(rows.length === 49 && rows.every((r) => r.uk != null && r.it != null), "49 décadas (1530–2010) com Reino Unido e Itália");
  assert(rows.filter((r) => r.nl == null).length === 0, "Países Baixos em todas as décadas");
  console.log(rows.map((r) => `${r.x}: uk ${r.uk} nl ${r.nl} es ${r.es} it ${r.it}`).join("\n"));
  const ukMax = rows.reduce((a, b) => (b.uk > a.uk ? b : a)), ukMin = rows.reduce((a, b) => (b.uk < a.uk ? b : a));
  assert(ukMin.x === 1910 && ukMin.uk === 23.7, `ponto mais baixo face ao Reino Unido: década de ${ukMin.x} (${ukMin.uk}%)`);
  assert(ukMax.x < 1800, `máximo face ao Reino Unido antes de 1800: década de ${ukMax.x} (${ukMax.uk}%)`);
  assert(R(1530).uk === 77.2 && R(1750).uk === 77.4, "anos 1530: 77,2%; anos 1750: 77,4%");
  assert(rows.filter((r) => r.x < 1790).every((r) => r.uk >= 65), "até aos anos 1780, sempre 65% ou mais do Reino Unido");
  assert(R(1950).uk === 31.9 && R(1960).uk === 40.9 && R(1990).uk === 70.3 && R(2010).uk === 69.4, "anos 1950: 31,9%; 1960: 40,9%; 1990: 70,3%; 2010: 69,4%");
  assert(R(1980).es === 91.2 && R(2010).es === 81.2, "face a Espanha: anos 1980 91,2%; anos 2010 81,2%");
  assert(R(1750).es > 100 && R(1850).es < 100, "Portugal acima de Espanha no século XVIII, abaixo desde os anos 1800");
  const ptSpainAbove = rows.filter((r) => r.es != null && r.es > 100).map((r) => r.x);
  console.log("décadas com Portugal acima de Espanha:", ptSpainAbove.join(", "));
  const pt1530 = r0(mean([1530, 1531, 1532, 1533, 1534, 1535, 1536, 1537, 1538, 1539].map((y) => v.Portugal[y])));
  const pt1910 = r0(mean([1910, 1911, 1912, 1913, 1914, 1915, 1916, 1917, 1918, 1919].map((y) => v.Portugal[y])));
  assert(pt1910 < 2.0 * pt1530, `PIB por habitante de Portugal: anos 1530 ${pt1530} $, anos 1910 ${pt1910} $ (menos do dobro em quatro séculos)`);
  const pt1750 = r0(mean([1750, 1751, 1752, 1753, 1754, 1755, 1756, 1757, 1758, 1759].map((y) => v.Portugal[y])));
  assert(pt1750 === 2110 && pt1910 === 1950 && pt1910 < pt1750, `anos 1750: ${pt1750} $; anos 1910: ${pt1910} $ (mais pobre do que 160 anos antes)`);
  assert(r1(pt1910 / pt1530) === 1.5, `anos 1910 ÷ anos 1530 = ${r1(pt1910 / pt1530)}`);
  assert(v.Portugal[2018] === 27036 || r0(v.Portugal[2018]) === 27036, "Portugal 2018: 27 036 $ (dólares de 2011)");
  write("pib-portugal-1530-2018", {
    rows,
    config: { x: { label: "Década", min: 1530, max: 2010, ticks: [1530, 1600, 1700, 1800, 1900, 1950, 2010] },
      y: { label: "PIB por habitante de Portugal em % do de cada país (média da década)", suffix: "%", decimals: 0, logDefault: false, linMax: 160 },
      series: [{ key: "uk", label: "Reino Unido", short: "R. Unido", color: "--accent-2", width: 3 }, { key: "es", label: "Espanha", short: "Espanha", color: "--accent-3", width: 2.4 },
        { key: "nl", label: "Países Baixos", short: "P. Baixos", color: "--muted" }, { key: "it", label: "Itália", short: "Itália", color: "--muted" }],
      scaleToggle: false, dots: false,
      howToRead: "Cada linha mostra quanto valia o PIB por habitante de Portugal em percentagem do de outro país, em médias por década. Nos 100% Portugal estaria igual; nos 50%, teria metade. Uma linha a descer quer dizer que Portugal se afastava desse país.",
      annotations: [{ x: 1750, key: "uk", text: "Anos 1750: 77%", short: "1750: 77%", anchor: "middle", dy: -12 }, { x: 1910, key: "uk", text: "Anos 1910: 24%", short: "1910: 24%", anchor: "middle", dy: 22 }, { x: 1990, key: "uk", text: "Anos 1990: 70%", short: "1990: 70%", anchor: "end", dx: -8, dy: -12 }] },
    summary: { ukMin, ukMax, r1530: R(1530), r1750: R(1750), r1950: R(1950), r1960: R(1960), r1980: R(1980), r1990: R(1990), r2010: R(2010), pt1530, pt1750, pt1910, pt2018: v.Portugal[2018], ptSpainAbove },
  }, [f, src]);
}

// 3. Reprodutibilidade da psicologia: efeito original contra efeito na réplica (Open Science Collaboration, 2015)
{
  const f = path.join(RAW, "rpp", "rpp_data_selected_columns.csv");
  const src = path.join(RAW, "rpp", "FONTE.md");
  const all = csv(f).filter((r) => r["Study Num"] !== "" && +r["Study Num"] <= 167);
  assert(all.length === 167, "167 linhas de estudos (como no script original: MASTER[1:167, ])");
  const num = (s) => (s === "" || s === "NA" ? null : +s);
  const pairs = all.filter((r) => num(r["T_r..O."]) != null && num(r["T_r..R."]) != null);
  assert(pairs.length === 97, `97 pares com efeito original e da réplica (${pairs.length})`);
  const mO = mean(pairs.map((r) => +r["T_r..O."])), mR = mean(pairs.map((r) => +r["T_r..R."]));
  assert(r3(mO) === 0.396 && r3(mR) === 0.197, `média de r: original ${r3(mO)}, réplica ${r3(mR)} (iguais ao output publicado: 0,396 e 0,197)`);
  const smaller = pairs.filter((r) => +r["T_r..R."] < +r["T_r..O."]).length;
  assert(smaller === 81, `réplica com efeito menor em ${smaller} de 97`);
  const neg = pairs.filter((r) => +r["T_r..R."] < 0).length;
  assert(neg === 17, `réplica com efeito de sinal contrário (r < 0) em ${neg}`);
  const sigR = pairs.filter((r) => r.T_sign_R === "1").length, sigO = pairs.filter((r) => r.T_sign_O === "1").length;
  assert(sigR === 34 && sigO === 94, `nos 97 pares: ${sigO} originais e ${sigR} réplicas significativas`);
  const area = (d) => pairs.filter((r) => r["Discipline (O)"] === d);
  const soc = area("Social"), cog = area("Cognitive");
  assert(soc.length === 54 && cog.length === 43, "54 estudos de psicologia social, 43 de cognitiva");
  const sSig = soc.filter((r) => r.T_sign_R === "1").length, cSig = cog.filter((r) => r.T_sign_R === "1").length;
  assert(sSig === 13 && cSig === 21, "réplicas significativas: social 13 de 54 (24%), cognitiva 21 de 43 (49%)");
  assert(r0((sSig / 54) * 100) === 24 && r0((cSig / 43) * 100) === 49, "24% e 49%");
  const sm = [r2(mean(soc.map((r) => +r["T_r..O."]))), r2(mean(soc.map((r) => +r["T_r..R."])))], cm = [r2(mean(cog.map((r) => +r["T_r..O."]))), r2(mean(cog.map((r) => +r["T_r..R."])))];
  assert(sm.join() === "0.33,0.13" && cm.join() === "0.49,0.28", `médias: social ${sm}, cognitiva ${cm}`);
  const J = { PS: "Psychological Science", JPSP: "Journal of Personality and Social Psychology", JEPLMC: "Journal of Experimental Psychology: Learning, Memory, and Cognition" };
  const rows = pairs.map((r) => ({ label: `Estudo ${r["Study Num"]}: ${r["Authors (O)"]} (2008)`, sub: J[r["Journal (O)"]], x: r3(+r["T_r..O."]), y: r3(+r["T_r..R."]), group: r.T_sign_R === "1" ? "sig" : "ns", area: r["Discipline (O)"] === "Social" ? "social" : "cognitiva" }));
  assert(Math.min(...rows.map((r) => r.x)) >= 0 && Math.max(...rows.map((r) => r.x)) < 1 && Math.min(...rows.map((r) => r.y)) > -0.5 && Math.max(...rows.map((r) => r.y)) < 1, "domínios: x 0–1, y −0,5–1");
  write("reprodutibilidade-psicologia", {
    rows,
    config: { x: { label: "Efeito no estudo original (r)", short: "Efeito original (r)", tipLabel: "Efeito original (r)", min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], decimals: 1 },
      y: { label: "Efeito na réplica (r)", short: "Efeito na réplica (r)", tipLabel: "Efeito na réplica (r)", min: -0.5, max: 1, ticks: [-0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1], decimals: 1 },
      groups: [{ key: "sig", label: "Réplica estatisticamente significativa (p < 0,05)", color: "--accent-2" }, { key: "ns", label: "Réplica não significativa", color: "--ink-3", shape: "ring" }],
      diagonal: { label: "Réplica igual ao original", text: "réplica = original", short: "igual ao original" }, zeroLines: true,
      facets: { key: "area", label: "Área", options: [["all", "Todos"], ["social", "Psicologia social"], ["cognitiva", "Psicologia cognitiva"]] },
      howToRead: "Cada ponto é um estudo publicado em 2008 e refeito por outra equipa. Na horizontal, a força do efeito no artigo original; na vertical, na réplica. Os pontos sobre a linha tracejada repetiram o efeito tal e qual; abaixo dela, o efeito encolheu; abaixo do zero, inverteu-se." },
    summary: { n: pairs.length, meanO: r3(mO), meanR: r3(mR), smaller, neg, sigO, sigR, social: { n: soc.length, sig: sSig, mean: sm }, cognitive: { n: cog.length, sig: cSig, mean: cm } },
  }, [f, src]);
}

// 4. Nascimentos por dia da semana nos EUA, 2000–2014 (SSA via FiveThirtyEight)
{
  const f = path.join(RAW, "nascimentos-eua", "fivethirtyeight_US_births_2000-2014_SSA.csv");
  const src = path.join(RAW, "nascimentos-eua", "FONTE.md");
  const all = csv(f).map((r) => ({ y: +r.year, m: +r.month, d: +r.date_of_month, w: +r.day_of_week, n: +r.births }));
  assert(all.length === 5479, "5 479 dias (2000–2014)");
  const total = all.reduce((s, r) => s + r.n, 0);
  assert(total === 62187024, "62 187 024 nascimentos");
  const avg = total / all.length;
  const W = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const m = W.map((_, i) => mean(all.filter((r) => r.w === i + 1).map((r) => r.n)));
  const rows = W.map((w, i) => ({ cat: w, avg: r0(m[i]), idx: r1((m[i] / avg) * 100) }));
  assert(rows[1].avg === 13122 && rows[6].avg === 7518 && rows[5].avg === 8563, "terça 13 122; sábado 8 563; domingo 7 518");
  const sunVsTue = r0((1 - m[6] / m[1]) * 100);
  assert(sunVsTue === 43, `domingo: menos ${sunVsTue}% do que terça`);
  const wkday = mean(m.slice(0, 5)), wkend = mean(m.slice(5));
  const gap = r0((1 - wkend / wkday) * 100);
  assert(gap === 37, `fim de semana: menos ${gap}% do que a média dos dias úteis`);
  const gapY = (y) => { const q = all.filter((r) => r.y === y); return r1((1 - mean(q.filter((r) => r.w >= 6).map((r) => r.n)) / mean(q.filter((r) => r.w <= 5).map((r) => r.n))) * 100); };
  assert(gapY(2009) === 38.9 && gapY(2010) === 38.9 && Math.max(...Array.from({ length: 15 }, (_, i) => gapY(2000 + i))) === 38.9, "máximo da diferença em 2009 e 2010 (38,9%)");
  assert(gapY(2000) === 31.6 && gapY(2007) === 38 && gapY(2014) === 35.5, `diferença fim de semana/dias úteis: 2000 ${gapY(2000)}%, 2007 ${gapY(2007)}%, 2014 ${gapY(2014)}%`);
  const f13 = all.filter((r) => r.w === 5 && r.d === 13), f620 = all.filter((r) => r.w === 5 && (r.d === 6 || r.d === 20));
  const fr = r1((mean(f13.map((r) => r.n)) / mean(f620.map((r) => r.n)) - 1) * 100);
  assert(f13.length === 25 && fr === -6.4, `sexta-feira 13 (n = ${f13.length}): ${fr}% face às sextas-feiras 6 e 20`);
  const sorted = [...all].sort((a, b) => a.n - b.n), low = sorted.slice(0, 8);
  assert(low.every((r) => r.m === 12 && r.d === 25) && !(sorted[8].m === 12 && sorted[8].d === 25), "os 8 dias com menos nascimentos são dias de Natal");
  write("nascimentos-dia-semana-eua", {
    rows,
    views: [{ id: "dia", label: "Por dia da semana", yLabel: "Nascimentos por dia nos EUA, média de 2000 a 2014", unit: "", decimals: 0, valueLabels: true,
      series: [{ key: "avg", label: "Nascimentos por dia (média)", color: "--accent-2" }], tipExtra: [{ key: "idx", label: "Em % da média de todos os dias", suffix: "%" }] }],
    summary: { avg: r0(avg), byDay: rows, sunVsTue, gap, gap2000: gapY(2000), gap2007: gapY(2007), gap2014: gapY(2014), fri13: { n: f13.length, pct: fr }, lowest: low.map((r) => `${r.y}-${r.m}-${r.d}`) },
  }, [f, src]);
}

// 5. Homicídios na Europa, 1300–1984 (Eisner 2003, via OWID)
{
  const f = path.join(RAW, "homicidios-europa", "owid_homicide_europe_eisner2003.csv");
  const src = path.join(RAW, "homicidios-europa", "FONTE.md");
  const all = csv(f);
  const K = { England: "en", "Germany and Switzerland": "de", Italy: "it", "Netherlands and Belgium": "nl", Scandinavia: "sc" };
  const col = "Homicide rate in Europe over long-term (per 100,000)";
  const by = {};
  for (const r of all) (by[+r.Year] ??= { x: +r.Year, en: null, de: null, it: null, nl: null, sc: null })[K[r.Entity]] = +r[col];
  const rows = Object.values(by).sort((a, b) => a.x - b.x);
  assert(all.length === 71 && all.every((r) => +r.Year < 1990), `71 observações de Eisner (até 1984): ${all.length}`);
  assert(rows[0].x === 1300 && rows.at(-1).x === 1984, "1300–1984");
  const v = (k, y) => by[y][k];
  assert(v("it", 1450) === 73 && v("it", 1962) === 1.3, "Itália: 73 em 1450, 1,3 em 1962");
  assert(v("en", 1300) === 23 && v("en", 1962) === 0.7, "Inglaterra: 23 em 1300, 0,7 em 1962");
  assert(v("nl", 1300) === 47 && v("de", 1300) === 37 && v("sc", 1450) === 46, "Países Baixos e Bélgica 47, Alemanha e Suíça 37 (1300); Escandinávia 46 (1450)");
  const maxR = Math.max(...all.map((r) => +r[col])), min1962 = Math.min(...Object.values(K).map((k) => v(k, 1962)));
  assert(maxR === 73 && min1962 === 0.6, "máximo 73; mínimo em 1962: 0,6");
  assert(Object.values(K).every((k) => v(k, 1962) <= 1.3), "em 1962 todas as regiões entre 0,6 e 1,3");
  assert(Object.values(K).every((k) => v(k, 1984) > v(k, 1962)), "1984 acima de 1962 em todas as regiões");
  const it1450to1962 = r0(v("it", 1450) / v("it", 1962)), en = r0(v("en", 1300) / v("en", 1962));
  assert(it1450to1962 === 56 && en === 33, `Itália ÷${it1450to1962} (1450→1962); Inglaterra ÷${en} (1300→1962)`);
  assert(v("en", 1725) === 2 && v("sc", 1775) === 0.7, "Inglaterra 2 em 1725; Escandinávia 0,7 em 1775");
  assert(v("it", 1812) === 18 && v("it", 1775) === 9, "Itália sobe de 9 (1775) para 18 (1812)");
  write("homicidios-europa-1300-1984", {
    rows,
    config: { x: { label: "Ano", min: 1300, max: 1984, ticks: [1300, 1400, 1500, 1600, 1700, 1800, 1900, 1984] },
      y: { label: "Homicídios por 100 mil habitantes", suffix: "", decimals: 1, logDefault: true, logMin: 0.5, logMax: 100, linMax: 80 },
      series: [{ key: "it", label: "Itália", short: "Itália", color: "--accent-2", width: 2.6 }, { key: "en", label: "Inglaterra", short: "Inglaterra", color: "--accent-3", width: 2.6 },
        { key: "nl", label: "Países Baixos e Bélgica", short: "PB e Bélg.", color: "--accent-4", width: 2 }, { key: "de", label: "Alemanha e Suíça", short: "Alem./Suíça", color: "--ink-3", width: 2 }, { key: "sc", label: "Escandinávia", short: "Escand.", color: "--ink", width: 1.6 }],
      scaleToggle: true, dots: true, shortEndLabels: true, labelMargin: [88, 104],
      howToRead: "Cada ponto é uma estimativa para um período (por exemplo, o século XIV aparece em 1300). Em escala logarítmica, cada linha da grelha multiplica por 2 ou por 2,5: uma descida do 50 para o 5 tem a mesma altura do que do 5 para o 0,5.",
      annotations: [{ x: 1450, key: "it", text: "Itália, 1450: 73", short: "It. 1450: 73", anchor: "start", dx: 8, dy: -8 }] },
    summary: { it1450: v("it", 1450), it1962: v("it", 1962), en1300: v("en", 1300), en1962: v("en", 1962), it1450to1962, en, nl1300: v("nl", 1300), de1300: v("de", 1300), sc1450: v("sc", 1450) },
  }, [f, src]);
}

if (fails) { console.error(`\n${fails} verificações falharam`); process.exit(1); }
console.log("\nTodas as verificações passaram.");
