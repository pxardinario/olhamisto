// Transformação reprodutível dos dados brutos da edição de 2026-11-16.
// Uso: node tools/prepare-2026-11-16.mjs
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
  const st = (o) => { const k = idx(o); return k == null ? undefined : (j.status || {})[k]; };
  return { j, v, st };
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
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

// 1. Juros das obrigações do Tesouro a 10 anos (BCE, IRS, critério de convergência)
{
  const P = ["PT", "DE", "FR", "ES", "IT", "GR"];
  const S = {};
  for (const c of P) {
    S[c] = {};
    for (const r of csv(path.join(RAW, "juros-10-anos", `ecb_IRS_M_${c}_L_L40_CI_0000_EUR_N_Z.csv`))) S[c][r.TIME_PERIOD] = r.OBS_VALUE === "" ? null : +r.OBS_VALUE;
  }
  const ms = Object.keys(S.PT).sort();
  assert(ms[0] === "2007-01" && ms.at(-1) === "2026-10" && ms.length === 238, "238 meses, de janeiro de 2007 a outubro de 2026");
  assert(["DE", "FR", "ES", "IT"].every((c) => ms.every((m) => typeof S[c][m] === "number")), "Alemanha, França, Espanha e Itália sem meses em falta");
  assert(S.GR["2015-07"] === null, "Grécia: julho de 2015 sem valor (estado M, em falta); a Grécia fica fora do gráfico (escala: 29% em 2012)");
  const o = "2026-10";
  assert(S.PT[o] === 3.917 && S.FR[o] === 4.89 && S.ES[o] === 4.066 && S.IT[o] === 4.68 && S.DE[o] === 3.416 && S.GR[o] === 4.41, "outubro de 2026: PT 3,917; FR 4,89; ES 4,066; IT 4,68; DE 3,416; GR 4,41");
  assert(r2(S.FR[o] - S.PT[o]) === 0.97 && r2(S.PT[o] - S.DE[o]) === 0.5, "outubro de 2026: Portugal paga menos 0,97 pontos do que a França e mais 0,50 do que a Alemanha");
  const below = (c) => { let k = ms.length - 1; while (k >= 0 && S.PT[ms[k]] < S[c][ms[k]]) k--; return ms[k + 1]; };
  console.log("abaixo desde: FR", below("FR"), "ES", below("ES"), "IT", below("IT"), "GR", below("GR"));
  assert(below("FR") === "2024-07", "Portugal abaixo da França todos os meses desde julho de 2024");
  assert(below("ES") === "2023-01", "Portugal abaixo da Espanha todos os meses desde janeiro de 2023");
  assert(ms.filter((m) => m < "2024-07").every((m) => S.PT[m] >= S.FR[m]), "antes de julho de 2024, Portugal nunca pagou menos do que a França (desde 2007)");
  const mx = ms.reduce((a, m) => (S.PT[m] - S.DE[m] > S.PT[a] - S.DE[a] ? m : a));
  assert(mx === "2012-01" && S.PT[mx] === 13.849 && S.DE[mx] === 1.82 && r2(S.PT[mx] - S.DE[mx]) === 12.03, "máximo do diferencial face à Alemanha: janeiro de 2012, 13,85% contra 1,82% (12,03 pontos)");
  assert(S.PT["2026-02"] === 3.127 && r2(S.PT[o] - S.PT["2026-02"]) === 0.79, "Portugal: 3,127% em fevereiro de 2026, mais 0,79 pontos até outubro");
  assert(["DE", "FR", "ES", "IT"].every((c) => S[c][o] > S[c]["2026-02"]), "todos os países pagam mais em outubro do que em fevereiro de 2026");
  assert(r2(S.FR[o] - S.FR["2026-02"]) === 1.49, "França: mais 1,49 pontos entre fevereiro e outubro de 2026");
  assert(S.FR[o] > S.IT[o] && S.FR[o] > S.GR[o], "outubro de 2026: a França paga mais do que a Itália e a Grécia");
  const rows = ms.map((m) => { const [y, mm] = m.split("-").map(Number); return { x: r2(y + (mm - 0.5) / 12), label: `${MES[mm - 1]} ${y}`, pt: S.PT[m], de: S.DE[m], fr: S.FR[m], es: S.ES[m], it: S.IT[m] }; });
  const xJan12 = rows.find((q) => q.label === "jan. 2012").x;
  write("juros-dividas-10-anos-2007-2026", {
    rows,
    config: {
      x: { label: "Mês", tableLabel: "Mês", min: 2007, max: 2026.83, ticks: [2007, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026] },
      y: { label: "Taxa de juro das obrigações do Tesouro a 10 anos (%)", suffix: "%", decimals: 2, logDefault: false, linMin: -1, linMax: 14 },
      series: [
        { key: "pt", label: "Portugal", short: "PT", color: "--accent", width: 2.8 },
        { key: "fr", label: "França", short: "FR", color: "--accent-2", width: 2.2 },
        { key: "it", label: "Itália", short: "IT", color: "--accent-4", width: 1.6 },
        { key: "es", label: "Espanha", short: "ES", color: "--accent-3", width: 1.6 },
        { key: "de", label: "Alemanha", short: "DE", color: "--ink", width: 1.6 },
      ],
      labelMargin: [64, 96], shortEndLabels: false,
      scaleToggle: false, dots: false,
      annotations: [{ x: xJan12, key: "pt", text: "jan. 2012: 13,85%", short: "13,85%", anchor: "start", dx: 8, dy: 4 }],
    },
    summary: { oct: Object.fromEntries(P.map((c) => [c, S[c][o]])), belowFR: below("FR"), belowES: below("ES"), maxSpread: { month: mx, pt: S.PT[mx], de: S.DE[mx] } },
  }, rawFiles("juros-10-anos"));
}

// 2. Médico de família por nacionalidade (SNS, inscritos nos CSP, setembro de 2026)
{
  const R = csv(path.join(RAW, "sns-medico-familia", "sns_inscritoscuidadosdesaudeprimarios_2026-07_2026-09.csv"), ";");
  const per = [...new Set(R.map((r) => r.periodo))].sort();
  assert(per.join() === "2026-07,2026-08,2026-09" && R.length === 234, "três meses (julho a setembro de 2026), 234 linhas");
  const S = R.filter((r) => r.periodo === "2026-09");
  const uls = [...new Set(S.map((r) => r.uls))];
  assert(uls.length === 39 && S.length === 78, "setembro de 2026: 39 ULS × 2 nacionalidades");
  const N = (r, k) => +r[k];
  const KEYS = ["inscritos_em_csp", "inscritos_em_csp_nao_elegiveis_para_mdf", "inscritos_em_csp_elegiveis_para_mdf", "inscritos_em_csp_elegiveis_c_mdf_atribuido", "inscritos_em_csp_elegiveis_s_mdf_atribuido", "inscritos_em_csp_elegiveis_s_mdf_por_opcao"];
  for (const r of R) {
    if (N(r, KEYS[0]) !== N(r, KEYS[1]) + N(r, KEYS[2]) || N(r, KEYS[2]) !== N(r, KEYS[3]) + N(r, KEYS[4]) + N(r, KEYS[5])) { assert(false, `somas coerentes em ${r.periodo} ${r.uls} ${r.nacionalidade}`); }
  }
  assert(true, "inscritos = elegíveis + não elegíveis; elegíveis = com MdF + sem MdF + sem MdF por opção (todas as linhas)");
  const rate = (rs) => { const c = rs.reduce((a, r) => a + N(r, KEYS[3]), 0), s = rs.reduce((a, r) => a + N(r, KEYS[4]), 0); return (100 * s) / (c + s); };
  assert(S.every((r) => Math.abs(rate([r]) - +r.taxa_de_utentes_s_mdf) < 0.001), "a taxa recalculada (sem MdF ÷ (com + sem MdF)) coincide com a publicada em todas as linhas");
  const sum = (rs, k) => rs.reduce((a, r) => a + N(r, k), 0);
  const est = S.filter((r) => r.nacionalidade === "Estrangeira"), por = S.filter((r) => r.nacionalidade === "Portuguesa");
  const tE = rate(est), tP = rate(por), tT = rate(S);
  console.log({ tE, tP, tT });
  assert(r1(tE) === 44.9 && r1(tP) === 9.3 && r1(tT) === 12.9, "setembro de 2026: sem médico de família 44,9% (nacionalidade estrangeira), 9,3% (portuguesa), 12,9% (total)");
  const semE = sum(est, KEYS[4]), semT = sum(S, KEYS[4]), insE = sum(est, KEYS[0]), insT = sum(S, KEYS[0]);
  assert(semT === 1373189 && semE === 485626 && insT === 10794761 && insE === 1102040, "1 373 189 utentes elegíveis sem MdF, dos quais 485 626 estrangeiros; 10 794 761 inscritos, dos quais 1 102 040 estrangeiros");
  assert(Math.round((100 * semE) / semT) === 35 && r1((100 * insE) / insT) === 10.2, "estrangeiros: 10,2% dos inscritos e 35% dos utentes sem médico de família");
  const rows = uls.map((u) => {
    const p = por.find((r) => r.uls === u), e = est.find((r) => r.uls === u);
    return { label: u, region: p.regiao, a: r1(rate([p])), b: r1(rate([e])), c: r1(rate([p, e])), est: N(e, KEYS[0]) };
  });
  const gt = rows.filter((q) => rate([est.find((r) => r.uls === q.label)]) > rate([por.find((r) => r.uls === q.label)])).length;
  console.log("ULS com taxa maior entre estrangeiros:", gt);
  const notGt = rows.filter((q) => !(rate([est.find((r) => r.uls === q.label)]) > rate([por.find((r) => r.uls === q.label)]))).map((q) => q.label);
  console.log("sem taxa maior entre estrangeiros:", notGt);
  assert(gt === 37, "a taxa sem médico de família é mais alta entre estrangeiros em 37 das 39 ULS");
  const eq = rows.filter((q) => q.a === q.b).map((q) => q.label).sort();
  console.log("iguais (arredondado):", eq);
  const top = [...rows].sort((p, q) => q.b - p.b).slice(0, 5).map((q) => `${q.label} ${q.b}`);
  console.log("mais altas (estrangeiros):", top);
  const g = (n) => rows.find((q) => q.label === n);
  assert(g("Arco Ribeirinho").b === 85.8 && g("Arco Ribeirinho").a === 25.2, "Arco Ribeirinho: 85,8% (estrangeiros) e 25,2% (portugueses) — a taxa mais alta entre estrangeiros");
  assert(g("Lisboa Ocidental").a === 2.2 && g("Lisboa Ocidental").b === 43.5, "Lisboa Ocidental: 2,2% (portugueses) e 43,5% (estrangeiros)");
  assert(g("Algarve").a === 10.7 && g("Algarve").b === 50.9 && g("Algarve").est === 128987, "Algarve: 10,7% e 50,9%; 128 987 inscritos estrangeiros (a ULS com mais)");
  assert(rows.every((q) => q.est <= 128987), "a ULS do Algarve é a que tem mais inscritos de nacionalidade estrangeira");
  const lvt = S.filter((r) => r.regiao === "LVT");
  const nor = S.filter((r) => r.regiao === "Norte");
  assert(r1(rate(lvt)) === 26.7 && r1(rate(nor)) === 1.5, "região de Lisboa e Vale do Tejo: 26,7% sem médico; Norte: 1,5%");
  const lvtP = rate(lvt.filter((r) => r.nacionalidade === "Portuguesa")), norE = rate(nor.filter((r) => r.nacionalidade === "Estrangeira"));
  console.log({ lvtP, norE });
  assert(r1(lvtP) === 20.5 && r1(norE) === 10.9, "portugueses em Lisboa e Vale do Tejo: 20,5%; estrangeiros no Norte: 10,9%");
  // série de julho a setembro (contexto)
  const m = (p, nac) => rate(R.filter((r) => r.periodo === p && (!nac || r.nacionalidade === nac)));
  assert(per.every((p) => m(p, "Estrangeira") > 44.5 && m(p, "Estrangeira") < 45.5 && m(p, "Portuguesa") > 9 && m(p, "Portuguesa") < 9.6), "julho a setembro: taxa estável (≈45% e ≈9,3–9,5%)");
  rows.push({ label: "Total (Continente)", region: "Continente", a: r1(tP), b: r1(tE), c: r1(tT), est: insE, highlight: true });
  for (const q of rows) delete q.est;
  // rótulos curtos para ecrãs estreitos (renderizador dumbbell: campo short)
  const SHORT = { "Póvoa Varzim / Vila Conde": "Póvoa/Vila Conde", "Trás-os-Montes Alto Douro": "Trás-os-Montes AD", "Barcelos / Esposende": "Barcelos/Espos.", "Entre Douro e Vouga": "Entre Douro/Vouga" };
  for (const q of rows) if (SHORT[q.label]) q.short = SHORT[q.label];
  assert(Object.keys(SHORT).every((k) => rows.some((q) => q.label === k)), "rótulos curtos correspondem a ULS existentes");
  write("medico-familia-nacionalidade-uls-2026", {
    rows,
    config: {
      aLabel: "Nacionalidade portuguesa", bLabel: "Nacionalidade estrangeira", cLabel: "Todos os inscritos", ref: r1(tT), refLabel: `Total: ${String(r1(tT)).replace(".", ",")}%`, itemLabel: "ULS", unit: "%", decimals: 1, domain: [0, 100],
      howToRead: "Cada linha é uma Unidade Local de Saúde (ULS) do continente: vai da percentagem de utentes de nacionalidade portuguesa sem médico de família (ponto cinzento) à dos utentes de nacionalidade estrangeira (ponto azul). O anel marca o valor para todos os inscritos da ULS. Quanto mais comprida a linha, maior a diferença. Contam só os utentes elegíveis para médico de família, e não quem ficou sem médico por opção. A linha destacada a terracota é o total do continente.",
      sorts: [["b", "Por valor entre estrangeiros"], ["delta", "Por diferença"]],
    },
    summary: { sep2026: { estrangeira: r1(tE), portuguesa: r1(tP), total: r1(tT), semT, semE, insT, insE }, ulsMaisAlta: gt, lvt: r1(rate(lvt)), norte: r1(rate(nor)) },
  }, rawFiles("sns-medico-familia"));
}

// 3. Espetadores de cinema em Portugal, 2006–2025 (ICA, via INE)
{
  const J = (c) => JSON.parse(fs.readFileSync(path.join(RAW, "cinema-pt", `ine_${c}.json`), "utf8"))[0].Dados;
  const ptT = (lst) => { const r = lst.find((q) => q.geocod === "PT" && (q.dim_3 == null || q.dim_3 === "T")); return r ? +r.valor : null; };
  const A = J("0004095"), B = J("0008345"), C = J("0010724"), M = J("0012252");
  const tot = {};
  for (let y = 2006; y <= 2010; y++) tot[y] = ptT(A[y]);
  for (let y = 2011; y <= 2023; y++) tot[y] = ptT(B[y]);
  for (let y = 2024; y <= 2025; y++) tot[y] = ptT(C[y]);
  assert(Object.values(tot).every((v) => typeof v === "number" && v > 0) && Object.keys(tot).length === 20, "20 anos com valor, de 2006 a 2025");
  assert(ptT(A[2011]) === 15701679 && ptT(B[2011]) === 15701649, "2011: 15 701 679 (0004095) e 15 701 649 (0008345) — diferença de 30; usa-se o mais recente");
  assert([2011, 2012, 2013].every((y) => Math.abs(ptT(A[y]) - ptT(B[y])) <= 30) && [2020, 2021, 2022, 2023].every((y) => ptT(B[y]) === ptT(C[y])), "séries sobrepostas coincidem (2011–2013 e 2020–2023)");
  assert(tot[2006] === 16367429 && tot[2019] === 15540742 && tot[2024] === 11864190 && tot[2025] === 10955126 && tot[2020] === 3802661, "2006: 16,37 milhões; 2019: 15,54; 2020: 3,80; 2024: 11,86; 2025: 10,96");
  assert(Math.round((1 - tot[2025] / tot[2019]) * 100) === 30 && Math.round((1 - tot[2025] / tot[2006]) * 100) === 33, "2025: −30% face a 2019 e −33% face a 2006");
  assert(r1((tot[2025] / tot[2024] - 1) * 100) === -7.7, "2025: −7,7% face a 2024");
  const pre = Object.keys(tot).filter((y) => +y < 2020).map((y) => tot[y]);
  assert(pre.every((v) => v > tot[2025]) && Math.min(...pre) === tot[2014] && tot[2014] === 12090667, "2025 abaixo de todos os anos antes da pandemia; o mínimo pré-pandemia foi 2014 (12,09 milhões)");
  assert(tot[2023] > tot[2024] && tot[2024] > tot[2025], "2023 → 2024 → 2025: duas descidas seguidas depois da recuperação");
  // origem dos filmes, 2025
  const orig = (y, k) => +C[y].find((q) => q.dim_3 === k).valor;
  assert(r1((100 * orig(2025, "US")) / tot[2025]) === 48.4 && r1((100 * orig(2025, "PT")) / tot[2025]) === 1.8 && orig(2025, "PT") === 193733, "2025: filmes dos EUA 48,4% dos bilhetes; portugueses 1,8% (193 733)");
  // população: espetadores por habitante 2025 (não usado no texto)
  // janeiro a setembro, 2023–2026 (mensal)
  const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mm = {};
  for (const [p, lst] of Object.entries(M)) { const [mes, , ano] = p.split(" "); const v = ptT(lst); if (v != null) mm[`${ano}-${String(MESES.indexOf(mes) + 1).padStart(2, "0")}`] = v; }
  const ytd = (y) => Object.keys(mm).filter((k) => k.startsWith(y + "-") && +k.slice(5) <= 9).reduce((a, k) => a + mm[k], 0);
  assert(Object.keys(mm).filter((k) => k.startsWith("2026-")).length === 9, "2026: nove meses (janeiro a setembro)");
  const full = (y) => Object.keys(mm).filter((k) => k.startsWith(y + "-")).reduce((a, k) => a + mm[k], 0);
  assert(Math.abs(full("2025") - tot[2025]) / tot[2025] < 0.01 && Math.abs(full("2024") - tot[2024]) / tot[2024] < 0.01, "a soma mensal de 2024 e 2025 coincide com o total anual (diferença < 1%)");
  console.log("ytd", ytd("2023"), ytd("2024"), ytd("2025"), ytd("2026"), "anual mensal", full("2024"), full("2025"));
  assert(ytd("2026") === 9252204 && ytd("2025") === 8432560 && r1((ytd("2026") / ytd("2025") - 1) * 100) === 9.7, "janeiro a setembro: 9,25 milhões em 2026, 8,43 em 2025 (+9,7%)");
  assert(ytd("2026") < ytd("2023"), "janeiro a setembro de 2026 abaixo do mesmo período de 2023");
  assert(mm["2026-08"] === 1795021 && Object.keys(mm).every((k) => mm[k] <= mm["2026-08"]), "agosto de 2026: 1,80 milhões, o mês com mais espetadores desde janeiro de 2023");
  const rows = Object.keys(tot).map((y) => ({ cat: y, v: r2(tot[y] / 1e6), n: tot[y], alt: +y >= 2020 && +y <= 2021 }));
  write("cinema-espetadores-portugal-2006-2025", {
    rows,
    views: [
      { id: "ano", label: "Por ano", yLabel: "Espetadores de cinema em Portugal, por ano (milhões)", unit: " milhões", decimals: 2, labelEvery: 2, labelEveryNarrow: 4,
        series: [{ key: "v", label: "Espetadores (milhões)", color: "--accent-2", altColor: "--muted", altLabel: "2020–2021: encerramentos e limites de lotação na pandemia" }],
        notes: [{ cat: "2019", text: "2019: 15,5 milhões", short: "15,5" }, { cat: "2025", text: "2025: 11,0", short: "11,0" }] },
    ],
    summary: { tot, ytd: { 2023: ytd("2023"), 2024: ytd("2024"), 2025: ytd("2025"), 2026: ytd("2026") }, us2025: orig(2025, "US"), pt2025: orig(2025, "PT") },
  }, rawFiles("cinema-pt"));
}

// 4. Democracias e autocracias no mundo, 1900–2025 (V-Dem v16, Regimes of the World)
{
  const R = csv(path.join(RAW, "vdem", "vdem_v16_country_year_regime.csv"));
  const by = {};
  let na = 0;
  for (const r of R) { const y = +r.year; if (y < 1900) continue; if (r.v2x_regime === "") { na++; continue; } (by[y] ??= [0, 0, 0, 0])[+r.v2x_regime]++; }
  const ys = Object.keys(by).map(Number).sort((a, b) => a - b);
  assert(ys[0] === 1900 && ys.at(-1) === 2025 && ys.length === 126, "126 anos, de 1900 a 2025");
  const aut = (y) => by[y][0] + by[y][1], dem = (y) => by[y][2] + by[y][3];
  assert(by[2025].join() === "35,57,56,31" && aut(2025) === 92 && dem(2025) === 87 && aut(2025) + dem(2025) === 179, "2025: 35 autocracias fechadas, 57 eleitorais, 56 democracias eleitorais, 31 liberais (92 autocracias, 87 democracias, 179 países)");
  assert(aut(2024) === 93 && dem(2024) === 86, "2024: 93 autocracias e 86 democracias (dados revistos na v16)");
  assert(ys.filter((y) => dem(y) > aut(y)).join() === Array.from({ length: 21 }, (_, i) => 2003 + i).join(), "as democracias só foram mais do que as autocracias entre 2003 e 2023");
  const libMax = ys.reduce((a, y) => (by[y][3] > by[a][3] ? y : a));
  assert(libMax === 2009 && by[2009][3] === 45, "democracias liberais: máximo de 45 em 2009");
  assert(by[2024][3] === 30 && by[2025][3] === 31 && by[1992][3] === 30 && ys.filter((y) => y > 1992 && y < 2024).every((y) => by[y][3] > 31), "democracias liberais: 30 em 2024 e 31 em 2025; entre 1993 e 2023 sempre mais de 31; 30 em 1992");
  assert(ys.filter((y) => y > 1992 && by[y][3] <= 31).join() === "2024,2025" && by[1992][3] <= 31, "31 democracias liberais em 2025: o número mais baixo desde 1992");
  assert(by[2025][0] === 35 && ys.filter((y) => y > 2001 && by[y][0] >= 35).join() === "2025" && by[2001][0] >= 35, "35 autocracias fechadas em 2025: o número mais alto desde 2001");
  assert(by[1974].join() === "86,36,16,20" && dem(1974) === 36 && dem(1990) === 62 && dem(2003) === 95, "democracias: 36 em 1974, 62 em 1990, 95 em 2003");
  const demMax = Math.max(...ys.map(dem));
  assert(demMax === 95 && ys.filter((y) => dem(y) === 95).join() === "2003,2004,2016", "máximo de democracias: 95 (2003, 2004 e 2016)");
  const prt = R.filter((r) => r.country_text_id === "PRT").reduce((o, r) => ((o[+r.year] = +r.v2x_regime), o), {});
  assert(prt[1975] === 0 && prt[1976] === 2 && prt[1977] === 3, "Portugal: autocracia fechada até 1975, democracia eleitoral em 1976, liberal desde 1977");
  const reg = (iso, y) => +R.find((r) => r.country_text_id === iso && +r.year === y).v2x_regime;
  assert(reg("USA", 2024) === 3 && reg("USA", 2025) === 2, "EUA: democracia liberal em 2024, democracia eleitoral em 2025");
  assert(reg("IND", 2025) === 1 && reg("LUX", 2025) === 3, "Índia: autocracia eleitoral em 2025; Luxemburgo: democracia liberal");
  console.log("anos sem classificação (1900–2025):", na);
  const rows = ys.map((y) => ({ x: y, aut: aut(y), dem: dem(y), fech: by[y][0], elA: by[y][1], elD: by[y][2], lib: by[y][3], n: aut(y) + dem(y) }));
  assert(rows.find((q) => q.x === 1900).n === 120, "1900: 120 países ou territórios classificados");
  write("democracias-autocracias-mundo-1900-2025", {
    rows,
    config: {
      x: { label: "Ano", tableLabel: "Ano", min: 1900, max: 2025, ticks: [1900, 1920, 1940, 1960, 1974, 1990, 2003, 2025] },
      y: { label: "Número de países", suffix: "", decimals: 0, logDefault: false, linMin: 0, linMax: Math.ceil(Math.max(...rows.map((q) => q.aut), ...rows.map((q) => q.dem)) / 10) * 10 },
      series: [
        { key: "aut", label: "Autocracias (total)", short: "Autocracias", color: "--ink", width: 2.8 },
        { key: "dem", label: "Democracias (total)", short: "Democracias", color: "--accent-2", width: 2.8 },
        { key: "lib", label: "Democracias liberais", short: "Dem. liberais", color: "--accent-4", width: 1.4 },
        { key: "fech", label: "Autocracias fechadas", short: "Aut. fechadas", color: "--accent-3", width: 1.4 },
      ],
      labelMargin: [92, 120], shortEndLabels: true,
      scaleToggle: false, dots: false,
      shade: [{ from: 2003, to: 2023, label: "2003–2023: mais democracias", short: "2003–23", top: true }],
      annotations: [{ x: 1974, key: "dem", text: "1974: 36 democracias", short: "1974: 36", anchor: "end", dx: -8, dy: -10 }],
      howToRead: "Cada linha conta os países classificados em cada ano pelo projeto V-Dem. As linhas grossas são os totais: democracias (eleitorais e liberais) e autocracias (eleitorais e fechadas). As linhas finas mostram dois subgrupos: as democracias liberais, a categoria mais exigente, e as autocracias fechadas, sem eleições multipartidárias. A faixa marca os anos em que as democracias foram mais.",
    },
    summary: { y2025: by[2025], y2024: by[2024], libMax, demMax },
  }, rawFiles("vdem"));
}

// 5. Compras pela internet, 16–74 anos, últimos 12 meses (Eurostat isoc_ec_ib20)
{
  const E = jstat(path.join(RAW, "compras-online", "eurostat_isoc_ec_ib20_I_BLT12_I_BUY3.json"));
  const v = (geo, t, ind = "I_BLT12") => E.v({ freq: "A", ind_type: "IND_TOTAL", indic_is: ind, unit: "PC_IND", geo, time: t });
  const NOMES = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };
  const eu = Object.keys(NOMES);
  assert(eu.every((g) => v(g, "2021") != null && v(g, "2025") != null), "27 países com valores em 2021 e 2025");
  assert(v("FR", "2020") == null, "França sem valor em 2020 — por isso a comparação começa em 2021");
  assert(E.st({ freq: "A", ind_type: "IND_TOTAL", indic_is: "I_BLT12", unit: "PC_IND", geo: "EU27_2020", time: "2021" }) === "b" && E.st({ freq: "A", ind_type: "IND_TOTAL", indic_is: "I_BLT12", unit: "PC_IND", geo: "EU27_2020", time: "2020" }) === "e", "UE: 2020 estimado e quebra de série em 2021 (também na Alemanha e na Irlanda)");
  assert(r1(v("PT", "2025")) === 60.5 && r1(v("PT", "2021")) === 51.6 && r1(v("EU27_2020", "2025")) === 73.6 && r1(v("EU27_2020", "2021")) === 67.1, "Portugal 51,6% → 60,5%; UE 67,1% → 73,6%");
  assert(v("PT", "2025") < v("EU27_2020", "2021"), "Portugal em 2025 ainda abaixo da UE em 2021");
  const rank25 = [...eu].sort((p, q) => v(q, "2025") - v(p, "2025")).indexOf("PT") + 1;
  const rank21 = [...eu].sort((p, q) => v(q, "2021") - v(p, "2021")).indexOf("PT") + 1;
  console.log("posição PT 2021/2025:", rank21, rank25);
  assert(rank25 === 24 && rank21 === 24, "Portugal em 24.º lugar entre 27 em 2021 e em 2025 (só Bulgária, Itália e Roménia abaixo em 2025)");
  assert(["BG", "IT", "RO"].every((g) => v(g, "2025") < v("PT", "2025")) && r1(v("RO", "2025")) === 60.3, "abaixo de Portugal em 2025: Bulgária, Itália e Roménia (60,3%)");
  assert(r1(v("PT", "2025") - v("PT", "2021")) === 8.9 && r1(v("EU27_2020", "2025") - v("EU27_2020", "2021")) === 6.5, "subida 2021–2025: +8,9 pontos em Portugal, +6,5 na UE");
  assert(r1(v("EU27_2020", "2025") - v("PT", "2025")) === 13.1 && r1(v("EU27_2020", "2021") - v("PT", "2021")) === 15.5, "diferença para a UE: 15,5 pontos em 2021, 13,1 em 2025");
  assert(r1(v("RO", "2021")) === 38.5, "Roménia: 38,5% em 2021");
  assert(r1(v("RO", "2025") - v("RO", "2021")) === 21.8 && r1(v("EL", "2025") - v("EL", "2021")) === 13.8, "Roménia +21,8 pontos; Grécia +13,8");
  assert(r1(v("IE", "2025")) === 95.1 && r1(v("NL", "2025")) === 94.2, "Irlanda 95,1% e Países Baixos 94,2% em 2025");
  assert(r1(v("PT", "2025", "I_BUY3")) === 49.6 && r1(v("EU27_2020", "2025", "I_BUY3")) === 62.4, "últimos 3 meses (2025): 49,6% em Portugal, 62,4% na UE");
  const rows = eu.map((g) => ({ label: NOMES[g], a: r1(v(g, "2021")), b: r1(v(g, "2025")), ...(g === "PT" ? { highlight: true } : {}) }));
  rows.push({ label: "UE-27", a: r1(v("EU27_2020", "2021")), b: r1(v("EU27_2020", "2025")) });
  write("compras-online-ue-2021-2025", {
    rows,
    config: {
      aLabel: "2021", bLabel: "2025", ref: r1(v("EU27_2020", "2025")), refLabel: "UE em 2025: 73,6%", unit: "%", decimals: 1, domain: [30, 100],
      howToRead: "Cada linha é um país da UE: vai da percentagem de pessoas dos 16 aos 74 anos que fizeram pelo menos uma compra pela internet nos 12 meses anteriores, em 2021 (ponto cinzento), à de 2025 (ponto azul). A linha tracejada é a média da UE em 2025. O eixo começa nos 30%. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por valor em 2025"], ["delta", "Por subida"]],
    },
    summary: { pt: { 2021: r1(v("PT", "2021")), 2025: r1(v("PT", "2025")) }, ue: { 2021: r1(v("EU27_2020", "2021")), 2025: r1(v("EU27_2020", "2025")) }, rank21, rank25 },
  }, rawFiles("compras-online"));
}

if (fails) { console.error(`\n${fails} verificação(ões) falharam.`); process.exit(1); }
console.log("\nTodas as verificações passaram.");
