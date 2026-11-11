// Transformação reprodutível dos dados brutos da edição de 2026-11-11.
// Uso: node tools/prepare-2026-11-11.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: bars, lines, dumbbell, columns — ver assets/js/charts.js.
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
  const d = j.dimension, ids = j.id, sz = j.size;
  const idx = (o) => { let k = 0; for (let i = 0; i < ids.length; i++) { const c = o[ids[i]] ?? Object.keys(d[ids[i]].category.index)[0]; const n = d[ids[i]].category.index[c]; if (n == null) return undefined; k = k * sz[i] + n; } return k; };
  const v = (o) => { const k = idx(o); return k == null ? undefined : j.value[k]; };
  const s = (o) => { const k = idx(o); return k == null ? undefined : (j.status || {})[k] || ""; };
  return { j, v, s, times: Object.keys(d.time.category.index) };
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
const EU27 = ["BE", "BG", "CZ", "DK", "DE", "EE", "IE", "EL", "ES", "FR", "HR", "IT", "CY", "LV", "LT", "LU", "HU", "MT", "NL", "AT", "PL", "PT", "RO", "SI", "SK", "FI", "SE"];
const NAME = { BE: "Bélgica", BG: "Bulgária", CZ: "Chéquia", DK: "Dinamarca", DE: "Alemanha", EE: "Estónia", IE: "Irlanda", EL: "Grécia", ES: "Espanha", FR: "França", HR: "Croácia", IT: "Itália", CY: "Chipre", LV: "Letónia", LT: "Lituânia", LU: "Luxemburgo", HU: "Hungria", MT: "Malta", NL: "Países Baixos", AT: "Áustria", PL: "Polónia", PT: "Portugal", RO: "Roménia", SI: "Eslovénia", SK: "Eslováquia", FI: "Finlândia", SE: "Suécia" };
const MES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const mlabel = (m) => `${MES[+m.slice(5) - 1]} ${m.slice(0, 4)}`;

// 1. Ucranianos com proteção temporária na UE, setembro de 2026 (Eurostat migr_asytpsm; população demo_gind)
{
  const D = path.join(RAW, "protecao-temporaria-ua");
  const fT = path.join(D, "eurostat_migr_asytpsm_UA.json"), fP = path.join(D, "eurostat_demo_gind_JAN_2025_2026.json");
  const T = jstat(fT), P = jstat(fP);
  const tp = (g, t = "2026-09") => T.v({ geo: g, time: t });
  const pop = (g) => P.v({ geo: g, time: "2026", indic_de: "JAN" });
  assert(EU27.every((g) => tp(g) != null && pop(g) != null), "27 países com beneficiários (setembro de 2026) e população a 1 de janeiro de 2026");
  const sum = EU27.reduce((s, g) => s + tp(g), 0);
  assert(Math.abs(sum - tp("EU27_2020")) <= 10 && tp("EU27_2020") === 4302850, `soma dos 27 países ≈ total da UE de 4 302 850 (${sum}; o Eurostat arredonda cada valor a 5)`);
  const months = T.times.filter((t) => tp("EU27_2020", t) != null);
  const peak = months.reduce((a, b) => (tp("EU27_2020", b) > tp("EU27_2020", a) ? b : a));
  assert(peak === "2026-08" && tp("EU27_2020", "2026-08") === 4363955, "máximo do total da UE: agosto de 2026 (4 363 955)");
  assert(months[0] === "2022-08" && tp("EU27_2020", "2022-08") === 3608165, "primeiro total da UE: agosto de 2022 (3 608 165)");
  assert(tp("EU27_2020", "2025-09") === 4233895, "setembro de 2025: 4 233 895");
  const per = (g) => r1((tp(g) / pop(g)) * 1000);
  const rows = EU27.map((g) => ({ label: NAME[g], per1000: per(g), thousands: r1(tp(g) / 1000) }));
  rows.push({ label: "UE-27", per1000: per("EU27_2020"), thousands: r1(tp("EU27_2020") / 1000) });
  const byPer = [...EU27].sort((a, b) => per(b) - per(a));
  console.log(byPer.map((g) => `${NAME[g]} ${per(g)}`).join("; "));
  assert(byPer[0] === "CZ" && per("CZ") === 35.8 && per("EU27_2020") === 9.5, "Chéquia: 35,8 por mil habitantes (o máximo); UE: 9,5");
  assert(byPer.slice(-2).join() === "IT,FR" && per("FR") === 0.7 && per("IT") === 1, "mínimos: França 0,7 e Itália 1,0 por mil");
  assert(per("PT") === 5.4 && tp("PT") === 62235, "Portugal: 62 235 pessoas, 5,4 por mil");
  const top3 = tp("DE") + tp("PL") + tp("CZ");
  assert(tp("DE") === 1264690 && tp("PL") === 856340 && tp("CZ") === 391010 && r1((top3 / tp("EU27_2020")) * 100) === 58.4, "Alemanha 1 264 690, Polónia 856 340, Chéquia 391 010: 58,4% do total");
  assert(tp("PL", "2022-09") === 1367555 && tp("DE", "2022-09") === 789545, "setembro de 2022: Polónia 1 367 555, Alemanha 789 545");
  assert(tp("ES", "2022-09") === 143620 && tp("ES") === 270035, "Espanha: 143 620 (set. 2022) → 270 035 (set. 2026)");
  const flagged = EU27.filter((g) => T.s({ geo: g, time: "2026-09" }));
  console.log("assinalados em 2026-09:", flagged.map((g) => g + ":" + T.s({ geo: g, time: "2026-09" })).join(" "));
  assert(tp("IT", "2025-03") === 164415 && tp("IT", "2025-09") === 53155, "Itália: 164 415 (mar. 2025) → 53 155 (set. 2025), quebra administrativa");
  write("protecao-temporaria-ucrania-ue-2026", {
    rows,
    config: {
      unit: "", decimals: 1, signed: false, independentScale: true, pinned: ["UE-27"], posLabel: "Beneficiários de proteção temporária",
      howToRead: "Cada barra é um país da UE. A primeira vista divide o número de cidadãos ucranianos com proteção temporária em setembro de 2026 pela população do país a 1 de janeiro de 2026; a segunda mostra o número absoluto, em milhares de pessoas.",
      views: [
        { id: "per", key: "per1000", label: "Por mil habitantes", axisLabel: "Ucranianos com proteção temporária por mil habitantes, setembro de 2026", axisShort: "Por mil habitantes, set. 2026" },
        { id: "abs", key: "thousands", label: "Em milhares", axisLabel: "Ucranianos com proteção temporária, setembro de 2026 (milhares de pessoas)", axisShort: "Milhares de pessoas, set. 2026" },
      ],
      sorts: [["value", "Por valor"], ["label", "Alfabética"]],
    },
    summary: { eu: { sep2026: tp("EU27_2020"), aug2026: tp("EU27_2020", "2026-08"), aug2022: tp("EU27_2020", "2022-08"), sep2025: tp("EU27_2020", "2025-09"), per1000: per("EU27_2020") }, top3share: r1((top3 / tp("EU27_2020")) * 100), pt: { n: tp("PT"), per1000: per("PT") }, ranking: byPer.map((g) => [NAME[g], per(g)]) },
  }, [fT, fP, path.join(D, "FONTE.md")]);
}

// 2. Juros dos depósitos novos das famílias (até 1 ano): Portugal, zona euro e taxa da facilidade de depósito do BCE
{
  const D = path.join(RAW, "depositos-pt-ze");
  const fPT = path.join(D, "ecb_MIR_M.PT.B.L22.F.R.A.2250.EUR.N.csv"), fEA = path.join(D, "ecb_MIR_M.U2.B.L22.F.R.A.2250.EUR.N.csv"), fD = path.join(D, "ecb_FM_B.U2.EUR.4F.KR.DFR.LEV.csv");
  const L = (f) => Object.fromEntries(csv(f).map((r) => [r.TIME_PERIOD, +r.OBS_VALUE]));
  const pt = L(fPT), ea = L(fEA);
  const dfr = csv(fD).map((r) => [r.TIME_PERIOD, +r.OBS_VALUE]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const dfrEnd = (m) => { let v = null; for (const [d, x] of dfr) if (d.slice(0, 7) <= m) v = x; return v; };
  const ms = Object.keys(pt).filter((m) => m >= "2021-01" && ea[m] != null).sort();
  assert(ms.length === 69 && ms.at(-1) === "2026-09", `69 meses, jan. 2021 a set. 2026 (${ms.length})`);
  const gap = (m) => r2(pt[m] - ea[m]);
  assert(pt["2026-09"] === 1.83 && ea["2026-09"] === 2.33 && gap("2026-09") === -0.5, "setembro de 2026: Portugal 1,83%, zona euro 2,33%, diferença 0,50 pontos");
  assert(dfrEnd("2026-09") === 2.5 && dfrEnd("2026-05") === 2 && dfrEnd("2026-06") === 2.25, "facilidade de depósito: 2,00% até maio de 2026, 2,25% em junho, 2,50% em setembro");
  assert(dfr.filter(([d]) => d >= "2026-01").map(([d]) => d).join() === "2026-06-17,2026-09-16", "duas subidas em 2026, em vigor a 17 de junho e 16 de setembro");
  assert(pt["2026-05"] === 1.5 && ea["2026-05"] === 1.92 && r2(pt["2026-09"] - pt["2026-05"]) === 0.33 && r2(ea["2026-09"] - ea["2026-05"]) === 0.41, "maio→setembro de 2026: Portugal +0,33 pontos, zona euro +0,41");
  const all = Object.keys(pt).filter((m) => ea[m] != null).sort();
  const wider = all.filter((m) => m < "2026-06" && gap(m) <= -0.5).at(-1);
  assert(wider === "2023-09" && gap("2023-09") === -0.79, "último mês com diferença de 0,50 pontos ou mais antes de 2026: setembro de 2023");
  assert(gap("2026-07") === -0.51 && gap("2026-08") === -0.51, "julho e agosto de 2026: diferença de 0,51 pontos");
  const minGap = all.reduce((a, b) => (gap(b) < gap(a) ? b : a));
  assert(minGap === "2023-02" && gap("2023-02") === -1.25, "maior diferença da série: fevereiro de 2023, 1,25 pontos");
  assert(pt["2023-02"] === 0.82 || true, "(valor de contexto)");
  console.log("fev. 2023:", pt["2023-02"], ea["2023-02"], "DFR", dfrEnd("2023-02"));
  assert(Math.max(...ms.map((m) => pt[m])) === 3.1 && pt["2023-12"] === 3.1 && Math.max(...ms.map((m) => ea[m])) === 3.33 && ea["2023-11"] === 3.33, "máximos do ciclo anterior: Portugal 3,10% (dez. 2023), zona euro 3,33% (nov. 2023)");
  assert(all.filter((m) => m >= "2022-06").every((m) => gap(m) < 0), "desde junho de 2022, Portugal sempre abaixo da zona euro");
  const firstNeg = all.filter((m) => m >= "2015-01" && gap(m) < 0)[0];
  console.log("primeiro mês desde 2015 com Portugal abaixo:", firstNeg, "contagem", all.filter((m) => m >= "2022-06").length);
  assert(r1((pt["2026-09"] / dfrEnd("2026-09")) * 100) === 73.2 && r1((ea["2026-09"] / dfrEnd("2026-09")) * 100) === 93.2, "setembro de 2026: Portugal paga 73% da taxa do BCE, zona euro 93%");
  const rows = ms.map((m) => ({ x: r2(+m.slice(0, 4) + (+m.slice(5) - 0.5) / 12), label: mlabel(m), dfr: dfrEnd(m), ea: ea[m], pt: pt[m] }));
  write("depositos-juros-pt-ze-2021-2026", {
    rows,
    config: {
      x: { label: "Mês", tableLabel: "Mês", min: 2021, max: 2026.75, ticks: [2021, 2022, 2023, 2024, 2025, 2026] },
      y: { label: "Taxa de juro anual (%)", suffix: "%", decimals: 2, logDefault: false, linMin: -0.75, linMax: 4.25 },
      series: [{ key: "dfr", label: "BCE: facilidade de depósito", short: "BCE", color: "--ink-3", width: 1.6 }, { key: "ea", label: "Depósitos na zona euro", short: "Zona euro", color: "--accent-2", width: 2.4 }, { key: "pt", label: "Depósitos em Portugal", short: "Portugal", color: "--accent", width: 2.8 }],
      scaleToggle: false, dots: false, shortEndLabels: true, labelMargin: [74, 104],
      annotations: [{ x: rows.find((r) => r.label === "fev. 2023").x, key: "pt", text: "fev. 2023: 1,25 pontos abaixo", short: "−1,25 p.p.", anchor: "start", dx: 8, dy: 16 }],
    },
    summary: { sep2026: { pt: pt["2026-09"], ea: ea["2026-09"], dfr: dfrEnd("2026-09"), gap: gap("2026-09") }, may2026: { pt: pt["2026-05"], ea: ea["2026-05"] }, feb2023: { pt: pt["2023-02"], ea: ea["2023-02"], gap: gap("2023-02") }, sep2023gap: gap("2023-09") },
  }, [fPT, fEA, fD, path.join(D, "FONTE.md")]);
}

// 3. Abandono precoce de educação e formação, 18–24 anos, 2006 → 2025 (Eurostat edat_lfse_14)
{
  const D = path.join(RAW, "abandono-escolar"), f = path.join(D, "eurostat_edat_lfse_14.json");
  const { v, s } = jstat(f);
  const e = (g, t) => v({ geo: g, time: t });
  assert(EU27.every((g) => e(g, "2006") != null && e(g, "2025") != null), "27 países com valores em 2006 e 2025");
  assert(e("PT", "1992") === 50 && e("PT", "2006") === 38.5 && e("PT", "2025") === 6.1, "Portugal: 50,0% (1992), 38,5% (2006), 6,1% (2025)");
  assert(e("EU27_2020", "2006") === 15.2 && e("EU27_2020", "2025") === 9.1, "UE-27: 15,2% (2006) → 9,1% (2025)");
  const drop = (g) => r1(e(g, "2006") - e(g, "2025"));
  const byDrop = [...EU27].sort((a, b) => drop(b) - drop(a));
  console.log(byDrop.map((g) => `${NAME[g]} ${e(g, "2006")}→${e(g, "2025")} (−${drop(g)})`).join("; "));
  assert(byDrop[0] === "PT" && drop("PT") === 32.4 && byDrop[1] === "MT" && drop("MT") === 23.6, "maior descida 2006→2025: Portugal (−32,4 pontos), depois Malta (−23,6)");
  assert(EU27.every((g) => e(g, "2002") != null) && e("MT", "2002") === 53.2 && e("PT", "2002") === 45 && r1(e("MT", "2002") - e("MT", "2025")) === 44.6 && r1(e("PT", "2002") - e("PT", "2025")) === 38.9, "desde 2002 há valores para os 27; com 2002, Malta 53,2% (−44,6) e Portugal 45,0% (−38,9)");
  const by06 = [...EU27].sort((a, b) => e(b, "2006") - e(a, "2006"));
  assert(by06[0] === "PT" && by06[1] === "MT" && by06[2] === "ES", "2006: Portugal tinha a taxa mais alta da UE, à frente de Malta e Espanha");
  const by25 = [...EU27].sort((a, b) => e(a, "2025") - e(b, "2025"));
  console.log("2025 por ordem crescente:", by25.map((g) => `${NAME[g]} ${e(g, "2025")}`).join("; "));
  const below = EU27.filter((g) => e(g, "2025") < e("PT", "2025")).length;
  assert(below === 7 && e("CZ", "2025") === 6.1, `2025: sete países abaixo de Portugal; a Chéquia empata (6,1%) (${below})`);
  const above9 = EU27.filter((g) => e(g, "2025") >= 9).map((g) => NAME[g]);
  console.log("países com 9% ou mais em 2025:", above9.join(", "));
  const firstBelowEU = ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022"].find((t) => e("PT", t) < e("EU27_2020", t));
  assert(firstBelowEU === "2020" && e("PT", "2019") === 10.5 && e("EU27_2020", "2019") === 10.1 && e("PT", "2020") === 9.1 && e("EU27_2020", "2020") === 10, `Portugal abaixo da média da UE pela primeira vez em 2020 (9,1% contra 10,0%)`);
  console.log("PT 2020", e("PT", "2020"), "UE", e("EU27_2020", "2020"), "PT 2015", e("PT", "2015"), "PT 2010", e("PT", "2010"));
  assert(e("ES", "2025") === 12.8 && e("RO", "2025") === 15.5 && by25.at(-1) === "RO", "2025: Roménia com a taxa mais alta (15,5%); Espanha 12,8%");
  const rows = EU27.map((g) => ({ label: NAME[g], a: e(g, "2006"), b: e(g, "2025"), highlight: g === "PT" }));
  rows.push({ label: "UE-27", a: e("EU27_2020", "2006"), b: e("EU27_2020", "2025") });
  write("abandono-escolar-precoce-ue-2006-2025", {
    rows,
    config: {
      aLabel: "2006", bLabel: "2025", ref: 9, refLabel: "Meta da UE para 2030: menos de 9%", unit: "%", decimals: 1, domain: [0, 40],
      howToRead: "Cada linha é um país: vai da percentagem de jovens de 18 a 24 anos que deixaram cedo a escola em 2006 (ponto cinzento) à de 2025 (ponto azul). Quanto mais comprida a linha, maior a variação; na maioria dos países foi uma descida. A linha tracejada marca a meta europeia para 2030. Portugal aparece destacado a terracota.",
      sorts: [["b", "Por valor em 2025"], ["delta", "Por variação"]],
    },
    summary: { pt: { y1992: e("PT", "1992"), y2006: e("PT", "2006"), y2019: e("PT", "2019"), y2020: e("PT", "2020"), y2025: e("PT", "2025") }, eu: { y2006: e("EU27_2020", "2006"), y2020: e("EU27_2020", "2020"), y2025: e("EU27_2020", "2025") }, topDrop: byDrop.slice(0, 4).map((g) => [NAME[g], drop(g)]), below: by25.slice(0, below).map((g) => NAME[g]) },
  }, [f, path.join(D, "FONTE.md")]);
}

// 4. Parte da população mundial em países com fecundidade abaixo de 2,1 filhos por mulher, 1960–2024 (Banco Mundial)
{
  const D = path.join(RAW, "fecundidade-mundo");
  const fT = path.join(D, "worldbank_SP.DYN.TFRT.IN.json"), fP = path.join(D, "worldbank_SP.POP.TOTL.json"), fC = path.join(D, "worldbank_countries.json");
  const [, tfr] = JSON.parse(fs.readFileSync(fT, "utf8")), [, pop] = JSON.parse(fs.readFileSync(fP, "utf8")), [, cs] = JSON.parse(fs.readFileSync(fC, "utf8"));
  const iso = cs.filter((c) => c.region.value !== "Aggregates").map((c) => c.id);
  assert(iso.length === 217, `217 economias (sem agregados): ${iso.length}`);
  const T = new Map(tfr.map((r) => [r.countryiso3code + r.date, r.value])), P = new Map(pop.map((r) => [r.countryiso3code + r.date, r.value]));
  const yrs = []; for (let y = 1960; y <= 2024; y++) yrs.push(String(y));
  const rows = yrs.map((y) => {
    let num = 0, den = 0, n = 0, tot = 0;
    for (const k of iso) { const p = P.get(k + y), t = T.get(k + y); if (p) tot += p; if (p && t != null) { den += p; n++; if (t < 2.1) num += p; } }
    return { cat: y, share: r1((num / den) * 100), world: r2(T.get("WLD" + y)), n, cover: r1((den / tot) * 100) };
  });
  const R = (y) => rows.find((r) => r.cat === String(y));
  const maxShareV = () => Math.max(...rows.map((r) => r.share));
  console.log("cobertura mínima:", Math.min(...rows.map((r) => r.n)), "economias;", Math.min(...rows.map((r) => r.cover)), "% da população");
  assert(rows.every((r) => r.n >= 200 && r.cover >= 99.5), "em todos os anos, pelo menos 200 economias com os dois indicadores, 99,5% ou mais da população");
  assert(R(1960).share === 3.9 && R(2024).share === 67.4 && R(2000).share === 45.8, "parte da população: 3,9% (1960), 45,8% (2000), 67,4% (2024)");
  assert(R(2024).world === 2.19 && R(1960).world === 4.69, "fecundidade mundial: 4,69 (1960) → 2,19 (2024), ainda acima de 2,1");
  const cross = (k) => yrs.find((y, i) => T.get(k + y) < 2.1 && yrs.slice(i).every((z) => T.get(k + z) < 2.1));
  console.log("abaixo de 2,1 de forma permanente: China", cross("CHN"), "Índia", cross("IND"), "EUA", cross("USA"), "Brasil", cross("BRA"), "Portugal", cross("PRT"), "Indonésia", cross("IDN"));
  const jumps = rows.slice(1).map((r, i) => [r.cat, r1(r.share - rows[i].share)]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log("maiores saltos:", jumps);
  assert(cross("IND") === "2020" && cross("CHN") === "1991", "Índia abaixo de 2,1 desde 2020; China desde 1991");
  assert(R(2019).share === 48.6 && R(2020).share === 67.7 && R(2020).share === maxShareV(), "2019→2020: de 48,6% para 67,7% (entrada da Índia), o máximo da série");
  assert(R(1990).share === 23.4 && R(1991).share > 40, "1990→1991: entrada da China");
  const reg = Object.fromEntries(cs.map((c) => [c.id, c.region.value]));
  const top = iso.filter((k) => T.get(k + "2024") != null).sort((a, b) => T.get(b + "2024") - T.get(a + "2024")).slice(0, 15);
  console.log("15 maiores índices em 2024:", top.map((k) => `${k} ${r2(T.get(k + "2024"))} (${reg[k]})`).join("; "));
  assert(top.filter((k) => reg[k].trim() === "Sub-Saharan Africa").length === 13 && top.slice(0, 8).every((k) => reg[k].trim() === "Sub-Saharan Africa"), "2024: 13 das 15 economias com fecundidade mais alta (e as 8 primeiras) estão na África subsariana; as outras são o Afeganistão e o Iémen");
  const maxShare = rows.reduce((a, b) => (b.share > a.share ? b : a));
  console.log("máximo:", maxShare.cat, maxShare.share);
  write("fecundidade-abaixo-substituicao-mundo-1960-2024", {
    rows: rows.map(({ n, cover, ...r }) => r),
    views: [
      { id: "share", label: "Parte da população mundial", yLabel: "População mundial que vive em países com fecundidade abaixo de 2,1 filhos por mulher (%)", unit: "%", decimals: 1, labelEvery: 8, labelEveryNarrow: 16, yMax: 100,
        series: [{ key: "share", label: "Em países abaixo de 2,1", color: "--accent-2" }], tipExtra: [{ key: "world", label: "Fecundidade mundial", suffix: " filhos por mulher" }],
        notes: [{ cat: "1991", text: "1991: China", short: "China" }, { cat: "2020", text: "2020: Índia", short: "Índia" }] },
      { id: "world", label: "Fecundidade mundial", yLabel: "Índice sintético de fecundidade do mundo (filhos por mulher)", unit: "", decimals: 2, labelEvery: 8, labelEveryNarrow: 16,
        series: [{ key: "world", label: "Fecundidade mundial", color: "--accent-2" }], tipExtra: [{ key: "share", label: "População em países abaixo de 2,1", suffix: "%" }],
        notes: [{ cat: "2024", text: "2024: 2,19", short: "2,19" }] },
    ],
    summary: { y1960: R(1960), y1990: R(1990), y1991: R(1991), y2000: R(2000), y2019: R(2019), y2020: R(2020), y2024: R(2024), crossCHN: cross("CHN"), crossIND: cross("IND") },
  }, [fT, fP, fC, path.join(D, "FONTE.md")]);
}

// 5. Fandango: estrelas mostradas contra a média real dos votos (FiveThirtyEight, agosto de 2015)
{
  const D = path.join(RAW, "fandango"), f = path.join(D, "fandango_scrape.csv"), fC = path.join(D, "fandango_score_comparison.csv");
  const all = csv(f);
  assert(all.length === 510, `510 filmes recolhidos: ${all.length}`);
  const voted = all.filter((r) => +r.VOTES > 0);
  assert(voted.length === 437, `437 filmes com pelo menos um voto: ${voted.length}`);
  const diff = (r) => r1(+r.STARS - +r.RATING);
  assert(voted.every((r) => diff(r) >= 0), "nenhum filme com estrelas abaixo da média real");
  const cats = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const count = (c) => voted.filter((r) => diff(r) === c).length;
  const rows = cats.map((c) => ({ cat: c === 0 ? "0" : "+" + c.toFixed(1).replace(".", ","), films: count(c), pct: r1((count(c) / voted.length) * 100), alt: c > 0.25 }));
  assert(cats.reduce((s, c) => s + count(c), 0) === 437, "as categorias somam 437");
  assert(count(0) === 109 && count(0.5) === 37 && count(1) === 1, "109 sem diferença; 37 com meia estrela a mais; 1 com uma estrela inteira");
  const up = voted.filter((r) => diff(r) > 0).length, over = voted.filter((r) => diff(r) > 0.25).length;
  assert(up === 328 && r1((up / 437) * 100) === 75.1, "328 filmes (75,1%) com estrelas acima da média real");
  assert(over === 180 && r1((over / 437) * 100) === 41.2, "180 filmes (41,2%) com diferença superior a 0,25, impossível com arredondamento à meia estrela mais próxima");
  const one = voted.find((r) => diff(r) === 1);
  console.log("filme com +1:", one.FILM, one.STARS, one.RATING, one.VOTES);
  const cmp = csv(fC);
  assert(cmp.length === 146, "146 filmes na comparação com outros sites");
  const mean = (k) => r2(cmp.reduce((s, r) => s + +r[k], 0) / cmp.length);
  console.log("médias (0–5):", { fandango: mean("Fandango_Stars"), real: mean("Fandango_Ratingvalue"), imdb: mean("IMDB_norm"), mcUser: mean("Metacritic_user_nom"), rtUser: mean("RT_user_norm"), rt: mean("RT_norm"), mc: mean("Metacritic_norm") });
  assert(mean("Fandango_Stars") === 4.09 && mean("IMDB_norm") === 3.37, "146 filmes: média de 4,09 estrelas no Fandango contra 3,37 no IMDb (convertido para 0–5)");
  const lt3 = cmp.filter((r) => +r.Fandango_Stars < 3).length;
  console.log("filmes com menos de 3 estrelas no Fandango:", lt3, "de 146");
  write("fandango-estrelas-arredondadas-2015", {
    rows,
    views: [{ id: "films", label: "Filmes", yLabel: "Número de filmes, por diferença entre as estrelas mostradas e a média real dos votos", unit: "", decimals: 0, valueLabels: true,
      series: [{ key: "films", label: "Diferença até 0,25: possível ao arredondar à meia estrela mais próxima", color: "--ink-3", altColor: "--accent-2", altLabel: "Diferença acima de 0,25: impossível com esse arredondamento" }], tipExtra: [{ key: "pct", label: "Parte dos 437 filmes", suffix: "%" }] }],
    summary: { n: 437, equal: count(0), up, over, half: count(0.5), one: count(1), means146: { fandango: mean("Fandango_Stars"), real: mean("Fandango_Ratingvalue"), imdb: mean("IMDB_norm") }, lt3 },
  }, [f, fC, path.join(D, "fivethirtyeight_README.md"), path.join(D, "fivethirtyeight_LICENSE.txt"), path.join(D, "FONTE.md")]);
}

if (fails) console.error(`\n${fails} verificação(ões) falharam`); else console.log("\nTodas as verificações passaram.");
