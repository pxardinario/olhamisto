// Transformação reprodutível dos dados brutos da edição de 2026-11-25.
// Uso: node tools/prepare-2026-11-25.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines (escala log ⇄ linear, linha de referência), dumbbell — ver assets/js/charts.js.
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
function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).map((l) => l.split(","));
  const [h, ...body] = rows;
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
// INE: valor de Portugal (geocod PT) por ano
function inePT(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"))[0];
  const out = {};
  for (const [per, rows] of Object.entries(j.Dados)) {
    const pt = rows.filter((r) => r.geocod === "PT");
    if (pt.length !== 1) throw new Error(`${file} ${per}: ${pt.length} linhas de Portugal`);
    out[per] = pt[0].valor == null ? null : +pt[0].valor;
  }
  return { j, v: out };
}
// JSON-stat do Eurostat
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
  return { get, cats, raw: d };
}
const EU27 = ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "EL", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE"];
const NOME = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };

// 1. Resíduos urbanos em Portugal: recolha seletiva, reciclagem e aterro, 2011–2025 (INE/APA)
{
  const D = (c) => inePT(path.join(RAW, "reciclagem-residuos", `ine_${c}.json`)).v;
  const rec = D("0013541"), at = D("0008978"), sel = D("0008658"), kg = D("0008657"), kgSel = D("0008660");
  const years = Object.keys(at).sort();
  assert(years[0] === "2011" && years.at(-1) === "2025" && years.length === 15, "aterro e recolha: 2011–2025 (15 anos)");
  assert(Object.keys(rec).sort().join() === "2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025", "taxa de reciclagem do INE: 2015–2025");
  assert(years.every((y) => at[y] != null && sel[y] != null && kg[y] != null && kgSel[y] != null), "sem anos em falta em aterro e recolha");
  const rows = years.map((y) => ({ x: +y, label: y, sel: sel[y], rec: rec[y] ?? null, at: at[y] }));
  const maxRec = Math.max(...Object.values(rec)), maxRecYear = Object.keys(rec).find((y) => rec[y] === maxRec);
  const minRec = Math.min(...Object.values(rec)), minRecYear = Object.keys(rec).find((y) => rec[y] === minRec);
  const s = {
    rec15: rec["2015"], rec24: rec["2024"], rec25: rec["2025"], maxRec, maxRecYear, minRec, minRecYear,
    at11: at["2011"], at15: at["2015"], at24: at["2024"], at25: at["2025"], minAt: Math.min(...years.map((y) => at[y])),
    sel11: sel["2011"], sel15: sel["2015"], sel25: sel["2025"], kgSel15: kgSel["2015"], kgSel25: kgSel["2025"], kg15: kg["2015"], kg25: kg["2025"], kgSel13: kgSel["2013"],
  };
  s.minAtYear = years.find((y) => at[y] === s.minAt);
  s.kgSelChg = r1((s.kgSel25 / s.kgSel15 - 1) * 100); s.kgChg = r1((s.kg25 / s.kg15 - 1) * 100);
  s.gapMeta = r1(55 - s.rec25);
  // comparação europeia no método harmonizado (Eurostat cei_wm011, até 2024)
  const E = jsonstat(path.join(RAW, "reciclagem-residuos", "eurostat_cei_wm011.json"));
  const e = (g, t) => E.get({ geo: g, time: t }).value;
  s.euPT24 = e("PT", "2024"); s.euUE24 = e("EU27_2020", "2024"); s.euPT15 = e("PT", "2015");
  const rk = EU27.map((c) => ({ c, v: e(c, "2024") })).filter((o) => o.v != null).sort((a, b) => a.v - b.v);
  s.euN24 = rk.length; s.euRankLow = rk.findIndex((o) => o.c === "PT") + 1; s.euBelowPT = rk.filter((o) => o.v < s.euPT24).map((o) => o.c);
  s.eu55 = rk.filter((o) => o.v >= 55).map((o) => o.c);
  console.log(s);
  assert(s.rec25 === 30.7 && s.rec15 === 31.3 && s.rec24 === 30.3, "taxa de reciclagem (INE): 31,3% em 2015, 30,3% em 2024, 30,7% em 2025");
  assert(s.maxRec === 32.8 && s.maxRecYear === "2016" && s.minRec === 27.6 && s.minRecYear === "2020", "máximo de 32,8% em 2016; mínimo de 27,6% em 2020");
  assert(s.gapMeta === 24.3, "faltam 24,3 pontos para a meta de 55% de 2025");
  assert(s.at25 === 49.1 && s.at11 === 58.9 && s.at15 === 47.3 && s.minAt === 46.1 && s.minAtYear === "2016", "aterro: 58,9% em 2011, mínimo de 46,1% em 2016, 49,1% em 2025");
  assert(s.sel15 === 15 && s.sel25 === 25 && s.sel11 === 15, "recolha seletiva: 15% dos resíduos recolhidos em 2015, 25% em 2025");
  assert(s.kgSel15 === 71 && s.kgSel25 === 126 && s.kgSelChg === 77.5, "recolha seletiva por habitante: 71 kg em 2015, 126 kg em 2025 (+77,5%)");
  assert(s.kg15 === 459 && s.kg25 === 497 && s.kgChg === 8.3, "resíduos recolhidos por habitante: 459 kg em 2015, 497 kg em 2025 (+8,3%)");
  assert(s.euPT24 === 32.9 && s.euUE24 === 49.4, "método harmonizado do Eurostat, 2024: Portugal 32,9%, UE 49,4%");
  assert(s.euN24 === 26 && s.euRankLow === 6 && s.eu55.length === 6, "2024: Portugal tem a 6.ª taxa mais baixa entre 26 países com dados (a Roménia não tem 2024); só 6 países chegam aos 55%");
  console.log(rk.map((o) => `${o.c} ${o.v}`).join(" · "));
  write("residuos-urbanos-portugal-2011-2025", {
    rows,
    config: {
      x: { min: 2011, max: 2025, ticks: [2011, 2013, 2015, 2017, 2019, 2021, 2023, 2025], tableLabel: "Ano" },
      y: { label: "Percentagem dos resíduos urbanos (%)", suffix: "%", decimals: 1, linMin: 0, linMax: 70, logDefault: false, linTicks: [0, 10, 20, 30, 40, 50, 60, 70] },
      series: [
        { key: "at", label: "Depositados em aterro", short: "Aterro", color: "--ink-3", width: 2 },
        { key: "rec", label: "Enviados para reciclagem", short: "Reciclagem", color: "--accent", width: 2.8 },
        { key: "sel", label: "Recolhidos seletivamente", short: "Seletiva", color: "--accent-2", width: 2 },
      ],
      labelMargin: [90, 206],
      dots: true,
      refLine: { value: 55, label: "Meta da UE para 2025: 55% reciclados", short: "Meta UE 2025: 55%", at: 2015.5 },
      howToRead: "Cada linha é uma fatia dos resíduos urbanos de Portugal, em percentagem. A reciclagem é a parte dos resíduos geridos enviada para reciclagem ou compostagem; o aterro e a recolha seletiva são partes dos resíduos recolhidos (a seletiva é o que chegou separado: ecopontos, porta a porta, biorresíduos). As bases são diferentes e as linhas não se somam. A taxa de reciclagem do INE só existe desde 2015. A linha tracejada é a meta europeia para 2025.",
    },
    summary: s,
  }, rawFiles("reciclagem-residuos"));
}

// 2. Anúncios de emprego online para especialistas em TIC, % do total, 2022-T3 vs 2026-T3 (Eurostat, estatísticas em desenvolvimento)
{
  const A = jsonstat(path.join(RAW, "anuncios-tic", "eurostat_isoc_sk_oja1.json"));
  const B = jsonstat(path.join(RAW, "anuncios-tic", "eurostat_isoc_sk_oja3.json"));
  const a = (g, t) => A.get({ geo: g, time: t }).value;
  const b = (g, t) => B.get({ geo: g, time: t }).value;
  const T = A.cats("time");
  assert(T[0] === "2019-Q4" && T.at(-1) === "2026-Q3" && T.length === 28, "série de 2019-T4 a 2026-T3 (28 trimestres)");
  const rows = EU27.map((c) => ({ label: NOME[c], code: c, a: a(c, "2022-Q3"), b: a(c, "2026-Q3"), highlight: c === "PT" || undefined }));
  assert(rows.every((q) => q.a != null && q.b != null), "os 27 países têm valores em 2022-T3 e 2026-T3");
  const eu = (t) => a("EU27_2020", t);
  const euSeries = T.map((t) => eu(t));
  const euMax = Math.max(...euSeries), euMaxT = T[euSeries.indexOf(euMax)];
  const ptSeries = T.map((t) => a("PT", t)); const ptMax = Math.max(...ptSeries), ptMaxT = T[ptSeries.indexOf(ptMax)];
  const fell = rows.filter((q) => q.b < q.a);
  const rk = [...rows].sort((p, q) => q.b - p.b);
  const s = {
    eu22: eu("2022-Q3"), eu26: eu("2026-Q3"), eu19: eu("2019-Q4"), euMax, euMaxT, pt22: a("PT", "2022-Q3"), pt26: a("PT", "2026-Q3"), ptMax, ptMaxT,
    nFell: fell.length, rankPT: rk.findIndex((q) => q.code === "PT") + 1, top3: rk.slice(0, 3).map((q) => `${q.code} ${q.b}`), low3: rk.slice(-3).map((q) => `${q.code} ${q.b}`),
    euYoy26: b("EU27_2020", "2026-Q3"), ptYoy26: b("PT", "2026-Q3"),
    euYoyQ3: ["2023-Q3", "2024-Q3", "2025-Q3", "2026-Q3"].map((t) => b("EU27_2020", t)),
  };
  s.euRatio = r2(s.eu26 / s.eu22); s.euChgPP = r1(s.eu26 - s.eu22); s.ptChgPP = r1(s.pt26 - s.pt22);
  s.euCountIdx = r1(s.euYoyQ3.reduce((t, v) => t * (1 + v / 100), 1) * 100);
  const dropPP = [...rows].sort((p, q) => (q.a - q.b) - (p.a - p.b)).slice(0, 3).map((q) => `${q.code} ${r1(q.b - q.a)}`);
  s.biggestDrops = dropPP; s.rose = rows.filter((q) => q.b > q.a).map((q) => `${q.code} ${q.a}→${q.b}`);
  console.log(s);
  assert(s.eu22 === 10.1 && s.eu26 === 5.8 && s.euChgPP === -4.3, "UE: 10,1% dos anúncios online em 2022-T3, 5,8% em 2026-T3 (−4,3 pontos)");
  assert(s.euMax === 11.1 && s.euMaxT === "2021-Q1", "máximo da UE: 11,1% (2021-T1)");
  assert(s.pt22 === 15.6 && s.pt26 === 12.6 && s.ptMax === 20.3 && s.ptMaxT === "2021-Q1", "Portugal: 15,6% → 12,6%; máximo de 20,3% em 2021-T1");
  assert(s.rankPT === 3 && s.top3.join() === "MT 13.2,CY 12.8,PT 12.6", "Portugal tem a terceira fatia mais alta (depois de Malta 13,2 e Chipre 12,8)");
  assert(s.euYoy26 === -36 && s.ptYoy26 === -55.1, "número de anúncios TIC no 3.º trimestre de 2026 face ao de 2025: UE −36,0%, Portugal −55,1%");
  assert(s.euCountIdx === 34.5, "encadeando as variações homólogas dos 3.os trimestres, o número de anúncios TIC na UE em 2026-T3 é 34,5% do de 2022-T3");
  write("anuncios-tic-ue-2022-2026", {
    rows: rows.map(({ code, ...q }) => q),
    config: {
      aLabel: "4 trimestres até set. 2022", bLabel: "4 trimestres até set. 2026", unit: "%", decimals: 1, domain: [0, 20],
      ref: s.eu26, refLabel: `UE, 2026: ${String(s.eu26).replace(".", ",")}%`, itemLabel: "país",
      sorts: [["b", "Valor de 2026"], ["delta", "Variação desde 2022"]],
      howToRead: "Cada linha é um país. O ponto cinzento é a percentagem dos anúncios de emprego publicados na internet que procuravam especialistas em informática e telecomunicações nos quatro trimestres até setembro de 2022; o ponto colorido, nos quatro trimestres até setembro de 2026. A linha tracejada é a média da UE em 2026.",
    },
    summary: s,
  }, rawFiles("anuncios-tic"));
}

// 3. Idade mediana da população, 2021 vs 2025, UE-27 (Eurostat demo_pjanind) e por nacionalidade em Portugal (demo_popmdctz)
{
  const M = jsonstat(path.join(RAW, "idade-mediana", "eurostat_demo_pjanind_MEDAGEPOP.json"));
  const m = (g, t) => M.get({ geo: g, time: t }).value;
  const T = M.cats("time");
  assert(T.at(-1) === "2025", "último ano: 2025 (1 de janeiro)");
  const ptYears = T.filter((t) => m("PT", t) != null);
  const ptFalls = ptYears.filter((t, i) => i > 0 && m("PT", t) < m("PT", ptYears[i - 1]));
  const rows = EU27.map((c) => ({ label: NOME[c], code: c, a: m(c, "2021"), b: m(c, "2025"), highlight: c === "PT" || undefined }));
  assert(rows.every((q) => q.a != null && q.b != null), "os 27 países têm idade mediana em 2021 e 2025");
  const down = rows.filter((q) => q.b < q.a).map((q) => `${q.code} ${q.a}→${q.b}`);
  const rk21 = [...rows].sort((p, q) => q.a - p.a), rk25 = [...rows].sort((p, q) => q.b - p.b);
  const N = jsonstat(path.join(RAW, "idade-mediana", "eurostat_demo_popmdctz_PT_EU.json"));
  const n = (cit, g, t) => N.get({ citizen: cit, geo: g, time: t }).value;
  const s = {
    firstPT: ptYears[0], pt21: m("PT", "2021"), pt22: m("PT", "2022"), pt22status: M.get({ geo: "PT", time: "2022" }).status, pt25: m("PT", "2025"), ptMax: Math.max(...ptYears.map((t) => m("PT", t))),
    ptFalls, eu21: m("EU27_2020", "2021"), eu25: m("EU27_2020", "2025"), pt05: m("PT", "2005"), pt00: m("PT", "2000"),
    down, rank21: rk21.findIndex((q) => q.code === "PT") + 1, rank25: rk25.findIndex((q) => q.code === "PT") + 1, top5: rk25.slice(0, 5).map((q) => `${q.code} ${q.b}`),
    nat21: n("NAT", "PT", "2021"), nat25: n("NAT", "PT", "2025"), for21: n("FOR_STLS", "PT", "2021"), for25: n("FOR_STLS", "PT", "2025"),
    nonEU21: n("NEU27_2020_FOR", "PT", "2021"), nonEU25: n("NEU27_2020_FOR", "PT", "2025"), euNat25: n("NAT", "EU27_2020", "2025"), euFor25: n("FOR_STLS", "EU27_2020", "2025"),
  };
  s.ptMaxYear = ptYears.find((t) => m("PT", t) === s.ptMax);
  console.log(s);
  assert(s.pt21 === 46.3 && s.pt25 === 45.6 && s.ptMax === 46.3 && s.ptMaxYear === "2021", "Portugal: máximo de 46,3 anos em 2021; 45,6 em 2025");
  assert(s.ptFalls.join() === "1972,1973,1974,1977,2022,2023,2024", "a idade mediana de Portugal desceu em 2022, 2023 e 2024 (igual em 2025); antes, só tinha descido em 1972–1974 e 1977");
  assert(s.pt22status === "b", "2022 tem marca de quebra de série em Portugal");
  assert(s.eu21 === 44.2 && s.eu25 === 44.9, "UE: 44,2 anos em 2021, 44,9 em 2025");
  assert(s.down.join() === "DE 45.9→45.5,LT 44.5→44.3,MT 40.2→40,NL 42.7→42.6,PT 46.3→45.6", "só cinco países da UE ficaram mais novos entre 2021 e 2025 (Alemanha, Lituânia, Malta, Países Baixos e Portugal); Portugal teve a maior descida (−0,7 anos)");
  s.ptDrop = r1(s.pt25 - s.pt21); s.natUp = r1(s.nat25 - s.nat21); s.forDown = r1(s.for25 - s.for21);
  assert(s.ptDrop === -0.7 && s.natUp === 1.3 && s.forDown === -2.7, "2021→2025: total −0,7 anos; portugueses +1,3; estrangeiros −2,7");
  s.gapNatFor = r1(s.nat25 - s.for25);
  assert(s.gapNatFor === 14.5, "2025: a idade mediana dos estrangeiros fica 14,5 anos abaixo da dos cidadãos portugueses");
  assert(s.pt00 === 37.5, "Portugal: 37,5 anos em 2000");
  assert(s.rank21 === 3 && s.rank25 === 5 && s.top5.join() === "IT 49.1,BG 47.3,EL 47.2,ES 45.8,PT 45.6", "Portugal passou de 3.º para 5.º país mais velho da UE (Itália 49,1)");
  assert(s.nat21 === 47.1 && s.nat25 === 48.4, "cidadãos portugueses: 47,1 anos em 2021, 48,4 em 2025");
  assert(s.for21 === 36.6 && s.for25 === 33.9 && s.nonEU25 === 33.3, "estrangeiros residentes: 36,6 → 33,9 anos; de fora da UE: 33,3 em 2025");
  assert(s.firstPT === "1960", "série de Portugal desde 1960");
  write("idade-mediana-ue-2021-2025", {
    rows: rows.map(({ code, ...q }) => q),
    config: {
      aLabel: "2021", bLabel: "2025", unit: "", decimals: 1, domain: [38, 50],
      ref: s.eu25, refLabel: `UE, 2025: ${String(s.eu25).replace(".", ",")} anos`, itemLabel: "país",
      sorts: [["delta", "Variação desde 2021"], ["b", "Idade mediana em 2025"]],
      howToRead: "Cada linha é um país. O ponto cinzento é a idade mediana da população a 1 de janeiro de 2021 (metade tem mais, metade tem menos); o ponto colorido, a de 2025. Quando o ponto colorido fica à esquerda, a população ficou mais nova. A escala começa nos 38 anos. A linha tracejada é a média da UE em 2025.",
    },
    summary: s,
  }, rawFiles("idade-mediana"));
}

// 4. Índice Planeta Vivo 2026 (WWF/ZSL), 1970–2022, por região e por meio (via catálogo da OWID)
{
  const all = parseCSV(fs.readFileSync(path.join(RAW, "indice-planeta-vivo", "owid_catalog_living_planet_index_2026-09-30.csv"), "utf8")).map((o) => ({ g: o.country, y: +o.year, v: +o.lpi_final, lo: +o.ci_low, hi: +o.ci_high }));
  const G = ["World", "Africa", "Asia and Pacific", "Europe and Central Asia", "Latin America and the Caribbean", "North America", "Freshwater", "Marine", "Terrestrial"];
  assert(all.length === 477 && G.every((g) => all.filter((o) => o.g === g).length === 53), "9 séries × 53 anos (1970–2022)");
  const v = (g, y) => all.find((o) => o.g === g && o.y === y);
  assert(G.every((g) => v(g, 1970).v === 1), "todas as séries valem 1 em 1970");
  const rows = [];
  for (let y = 1970; y <= 2022; y++) rows.push({ x: y, label: String(y), wld: r1(v("World", y).v * 100), lam: r1(v("Latin America and the Caribbean", y).v * 100), afr: r1(v("Africa", y).v * 100), asp: r1(v("Asia and Pacific", y).v * 100), nam: r1(v("North America", y).v * 100), eur: r1(v("Europe and Central Asia", y).v * 100), fw: r1(v("Freshwater", y).v * 100), mar: r1(v("Marine", y).v * 100), ter: r1(v("Terrestrial", y).v * 100) });
  const dec = (g) => r1((1 - v(g, 2022).v) * 100);
  const s = {
    world: dec("World"), worldLo: r1((1 - v("World", 2022).hi) * 100), worldHi: r1((1 - v("World", 2022).lo) * 100),
    lam: dec("Latin America and the Caribbean"), afr: dec("Africa"), asp: dec("Asia and Pacific"), nam: dec("North America"), eur: dec("Europe and Central Asia"),
    fw: dec("Freshwater"), mar: dec("Marine"), ter: dec("Terrestrial"),
    eurMax: Math.max(...all.filter((o) => o.g === "Europe and Central Asia").map((o) => o.v)),
    annual: r2((1 - v("World", 2022).v ** (1 / 52)) * 100),
  };
  s.eurMaxYear = all.find((o) => o.g === "Europe and Central Asia" && o.v === s.eurMax).y; s.eurMax = r1(s.eurMax * 100);
  s.eurAbove1970Until = Math.max(...all.filter((o) => o.g === "Europe and Central Asia" && o.v >= 1).map((o) => o.y));
  s.lamIdx = r1(v("Latin America and the Caribbean", 2022).v * 100); s.wldIdx = r1(v("World", 2022).v * 100);
  console.log(s);
  assert(s.world === 73.2 && s.worldLo === 67.3 && s.worldHi === 78.3, "mundo: −73,2% de 1970 a 2022 (intervalo de 67,3% a 78,3%)");
  assert(s.lam === 94.9 && s.afr === 80.2 && s.asp === 49.3 && s.nam === 28.4 && s.eur === 23, "regiões: América Latina e Caraíbas −94,9%, África −80,2%, Ásia-Pacífico −49,3%, América do Norte −28,4%, Europa e Ásia Central −23,0%");
  assert(s.fw === 84.8 && s.ter === 69.5 && s.mar === 58.6, "água doce −84,8%, terrestres −69,5%, marinhos −58,6%");
  assert(s.annual === 2.5, "queda média de 2,5% ao ano (taxa composta 1970–2022)");
  assert(s.eurMax === 129.5 && s.eurMaxYear === 1990 && s.eurAbove1970Until === 2002, "Europa e Ásia Central: máximo de 129,5 (1970 = 100) em 1990; acima de 1970 até 2002");
  assert(s.wldIdx === 26.8 && s.lamIdx === 5.1, "índice de 2022: mundo 26,8; América Latina e Caraíbas 5,1");
  write("indice-planeta-vivo-1970-2022", {
    rows,
    config: {
      x: { min: 1970, max: 2022, ticks: [1970, 1980, 1990, 2000, 2010, 2022], tableLabel: "Ano" },
      y: { label: "Índice Planeta Vivo (1970 = 100)", suffix: "", decimals: 1, logDefault: false, logMin: 4, logMax: 200, logTicks: [5, 10, 20, 50, 100, 200], linMin: 0, linMax: 140, linTicks: [0, 20, 40, 60, 80, 100, 120, 140] },
      series: [
        { key: "eur", label: "Europa e Ásia Central", short: "Europa", color: "--accent-3", width: 1.8 },
        { key: "nam", label: "América do Norte", short: "Am. Norte", color: "--ink-3", width: 1.6 },
        { key: "asp", label: "Ásia e Pacífico", short: "Ásia-Pac.", color: "--ink-3", width: 1.6 },
        { key: "wld", label: "Mundo", short: "Mundo", color: "--ink", width: 3 },
        { key: "afr", label: "África", short: "África", color: "--ink-3", width: 1.6 },
        { key: "lam", label: "América Latina e Caraíbas", short: "Am. Latina", color: "--accent-2", width: 2.4 },
      ],
      labelMargin: [92, 190],
      scaleToggle: true,
      refLine: { value: 100, label: "Nível de 1970", short: "1970", at: 2016 },
      howToRead: "Cada linha resume a evolução média de milhares de populações de animais vertebrados monitorizadas numa região, com 1970 = 100. Um valor de 27 não quer dizer que restam 27% dos animais: quer dizer que, em média, a população típica vigiada encolheu para cerca de um quarto do tamanho que tinha. Na escala logarítmica, a mesma inclinação é a mesma taxa de queda.",
    },
    summary: s,
  }, rawFiles("indice-planeta-vivo"));
}
