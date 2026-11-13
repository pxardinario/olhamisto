// Transformação reprodutível dos dados brutos da edição de 2026-11-13.
// Uso: node tools/prepare-2026-11-13.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: columns, lines, dumbbell — ver assets/js/charts.js.
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
  return { j, v, geos: Object.keys(d.geo.category.index) };
}
function csv(file) {
  const txt = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const out = []; let row = [], cur = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur.replace(/\r$/, "")); out.push(row); row = []; cur = ""; } else cur += c;
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

// 1. Fogos licenciados em construções novas para habitação familiar (INE 0008066, Portugal, total)
{
  const f = path.join(RAW, "fogos-licenciados", "ine_0008066_fogos_licenciados_PT.json");
  const D = JSON.parse(fs.readFileSync(f, "utf8"))[0].Dados;
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const m = {}; // "AAAA-MM" -> valor
  for (const [per, lst] of Object.entries(D)) {
    const [mes, , ano] = per.split(" ");
    const mi = MESES.indexOf(mes); if (mi < 0) throw new Error("mês desconhecido: " + per);
    const r = lst.find((q) => q.geocod === "PT" && q.dim_3 === "T");
    m[`${ano}-${String(mi + 1).padStart(2, "0")}`] = +r.valor;
  }
  const keys = Object.keys(m).sort();
  assert(keys[0] === "2007-01" && keys.at(-1) === "2026-09" && keys.length === 237, "237 meses, de janeiro de 2007 a setembro de 2026");
  const years = [...new Set(keys.map((k) => +k.slice(0, 4)))];
  const full = {}, ytd = {};
  for (const y of years) {
    const ks = keys.filter((k) => +k.slice(0, 4) === y);
    if (ks.length === 12) full[y] = ks.reduce((a, k) => a + m[k], 0);
    ytd[y] = ks.filter((k) => +k.slice(5) <= 9).reduce((a, k) => a + m[k], 0);
  }
  console.log(full, ytd);
  assert(full[2007] === 65828 && full[2008] === 45981 && full[2014] === 6996 && full[2025] === 42066, "ano completo: 2007 65 828; 2008 45 981; 2014 6 996; 2025 42 066");
  const minY = +Object.keys(full).reduce((p, k) => (full[k] < full[p] ? k : p));
  assert(minY === 2014, "mínimo anual em 2014");
  assert(Object.keys(full).filter((y) => +y > 2008 && +y < 2025).every((y) => full[y] < full[2025]) && full[2008] > full[2025], "2025 é o ano com mais fogos licenciados desde 2008");
  assert(r1(full[2025] / full[2014]) === 6 && Math.round((full[2025] / full[2007]) * 100) === 64, "2025 = 6,0 vezes 2014 e 64% de 2007");
  assert(ytd[2026] === 32670 && ytd[2025] === 31122 && r1((ytd[2026] / ytd[2025] - 1) * 100) === 5, "janeiro a setembro: 32 670 em 2026, 31 122 em 2025 (+5,0%)");
  assert(ytd[2008] === 37533 && years.filter((y) => y > 2008 && y < 2026).every((y) => ytd[y] < ytd[2026]) && ytd[2008] > ytd[2026], "janeiro a setembro de 2026: o valor mais alto desde 2008 (37 533)");
  assert(Math.round((1 - full[2014] / full[2008]) * 100) === 85, "entre 2008 e 2014, o licenciamento caiu 85%");
  const rows = years.map((y) => ({ cat: String(y), ytd: r2(ytd[y] / 1000), full: full[y] != null ? r2(full[y] / 1000) : null, ytdN: ytd[y], fullN: full[y] ?? null, alt: y === 2026 }));
  write("fogos-licenciados-2007-2026", {
    rows,
    views: [
      { id: "ytd", label: "Janeiro a setembro", yLabel: "Fogos licenciados em construções novas para habitação familiar, janeiro a setembro de cada ano (milhares)", unit: " mil", decimals: 1, labelEvery: 2, labelEveryNarrow: 3,
        series: [{ key: "ytd", label: "Janeiro a setembro (milhares)", color: "--accent-2", altColor: "--accent-3", altLabel: "2026 (janeiro a setembro, milhares)" }],
        tipExtra: [{ key: "full", label: "Ano completo (milhares)", suffix: " mil" }],
        notes: [{ cat: "2014", text: "2014: 5,1 mil", short: "2014: 5,1 mil" }] },
      { id: "full", label: "Ano completo", yLabel: "Fogos licenciados em construções novas para habitação familiar, por ano (milhares)", unit: " mil", decimals: 1, labelEvery: 2, labelEveryNarrow: 3,
        series: [{ key: "full", label: "Ano completo (milhares)", color: "--accent-2" }],
        notes: [{ cat: "2014", text: "2014: 7,0 mil", short: "2014: 7,0 mil" }] },
    ],
    summary: { full, ytd, minYear: minY, ratio2025_2014: r1(full[2025] / full[2014]), pct2025of2007: Math.round((full[2025] / full[2007]) * 100), ytdChange: r1((ytd[2026] / ytd[2025] - 1) * 100) },
  }, rawFiles("fogos-licenciados"));
  assert(r1(ytd[2014] / 1000) === 5.1 && r1(full[2014] / 1000) === 7, "notas: 2014 com 5,1 mil (jan.–set.) e 7,0 mil (ano)");
}

// 2. Eletricidade mundial por fonte (Ember / Energy Institute, via OWID energy-data)
{
  const f = path.join(RAW, "eletricidade-mundo", "owid-energy-data_World.csv");
  const R = csv(f).filter((r) => r.country === "World" && r.coal_electricity !== "");
  const n = (r, k) => (r[k] === "" ? null : +r[k]);
  const by = Object.fromEntries(R.map((r) => [+r.year, r]));
  const yrs = Object.keys(by).map(Number).sort((a, b) => a - b);
  assert(yrs[0] === 1985 && yrs.at(-1) === 2025 && yrs.length === 41, "41 anos, de 1985 a 2025");
  const rows = yrs.map((y) => { const r = by[y]; const sw = n(r, "solar_electricity") + n(r, "wind_electricity"); return { x: y, coal: r2(n(r, "coal_electricity")), ren: r2(n(r, "renewables_electricity")), gas: r2(n(r, "gas_electricity")), nuc: r2(n(r, "nuclear_electricity")), sw: r2(sw), total: r2(n(r, "electricity_generation")), coalSh: r2(n(r, "coal_share_elec")), renSh: r2(n(r, "renewables_share_elec")) }; });
  const g = (y) => rows.find((q) => q.x === y);
  assert(rows.every((q) => q.x === 2025 || q.ren < q.coal) && g(2025).ren > g(2025).coal, "2025 é o primeiro ano da série (desde 1985) em que as renováveis produzem mais do que o carvão");
  assert(Math.round(g(2025).ren) === 10726 && Math.round(g(2025).coal) === 10472, "2025: renováveis 10 726 TWh; carvão 10 472 TWh (valores no gráfico com duas casas, para o arredondamento coincidir)");
  assert(Math.round(g(2025).renSh * 10) / 10 === 33.8 && Math.round(g(2025).coalSh * 10) / 10 === 33, "2025: renováveis 33,8% da eletricidade; carvão 33,0%");
  const dCoal = n(by[2025], "coal_electricity") - n(by[2024], "coal_electricity");
  const dSW = n(by[2025], "solar_electricity") + n(by[2025], "wind_electricity") - n(by[2024], "solar_electricity") - n(by[2024], "wind_electricity");
  const dTot = n(by[2025], "electricity_generation") - n(by[2024], "electricity_generation");
  const dSolar = n(by[2025], "solar_electricity") - n(by[2024], "solar_electricity");
  console.log({ dCoal, dSW, dTot, dSolar });
  assert(Math.round(dCoal) === -67 && Math.round(dSW) === 840 && Math.round(dTot) === 842 && Math.round(dSolar) === 636, "2024→2025: carvão −67 TWh; solar e eólica +840 TWh (solar +636); produção total +842 TWh");
  assert(Math.round(g(2000).renSh * 10) / 10 === 18.7 && Math.round(g(2000).coalSh) === 38, "2000: renováveis 18,7%; carvão 38%");
  const coalPeak = rows.reduce((p, q) => (q.coal > p.coal ? q : p));
  assert(coalPeak.x === 2024, "o carvão atingiu o máximo em 2024");
  assert(n(by[2025], "electricity_generation") / n(by[2000], "electricity_generation") > 2 && n(by[2025], "electricity_generation") / n(by[2000], "electricity_generation") < 2.2, "a produção total mais do que duplicou entre 2000 e 2025");
  assert(rows.filter((q) => q.x < 2024).every((q) => q.coal < g(2025).coal), "o carvão produziu em 2025 mais do que em qualquer ano anterior a 2024");
  assert(g(2025).gas > g(2024).gas, "o gás subiu em 2025");
  assert(Math.abs(g(2000).coalSh / g(2000).renSh - 2) < 0.1 && n(by[2000], "hydro_electricity") / n(by[2000], "renewables_electricity") > 0.85, "2000: o carvão dava o dobro das renováveis, quase todas hídricas (>85%)");
  assert(r1(n(by[2025], "solar_electricity") / n(by[2015], "solar_electricity")) === 10.9, "a produção solar de 2025 é 10,9 vezes a de 2015");
  write("eletricidade-renovaveis-carvao-1985-2025", {
    rows,
    config: {
      x: { label: "Ano", tableLabel: "Ano", min: 1985, max: 2025, ticks: [1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025] },
      y: { label: "Produção mundial de eletricidade (TWh)", suffix: " TWh", decimals: 0, logDefault: false, linMin: 0, linMax: 12000 },
      series: [
        { key: "ren", label: "Renováveis", short: "Renováveis", color: "--accent-4", width: 2.6 },
        { key: "coal", label: "Carvão", short: "Carvão", color: "--ink", width: 2.6 },
        { key: "gas", label: "Gás", short: "Gás", color: "--accent-3", width: 1.6 },
        { key: "nuc", label: "Nuclear", short: "Nuclear", color: "--ink-3", width: 1.4 },
        { key: "sw", label: "Solar e eólica", short: "Solar+eólica", color: "--accent-2", width: 1.6 },
      ],
      labelMargin: [104, 120], shortEndLabels: true,
      scaleToggle: false, dots: false,
      annotations: [{ x: 2025, key: "ren", text: "2025: renováveis passam o carvão", short: "2025", anchor: "end", dx: -8, dy: -12, strong: false }],
      howToRead: "Cada linha é a eletricidade produzida no mundo por uma fonte, em terawatts-hora por ano. As renováveis incluem a hídrica, a eólica, a solar, a bioenergia e outras; a linha «Solar e eólica» é uma parte das renováveis, não uma série à parte.",
    },
    summary: { y2025: g(2025), y2024: g(2024), y2000: g(2000), dCoal: r1(dCoal), dSW: r1(dSW), dTot: r1(dTot), dSolar: r1(dSolar), coalPeak: coalPeak.x },
  }, rawFiles("eletricidade-mundo"));
}

// 3. Ajuda pública ao desenvolvimento (OCDE DAC1): membros do CAD, % do RNB 2024 → 2025
{
  const f = path.join(RAW, "apd-ocde", "oecd_DAC1_ODA_grant_equivalent_2015_2025.csv");
  const R = csv(f);
  const V = {};
  for (const r of R) if (r.OBS_VALUE !== "") V[[r.DONOR, r.MEASURE, r.UNIT_MEASURE, r.PRICE_BASE, r.TIME_PERIOD].join("|")] = +r.OBS_VALUE;
  const v = (d, me, u, p, t) => V[[d, me, u, p, t].join("|")];
  const NOMES = { AUS: "Austrália", AUT: "Áustria", BEL: "Bélgica", CAN: "Canadá", CZE: "Chéquia", DNK: "Dinamarca", EST: "Estónia", FIN: "Finlândia", FRA: "França", DEU: "Alemanha", GRC: "Grécia", HUN: "Hungria", ISL: "Islândia", IRL: "Irlanda", ITA: "Itália", JPN: "Japão", KOR: "Coreia do Sul", LVA: "Letónia", LTU: "Lituânia", LUX: "Luxemburgo", NLD: "Países Baixos", NZL: "Nova Zelândia", NOR: "Noruega", POL: "Polónia", PRT: "Portugal", ROU: "Roménia", SVK: "Eslováquia", SVN: "Eslovénia", ESP: "Espanha", SWE: "Suécia", CHE: "Suíça", GBR: "Reino Unido", USA: "Estados Unidos" };
  const mem = Object.keys(NOMES);
  const sum25 = mem.reduce((a, d) => a + (v(d, "11010", "USD", "V", "2025") || 0), 0);
  assert(Math.abs(sum25 - v("DAC", "11010", "USD", "V", "2025")) < 0.5, "os 33 países somam o total do CAD de 2025 (174 301,55 milhões de dólares correntes)");
  const tot24 = v("DAC", "11010", "USD", "Q", "2024"), tot25 = v("DAC", "11010", "USD", "Q", "2025");
  const chg = (tot25 / tot24 - 1) * 100;
  assert(r1(chg) === -23.1, "APD total do CAD: −23,1% em termos reais (preços de 2024)");
  assert(r1(tot24 / 1000) === 215.1 && r1(tot25 / 1000) === 165.5 && r1(v("DAC", "11010", "USD", "V", "2025") / 1000) === 174.3, "215,1 → 165,5 mil milhões de dólares de 2024; 174,3 mil milhões a preços correntes");
  const realQ = ["2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025"].map((t) => v("DAC", "11010", "USD", "Q", t));
  assert(realQ.every((x, i) => i === 7 || x > tot25), "2025 é o valor real mais baixo desde 2018 (início da série em equivalente-subvenção)");
  assert(v("DAC", "11002", "PT_B5G", "V", "2024") === 0.34 && v("DAC", "11002", "PT_B5G", "V", "2025") === 0.26, "rácio APD/RNB do CAD: 0,34% → 0,26%");
  const us = (v("USA", "11010", "USD", "Q", "2025") / v("USA", "11010", "USD", "Q", "2024") - 1) * 100;
  assert(Math.round(us) === -57 && v("USA", "11002", "PT_B5G", "V", "2025") === 0.09, "Estados Unidos: −57% em termos reais; 0,09% do RNB em 2025");
  const usShare = (v("USA", "11010", "USD", "Q", "2024") - v("USA", "11010", "USD", "Q", "2025")) / (tot24 - tot25) * 100;
  assert(Math.round(usShare) === 75, "os EUA explicam 75% da descida total do CAD em termos reais");
  const pt = (v("PRT", "11010", "USD", "Q", "2025") / v("PRT", "11010", "USD", "Q", "2024") - 1) * 100;
  assert(Math.round(pt) === -15 && v("PRT", "11002", "PT_B5G", "V", "2024") === 0.22 && v("PRT", "11002", "PT_B5G", "V", "2025") === 0.19, "Portugal: −15% em termos reais; 0,22% → 0,19% do RNB");
  const cutReal = mem.filter((d) => v(d, "11010", "USD", "Q", "2025") < v(d, "11010", "USD", "Q", "2024"));
  const cutRatio = mem.filter((d) => v(d, "11002", "PT_B5G", "V", "2025") < v(d, "11002", "PT_B5G", "V", "2024"));
  console.log("cortes reais:", cutReal.length, "rácio:", cutRatio.length);
  assert(cutReal.length === 25 && cutRatio.length === 26, "25 dos 33 países do CAD cortaram a APD em termos reais; 26 baixaram o rácio");
  const above07 = (t) => mem.filter((d) => v(d, "11002", "PT_B5G", "V", t) >= 0.7).map((d) => NOMES[d]);
  assert(above07("2025").join() === "Dinamarca,Luxemburgo,Noruega,Suécia" && above07("2024").length === 4, "só Dinamarca, Luxemburgo, Noruega e Suécia cumprem os 0,7% (em 2024 e em 2025)");
  assert(["DEU", "GBR", "FRA"].every((d) => v(d, "11002", "PT_B5G", "V", "2025") < v(d, "11002", "PT_B5G", "V", "2024")), "Alemanha, Reino Unido e França baixaram o rácio APD/RNB");
  const de = (v("DEU", "11010", "USD", "V", "2025"));
  assert(r1(de / 1000) === 29.1 && mem.every((d) => d === "DEU" || v(d, "11010", "USD", "V", "2025") < de), "a Alemanha passou a ser o maior doador (29,1 mil milhões de dólares correntes)");
  const ptRank = [...mem].sort((a, b) => v(b, "11002", "PT_B5G", "V", "2025") - v(a, "11002", "PT_B5G", "V", "2025")).indexOf("PRT") + 1;
  const ptBelow = mem.filter((d) => v(d, "11002", "PT_B5G", "V", "2025") < 0.19).length;
  console.log("Portugal, posição:", ptRank, "abaixo:", ptBelow);
  assert(ptBelow === 9, "em 2025, nove países do CAD ficaram abaixo de Portugal (0,19%)");
  const rows = mem.map((d) => ({ label: NOMES[d], a: v(d, "11002", "PT_B5G", "V", "2024"), b: v(d, "11002", "PT_B5G", "V", "2025"), ...(d === "PRT" ? { highlight: true } : {}), realChange: r1((v(d, "11010", "USD", "Q", "2025") / v(d, "11010", "USD", "Q", "2024") - 1) * 100) }));
  rows.push({ label: "Total do CAD", a: 0.34, b: 0.26, realChange: r1(chg) });
  write("ajuda-desenvolvimento-cad-2024-2025", {
    rows,
    config: {
      aLabel: "2024", bLabel: "2025", ref: 0.7, refLabel: "Meta da ONU: 0,7% do RNB", unit: "%", decimals: 2, domain: [0, 1.1],
      howToRead: "Cada linha é um país membro do Comité de Ajuda ao Desenvolvimento da OCDE: vai da ajuda pública ao desenvolvimento em percentagem do rendimento nacional bruto em 2024 (ponto cinzento) à de 2025 (ponto azul). Quando o ponto azul está à esquerda do cinzento, o país deu menos. A linha tracejada é a meta de 0,7% definida na ONU. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por valor em 2025"], ["delta", "Por variação"]],
    },
    summary: { tot24: r1(tot24 / 1000), tot25: r1(tot25 / 1000), chg: r1(chg), us: r1(us), usShare: Math.round(usShare), pt: r1(pt), cutReal: cutReal.length, cutRatio: cutRatio.length, above07: above07("2025"), ptBelow },
  }, rawFiles("apd-ocde"));
}

// 4. IA generativa por idade (Eurostat isoc_ai_iaiu, 2025, UE-27)
{
  const f = path.join(RAW, "ia-generativa", "eurostat_isoc_ai_iaiu.json");
  const E = jstat(f);
  const val = (geo, ind) => E.v({ freq: "A", ind_type: ind, indic_is: "I_IUAI", unit: "PC_IND", geo, time: "2025" });
  const NOMES = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };
  const eu = Object.keys(NOMES);
  assert(eu.length === 27 && eu.every((g) => val(g, "Y16_24") != null && val(g, "Y65_74") != null && val(g, "IND_TOTAL") != null), "27 países da UE com valores para 16–24, 65–74 e 16–74 anos");
  const rows = eu.map((g) => ({ label: NOMES[g], a: r1(val(g, "Y65_74")), b: r1(val(g, "Y16_24")), c: r1(val(g, "IND_TOTAL")), ...(g === "PT" ? { highlight: true } : {}), gap: val(g, "Y16_24") - val(g, "Y65_74") }));
  rows.push({ label: "UE-27", a: r1(val("EU27_2020", "Y65_74")), b: r1(val("EU27_2020", "Y16_24")), c: r1(val("EU27_2020", "IND_TOTAL")), gap: val("EU27_2020", "Y16_24") - val("EU27_2020", "Y65_74") });
  const pt = rows.find((q) => q.label === "Portugal"), ue = rows.at(-1);
  assert(pt.b === 76.5 && pt.a === 5.8 && pt.c === 38.7, "Portugal: 76,5% (16–24), 5,8% (65–74), 38,7% (16–74)");
  assert(ue.b === 63.8 && ue.a === 6.5 && ue.c === 32.7, "UE-27: 63,8% (16–24), 6,5% (65–74), 32,7% (16–74)");
  const byGap = rows.slice(0, 27).sort((p, q) => q.gap - p.gap).map((q) => q.label);
  const ptGapRank = byGap.indexOf("Portugal") + 1;
  console.log("fosso:", byGap.slice(0, 10), "Portugal:", ptGapRank, r1(val("PT", "Y16_24") - val("PT", "Y65_74")), r1(ue.gap));
  assert(r1(val("PT", "Y16_24") - val("PT", "Y65_74")) === 70.8 && r1(ue.gap) === 57.3, "fosso entre gerações: 70,8 pontos em Portugal, 57,3 na UE");
  assert(ptGapRank === 4, "Portugal tem o 4.º maior fosso entre 16–24 e 65–74 anos na UE");
  const ratio = (g) => val(g, "Y16_24") / val(g, "Y65_74");
  assert(Math.round(ratio("PT")) === 13 && Math.round(ratio("EU27_2020")) === 10, "em Portugal, os jovens usam 13 vezes mais do que os de 65–74 (10 vezes na UE)");
  const ptTotRank = [...eu].sort((p, q) => val(q, "IND_TOTAL") - val(p, "IND_TOTAL")).indexOf("PT") + 1;
  assert(ptTotRank === 13, "Portugal é o 13.º país da UE em utilização total (16–74 anos)");
  const ptYoungRank = [...eu].sort((p, q) => val(q, "Y16_24") - val(p, "Y16_24")).indexOf("PT") + 1;
  console.log("posição jovens:", ptYoungRank);
  assert(ptYoungRank === 5, "Portugal é o 5.º país da UE na utilização entre os 16 e os 24 anos");
  const ptOldRank = [...eu].sort((p, q) => val(q, "Y65_74") - val(p, "Y65_74")).indexOf("PT") + 1;
  console.log("posição 65–74:", ptOldRank);
  assert(ptOldRank === 18, "Portugal é o 18.º país da UE na utilização entre os 65 e os 74 anos");
  const hi = r1(val("PT", "Y25_64HI")), lo = r1(val("PT", "Y25_64LO"));
  assert(hi === 66.1 && lo === 11.9 && r1(val("EU27_2020", "Y25_64HI")) === 51.6 && r1(val("EU27_2020", "Y25_64LO")) === 13.3, "25–64 anos: ensino superior 66,1% e escolaridade baixa 11,9% em Portugal (UE: 51,6% e 13,3%)");
  assert(Math.round(100 / val("PT", "Y65_74")) === 17, "65–74 anos em Portugal: cerca de um em cada 17");
  for (const q of rows) delete q.gap;
  write("ia-generativa-idade-ue-2025", {
    rows,
    config: {
      aLabel: "65 a 74 anos", bLabel: "16 a 24 anos", cLabel: "16 a 74 anos (todos)", ref: r1(val("EU27_2020", "IND_TOTAL")), refLabel: "UE, 16 a 74 anos: 32,7%", unit: "%", decimals: 1, domain: [0, 100],
      howToRead: "Cada linha é um país da UE: vai da percentagem de pessoas entre os 65 e os 74 anos que usaram uma ferramenta de IA generativa nos últimos três meses (ponto cinzento) à dos jovens dos 16 aos 24 anos (ponto azul). O anel marca o valor para toda a população dos 16 aos 74 anos. Quanto mais comprida a linha, maior a diferença entre gerações. Portugal aparece destacado a terracota.",
      sorts: [["delta", "Por diferença entre idades"], ["b", "Por valor entre os jovens"]],
    },
    summary: { pt, ue, ptGapRank, ptTotRank, ptYoungRank, ptOldRank, ptHi: hi, ptLo: lo },
  }, rawFiles("ia-generativa"));
}

// 5. Horas de trabalho por semana, 1870–1990 (Huberman e Minns, 2007, via OWID)
{
  const f = path.join(RAW, "horas-trabalho", "owid_huberman_minns_2007.csv");
  const R = csv(f);
  const K = "Hours of work per week (total) (Huberman and Minns (2007))";
  const H = {};
  for (const r of R) if (r[K] !== "") (H[r.Entity] ??= {})[+r.Year] = +r[K];
  const yrs = [1870, 1880, 1890, 1900, 1913, 1929, 1938, 1950, 1960, 1970, 1980, 1990];
  const EU = ["Belgium", "Denmark", "France", "Germany", "Ireland", "Italy", "Netherlands", "Spain", "Sweden", "Switzerland", "United Kingdom"];
  for (const y of yrs) { const xs = EU.map((c) => H[c][y]).filter((x) => x != null); assert(Math.abs(xs.reduce((a, b) => a + b, 0) / xs.length - H["Old World"][y]) < 0.16, `${y}: «Old World» = média simples de ${xs.length} países europeus`); }
  assert(EU.every((c) => H[c][2000] == null), "2000: sem valor total (só homens) nos países europeus — fica de fora");
  assert(Object.keys(H).filter((e) => !/World/.test(e)).length === 14, "14 países no conjunto de dados");
  const ow = H["Old World"], nw = H["New World"];
  const rows = yrs.map((y) => ({ x: y, eu: r1(ow[y]), nw: r1(nw[y]), be: H.Belgium[y] != null ? r1(H.Belgium[y]) : null, uk: r1(H["United Kingdom"][y]), us: r1(H["United States"][y]) }));
  const g = (y) => rows.find((q) => q.x === y);
  assert(g(1870).eu === 65.9 && g(1913).eu === 57.9 && g(1929).eu === 47.8 && g(1990).eu === 38.7, "Europa: 65,9 h (1870), 57,9 (1913), 47,8 (1929), 38,7 (1990)");
  assert(r1(ow[1913] - ow[1929]) === 10.1 && r1(ow[1870] - ow[1913]) === 8 && r1(ow[1929] - ow[1990]) === 9.1, "Europa: −10,1 h entre 1913 e 1929; −8,0 entre 1870 e 1913; −9,1 entre 1929 e 1990");
  assert(g(1870).nw === 58.5 && g(1990).nw === 39.4 && r1(ow[1870] - nw[1870]) === 7.4 && g(1990).eu < g(1990).nw, "1870: a Europa trabalhava mais 7,4 h do que o Novo Mundo (58,5 h); em 1990 já trabalhava menos (38,7 contra 39,4)");
  assert(g(1870).be === 72.2 && g(1990).be === 36.6, "Bélgica: 72,2 h em 1870; 36,6 em 1990");
  assert(g(1929).us === 48 && g(1938).us === 37.3 && g(1950).us === 42.4, "EUA: 48 h (1929), 37,3 (1938), 42,4 (1950)");
  write("horas-trabalho-semana-1870-1990", {
    rows,
    config: {
      x: { label: "Ano", tableLabel: "Ano", min: 1870, max: 1990, ticks: [1870, 1890, 1913, 1929, 1950, 1970, 1990] },
      y: { label: "Horas de trabalho por semana — eixo a partir de 30 (trabalhadores a tempo inteiro)", suffix: " h", decimals: 1, logDefault: false, linMin: 30, linMax: 75 },
      series: [
        { key: "eu", label: "Europa (média de 11 países)", short: "Europa", color: "--accent-2", width: 2.8 },
        { key: "nw", label: "EUA, Canadá e Austrália", short: "EUA/Can./Aus.", color: "--accent-3", width: 2.4 },
        { key: "be", label: "Bélgica", short: "Bélgica", color: "--muted", width: 1.3 },
        { key: "uk", label: "Reino Unido", short: "R. Unido", color: "--muted", width: 1.3 },
        { key: "us", label: "Estados Unidos", short: "EUA", color: "--muted", width: 1.3 },
      ],
      labelMargin: [104, 110], shortEndLabels: true, gaps: true,
      scaleToggle: false, dots: true,
      shade: [{ from: 1913, to: 1929, label: "1913–1929: −10 h na Europa", short: "−10 h", exact: true, top: true }],
      annotations: [{ x: 1870, key: "be", text: "Bélgica, 1870: 72,2 h", short: "72,2 h", anchor: "start", dx: 8, dy: 4 }],
      howToRead: "Cada linha liga estimativas das horas semanais de trabalho de quem trabalha a tempo inteiro, em anos de referência (os pontos), com intervalos desiguais. A escala começa nas 30 horas. As linhas cinzentas são três países mostrados em separado; a faixa marca 1913–1929.",
    },
    summary: { ow, nw, d1913_1929: r1(ow[1913] - ow[1929]), d1870_1913: r1(ow[1870] - ow[1913]), d1929_1990: r1(ow[1929] - ow[1990]) },
  }, rawFiles("horas-trabalho"));
}

if (fails) { console.error(`\n${fails} verificação(ões) falharam.`); process.exit(1); }
console.log("\nTodas as verificações passaram.");
