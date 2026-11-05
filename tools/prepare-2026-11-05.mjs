// Transformação reprodutível dos dados brutos da edição de 2026-11-05.
// Uso: node tools/prepare-2026-11-05.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: dumbbell, lines, bars (novo), columns (ver assets/js/charts.js).
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


// 1. Dívida pública na UE, 2022 → 2025 (Eurostat, notificação PDE de outubro de 2026)
{
  const f = path.join(RAW, "divida-ue", "eurostat_edp_2026-10-21_debt_balance.csv");
  const PT = { Belgium: "Bélgica", Bulgaria: "Bulgária", Czechia: "Chéquia", Denmark: "Dinamarca", Germany: "Alemanha", Estonia: "Estónia", Ireland: "Irlanda", Greece: "Grécia", Spain: "Espanha", France: "França", Croatia: "Croácia", Italy: "Itália", Cyprus: "Chipre", Latvia: "Letónia", Lithuania: "Lituânia", Luxembourg: "Luxemburgo", Hungary: "Hungria", Malta: "Malta", Netherlands: "Países Baixos", Austria: "Áustria", Poland: "Polónia", Portugal: "Portugal", Romania: "Roménia", Slovenia: "Eslovénia", Slovakia: "Eslováquia", Finland: "Finlândia", Sweden: "Suécia" };
  const all = csv(f);
  const ms = all.filter((r) => PT[r.geo]);
  assert(ms.length === 27, "27 Estados-membros");
  const rows = ms.map((r) => ({ label: PT[r.geo], en: r.geo, a: +r.debt_2022, b: +r.debt_2025, c: null, balance2025: +r.balance_2025, highlight: r.geo === "Portugal" }));
  const ea = all.find((r) => r.geo === "Euro area (EA20)"), eu = all.find((r) => r.geo === "EU");
  const pt = rows.find((r) => r.en === "Portugal");
  const drop = (r) => r1(r.a - r.b);
  const byDrop = [...rows].sort((p, q) => drop(q) - drop(p));
  assert(pt.a === 111.2 && pt.b === 89.2, "Portugal: 111,2% → 89,2%");
  assert(drop(pt) === 22, `Portugal desce 22,0 pp (${drop(pt)})`);
  assert(byDrop[0].en === "Greece" && byDrop[1].en === "Cyprus" && byDrop[2].en === "Portugal", `maiores descidas: ${byDrop.slice(0, 3).map((r) => r.en + " " + drop(r)).join(", ")}`);
  assert(drop(byDrop[0]) === 32.4 && drop(byDrop[1]) === 27.7, "Grécia −32,4 pp; Chipre −27,7 pp");
  const above2022 = rows.filter((r) => r.a > pt.a).map((r) => r.en), above2025 = rows.filter((r) => r.b > pt.b).map((r) => r.en);
  assert(above2022.length === 3, `2022: acima de Portugal só ${above2022.join(", ")}`);
  assert(above2025.length === 5, `2025: acima de Portugal ${above2025.join(", ")}`);
  const gapEA = r1(pt.b - +ea.debt_2025);
  assert(gapEA === 1.5, `Portugal 2025 a ${gapEA} pp da média da zona euro (EA20 ${ea.debt_2025}%)`);
  const ptAboveEA2022 = r1(pt.a - +ea.debt_2022);
  assert(ptAboveEA2022 === 22, `2022: Portugal ${ptAboveEA2022} pp acima da zona euro`);
  const surplus = rows.filter((r) => r.balance2025 > 0).map((r) => r.en);
  assert(surplus.length === 5 && surplus.includes("Portugal"), `excedente em 2025: ${surplus.join(", ")}`);
  const fell = rows.filter((r) => r.b < r.a).length, rose = rows.filter((r) => r.b > r.a).length;
  const dv = (g) => r1(rows.find((r) => r.en === g).b - rows.find((r) => r.en === g).a);
  assert(dv("France") === 4.3 && dv("Poland") === 10.8 && dv("Finland") === 14.3, "França +4,3; Polónia +10,8; Finlândia +14,3");
  assert(fell === 13 && rose === 14, `${fell} desceram, ${rose} subiram`);
  write("divida-publica-ue-2025", {
    rows: rows.map(({ en, ...r }) => r),
    config: { aLabel: "2022", bLabel: "2025", ref: +ea.debt_2025, refLabel: `Zona euro 2025: ${String(ea.debt_2025).replace(".", ",")}%`, unit: "%", decimals: 1, domain: [0, 190],
      howToRead: "Cada linha é um país: vai da dívida pública de 2022 (ponto cinzento) à de 2025 (ponto azul). Linha para a esquerda: a dívida desceu em percentagem do PIB. A linha tracejada marca o rácio da zona euro em 2025. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por dívida em 2025"], ["delta", "Por variação"]] },
    summary: { pt2022: pt.a, pt2025: pt.b, ptDrop: drop(pt), ea2022: +ea.debt_2022, ea2025: +ea.debt_2025, eu2025: +eu.debt_2025, gapEA, ptAboveEA2022,
      gr: [byDrop[0].a, byDrop[0].b, drop(byDrop[0])], cy: [byDrop[1].a, byDrop[1].b, drop(byDrop[1])], above2022, above2025, surplus, ptBalance: pt.balance2025, fell, rose },
  }, [f]);
}

// 2. CO2 por habitante, 1990–2024 (Global Carbon Budget 2025 via OWID)
{
  const f = path.join(RAW, "co2-capita", "owid_co2_per_capita_selected.csv");
  const all = csv(f);
  const K = { "Portugal": "pt", "World": "world", "China": "cn", "United States": "us", "European Union (27)": "eu", "India": "in" };
  const by = {};
  for (const r of all) { const y = +r.year; if (y < 1990) continue; (by[y] ??= { x: y })[K[r.country]] = r.co2_per_capita === "" ? null : r2(+r.co2_per_capita); }
  const rows = Object.values(by).sort((a, b) => a.x - b.x);
  assert(rows.length === 35 && rows[0].x === 1990 && rows.at(-1).x === 2024, "35 anos, 1990–2024");
  assert(rows.every((r) => Object.values(K).every((k) => r[k] != null)), "sem valores em falta");
  const raw = (c, y) => +all.find((r) => r.country === c && +r.year === y).co2_per_capita;
  // primeiro ano em que a China passa a UE e não volta a ficar abaixo
  const cnOver = rows.find((r, i) => rows.slice(i).every((q) => raw("China", q.x) > raw("European Union (27)", q.x))).x;
  assert(cnOver === 2017, `China sempre acima da UE27 desde ${cnOver}`);
  const cnFirst = rows.find((r) => raw("China", r.x) > raw("European Union (27)", r.x)).x;
  assert(cnFirst === 2013, `China passa a UE27 pela primeira vez em ${cnFirst} (2016: UE ligeiramente acima)`);
  assert(raw("European Union (27)", 2016) > raw("China", 2016), "2016: UE 6,955 > China 6,943");
  const ptUnder = rows.find((r, i) => rows.slice(i).every((q) => raw("Portugal", q.x) < raw("World", q.x))).x;
  assert(ptUnder === 2019, `Portugal abaixo da média mundial desde ${ptUnder}`);
  const ptPeak = rows.reduce((a, b) => (b.pt > a.pt ? b : a));
  assert(ptPeak.x === 2002 && ptPeak.pt === 6.68, `pico de Portugal: ${ptPeak.x} (${ptPeak.pt} t)`);
  const L = rows.at(-1);
  const ptFall = Math.round((1 - raw("Portugal", 2024) / raw("Portugal", 2002)) * 100);
  assert(ptFall === 49, `Portugal 2002→2024: −${ptFall}%`);
  const euFall = Math.round((1 - raw("European Union (27)", 2024) / raw("European Union (27)", 1990)) * 100);
  assert(euFall === 42, `UE27 1990→2024 por habitante: −${euFall}%`);
  const cnX = r1(raw("China", 2024) / raw("China", 1990));
  assert(cnX === 4, `China 1990→2024: ×${cnX}`);
  assert(Math.round((1 - raw("United States", 2024) / raw("United States", 1990)) * 100) === 30 && L.us === 14.2, "EUA 14,2 t em 2024, −30% face a 1990");
  assert(raw("European Union (27)", 1990) / raw("China", 1990) > 4, "1990: UE mais de 4× a China por habitante");
  const cons2023 = { cn: +all.find((r) => r.country === "China" && r.year === "2023").consumption_co2_per_capita, eu: +all.find((r) => r.country === "European Union (27)" && r.year === "2023").consumption_co2_per_capita, pt: +all.find((r) => r.country === "Portugal" && r.year === "2023").consumption_co2_per_capita, world: +all.find((r) => r.country === "World" && r.year === "2023").consumption_co2_per_capita };
  assert(cons2023.cn > cons2023.eu, `consumo 2023: China ${cons2023.cn} > UE ${cons2023.eu}`);
  assert(cons2023.pt < cons2023.world, `consumo 2023: Portugal ${cons2023.pt} < mundo ${cons2023.world}`);
  write("co2-por-habitante", {
    rows,
    config: { x: { label: "Ano", min: 1990, max: 2024, ticks: [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2024] },
      y: { label: "Emissões de CO₂ fósseis e da indústria por habitante (toneladas)", suffix: " t", decimals: 1, logDefault: false, logMin: 0.5, logMax: 25, linMax: 22 },
      series: [{ key: "us", label: "EUA", short: "EUA", color: "--muted" }, { key: "cn", label: "China", short: "China", color: "--accent-3", width: 2.6 }, { key: "eu", label: "UE27", short: "UE", color: "--accent-2", width: 2.6 },
        { key: "world", label: "Mundo", short: "Mundo", color: "--ink", width: 2 }, { key: "pt", label: "Portugal", short: "PT", color: "--accent", width: 3 }, { key: "in", label: "Índia", short: "Índia", color: "--muted" }],
      scaleToggle: true, dots: false,
      annotations: [{ x: 2013, key: "cn", text: "2013: China passa a UE", short: "2013: China > UE", anchor: "end", dx: -8, dy: -12 }, { x: 2019, key: "pt", text: "Desde 2019: Portugal sempre abaixo do mundo", short: "2019: PT < mundo", anchor: "end", dx: -8, dy: 22 }] },
    summary: { cnOver, cnFirst, ptUnder, ptPeakYear: ptPeak.x, ptPeak: ptPeak.pt, pt2024: L.pt, world2024: L.world, cn2024: L.cn, eu2024: L.eu, us2024: L.us, in2024: L.in, ptFall, euFall, cnX, cons2023 },
  }, [f]);
}

// 3. Dormidas no alojamento turístico por região, setembro de 2026 (INE, estimativa rápida)
{
  const f = path.join(RAW, "turismo-set26", "ine_atividade_turistica_set2026_quadro1.csv");
  const fm = path.join(RAW, "turismo-set26", "ine_atividade_turistica_set2026_mercados.csv");
  const all = csv(f);
  const short = { "Oeste e Vale do Tejo": "Oeste e V. Tejo", "Península de Setúbal": "Pen. Setúbal", "RA Açores": "Açores", "RA Madeira": "Madeira" };
  const rows = all.map((r) => ({ label: r.region, short: short[r.region], total: +r.total_yoy, res: +r.residents_yoy, nres: +r.nonresidents_yoy, nights: +r.total_k, highlight: false }));
  const pt = all.find((r) => r.region === "Portugal"), reg = all.filter((r) => r.region !== "Portugal");
  assert(reg.length === 9, "9 regiões NUTS II");
  const sum = (k) => r1(reg.reduce((s, r) => s + +r[k], 0));
  for (const k of ["total_k", "residents_k", "nonresidents_k"]) assert(Math.abs(sum(k) - +pt[k]) <= 0.3, `soma regional de ${k} ${sum(k)} ≈ ${pt[k]}`);
  assert(Math.abs(+pt.residents_k + +pt.nonresidents_k - +pt.total_k) <= 0.2, "residentes + não residentes = total");
  const nresDown = reg.filter((r) => +r.nonresidents_yoy < 0).map((r) => r.region);
  assert(nresDown.length === 5, `não residentes a descer em 5 regiões: ${nresDown.join(", ")}`);
  const resUp = reg.filter((r) => +r.residents_yoy > 0).length;
  assert(resUp === 7, `residentes a subir em ${resUp} regiões`);
  const norte = reg.find((r) => r.region === "Norte");
  // contributo do Norte para o aumento total: dormidas do ano anterior implícitas
  const prev = (v, g) => v / (1 + g / 100);
  const incTotal = +pt.total_k - prev(+pt.total_k, +pt.total_yoy), incNorte = +norte.total_k - prev(+norte.total_k, +norte.total_yoy);
  const norteShareInc = Math.round((incNorte / incTotal) * 100);
  assert(norteShareInc === 59, `o Norte explica ~${norteShareInc}% do aumento nacional (estimado a partir das taxas)`);
  const alg = reg.find((r) => r.region === "Algarve");
  const algShare = Math.round((+alg.total_k / +pt.total_k) * 100), norteShare = Math.round((+norte.total_k / +pt.total_k) * 100);
  assert(algShare === 27 && norteShare === 19, `quotas: Algarve ${algShare}%, Norte ${norteShare}%`);
  const nresShare = Math.round((+pt.nonresidents_k / +pt.total_k) * 100);
  assert(nresShare === 71, `não residentes: ${nresShare}% das dormidas`);
  write("turismo-regioes-set-2026", {
    rows,
    config: { unit: "%", decimals: 1, pinned: ["Portugal"], posLabel: "Aumento", negLabel: "Diminuição",
      views: [{ id: "total", label: "Total", key: "total", axisLabel: "Dormidas em setembro de 2026: variação face a setembro de 2025 (%)", axisShort: "Dormidas, variação homóloga (%)" },
        { id: "res", label: "Residentes", key: "res", axisLabel: "Dormidas de residentes em Portugal: variação homóloga (%)", axisShort: "Residentes, variação (%)" },
        { id: "nres", label: "Não residentes", key: "nres", axisLabel: "Dormidas de não residentes: variação homóloga (%)", axisShort: "Não residentes, variação (%)" }],
      sorts: [["value", "Por variação"], ["label", "Alfabética"]],
      howToRead: "Cada barra é uma região (NUTS II de 2024) e mostra quanto variaram as dormidas face a setembro de 2025. Portugal fica fixo no topo. Os botões mudam entre todas as dormidas, só as de residentes em Portugal ou só as de não residentes." },
    summary: { pt: { total: +pt.total_yoy, res: +pt.residents_yoy, nres: +pt.nonresidents_yoy, nights: +pt.total_k }, norte: { total: +norte.total_yoy, nres: +norte.nonresidents_yoy }, alg: { total: +alg.total_yoy, res: +alg.residents_yoy },
      nresDown, resUp, norteShareInc, algShare, norteShare, nresShare, markets: csv(fm) },
  }, [f, fm]);
}

// 4. População residente em Portugal, 1960–2025 (Banco Mundial, SP.POP.TOTL)
{
  const f = path.join(RAW, "populacao-pt", "worldbank_SP.POP.TOTL_portugal_datahub.csv");
  const all = csv(f).map((r) => ({ y: +r.Year, v: +r.Value }));
  assert(all.length === 66 && all[0].y === 1960 && all.at(-1).y === 2025, "66 anos, 1960–2025");
  const rows = all.slice(1).map((r, i) => ({ cat: String(r.y), change: Math.round((r.v - all[i].v) / 100) / 10, pop: Math.round(r.v / 10000) / 100 }));
  const max = all.reduce((a, b) => (b.v > a.v ? b : a));
  assert(max.y === 2025, `máximo da série em ${max.y} (${max.v})`);
  const peak2010 = all.find((r) => r.y === 2010).v, low2018 = all.find((r) => r.y === 2018).v;
  assert(all.filter((r) => r.y >= 2000 && r.y <= 2015).every((r) => r.v <= peak2010), "2010 é o máximo antes de 2019");
  const lost = Math.round((peak2010 - low2018) / 1000);
  assert(lost === 289, `2010→2018: −${lost} mil`);
  const gained = Math.round((all.at(-1).v - low2018) / 1000);
  assert(gained === 521, `2018→2025: +${gained} mil`);
  const loss60s = Math.round((all.find((r) => r.y === 1964).v - all.find((r) => r.y === 1972).v) / 1000);
  assert(loss60s === 405, `1964→1972: −${loss60s} mil`);
  const c75 = rows.find((r) => r.cat === "1975").change, c76 = rows.find((r) => r.cat === "1976").change;
  assert(c75 === 339.1 && c76 === 262.3, `1975 +${c75} mil; 1976 +${c76} mil`);
  const biggest = rows.reduce((a, b) => (b.change > a.change ? b : a));
  assert(biggest.cat === "1975", "maior aumento anual: 1975");
  const since76 = rows.filter((r) => +r.cat > 1976).reduce((a, b) => (b.change > a.change ? b : a));
  assert(since76.cat === "2023" && since76.change === 143.8, `maior aumento desde 1976: ${since76.cat} (+${since76.change} mil)`);
  const negYears = rows.filter((r) => r.change < 0).length;
  write("populacao-portugal-1960-2025", {
    rows,
    views: [{ id: "var", label: "Variação anual", yLabel: "Variação da população face ao ano anterior (milhares de pessoas)", unit: " mil", decimals: 1, yMax: 400, labelEvery: 5, labelEveryNarrow: 10,
        series: [{ key: "change", label: "Variação anual (milhares)", color: "--accent-2", negColor: "--accent-3" }],
        notes: [{ cat: "1975", text: "1975: descolonização, +339 mil", short: "1975: +339 mil" }, { cat: "2013", text: "2011–2018: crise e emigração", short: "2011–18" }] },
      { id: "pop", label: "População", yLabel: "População residente (milhões, estimativa a meio do ano)", unit: " milhões", decimals: 2, labelEvery: 5, labelEveryNarrow: 10,
        series: [{ key: "pop", label: "População (milhões)", color: "--accent-2" }] }],
    summary: { pop1960: all[0].v, pop2025: all.at(-1).v, peak2010, low2018, lost, gained, loss60s, c75, c76, since76: since76.change, negYears },
  }, [f]);
}
if (fails) { console.error(`${fails} asserts falharam`); process.exit(1); }
