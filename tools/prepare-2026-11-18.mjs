// Transformação reprodutível dos dados brutos da edição de 2026-11-18.
// Uso: node tools/prepare-2026-11-18.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, columns, bars — ver assets/js/charts.js.
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
function ine(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"))[0];
  return { j, D: j.Dados };
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
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const pct = (a, b) => (b / a - 1) * 100;

// 1. Comboios: passageiros transportados por tipo de tráfego (INE 0000901, mensal desde 2004)
{
  const { j, D } = ine(path.join(RAW, "comboios-passe", "ine_0000901.json"));
  const g = (y, m, t) => { const x = D[`${MESES[m]} de ${y}`]?.find((q) => q.geocod === "PT" && q.dim_3 === t); return x && x.valor != null ? +x.valor : null; };
  const months = [];
  for (let y = 2004; y <= 2026; y++) for (let m = 0; m < 12; m++) if (g(y, m, "T") != null) months.push([y, m]);
  assert(months.length === 272 && months[0].join() === "2004,0" && months.at(-1).join() === "2026,7", "272 meses, de janeiro de 2004 a agosto de 2026");
  const incoh = months.filter(([y, m]) => Math.abs(g(y, m, "1") + g(y, m, "2") + g(y, m, "3") - g(y, m, "T")) > 3).map(([y, m]) => `${y}-${m + 1}`);
  assert(incoh.join() === "2021-4,2021-5,2021-6", "a soma dos três tipos coincide com o total (±3 mil) em todos os meses menos abril, maio e junho de 2021, em que o total do INE excede a soma em 188 a 228 mil (registado nas notas)");
  // soma móvel de 12 meses, em milhões de passageiros
  const roll = (i, t) => { let s = 0; for (let k = i - 11; k <= i; k++) s += g(months[k][0], months[k][1], t); return s / 1000; };
  const rows = [];
  for (let i = 11; i < months.length; i++) {
    const [y, m] = months[i];
    rows.push({ x: r2(y + (m + 1) / 12 - 1 / 24), label: `12 meses até ${MES[m]} ${y}`, nac: r2(roll(i, "2")), sub: r2(roll(i, "1")) });
  }
  const year = (y, t, upTo = 11) => { let s = 0; for (let m = 0; m <= upTo; m++) s += g(y, m, t); return s; };
  const s = {
    nac2019: year(2019, "2"), nac2023: year(2023, "2"), nac2024: year(2024, "2"), nac2025: year(2025, "2"),
    nac8_2024: year(2024, "2", 7), nac8_2025: year(2025, "2", 7), nac8_2026: year(2026, "2", 7),
    sub2018: year(2018, "1"), sub2019: year(2019, "1"), sub2025: year(2025, "1"),
    tot2019: year(2019, "T"), tot2025: year(2025, "T"),
    nacSep24: g(2024, 8, "2"), nacOct24: g(2024, 9, "2"), nacNov24: g(2024, 10, "2"), nacOct23: g(2023, 9, "2"), nacNov23: g(2023, 10, "2"),
    rollLast: rows.at(-1).nac, rollSep24: rows.find((q) => q.label === "12 meses até set. 2024").nac,
  };
  console.log(s);
  // números citados (milhares de passageiros na fonte)
  assert(s.nac2024 === 20927 && s.nac2025 === 39402 && r1(pct(s.nac2024, s.nac2025)) === 88.3, "tráfego nacional: 20,9 milhões em 2024, 39,4 milhões em 2025 (+88,3%)");
  assert(s.nac2019 === 16808 && s.nac2023 === 16049, "tráfego nacional: 16,8 milhões em 2019 e 16,0 milhões em 2023");
  assert(Object.keys(D).filter((k) => /de 20(0[4-9]|1\d|2[0-4])$/.test(k)).length === 21 * 12 && [...Array(21)].every((_, i) => year(2004 + i, "2") < 21000), "de 2004 a 2024, o tráfego nacional nunca chegou a 21 milhões num ano");
  assert(s.nac8_2026 === 28292 && s.nac8_2025 === 25434 && r1(pct(s.nac8_2025, s.nac8_2026)) === 11.2, "janeiro a agosto de 2026: 28,3 milhões, mais 11,2% do que em 2025");
  assert(s.nac8_2024 === 12431 && r1(s.nac8_2026 / s.nac8_2024) === 2.3, "janeiro a agosto de 2024: 12,4 milhões; 2026 é 2,3 vezes 2024");
  assert(s.nacOct23 === 1621 && s.nacOct24 === 1986 && s.nacNov23 === 1422 && s.nacNov24 === 2402 && r1(pct(1422, 2402)) === 68.9, "outubro de 2024: 1,99 milhões (1,62 em 2023); novembro de 2024, primeiro mês completo do passe: 2,40 milhões (+68,9% face a 1,42 em 2023)");
  assert(s.sub2018 === 131277 && s.sub2019 === 161645 && r1(pct(s.sub2018, s.sub2019)) === 23.1, "suburbano: 131,3 milhões em 2018, 161,6 milhões em 2019 (+23,1%)");
  assert(s.sub2025 === 200480, "suburbano: 200,5 milhões em 2025");
  assert(s.tot2025 === 239982 && r1(s.tot2025 / 1000) === 240, "total: 240,0 milhões de passageiros em 2025");
  assert(r1(s.rollSep24) === 18.6 && r1(s.rollLast) === 42.3, "soma de 12 meses do tráfego nacional: 18,6 milhões até set. 2024, 42,3 milhões até ago. 2026");
  write("comboios-passe-ferroviario-2004-2026", {
    rows,
    config: {
      x: { min: 2004.9, max: 2026.75, ticks: [2005, 2008, 2011, 2014, 2017, 2020, 2023, 2026], tableLabel: "Período" },
      y: { label: "Passageiros em 12 meses (milhões)", suffix: " milhões", decimals: 1, linMin: 0, linMax: 220, logDefault: false, logMin: 5, logMax: 250 },
      scaleToggle: true,
      series: [
        { key: "sub", label: "Tráfego suburbano", short: "Suburb.", color: "--ink-3", width: 1.6 },
        { key: "nac", label: "Tráfego nacional (fora dos suburbanos)", short: "Nac.", color: "--accent-2", width: 2.6 },
      ],
      labelMargin: [74, 92],
      shortEndLabels: true,
      shade: [{ from: 2020.17, to: 2022.25, exact: true, label: "Pandemia", short: "Pandemia", top: true }],
      annotations: [
        { x: rows.find((q) => q.label === "12 meses até abr. 2019").x, key: "sub", text: "Abr. 2019: passes metropolitanos mais baratos", short: "Passes 2019", dx: -6, dy: -12, anchor: "end", linOnly: true },
        { x: rows.find((q) => q.label === "12 meses até out. 2024").x, key: "nac", text: "Out. 2024: Passe Ferroviário Verde (20 €)", short: "Passe 20 €", dx: -6, dy: -14, anchor: "end", strong: true },
      ],
      howToRead: "Cada ponto soma os passageiros dos 12 meses anteriores, para tirar o efeito das estações do ano. Os botões alternam entre a escala linear e a logarítmica; na logarítmica, a mesma distância vertical corresponde à mesma variação percentual, o que permite comparar as duas linhas apesar da diferença de tamanho.",
    },
    summary: s,
  }, rawFiles("comboios-passe"));
}

// 2. Multibanco: levantamentos e compras em terminais (INE/SIBS 0012845, 0012846, 0012847)
{
  const W = ine(path.join(RAW, "multibanco-cartoes", "ine_0012845.json")).D;
  const WV = ine(path.join(RAW, "multibanco-cartoes", "ine_0012846.json")).D;
  const P = ine(path.join(RAW, "multibanco-cartoes", "ine_0012847.json")).D;
  const PV = ine(path.join(RAW, "multibanco-cartoes", "ine_0012103.json")).D;
  const g = (D, y, m, d) => { const x = D[`${MESES[m]} de ${y}`]?.find((q) => q.geocod === "PT" && q.dim_3 === d); return x && x.valor != null ? +x.valor : null; };
  assert([W, WV, P].every((D) => Object.keys(D).length === 82 && D["Janeiro de 2020"] && D["Outubro de 2026"]), "três séries mensais com 82 meses, de janeiro de 2020 a outubro de 2026");
  assert([2020, 2021, 2022, 2023, 2024, 2025, 2026].every((y) => [...Array(10)].every((_, m) => g(W, y, m, "1") + g(W, y, m, "2") === g(W, y, m, "T") && g(P, y, m, "1") + g(P, y, m, "2") === g(P, y, m, "T"))), "nacional + estrangeiro = total (levantamentos) e presenciais + online = total (compras), janeiro a outubro de cada ano");
  const rows = [];
  for (let y = 2020; y <= 2026; y++) {
    let w = 0, p = 0, on = 0, wv = 0, pv = 0;
    for (let m = 0; m < 10; m++) { w += g(W, y, m, "T"); p += g(P, y, m, "T"); on += g(P, y, m, "2"); wv += g(WV, y, m, "T"); pv += g(PV, y, m, "T"); }
    rows.push({ cat: String(y), alt: y <= 2021, ratio: r2(p / w), lev: r1(w / 1e6), comp: r1(p / 1e6), online: r1((on / p) * 100), levEur: r2(wv / 1e9), compEur: r2(pv / 1e9), ticket: r2(pv / p) });
  }
  const R = Object.fromEntries(rows.map((q) => [q.cat, q]));
  console.log(rows);
  assert(R["2022"].ratio === 4.5 && R["2026"].ratio === 8.77, "compras por levantamento, janeiro a outubro: 4,50 em 2022, 8,77 em 2026");
  assert(R["2020"].ratio === 3.24 && R["2021"].ratio === 3.72, "2020: 3,24; 2021: 3,72 (anos de pandemia)");
  assert(rows.every((q, i) => i === 0 || q.ratio > rows[i - 1].ratio), "o rácio subiu todos os anos desde 2020");
  assert(R["2026"].lev === 275.3 && rows.every((q) => q.cat === "2026" || q.lev > 275.3), "2026: 275,3 milhões de levantamentos de janeiro a outubro, o valor mais baixo da série (incluindo 2020)");
  assert(R["2023"].lev === 323.8 && r1(pct(323.8, 275.3)) === -15, "levantamentos: 323,8 milhões em 2023 (máximo), menos 15% em 2026");
  assert(R["2022"].comp === 1445.1 && R["2026"].comp === 2415.7 && r1(pct(1445.1, 2415.7)) === 67.2, "compras: 1 445,1 milhões em 2022, 2 415,7 milhões em 2026 (+67,2%)");
  assert(R["2020"].online === 1.5 && R["2026"].online === 7.5, "compras online: 1,5% das compras em 2020, 7,5% em 2026");
  assert(R["2023"].levEur === 25.2 && R["2026"].levEur === 22.59, "valor levantado, janeiro a outubro: 25,20 mil milhões de euros em 2023, 22,59 em 2026");
  assert(R["2022"].compEur === 51.96 && R["2026"].compEur === 75.63 && r1(pct(51.96, 75.63)) === 45.6, "valor das compras, janeiro a outubro: 51,96 mil milhões de euros em 2022, 75,63 em 2026 (+45,6%)");
  assert(R["2022"].ticket === 35.96 && R["2026"].ticket === 31.31, "valor médio por compra: 35,96 euros em 2022, 31,31 euros em 2026");
  write("multibanco-levantamentos-compras-2020-2026", {
    rows,
    views: [
      { id: "ratio", label: "Compras por levantamento", yLabel: "Compras em terminais de pagamento por cada levantamento no Multibanco, janeiro a outubro de cada ano", unit: "", decimals: 2, valueLabels: true,
        series: [{ key: "ratio", label: "Compras por levantamento", color: "--accent-2", altColor: "--muted", altLabel: "Anos de pandemia (2020 e 2021)" }] },
      { id: "lev", label: "Levantamentos", yLabel: "Levantamentos no Multibanco, janeiro a outubro de cada ano (milhões)", unit: " milhões", decimals: 1, valueLabels: true,
        series: [{ key: "lev", label: "Levantamentos (milhões)", color: "--accent-3", altColor: "--muted", altLabel: "Anos de pandemia (2020 e 2021)" }] },
      { id: "comp", label: "Compras com cartão", yLabel: "Compras em terminais de pagamento automático, janeiro a outubro de cada ano (milhões)", unit: " milhões", decimals: 1, valueLabels: true,
        series: [{ key: "comp", label: "Compras (milhões)", color: "--accent-2", altColor: "--muted", altLabel: "Anos de pandemia (2020 e 2021)" }] },
    ],
    summary: { rows: R },
  }, rawFiles("multibanco-cartoes"));
}

// 3. Baleias caçadas no século XX (Rocha, Clapham e Ivashchenko 2014; CBI depois de 2000; compilação da OWID)
{
  const all = csv(path.join(RAW, "baleias-seculo-xx", "owid_whale_catch_rocha_iwc.csv"));
  const K = (sp) => `${sp} (Rocha et al.; IWC)`;
  const n = (q, sp) => (q[K(sp)] === "" || q[K(sp)] == null ? 0 : +q[K(sp)]);
  const world = all.filter((q) => q.Entity === "World").sort((a, b) => a.Year - b.Year);
  assert(world.length === 119 && world[0].Year === "1900" && world.at(-1).Year === "2018", "série mundial com 119 anos, de 1900 a 2018");
  const SP = ["Blue whale", "Fin whale", "Sperm whale", "Humpback whale", "Sei whale", "Bryde's whale", "Minke whale", "Gray whale", "Right whale", "Unspecified/Other"];
  assert(world.every((q) => SP.reduce((a, sp) => a + n(q, sp), 0) + (+q.Year >= 1989 ? n(q, "Bowhead whale") : 0) === n(q, "All whale species")), "em todos os anos, a soma das categorias é igual ao total (desde 1989, o total inclui a baleia-da-gronelândia)");
  const hemi = all.filter((q) => q.Entity !== "World");
  const sumH = hemi.reduce((a, q) => a + n(q, "All whale species"), 0);
  const sumW20 = world.filter((q) => +q.Year <= 1999).reduce((a, q) => a + n(q, "All whale species"), 0);
  const sumS = hemi.filter((q) => q.Entity === "Southern Hemisphere").reduce((a, q) => a + n(q, "All whale species"), 0);
  const rows = world.map((q) => {
    const blue = n(q, "Blue whale"), fin = n(q, "Fin whale"), sperm = n(q, "Sperm whale"), sei = n(q, "Sei whale"), minke = n(q, "Minke whale");
    const tot = n(q, "All whale species");
    return { cat: q.Year, blue, fin, sperm, sei, minke, other: tot - blue - fin - sperm - sei - minke, tot };
  });
  const R = Object.fromEntries(rows.map((q) => [q.cat, q]));
  const peak = rows.reduce((a, q) => (q.tot > a.tot ? q : a));
  const bluePeak = rows.reduce((a, q) => (q.blue > a.blue ? q : a));
  const dec = (d) => rows.filter((q) => +q.cat >= d && +q.cat < d + 10).reduce((a, q) => a + q.tot, 0);
  const s = { sumW20, sumH, sumS, peak: peak.cat, peakV: peak.tot, bluePeak: bluePeak.cat, bluePeakV: bluePeak.blue, d1950: dec(1950), d1960: dec(1960),
    blue20: rows.filter((q) => +q.cat <= 1999).reduce((a, q) => a + q.blue, 0), fin20: rows.filter((q) => +q.cat <= 1999).reduce((a, q) => a + q.fin, 0), sperm20: rows.filter((q) => +q.cat <= 1999).reduce((a, q) => a + q.sperm, 0),
    max2000: Math.max(...rows.filter((q) => +q.cat >= 2000).map((q) => q.tot)), max2000y: rows.filter((q) => +q.cat >= 2000).reduce((a, q) => (q.tot > a.tot ? q : a)).cat, v2018: R["2018"].tot,
    blue1965: R["1965"].blue, after1987: rows.filter((q) => +q.cat >= 1987).every((q) => q.tot < 3000) };
  const decSp = {};
  for (const k of ["blue", "fin", "sperm", "sei", "minke"]) { const by = {}; for (const q of rows) { const d = Math.floor(+q.cat / 10) * 10; by[d] = (by[d] || 0) + q[k]; } decSp[k] = +Object.entries(by).sort((a, b) => b[1] - a[1])[0][0]; }
  s.decSp = decSp;
  console.log(s);
  assert(decSp.blue === 1930 && decSp.fin === 1950 && decSp.sperm === 1960 && decSp.sei === 1960 && decSp.minke === 1970, "década com mais capturas: azul 1930, comum 1950, cachalote 1960, sardinheira 1960, anã 1970");
  assert(sumH === 2883164, "soma dos dois hemisférios, 1900–1999: 2 883 164 baleias (≈ 2,9 milhões)");
  assert(Math.abs(sumW20 - sumH) / sumH < 0.001, "a série mundial 1900–1999 difere menos de 0,1% da soma dos hemisférios");
  assert(sumW20 === 2883703 && r1((s.sumS / sumH) * 100) === 71.2, "série mundial 1900–1999: 2 883 703; 71,2% das capturas no hemisfério Sul");
  assert(s.peak === "1964" && s.peakV === 82194, "máximo: 1964, 82 194 baleias");
  assert(r1(((s.d1950 + s.d1960) / sumW20) * 100) === 45.6, "as décadas de 1950 e 1960 somam 45,6% das capturas do século");
  assert(s.bluePeak === "1930" && s.bluePeakV === 30727, "máximo da baleia-azul: 1930, 30 727");
  assert(s.blue20 === 379185 && r1((s.blue20 / sumW20) * 100) === 13.1, "baleias-azuis no século XX: 379 185 (13,1% do total)");
  assert(s.fin20 === 874068 && s.sperm20 === 755908, "baleias-comuns: 874 068; cachalotes: 755 908");
  assert(s.blue1965 === 1756 && R["1966"].blue === 726, "baleias-azuis: 1 756 em 1965, 726 em 1966");
  assert(s.max2000 === 2314 && s.max2000y === "2005", "desde 2000, o máximo anual foi 2 314 (2005)");
  assert(s.v2018 === 1576, "2018: 1 576 baleias");
  write("baleias-cacadas-1900-2018", {
    rows,
    views: [
      { id: "esp", label: "Por espécie", yLabel: "Grandes baleias mortas por ano no mundo, por espécie", unit: " baleias", decimals: 0, labelEvery: 10, labelEveryNarrow: 20, yMax: 90000, marginLeft: [46, 54],
        series: [
          { key: "other", label: "Outras (bossa, Bryde, cinzenta, franca, gronelândia, não identificadas)", color: "--muted" },
          { key: "minke", label: "Baleia-anã", color: "--accent-4" },
          { key: "sei", label: "Baleia-sardinheira", color: "--accent-3" },
          { key: "sperm", label: "Cachalote", color: "--ink-3" },
          { key: "fin", label: "Baleia-comum", color: "--ink-2" },
          { key: "blue", label: "Baleia-azul", color: "--accent-2" },
        ],
        tipExtra: [{ key: "tot", label: "Total", suffix: "" }],
        notes: [{ cat: "1930", text: "1930: 30 727 baleias-azuis", short: "1930" }, { cat: "1964", text: "1964: 82 194 baleias", short: "1964" }, { cat: "1986", text: "1986: moratória comercial", short: "1986" }] },
      { id: "azul", label: "Só a baleia-azul", yLabel: "Baleias-azuis mortas por ano no mundo", unit: " baleias", decimals: 0, labelEvery: 10, labelEveryNarrow: 20, marginLeft: [46, 54],
        series: [{ key: "blue", label: "Baleia-azul", color: "--accent-2" }],
        notes: [{ cat: "1930", text: "1930: 30 727", short: "1930" }, { cat: "1966", text: "1966: proteção pela CBI", short: "1966" }] },
    ],
    summary: s,
  }, rawFiles("baleias-seculo-xx"));
}

// 4. PISA: alunos de 15 anos abaixo do nível mínimo (Eurostat educ_outc_pisa)
{
  const E = jstat(path.join(RAW, "pisa-abaixo-minimo", "eurostat_educ_outc_pisa.json"));
  const v = (f, g, t, lv = "LOW") => E.v({ freq: "A", levels: lv, field: f, sex: "T", unit: "PC", geo: g, time: String(t) });
  const st = (f, g, t) => E.st({ freq: "A", levels: "LOW", field: f, sex: "T", unit: "PC", geo: g, time: String(t) });
  const Y = [2000, 2003, 2006, 2009, 2012, 2015, 2018, 2022, 2025];
  const rows = Y.map((y) => ({ x: y, label: String(y), ptMat: v("EF461", "PT", y) ?? null, ptRead: v("READ", "PT", y) ?? null, euMat: v("EF461", "EU27_2020", y) ?? null, euRead: v("READ", "EU27_2020", y) ?? null, ptSci: v("SCI", "PT", y) ?? null }));
  console.log(rows);
  const R = Object.fromEntries(rows.map((q) => [q.x, q]));
  assert(R[2025].ptMat === 35.2 && R[2015].ptMat === 23.8 && R[2018].ptMat === 23.3, "Portugal, matemática: 23,8% em 2015, 23,3% em 2018, 35,2% em 2025");
  assert(rows.every((q) => q.ptMat == null || q.ptMat <= 35.2) && R[2006].ptMat === 30.9 && R[2003].ptMat === 30.1, "35,2% é o valor mais alto de Portugal a matemática desde 2003 (antes: 30,9% em 2006)");
  assert(R[2025].ptRead === 28.4 && R[2015].ptRead === 17.2 && R[2000].ptRead === 26.3 && rows.every((q) => q.ptRead <= 28.4), "Portugal, leitura: 26,3% em 2000, 17,2% em 2015, 28,4% em 2025 (máximo da série)");
  assert(R[2025].euMat === 33.9 && R[2025].euRead === 31.3, "UE: 33,9% a matemática e 31,3% a leitura em 2025");
  assert(R[2015].euMat === 22.2 && R[2015].euRead === 20, "UE em 2015: 22,2% e 20,0%");
  assert(R[2025].ptSci === 24.4 && R[2015].ptSci === 17.4, "Portugal, ciências: 17,4% em 2015, 24,4% em 2025");
  assert(r1(R[2025].ptMat - R[2015].ptMat) === 11.4 && r1(R[2025].ptRead - R[2015].ptRead) === 11.2, "subidas entre 2015 e 2025: +11,4 pp a matemática, +11,2 pp a leitura");
  assert(st("EF461", "PT", 2022) === "b" && st("EF461", "PT", 2012) === "b" && st("READ", "PT", 2018) === "b" && st("READ", "PT", 2009) === "b", "Eurostat assinala quebras de série: matemática em 2012 e 2022; leitura em 2009 e 2018");
  // Posição de Portugal entre os países da UE com valor em 2025 (matemática)
  const EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "EL", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
  const eu25 = EU.filter((g) => v("EF461", g, 2025) != null).sort((a, b) => v("EF461", a, 2025) - v("EF461", b, 2025));
  const ptPos = eu25.indexOf("PT") + 1;
  console.log(eu25.length, ptPos, eu25.map((g) => g + ":" + v("EF461", g, 2025)).join(" "));
  assert(eu25.length === 27 && ptPos === 19, "matemática 2025: Portugal com a 19.ª percentagem mais baixa entre os 27 países da UE");
  const worse15 = EU.filter((g) => v("EF461", g, 2015) != null && v("EF461", g, 2025) != null && g !== "PT" && r1(v("EF461", g, 2025) - v("EF461", g, 2015)) > 11.4);
  assert(worse15.length === 12, "entre 2015 e 2025, 12 países da UE tiveram uma subida maior do que Portugal a matemática");
  console.log("subidas maiores do que Portugal:", worse15.map((g) => g + ":" + r1(v("EF461", g, 2025) - v("EF461", g, 2015))).join(" "));
  write("pisa-alunos-abaixo-minimo-2000-2025", {
    rows,
    config: {
      x: { min: 1999.5, max: 2025.5, ticks: [2000, 2003, 2006, 2009, 2012, 2015, 2018, 2022, 2025], tableLabel: "Ciclo do PISA" },
      y: { label: "Alunos de 15 anos abaixo do nível mínimo (%)", suffix: "%", decimals: 1, linMin: 0, linMax: 40 },
      dots: true,
      series: [
        { key: "euRead", label: "UE · leitura", short: "UE lei.", color: "--accent-4", width: 1.4 },
        { key: "euMat", label: "UE · matemática", short: "UE mat.", color: "--accent-2", width: 1.4 },
        { key: "ptRead", label: "Portugal · leitura", short: "PT lei.", color: "--accent-3", width: 2.2 },
        { key: "ptMat", label: "Portugal · matemática", short: "PT mat.", color: "--accent", width: 2.8 },
      ],
      labelMargin: [80, 150],
      shortEndLabels: false,
      annotations: [
        { x: 2015, key: "ptRead", text: "2015: mínimo em leitura", short: "2015", dx: 0, dy: 18, anchor: "middle" },
      ],
      howToRead: "Cada ponto é um ciclo do PISA (de três em três anos; o de 2021 passou para 2022 por causa da pandemia). A linha mostra a percentagem de alunos de 15 anos que ficam abaixo do nível 2, o mínimo que a OCDE considera necessário para participar plenamente na sociedade. Quanto mais alta a linha, pior.",
    },
    summary: { rows: R, eu25Rank: ptPos },
  }, rawFiles("pisa-abaixo-minimo"));
}

// 5. Comércio da UE com a China e outros parceiros (Eurostat ext_lt_maineu)
{
  const E = jstat(path.join(RAW, "comercio-ue-china", "eurostat_ext_lt_maineu.json"));
  const v = (ind, p, t) => E.v({ freq: "A", indic_et: ind, sitc06: "TOTAL", partner: p, geo: "EU27_2020", time: String(t) });
  const NAMES = { EXT_EU27_2020: "Total fora da UE", US: "EUA", CN_X_HK: "China", UK: "Reino Unido", CH: "Suíça", TR: "Turquia", JP: "Japão", KR: "Coreia do Sul", IN: "Índia", NO: "Noruega", RU: "Rússia", BR: "Brasil", MX: "México", VN: "Vietname" };
  const rows = Object.entries(NAMES).map(([p, label]) => ({
    label, code: p, highlight: p === "CN_X_HK",
    dImp: r1((v("MIO_IMP_VAL", p, 2025) - v("MIO_IMP_VAL", p, 2024)) / 1000),
    dExp: r1((v("MIO_EXP_VAL", p, 2025) - v("MIO_EXP_VAL", p, 2024)) / 1000),
    imp25: r1(v("MIO_IMP_VAL", p, 2025) / 1000), exp25: r1(v("MIO_EXP_VAL", p, 2025) / 1000),
  }));
  console.log(rows);
  const c = (ind, t) => v(ind, "CN_X_HK", t);
  const s = { imp24: c("MIO_IMP_VAL", 2024), imp25: c("MIO_IMP_VAL", 2025), exp24: c("MIO_EXP_VAL", 2024), exp25: c("MIO_EXP_VAL", 2025), imp22: c("MIO_IMP_VAL", 2022), exp22: c("MIO_EXP_VAL", 2022),
    bal25: c("MIO_BAL_VAL", 2025), bal24: c("MIO_BAL_VAL", 2024), bal22: c("MIO_BAL_VAL", 2022) };
  const expYears = Object.keys(E.j.dimension.time.category.index).filter((t) => c("MIO_EXP_VAL", t) != null);
  s.lastExpBelow = expYears.filter((t) => t < "2025" && c("MIO_EXP_VAL", t) < s.exp25).at(-1);
  const R = Object.fromEntries(rows.map((q) => [q.code, q]));
  s.extImp = R.EXT_EU27_2020.dImp; s.extExp = R.EXT_EU27_2020.dExp;
  console.log(s);
  assert(r1(s.imp24 / 1000) === 531.4 && r1(s.imp25 / 1000) === 574.4 && r1(pct(s.imp24, s.imp25)) === 8.1, "importações da UE vindas da China: 531,4 mil milhões de euros em 2024, 574,4 em 2025 (+8,1%)");
  assert(R.CN_X_HK.dImp === 43 && R.CN_X_HK.dExp === -14 && r1(pct(s.exp24, s.exp25)) === -6.6, "China: importações +43,0 mil milhões; exportações −14,0 mil milhões (−6,6%)");
  assert(r1(s.exp25 / 1000) === 199.5 && s.lastExpBelow === "2019" && r1(s.exp22 / 1000) === 231, "exportações para a China: 231,0 mil milhões em 2022, 199,5 em 2025, o valor mais baixo desde 2019");
  assert(r1(-s.bal25 / 1000) === 375 && r1(-s.bal24 / 1000) === 317.9 && r1(-s.bal22 / 1000) === 397.8, "défice com a China: 317,9 mil milhões em 2024, 375,0 em 2025 (397,8 em 2022, o máximo)");
  assert(Object.keys(E.j.dimension.time.category.index).every((t) => c("MIO_BAL_VAL", t) == null || -c("MIO_BAL_VAL", t) <= -s.bal22), "2022 é o maior défice da série (desde 2002)");
  assert(c("MIO_EXP_VAL", 2023) < s.exp22 && c("MIO_EXP_VAL", 2024) < c("MIO_EXP_VAL", 2023) && s.exp25 < c("MIO_EXP_VAL", 2024) && c("MIO_EXP_VAL", 2022) > c("MIO_EXP_VAL", 2021), "as exportações para a China caíram em 2023, 2024 e 2025, depois de subirem em 2022");
  assert(r1(s.imp25 / s.exp25) === 2.9, "em 2025, a UE comprou à China 2,9 euros por cada euro que lhe vendeu");
  assert(rows.filter((q) => q.code !== "EXT_EU27_2020").every((q) => q.dImp <= 43), "a China teve o maior aumento das importações da UE entre os parceiros mostrados");
  assert(s.extImp === 81 && r1((R.CN_X_HK.dImp / s.extImp) * 100) === 53.1, "importações extra-UE: +81,0 mil milhões; a China explica 53,1% do aumento");
  assert(R.US.dExp === 19 && R.US.dImp === 20.3, "EUA: exportações da UE +19,0 mil milhões; importações +20,3 mil milhões");
  assert(R.VN.dImp === 9 && R.RU.dImp === -8.2, "Vietname +9,0 mil milhões; Rússia −8,2 mil milhões nas importações");
  write("comercio-ue-china-2025", {
    rows: rows.map(({ code, ...q }) => q),
    config: {
      unit: "", decimals: 1, pinned: ["Total fora da UE"], posLabel: "Aumento", negLabel: "Diminuição", highlightLabel: "China", highlightColor: "--ink",
      views: [
        { id: "imp", label: "Importações", key: "dImp", axisLabel: "Variação das importações da UE em 2025 face a 2024 (mil milhões de euros)", axisShort: "Importações, 2025 vs. 2024 (mil milhões de €)" },
        { id: "exp", label: "Exportações", key: "dExp", axisLabel: "Variação das exportações da UE em 2025 face a 2024 (mil milhões de euros)", axisShort: "Exportações, 2025 vs. 2024 (mil milhões de €)" },
      ],
      sorts: [["value", "Por variação"], ["label", "Alfabética"]],
      howToRead: "Cada barra é um parceiro comercial e mostra quanto a UE comprou (importações) ou vendeu (exportações) a mais ou a menos do que no ano anterior, em mil milhões de euros. A China está destacada; o total fora da UE fica fixo no topo. Os botões alternam entre importações e exportações.",
    },
    summary: s,
  }, rawFiles("comercio-ue-china"));
}

if (fails) { console.error(`\n${fails} verificação(ões) falharam.`); process.exit(1); } else console.log("\nTodas as verificações passaram.");
