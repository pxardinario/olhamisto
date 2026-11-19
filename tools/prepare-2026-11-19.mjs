// Transformação reprodutível dos dados brutos da edição de 2026-11-19.
// Uso: node tools/prepare-2026-11-19.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: lines, columns — ver assets/js/charts.js.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

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
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); process.exitCode = 1; } else console.log("ok:", msg); }
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

// 1. Função pública: remuneração base média mensal (DGAEP), nominal e deflacionada pelo IPC (INE 0014639)
// A «Data de referência» do ficheiro (fim do trimestre) é a do emprego; a remuneração refere-se ao primeiro mês do trimestre
// (janeiro, abril, julho, outubro), como nos destaques da DGAEP («Em abril de 2026 … 1 967,4 €»). O IPC usado é o desse mês.
{
  const rem = csv(path.join(RAW, "funcao-publica-salarios", "dgaep_remuneracoes_base_ganho_medio.csv"));
  const { D } = ine(path.join(RAW, "funcao-publica-salarios", "ine_0014639_ipc_jan_abr_jul_out_PT.json"));
  const ipc = (y, m) => { const x = D[`${MESES[m]} de ${y}`]?.find((q) => q.geocod === "PT" && q.dim_3 === "T"); return x ? +x.valor : null; };
  const pts = rem.map((q) => { const [y, m] = q["Data de referência"].split("-").map(Number); return { y, m: m - 3, base: +q["Remuneração base média mensal"], ganho: +q["Ganho médio mensal"] }; })
    .sort((a, b) => a.y - b.y || a.m - b.m);
  assert(pts.length === 59 && pts[0].y === 2011 && pts[0].m === 9 && pts.at(-1).y === 2026 && pts.at(-1).m === 3, "59 trimestres, remunerações de outubro de 2011 a abril de 2026");
  assert(pts.every((p) => [0, 3, 6, 9].includes(p.m) && ipc(p.y, p.m) != null), "todos os meses de remuneração são janeiro, abril, julho ou outubro e têm IPC");
  const ref = ipc(2026, 3);
  assert(ref === 103.472 && ipc(2011, 9) === 79.521 && ipc(2021, 9) === 85.69 && ipc(2022, 9) === 94.379, "IPC (base 2025): 79,521 em out. 2011, 85,690 em out. 2021, 94,379 em out. 2022, 103,472 em abr. 2026");
  const rows = pts.map((p) => ({ x: r2(p.y + p.m / 12 + 1 / 24), label: `${MES[p.m]} ${p.y}`, nom: p.base, real: r1(p.base * ref / ipc(p.y, p.m)) }));
  const R = (y, m) => rows.find((q) => q.label === `${MES[m]} ${y}`);
  const realOf = (y, m) => R(y, m).nom * ref / ipc(y, m);
  const s = {
    nom2011: R(2011, 9).nom, nom2021: R(2021, 9).nom, nom2022: R(2022, 9).nom, nom2026: R(2026, 3).nom,
    real2011: r1(realOf(2011, 9)), real2020: r1(realOf(2020, 9)), real2021: r1(realOf(2021, 9)), real2022: r1(realOf(2022, 9)), real2026: R(2026, 3).nom,
    cpi2122: r1(pct(ipc(2021, 9), ipc(2022, 9))), nom2122: r1(pct(R(2021, 9).nom, R(2022, 9).nom)),
    real2122: r1(pct(realOf(2021, 9), realOf(2022, 9))), realJan24: r1(pct(realOf(2021, 9), realOf(2024, 0))), realApr24: r1(pct(realOf(2021, 9), realOf(2024, 3))), realJul24: r1(pct(realOf(2021, 9), realOf(2024, 6))),
    nom1126: r1(pct(R(2011, 9).nom, R(2026, 3).nom)), cpi1126: r1(pct(ipc(2011, 9), ref)), real1126: r1(pct(realOf(2011, 9), realOf(2026, 3))), real2126: r1(pct(realOf(2021, 9), realOf(2026, 3))),
    jan2014: R(2014, 0).nom, apr2014: R(2014, 3).nom, jul2014: R(2014, 6).nom, oct2014: R(2014, 9).nom,
  };
  const after = rows.filter((q) => q.x > R(2022, 9).x);
  s.recover = after.find((q) => realOf(+q.label.slice(-4), MES.indexOf(q.label.slice(0, 4))) > realOf(2021, 9))?.label;
  s.durable = after.find((q, i) => after.slice(i).every((z) => realOf(+z.label.slice(-4), MES.indexOf(z.label.slice(0, 4))) > realOf(2021, 9)))?.label;
  const tr = csv(path.join(RAW, "funcao-publica-salarios", "dgaep_trabalhadores_ap.csv"));
  s.trab2026 = +tr.find((q) => q["Data de referência"] === "2026-06-30")["Trabalhadores na AP"];
  console.log(s);
  assert(s.nom2011 === 1384.7 && s.nom2026 === 1967.4 && s.nom1126 === 42.1, "nominal: 1 384,7 € em out. 2011, 1 967,4 € em abr. 2026 (+42,1%)");
  assert(s.cpi1126 === 30.1 && s.real1126 === 9.2, "IPC +30,1% entre out. 2011 e abr. 2026; remuneração base real +9,2%");
  assert(s.nom2021 === 1540 && s.nom2022 === 1571.1 && s.nom2122 === 2 && s.cpi2122 === 10.1 && s.real2122 === -7.4, "out. 2021 → out. 2022: nominal +2,0% (1 540,0 → 1 571,1 €), IPC +10,1%, real −7,4%");
  assert(s.recover === "jan. 2024" && s.realJan24 === 0.2 && s.realApr24 === -0.6 && s.durable === "jul. 2024" && s.realJul24 === 0.6, "nível real de out. 2021 ultrapassado em jan. 2024 (+0,2%), de novo abaixo em abr. 2024 (−0,6%), acima de forma continuada desde jul. 2024 (+0,6%)");
  assert(s.real2126 === 5.8, "abr. 2026 face a out. 2021: +5,8% em termos reais");
  assert(s.real2011 === 1801.8 && s.real2021 === 1859.6 && s.real2022 === 1722.5, "em euros de abril de 2026: 1 801,8 (out. 2011), 1 859,6 (out. 2021), 1 722,5 (out. 2022)");
  assert(s.real2020 > s.real2021, "o nível real de out. 2020 era superior ao de out. 2021 (a perda começa em 2021; registado nas notas)");
  assert(s.jan2014 === 1311.2 && s.apr2014 === 1313.6 && s.jul2014 === 1444.6 && s.oct2014 === 1390.4, "2014: 1 311,2 (jan.), 1 313,6 (abr.), 1 444,6 (jul.), 1 390,4 € (out.)");
  assert(s.trab2026 === 768378, "768 378 trabalhadores nas administrações públicas a 30/06/2026 (provisório)");
  write("funcao-publica-salario-real-2011-2026", {
    rows,
    config: {
      x: { min: 2011.75, max: 2026.4, ticks: [2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026], tableLabel: "Mês de referência" },
      y: { label: "Euros por mês, eixo a partir de 1 200", suffix: " €", decimals: 1, linMin: 1200, linMax: 2100, logDefault: false },
      series: [
        { key: "real", label: "A preços de abril de 2026 (descontada a inflação)", short: "Real", color: "--accent-2", width: 2.6 },
        { key: "nom", label: "Em euros correntes (nominal)", short: "Nominal", color: "--ink-3", width: 1.6 },
      ],
      labelMargin: [88, 96],
      shortEndLabels: true,
      refLine: { value: s.real2021, label: "Nível real de outubro de 2021", short: "Out. 2021", at: 2014.5 },
      shade: [{ from: 2021.75, to: 2022.84, exact: true, label: "Out. 2021–out. 2022", short: "2022", top: true }],
      annotations: [
        { x: R(2022, 9).x, key: "real", text: "Out. 2022: −7,4% em termos reais", short: "−7,4%", dx: 6, dy: 18, anchor: "start", strong: true },
      ],
      howToRead: "A linha cinzenta mostra a remuneração base média em euros correntes, no primeiro mês de cada trimestre. A azul mostra o mesmo valor convertido em euros de abril de 2026 com o índice de preços no consumidor: quando desce, os aumentos ficaram atrás da inflação. A linha tracejada marca o poder de compra de outubro de 2021.",
    },
    summary: s,
  }, rawFiles("funcao-publica-salarios"));
}

// 2. Aeroportos: passageiros embarcados por aeroporto (INE 0003864)
{
  const { D } = ine(path.join(RAW, "aeroportos-passageiros", "ine_0003864.json"));
  const AP = [["lis", "Aeroporto de Lisboa", "Lisboa"], ["opo", "Aeroporto Francisco Sá Carneiro", "Porto"], ["fao", "Aeroporto de Faro", "Faro"], ["fnc", "Aeroporto da Madeira", "Madeira"], ["pdl", "Aeroporto João Paulo II", "Ponta Delgada"]];
  const g = (y, name) => { const x = D[String(y)]?.find((q) => q.geodsg === name && q.dim_3_t === "Total"); return x && x.valor != null ? +x.valor : null; };
  const years = Object.keys(D).map(Number).sort((a, b) => a - b);
  assert(years.length === 22 && years[0] === 2004 && years.at(-1) === 2025, "22 anos, 2004–2025");
  assert(years.filter((y) => y !== 2012).every((y) => AP.reduce((a, [, n]) => a + g(y, n), 0) === g(y, "Total")), "fora 2012, a soma dos cinco aeroportos é igual ao total em todos os anos");
  assert(AP.filter(([k]) => k !== "opo").every(([, n]) => g(2012, n) === g(2013, n)) && g(2012, "Aeroporto Francisco Sá Carneiro") == null, "2012: quatro aeroportos repetem os valores de 2013 e falta o Porto (ano excluído)");
  const rows = years.filter((y) => y !== 2012).map((y) => Object.assign({ x: y, label: String(y) }, Object.fromEntries(AP.map(([k, n]) => [k, r2(g(y, n) / 1e6)]))));
  rows.splice(rows.findIndex((q) => q.x === 2013), 0, { x: 2012, label: "2012 (sem dados válidos)", lis: null, opo: null, fao: null, fnc: null, pdl: null });
  const s = {};
  for (const [k, n] of AP) {
    s[k] = { v2004: g(2004, n), v2019: g(2019, n), v2024: g(2024, n), v2025: g(2025, n), g1925: r1(pct(g(2019, n), g(2025, n))), g2425: r1(pct(g(2024, n), g(2025, n))), g0425: r1(pct(g(2004, n), g(2025, n))) };
  }
  s.tot = { v2019: g(2019, "Total"), v2024: g(2024, "Total"), v2025: g(2025, "Total"), g1925: r1(pct(g(2019, "Total"), g(2025, "Total"))), g2425: r1(pct(g(2024, "Total"), g(2025, "Total"))) };
  s.share = { lis2004: r1((g(2004, "Aeroporto de Lisboa") / g(2004, "Total")) * 100), lis2019: r1((g(2019, "Aeroporto de Lisboa") / g(2019, "Total")) * 100), lis2025: r1((g(2025, "Aeroporto de Lisboa") / g(2025, "Total")) * 100) };
  const growth19 = AP.map(([k]) => [k, s[k].g1925]).sort((a, b) => a[1] - b[1]);
  s.lowest1925 = growth19[0][0];
  s.lisAdd1925 = g(2025, "Aeroporto de Lisboa") - g(2019, "Aeroporto de Lisboa");
  s.othersAdd1925 = (g(2025, "Total") - g(2025, "Aeroporto de Lisboa")) - (g(2019, "Total") - g(2019, "Aeroporto de Lisboa"));
  s.lisShareOfGrowth = r1((s.lisAdd1925 / (g(2025, "Total") - g(2019, "Total"))) * 100);
  console.log(JSON.stringify(s));
  assert(s.lis.v2025 === 17962545 && s.lis.g2425 === 3 && s.lis.g1925 === 15.7, "Lisboa: 17 962 545 embarcados em 2025; +3,0% face a 2024; +15,7% face a 2019");
  assert(s.opo.v2025 === 8463226 && s.opo.g1925 === 30.5 && s.opo.g2425 === 6.4, "Porto: 8 463 226 em 2025; +30,5% face a 2019; +6,4% face a 2024");
  assert(s.fnc.v2025 === 2695089 && s.fnc.g1925 === 68.5 && s.fnc.g2425 === 12.4, "Madeira: 2 695 089 em 2025; +68,5% face a 2019; +12,4% face a 2024");
  assert(s.fao.g1925 === 16 && s.fao.g2425 === 6 && s.pdl.g1925 === 37.8 && s.pdl.g2425 === 2.3, "Faro: +16,0% face a 2019 e +6,0% face a 2024; Ponta Delgada: +37,8% e +2,3%");
  assert(s.lowest1925 === "lis", "Lisboa é o aeroporto que menos cresceu desde 2019");
  assert(s.tot.v2025 === 35701490 && s.tot.g1925 === 22.7 && s.tot.g2425 === 4.8, "total: 35 701 490 embarcados em 2025; +22,7% face a 2019; +4,8% face a 2024");
  assert(s.share.lis2019 === 53.4 && s.share.lis2025 === 50.3 && s.share.lis2004 === 49.9, "peso de Lisboa: 49,9% em 2004, 53,4% em 2019, 50,3% em 2025");
  assert(s.lisShareOfGrowth === 36.9, "Lisboa explica 36,9% do aumento de passageiros embarcados entre 2019 e 2025");
  const crows = AP.map(([k, , lab]) => ({ cat: lab, g1925: s[k].g1925, g2425: s[k].g2425, m2025: r2(s[k].v2025 / 1e6), m2019: r2(s[k].v2019 / 1e6) }));
  crows.push({ cat: "Total", alt: true, g1925: s.tot.g1925, g2425: s.tot.g2425, m2025: r2(s.tot.v2025 / 1e6), m2019: r2(s.tot.v2019 / 1e6) });
  assert(crows.length === 6 && crows[0].m2025 === 17.96 && crows.at(-1).m2025 === 35.7, "seis colunas: cinco aeroportos e o total (35,70 milhões em 2025)");
  write("aeroportos-passageiros-2019-2025", {
    rows: crows,
    views: [
      { id: "g1925", label: "Desde 2019", yLabel: "Variação dos passageiros embarcados entre 2019 e 2025 (%)", unit: "%", decimals: 1, valueLabels: true,
        series: [{ key: "g1925", label: "Variação 2019–2025 (%)", color: "--accent-2", altColor: "--muted", altLabel: "Total dos cinco aeroportos" }],
        tipExtra: [{ key: "m2019", label: "Embarcados em 2019", suffix: " milhões" }, { key: "m2025", label: "Embarcados em 2025", suffix: " milhões" }] },
      { id: "g2425", label: "2024 → 2025", yLabel: "Variação dos passageiros embarcados entre 2024 e 2025 (%)", unit: "%", decimals: 1, valueLabels: true,
        series: [{ key: "g2425", label: "Variação 2024–2025 (%)", color: "--accent-2", altColor: "--muted", altLabel: "Total dos cinco aeroportos" }] },
      { id: "m2025", label: "Passageiros em 2025", yLabel: "Passageiros embarcados em 2025 (milhões)", unit: " milhões", decimals: 2, valueLabels: true,
        series: [{ key: "m2025", label: "Embarcados em 2025 (milhões)", color: "--accent-2", altColor: "--muted", altLabel: "Total dos cinco aeroportos" }] },
    ],
    series2004_2025: rows,
    summary: s,
  }, rawFiles("aeroportos-passageiros"));
}

// 3. Fogos concluídos em construções novas para habitação familiar, 1975–2025 (INE 0011725)
{
  const { D } = ine(path.join(RAW, "fogos-concluidos", "ine_0011725_PT.json"));
  const v = (y) => { const x = D[String(y)]?.find((q) => q.geocod === "PT"); return x && x.valor != null ? +x.valor : null; };
  const years = Object.keys(D).map(Number).sort((a, b) => a - b);
  assert(years.length === 51 && years[0] === 1975 && years.at(-1) === 2025 && years.every((y) => v(y) > 0), "51 anos, 1975–2025, todos com valor");
  const rows = years.map((y) => ({ cat: String(y), fogos: v(y), mil: r1(v(y) / 1000) }));
  const max = rows.reduce((a, q) => (q.fogos > a.fogos ? q : a)), min = rows.reduce((a, q) => (q.fogos < a.fogos ? q : a));
  const s = { v2025: v(2025), v2024: v(2024), v2002: v(2002), v2015: v(2015), v1975: v(1975), max: max.cat, min: min.cat,
    x1525: r1(v(2025) / v(2015)), share02: r1((v(2025) / v(2002)) * 100), g2425: r1(pct(v(2024), v(2025))),
    above2025: years.filter((y) => v(y) > v(2025)).length, firstAbove: years.filter((y) => y > 2011 && v(y) > v(2025)).length,
    last2025: years.filter((y) => y < 2025 && v(y) >= v(2025)).at(-1), lic2025: 42066, sum0207: [2002, 2003, 2004, 2005, 2006, 2007].reduce((a, y) => a + v(y), 0),
    decline1525: years.filter((y) => y >= 2016 && y <= 2025).every((y) => v(y) > v(y - 1)) };
  s.ratioLic = r1((v(2025) / s.lic2025) * 100);
  s.sum1125 = years.filter((y) => y >= 2011).reduce((a, y) => a + v(y), 0);
  console.log(s);
  assert(s.v2025 === 27301 && s.v2024 === 24666 && s.g2425 === 10.7, "2025: 27 301 fogos concluídos, +10,7% face a 2024 (24 666)");
  assert(s.max === "2002" && s.v2002 === 125708 && s.share02 === 21.7, "máximo: 2002, 125 708 fogos; 2025 é 21,7% de 2002");
  assert(s.min === "2015" && s.v2015 === 7148 && s.x1525 === 3.8, "mínimo: 2015, 7 148 fogos; 2025 é 3,8 vezes 2015");
  assert(s.decline1525, "subiu todos os anos de 2016 a 2025");
  assert(s.last2025 === 2010 && s.v1975 === 31967, "2025 é o valor mais alto desde 2010 (35 442); 1975: 31 967");
  assert(s.sum0207 === 504827 && s.sum1125 === 246248 && s.sum0207 > 2 * s.sum1125, "2002–2007: 504 827 fogos concluídos, mais do dobro dos 15 anos de 2011 a 2025 (246 248)");
  assert(s.ratioLic === 64.9, "27 301 concluídos em 2025 são 64,9% dos 42 066 fogos licenciados em construções novas nesse ano (peça de 13/11/2026)");
  write("fogos-concluidos-1975-2025", {
    rows,
    views: [
      { id: "conc", label: "Fogos concluídos", yLabel: "Fogos concluídos em construções novas para habitação familiar (milhares)", unit: " mil", decimals: 1, labelEvery: 5, labelEveryNarrow: 10, yMax: 140,
        series: [{ key: "mil", label: "Fogos concluídos (milhares)", color: "--accent-2" }],
        tipExtra: [{ key: "fogos", label: "Número exato", suffix: " fogos" }],
        notes: [
          { cat: "2002", text: "2002: 125,7 mil, o máximo", short: "125,7 mil" },
          { cat: "2015", text: "2015: 7,1 mil, o mínimo", short: "7,1 mil" },
        ] },
    ],
    summary: s,
  }, rawFiles("fogos-concluidos"));
}

// 4. Preço da luz no Reino Unido, 1301–2006 (Fouquet e Pearson; cópia da OWID)
{
  const all = csv(path.join(RAW, "preco-luz", "owid_price_for_light_fouquet.csv"));
  const K = "Price for Light – Fouquet and Pearson (2012)";
  const P = Object.fromEntries(all.map((q) => [+q.Year, +q[K]]));
  const years = Object.keys(P).map(Number).sort((a, b) => a - b);
  assert(all.every((q) => q.Entity === "Price for Lightning") && years.length === 706 && years[0] === 1301 && years.at(-1) === 2006 && years.every((y, i) => i === 0 || y === years[i - 1] + 1), "706 anos seguidos, 1301–2006, uma só entidade");
  const mean = (a, b) => { let t = 0; for (let y = a; y <= b; y++) t += P[y]; return t / (b - a + 1); };
  const s = { p1301: P[1301], p1302: P[1302], p1500: P[1500], p1700: P[1700], p1750: P[1750], p1800: P[1800], p1850: P[1850], p1900: P[1900], p1950: P[1950], p2000: P[2000], p2002: P[2002], p2006: P[2006],
    m1300s: r1(mean(1301, 1310)), m1790s: r1(mean(1790, 1799)),
    f1301_1800: r1(P[1301] / P[1800]), f1800_2000: Math.round(P[1800] / P[2000]), f1301_2000: Math.round(P[1301] / P[2000]), fdec: r1(mean(1301, 1310) / mean(1790, 1799)),
    f1800_1900: r1(P[1800] / P[1900]), f1900_2000: Math.round(P[1900] / P[2000]),
    minYear: years.reduce((a, y) => (P[y] < P[a] ? y : a)), maxYear: years.reduce((a, y) => (P[y] > P[a] ? y : a)) };
  console.log(s);
  assert(s.p1301 === 33042.9 && s.p1800 === 9539.93 && s.p2000 === 2.62 && s.p2006 === 2.89, "1301: 33 042,90; 1800: 9 539,93; 2000: 2,62; 2006: 2,89 (libras de 2000 por milhão de lúmenes-hora)");
  assert(s.f1301_1800 === 3.5 && s.fdec === 3.5, "de 1301 a 1800, o preço caiu para menos de um terço (3,5 vezes; o mesmo com médias de dez anos)");
  assert(s.f1800_2000 === 3641, "de 1800 a 2000, caiu 3 641 vezes");
  assert(s.f1301_2000 === 12612 && s.maxYear === 1302 && s.p1302 === 40820.58, "de 1301 a 2000, 12 612 vezes; máximo em 1302 (40 820,58)");
  assert(s.minYear === 2002 && s.p2002 === 2.38, "mínimo: 2002 (2,38); depois sobe até 2,89 em 2006");
  assert(s.p1900 === 236.28 && s.p1950 === 14.69 && s.f1800_1900 === 40.4 && s.f1900_2000 === 90, "1900: 236,28 (40 vezes menos do que em 1800); 1950: 14,69; de 1900 a 2000, 90 vezes menos");
  assert(s.p1500 === 14472.14 && s.p1700 === 14102.07, "1500: 14 472; 1700: 14 102 — quase igual em dois séculos");
  const rows = years.map((y) => ({ x: y, label: String(y), price: P[y] }));
  write("preco-luz-reino-unido-1301-2006", {
    rows,
    config: {
      x: { min: 1300, max: 2006, ticks: [1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000], tableLabel: "Ano" },
      y: { label: "Preço de um milhão de lúmenes-hora (libras de 2000)", suffix: " £", decimals: 2, logDefault: true, logMin: 1, logMax: 50000, logTicks: [1, 10, 100, 1000, 10000], linMin: 0, linMax: 45000, linTicks: [0, 10000, 20000, 30000, 40000] },
      scaleToggle: true,
      series: [{ key: "price", label: "Preço da luz", short: "Preço", color: "--accent-2", width: 1.6 }],
      annotations: [
        { x: 1800, key: "price", text: "1800: 9 540 £", short: "1800: 9 540 £", dx: -8, dy: 20, anchor: "end" },
        { x: 1900, key: "price", text: "1900: 236 £", short: "1900: 236 £", dx: -8, dy: 16, anchor: "end", logOnly: true },
        { x: 2000, key: "price", text: "2000: 2,62 £", short: "2000: 2,62 £", dx: -10, dy: 4, anchor: "end", strong: true },
      ],
      howToRead: "Um lúmen-hora é a luz que uma fonte de um lúmen dá durante uma hora; um milhão de lúmenes-hora corresponde, grosso modo, a manter acesa uma lâmpada incandescente doméstica durante algumas centenas de horas. A escala logarítmica, que abre por defeito, mostra cada divisão por dez com a mesma distância vertical; a linear mostra os valores absolutos, em que quase tudo depois de 1850 se confunde com o zero.",
    },
    summary: s,
  }, rawFiles("preco-luz"));
}
