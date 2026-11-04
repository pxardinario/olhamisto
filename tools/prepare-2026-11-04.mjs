// Transformação reprodutível dos dados brutos da edição de 2026-11-04.
// Uso: node tools/prepare-2026-11-04.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: columns, lines, dumbbell (ver assets/js/charts.js).
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

// 1. Inflação na zona euro: contributos por componente (Eurostat) + Brent (EIA via FRED)
{
  const fa = path.join(RAW, "inflacao-energia", "eurostat_hicp_2026-04-16.csv");
  const fb = path.join(RAW, "inflacao-energia", "eurostat_hicp_2026-10-16.csv");
  const fo = path.join(RAW, "inflacao-energia", "fred_MCOILBRENTEU.csv");
  const toTable = (f) => { const t = {}; for (const r of csv(f)) { const { series, ...rest } = r; t[series] = rest; } return t; };
  const A = toTable(fa), B = toTable(fb);
  const months = [["Oct25", A, "2025-10", "out. 25"], ["Nov25", A, "2025-11", "nov. 25"], ["Dec25", A, "2025-12", "dez. 25"], ["Jan26", A, "2026-01", "jan. 26"], ["Feb26", A, "2026-02", "fev. 26"], ["Mar26", A, "2026-03", "mar. 26"],
    ["Apr26", B, "2026-04", "abr. 26"], ["May26", B, "2026-05", "mai. 26"], ["Jun26", B, "2026-06", "jun. 26"], ["Jul26", B, "2026-07", "jul. 26"], ["Aug26", B, "2026-08", "ago. 26"], ["Sep26", B, "2026-09", "set. 26"]];
  const brent = Object.fromEntries(csv(fo).map((r) => [r.date.slice(0, 7), +r.value]));
  const rows = months.map(([col, T, ym, lab]) => ({
    cat: lab, month: ym,
    headline: +T.rate_all_items[col], exEnergy: +T.rate_excl_energy[col], energyRate: +T.rate_energy[col], portugal: +T.rate_portugal[col],
    energy: +T.contrib_energy[col], food: +T.contrib_food_alcohol_tobacco[col], neig: +T.contrib_non_energy_industrial_goods[col], services: +T.contrib_services[col],
    brent: brent[ym],
  }));
  // Sep 2025 aparece nas duas publicações? Não: Sep25 só na de outubro; confirmar coerência Mar25 vs Sep25 não se aplica.
  for (const r of rows) {
    const s = r.energy + r.food + r.neig + r.services;
    assert(Math.abs(s - r.headline) <= 0.06, `${r.month}: soma dos contributos ${r2(s)} ≈ taxa global ${r.headline}`);
    assert(r.brent > 0, `${r.month}: Brent disponível (${r.brent})`);
  }
  const jan = rows.find((r) => r.month === "2026-01"), sep = rows.at(-1);
  const apr = rows.find((r) => r.month === "2026-04");
  const riseHeadline = r1(sep.headline - jan.headline);
  const riseEnergyContrib = r2(sep.energy - jan.energy);
  const riseOther = r2((sep.food + sep.neig + sep.services) - (jan.food + jan.neig + jan.services));
  assert(riseHeadline === 2.1, `subida da taxa global jan→set: ${riseHeadline} pp`);
  assert(riseEnergyContrib === 2.1, `subida do contributo da energia jan→set: ${riseEnergyContrib} pp`);
  assert(jan.exEnergy === 2.3 && sep.exEnergy === 2.3, "inflação sem energia: 2,3% em jan. e em set.");
  const brentJanSepPct = Math.round((sep.brent / jan.brent - 1) * 100);
  assert(brentJanSepPct === 71, `Brent jan→set: +${brentJanSepPct}%`);
  write("inflacao-energia-2026", {
    rows,
    views: [
      { id: "contrib", label: "Contributos", yLabel: "Contributo para a inflação homóloga da zona euro (pontos percentuais)", unit: "pp", decimals: 2,
        series: [{ key: "services", label: "Serviços", color: "--ink-3" }, { key: "food", label: "Alimentação, álcool e tabaco", color: "--accent-3" }, { key: "neig", label: "Bens industriais não energéticos", color: "--accent-2" }, { key: "energy", label: "Energia", color: "--accent" }],
        line: { key: "headline", label: "Inflação total (%)" },
        tipExtra: [{ key: "exEnergy", label: "Sem energia", suffix: "%" }, { key: "energyRate", label: "Taxa da energia", suffix: "%" }],
        notes: [{ cat: "mar. 26", text: "Março: energia passa a positiva", short: "Energia > 0" }] },
      { id: "brent", label: "Petróleo Brent", yLabel: "Brent, média mensal (dólares por barril)", unit: "$", decimals: 2,
        series: [{ key: "brent", label: "Brent (US$/barril)", color: "--accent" }], valueLabels: true },
    ],
    summary: {
      headlineJan: jan.headline, headlineSep: sep.headline, riseHeadline, energyJan: jan.energy, energySep: sep.energy, riseEnergyContrib, riseOther,
      exEnergyJan: jan.exEnergy, exEnergySep: sep.exEnergy, energyRateSep: sep.energyRate, energyRateApr: apr.energyRate,
      brentJan: jan.brent, brentSep: sep.brent, brentApr: apr.brent, brentJanSepPct, portugalSep: sep.portugal, portugalJan: jan.portugal,
      energyShareOfSep: Math.round((sep.energy / sep.headline) * 100),
    },
  }, [fa, fb, fo]);
}

// 2. NATO: despesa de defesa em % do PIB, 2014 vs 2025e (relatório NATO jun. 2025) + revisões conhecidas (ICDS, jul. 2026)
{
  const fn = path.join(RAW, "nato", "nato_def-exp-2025_table3_share_real_gdp.csv");
  const fr = path.join(RAW, "nato", "icds_2026-07-09_revisoes_2025.csv");
  const PT = { Albania: "Albânia", Belgium: "Bélgica", Bulgaria: "Bulgária", Canada: "Canadá", Croatia: "Croácia", Czechia: "Chéquia", Denmark: "Dinamarca", Estonia: "Estónia", Finland: "Finlândia", France: "França", Germany: "Alemanha", Greece: "Grécia", Hungary: "Hungria", Italy: "Itália", Latvia: "Letónia", Lithuania: "Lituânia", Luxembourg: "Luxemburgo", Montenegro: "Montenegro", Netherlands: "Países Baixos", "North Macedonia": "Macedónia do Norte", Norway: "Noruega", Poland: "Polónia", Portugal: "Portugal", Romania: "Roménia", "Slovak Republic": "Eslováquia", Slovenia: "Eslovénia", Spain: "Espanha", Sweden: "Suécia", Türkiye: "Turquia", "United Kingdom": "Reino Unido", "United States": "Estados Unidos" };
  const all = csv(fn);
  const rev = Object.fromEntries(csv(fr).filter((r) => r.country !== "ALL").map((r) => [r.country, +r.revised_2025_pct]));
  const countries = all.filter((r) => !r.country.startsWith("NATO"));
  assert(countries.length === 31, "31 aliados na tabela (Islândia não tem forças armadas e não consta)");
  const rows = countries.map((r) => {
    const name = r.country.replace("*", "");
    const b = r["2025e"] === ".." ? null : +r["2025e"];
    return { label: PT[name], en: name, a: +r["2014"], b, c: rev[name] ?? null, highlight: name === "Portugal", law2pct: r.country.endsWith("*") };
  });
  assert(rows.every((r) => r.label), "todos os nomes traduzidos");
  const withB = rows.filter((r) => r.b != null);
  assert(withB.length === 30, "30 aliados com estimativa para 2025 (Alemanha sem dados)");
  const at2 = withB.filter((r) => r.b >= 2).length;
  const band = withB.filter((r) => r.b >= 2 && r.b <= 2.05);
  const exactly = withB.filter((r) => r.b === 2);
  const in2014 = rows.filter((r) => r.a >= 2);
  assert(at2 === 30, "todos os 30 com estimativa declaravam ≥ 2,00% em 2025");
  assert(band.length === 14, `14 aliados entre 2,00% e 2,05% (${band.map((r) => r.en).join(", ")})`);
  assert(exactly.length === 6, `6 aliados exatamente em 2,00% (${exactly.map((r) => r.en).join(", ")})`);
  assert(in2014.length === 3, `3 aliados ≥ 2% em 2014 (${in2014.map((r) => r.en).join(", ")})`);
  const pt = rows.find((r) => r.en === "Portugal");
  assert(pt.a === 1.31 && pt.b === 2.0, "Portugal 1,31% → 2,00%");
  const tot = all.find((r) => r.country === "NATO Europe and Canada");
  write("nato-meta-2pct", {
    rows: rows.map(({ en, ...r }) => r),
    config: { aLabel: "2014", bLabel: "2025 (estimativa, dados até jun. 2025)", cLabel: "2025 revisto (jul. 2026)", ref: 2, refLabel: "Meta de Gales: 2% do PIB", band: [2, 2.05], bandLabel: "2,00–2,05%", unit: "%", decimals: 2, domain: [0, 4.6],
      sorts: [["b", "Por 2025"], ["delta", "Por subida"]] },
    summary: { allies: 31, withEstimate: withB.length, atOrAbove2: at2, inBand: band.length, exactly2: exactly.length, in2014: in2014.length,
      revisedAbove2: 24, revisedJustAbove: 12, ptA: pt.a, ptB: pt.b, euCanada2014: +tot["2014"], euCanada2025e: +tot["2025e"],
      revised: Object.entries(rev).map(([k, v]) => `${PT[k]} ${v}%`) },
  }, [fn, fr]);
}

// 3. Idade normal de acesso à pensão de velhice, 2014–2027 (Portarias)
{
  const f = path.join(RAW, "idade-reforma", "apcmc_portarias_idade_normal.csv");
  const fe = path.join(RAW, "idade-reforma", "ine_emv65.csv");
  const src = csv(f).map((r) => ({ year: +r.year, months: (+r.age_years) * 12 + (+r.age_months), y: +r.age_years, m: +r.age_months, portaria: r.portaria_idade }));
  const fmtAge = (y, m) => (m ? `${y} anos e ${m} ${m === 1 ? "mês" : "meses"}` : `${y} anos`);
  const rows = src.slice(1).map((r, i) => ({ cat: String(r.year), change: r.months - src[i].months, age: fmtAge(r.y, r.m), portaria: r.portaria }));
  assert(rows.length === 13, "13 variações anuais (2015–2027)");
  const neg = rows.filter((r) => r.change < 0);
  assert(neg.length === 1 && neg[0].cat === "2023" && neg[0].change === -3, "única descida: 2023 (−3 meses)");
  const last3 = rows.filter((r) => +r.cat >= 2025).reduce((a, r) => a + r.change, 0);
  assert(last3 === 7, "2025–2027: +7 meses");
  const total = src.at(-1).months - src[0].months;
  assert(total === 11, "2014→2027: +11 meses");
  assert(rows.find((r) => r.cat === "2025").change === 3, "2025: maior subida anual da série (+3 meses)");
  assert(Math.max(...rows.map((r) => r.change)) === 3, "máximo anual = 3 meses");
  write("idade-reforma-pt", {
    rows,
    views: [{ id: "change", label: "Variação", yLabel: "Variação da idade normal de acesso à pensão face ao ano anterior (meses)", unit: " meses", decimals: 0,
      series: [{ key: "change", label: "Variação anual (meses)", color: "--accent-2", negColor: "--accent" }], valueLabels: true,
      tipExtra: [{ key: "age", label: "Idade nesse ano", suffix: "" }, { key: "portaria", label: "Portaria", suffix: "" }],
      notes: [{ cat: "2023", text: "Pandemia: primeira descida", short: "Pandemia" }] }],
    summary: { age2014: fmtAge(66, 0), age2022: fmtAge(66, 7), age2023: fmtAge(66, 4), age2027: fmtAge(66, 11), totalMonths: total, last3Months: last3, emv65_2023_2025: +csv(fe)[0].emv65_anos },
  }, [f, fe]);
}

// 4. Preço dos módulos solares fotovoltaicos, 1975–2025 (OWID)
{
  const f = path.join(RAW, "solar", "owid_solar-pv-prices.csv");
  const rows = csv(f).map((r) => ({ x: +r.Year, price: +r["Solar PV module cost"] }));
  assert(rows.length === 51 && rows[0].x === 1975 && rows.at(-1).x === 2025, "51 anos, 1975–2025");
  const p = (y) => rows.find((r) => r.x === y).price;
  const ratio = Math.round(p(1975) / p(2025));
  const fall1975 = r1((1 - p(2025) / p(1975)) * 100);
  const fall2010 = Math.round((1 - p(2025) / p(2010)) * 100);
  const fall2023 = Math.round((1 - p(2025) / p(2023)) * 100);
  assert(ratio === 1101, `1975/2025 = ${ratio}×`);
  assert(fall1975 === 99.9, `queda 1975→2025: ${fall1975}%`);
  assert(fall2010 === 95, `queda 2010→2025: ${fall2010}%`);
  assert(fall2023 === 56, `queda 2023→2025: ${fall2023}%`);
  const up = rows.filter((r, i) => i && r.price > rows[i - 1].price).map((r) => r.x);
  assert(up.join() === "1989,1990,2005,2006,2007,2021,2022", `anos de subida: ${up.join(", ")}`);
  write("solar-preco-modulos", {
    rows,
    config: { x: { label: "Ano", min: 1975, max: 2025, ticks: [1975, 1985, 1995, 2005, 2015, 2025] },
      y: { label: "Preço médio do módulo fotovoltaico (dólares de 2025 por watt)", prefix: "", suffix: " $/W", decimals: 2, logDefault: true, logMin: 0.08, logMax: 200, linMax: 140 },
      series: [{ key: "price", label: "Preço do módulo", color: "--accent", width: 3 }],
      scaleToggle: true,
      annotations: [{ x: 1975, key: "price", text: "132 $/W", anchor: "start", dx: 8, dy: -4 }, { x: 2012, key: "price", text: "2012: 1,11 $/W", anchor: "start", dx: 8, dy: -8, logOnly: true }, { x: 2025, key: "price", text: "0,12 $/W", anchor: "end", dx: -4, dy: -12, strong: true }],
      shade: [{ from: 1989, to: 1990, label: "" }, { from: 2005, to: 2007, label: "subidas" }, { from: 2021, to: 2022, label: "" }] },
    summary: { p1975: r2(p(1975)), p2010: r2(p(2010)), p2023: r2(p(2023)), p2025: r2(p(2025)), ratio, fall1975, fall2010, fall2023, yearsUp: up },
  }, [f]);
}

// 5. Mortalidade até aos cinco anos: Portugal e cinco países europeus, 1950–2024 (OWID: UN IGME + Gapminder)
{
  const f = path.join(RAW, "mortalidade-infantil", "owid_child-mortality_selected_5anos.csv");
  const raw = csv(f);
  const keys = { PRT: "pt", ESP: "es", ITA: "it", GRC: "gr", FRA: "fr", SWE: "se" };
  const years = [...new Set(raw.map((r) => +r.Year))].sort((a, b) => a - b);
  const rows = years.map((y) => { const o = { x: y }; for (const r of raw.filter((r) => +r.Year === y)) o[keys[r.Code]] = +r["Under-five mortality rate (selected)"]; return o; });
  assert(rows.every((r) => Object.values(keys).every((k) => typeof r[k] === "number")), "todos os países com valor em todos os anos");
  const v = (y, k) => rows.find((r) => r.x === y)[k];
  const pt60 = v(1960, "pt"), se60 = v(1960, "se"), pt24 = v(2024, "pt");
  assert(pt60 === 11.43 && se60 === 1.96, "1960: Portugal 11,43 vs Suécia 1,96 por 100");
  const ratio60 = r1(pt60 / se60);
  assert(ratio60 === 5.8, `1960: Portugal ${ratio60}× a Suécia`);
  const max60 = Math.max(...Object.values(keys).map((k) => v(1960, k)));
  assert(max60 === pt60, "1960: Portugal tem a taxa mais alta dos seis");
  assert(pt24 === 0.32 && v(2024, "es") === 0.32 && v(2024, "fr") === 0.43 && v(2024, "gr") === 0.38, "2024: PT 0,32 = ES; FR 0,43; GR 0,38");
  const fall = r1((1 - pt24 / pt60) * 100);
  assert(fall === 97.2, `queda 1960→2024: ${fall}%`);
  const fall7080 = Math.round((1 - v(1980, "pt") / v(1970, "pt")) * 100);
  assert(fall7080 === 60, `1970→1980: −${fall7080}%`);
  const ratio24 = r1(pt24 / v(2024, "se"));
  write("mortalidade-5anos-europa", {
    rows,
    config: { x: { label: "Ano", min: 1950, max: 2024, ticks: [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2024] },
      y: { label: "Mortes antes dos 5 anos por 100 nados-vivos", suffix: "", decimals: 2, logDefault: false, logMin: 0.15, logMax: 20, linMax: 16 },
      series: [{ key: "pt", label: "Portugal", color: "--accent", width: 3.2 }, { key: "es", label: "Espanha", color: "--muted" }, { key: "it", label: "Itália", color: "--muted" },
        { key: "gr", label: "Grécia", color: "--muted" }, { key: "fr", label: "França", color: "--muted" }, { key: "se", label: "Suécia", color: "--accent-2", width: 2.2 }],
      scaleToggle: true, dots: true,
      annotations: [{ x: 1960, key: "pt", text: "1960: 11,4 em cada 100", anchor: "start", dx: 8, dy: -6, strong: true }] },
    summary: { pt1950: v(1950, "pt"), pt60, se60, ratio60, pt24, es24: v(2024, "es"), fr24: v(2024, "fr"), gr24: v(2024, "gr"), it24: v(2024, "it"), se24: v(2024, "se"), fall, fall7080, ratio24 },
  }, [f]);
}
console.log(fails ? `\n${fails} verificações falharam` : "\nConcluído sem falhas.");
