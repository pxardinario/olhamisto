// Transformação reprodutível dos dados brutos da edição de 2026-11-10.
// Uso: node tools/prepare-2026-11-10.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json; copia os brutos para site/data/datasets/<id>/raw/.
// Renderizadores genéricos usados: scatter, bars, columns, lines (com a opção nova «gaps») — ver assets/js/charts.js.
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
// JSON-stat do Eurostat: v({dim: código, ...}); dimensões omitidas tomam o primeiro código.
function jstat(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const d = j.dimension, ids = j.id, sz = j.size;
  const v = (o) => { let k = 0; for (let i = 0; i < ids.length; i++) { const c = o[ids[i]] ?? Object.keys(d[ids[i]].category.index)[0]; const n = d[ids[i]].category.index[c]; if (n == null) return undefined; k = k * sz[i] + n; } return j.value[k]; };
  return { j, v, times: Object.keys(d.time.category.index) };
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
const fmt = (x, d = 1) => x.toFixed(d).replace(".", ",");

// 1. Empresas: taxa de natalidade (2021) e sobrevivência a três anos da geração de 2021, UE-27 (Eurostat bd_size)
{
  const D = path.join(RAW, "empresas-ue"), f = path.join(D, "eurostat_bd_size.json");
  const { v } = jstat(f);
  const q = (ind, age, g, t) => v({ freq: "A", age, sizeclas: "TOTAL", indic_sbs: ind, nace_r2: "B-S_X_O_S94", geo: g, time: t });
  const birth = (g, t) => q("ENT_BRTHR_PC", "TOTAL", g, t), death = (g, t) => q("ENT_DTHR_PC", "TOTAL", g, t);
  const surv3 = (g) => q("ENT_SRVLR_BRTH_CHB_PC", "Y3", g, "2021"), surv3b = (g) => q("ENT_SRVLR_BRTH_PC", "Y3", g, "2024");
  const surv1 = (g) => q("ENT_SRVLR_BRTH_CHB_PC", "Y1", g, "2021");
  assert(EU27.every((c) => birth(c, "2021") != null && surv3(c) != null && birth(c, "2024") != null), "27 países com taxa de natalidade (2021, 2024) e sobrevivência a três anos");
  assert(EU27.every((c) => surv3(c) === surv3b(c)), "sobrevivência da geração de 2021 aos três anos = sobrevivência aos três anos publicada para 2024 (dois indicadores coincidem)");
  assert(birth("PT", "2021") === 14.38 && surv3("PT") === 47.71 && birth("EU27_2020", "2021") === 10.8 && surv3("EU27_2020") === 57.18, "Portugal: natalidade 14,38% em 2021, sobrevivência 47,71%; UE: 10,8% e 57,18%");
  const rows = EU27.map((c) => ({ label: NAME[c], x: birth(c, "2021"), y: surv3(c), group: c === "PT" ? "pt" : "ue", b2024: birth(c, "2024") }));
  rows.push({ label: "UE-27 (agregado)", x: birth("EU27_2020", "2021"), y: surv3("EU27_2020"), group: "media", b2024: birth("EU27_2020", "2024") });
  const bySurv = [...EU27].sort((a, b) => surv3(a) - surv3(b));
  assert(bySurv.slice(0, 3).join() === "LT,DK,PT", `menor sobrevivência a três anos: Lituânia ${surv3("LT")}%, Dinamarca ${surv3("DK")}%, Portugal ${surv3("PT")}%`);
  assert(surv3("NL") === 78.11 && surv3("BE") === 74.9 && bySurv.at(-1) === "NL", "maior sobrevivência: Países Baixos 78,11%; Bélgica 74,9%");
  const byB21 = [...EU27].sort((a, b) => birth(b, "2021") - birth(a, "2021"));
  assert(byB21.indexOf("PT") === 4 && byB21.slice(0, 4).join() === "EE,LT,FR,MT", `natalidade 2021: Portugal em 5.º (atrás de Estónia, Lituânia, França, Malta)`);
  const byB24 = [...EU27].sort((a, b) => birth(b, "2024") - birth(a, "2024"));
  assert(byB24[0] === "LT" && byB24[1] === "PT" && birth("PT", "2024") === 16.08 && birth("LT", "2024") === 17.47 && birth("EU27_2020", "2024") === 10.36, "natalidade 2024: Lituânia 17,47%, Portugal 16,08% (2.º); UE 10,36%");
  assert(birth("PT", "2022") === 16.74 && birth("PT", "2023") === 16.82, "Portugal: 16,74% (2022), 16,82% (2023)");
  assert(death("PT", "2024") === 11.83 && death("EU27_2020", "2024") === 9.2, "mortalidade 2024: Portugal 11,83%, UE 9,2% (provisórias)");
  assert(surv1("PT") === 75.83 && surv1("EU27_2020") === 81.17, "sobrevivência ao 1.º ano (geração 2021): Portugal 75,83%, UE 81,17%");
  assert(r1(100 - surv3("PT")) === 52.3, "Portugal: 52,3% das empresas nascidas em 2021 já não estavam ativas em 2024");
  const both = EU27.filter((c) => birth(c, "2021") > birth("EU27_2020", "2021") && surv3(c) < surv3("EU27_2020")).map((c) => NAME[c]);
  console.log("acima da média na natalidade e abaixo na sobrevivência:", both.join(", "));
  assert(both.length === 7 && both.includes("Portugal"), `sete países com natalidade acima e sobrevivência abaixo da UE: ${both.join(", ")}`);
  write("empresas-natalidade-sobrevivencia-ue", {
    rows,
    config: {
      x: { label: "Empresas nascidas em 2021, em % das ativas →", short: "Natalidade 2021 (%) →", tipLabel: "Taxa de natalidade 2021 (%)", min: 4, max: 27, ticks: [5, 10, 15, 20, 25], decimals: 0, tipDecimals: 1 },
      y: { label: "Sobreviventes em 2024 (%)", short: "Sobreviventes 2024 (%)", tipLabel: "Ainda ativas em 2024 (%)", min: 40, max: 82, ticks: [40, 50, 60, 70, 80], decimals: 0, tipDecimals: 1 },
      groups: [{ key: "pt", label: "Portugal", color: "--accent" }, { key: "ue", label: "Outros países da UE", color: "--accent-2" }, { key: "media", label: "UE-27 (agregado)", color: "--ink", shape: "ring" }],
      howToRead: "Cada ponto é um país da UE. Na horizontal, quantas empresas nasceram em 2021 por cada 100 ativas; na vertical, quantas dessas recém-nascidas ainda estavam ativas três anos depois, em 2024. Em baixo à direita ficam os países onde nascem muitas empresas e poucas sobrevivem. O anel é o agregado da UE.",
      notes: [{ x: 14.9, y: 45.6, text: "Portugal" }, { x: 19.9, y: 44.6, text: "Lituânia" }, { x: 24.8, y: 63.8, text: "Estónia", anchor: "end" }, { x: 11.6, y: 78.4, text: "Países Baixos" }, { x: 10.2, y: 55.4, text: "UE-27", anchor: "end" }],
    },
    summary: { pt: { birth2021: birth("PT", "2021"), birth2024: birth("PT", "2024"), surv1: surv1("PT"), surv3: surv3("PT"), death2024: death("PT", "2024") }, eu: { birth2021: birth("EU27_2020", "2021"), birth2024: birth("EU27_2020", "2024"), surv1: surv1("EU27_2020"), surv3: surv3("EU27_2020"), death2024: death("EU27_2020", "2024") }, lowestSurvival: bySurv.slice(0, 5).map((c) => [NAME[c], surv3(c)]), highBirthLowSurvival: both },
  }, [f, path.join(D, "FONTE.md")]);
}

// 2. Preços das casas e rendas, 2015 → 2025, UE-27 (Eurostat prc_hpi_a e prc_hicp_aind CP041)
{
  const D = path.join(RAW, "casas-rendas-ue");
  const fH = path.join(D, "eurostat_prc_hpi_a_TOTAL_I15.json"), fR = path.join(D, "eurostat_prc_hicp_aind_CP041.json"), fC = path.join(D, "eurostat_prc_hicp_aind_CP00.json");
  const H = jstat(fH).v, R = jstat(fR).v, C = jstat(fC).v;
  const h = (g, t = "2025") => H({ geo: g, time: t }), r = (g, t = "2025") => R({ geo: g, time: t }), c = (g, t = "2025") => C({ geo: g, time: t });
  const have = EU27.filter((g) => h(g) != null && r(g) != null);
  assert(have.length === 26 && !have.includes("EL") && h("EL") == null, "26 países com os dois índices em 2025 (a Grécia não tem índice de preços da habitação no Eurostat)");
  assert(have.every((g) => h(g, "2015") === 100 && r(g, "2015") === 100), "base 2015 = 100 em todos");
  assert(h("PT") === 263.85 && r("PT") === 136.37 && c("PT") === 124.83, "Portugal 2025: casas 263,85; rendas 136,37; IHPC 124,83 (2015 = 100)");
  assert(h("EU27_2020") === 161.89 && r("EU27_2020") === 120.51, "UE-27 2025: casas 161,89; rendas 120,51");
  const gap = (g) => r1((h(g) / r(g) - 1) * 100);
  const rows = have.map((g) => ({ label: NAME[g], house: r1(h(g) - 100), rent: r1(r(g) - 100), gap: gap(g), highlight: g === "PT" }));
  rows.unshift({ label: "UE-27", house: r1(h("EU27_2020") - 100), rent: r1(r("EU27_2020") - 100), gap: gap("EU27_2020") });
  assert(gap("PT") === 93.5 && gap("EU27_2020") === 34.3, `preço das casas face às rendas: Portugal +${gap("PT")}%, UE +${gap("EU27_2020")}%`);
  const byGap = [...have].sort((a, b) => gap(b) - gap(a));
  assert(byGap[0] === "PT" && byGap[1] === "HU" && gap("HU") === 78.5, "maior afastamento entre casas e rendas: Portugal, depois Hungria (+78,5%)");
  const byHouse = [...have].sort((a, b) => h(b) - h(a));
  assert(byHouse[0] === "HU" && byHouse[1] === "PT" && r1(h("HU") - 100) === 266.6, "maior subida dos preços das casas: Hungria (+266,6%), depois Portugal (+163,9%)");
  const byRent = [...have].sort((a, b) => r(b) - r(a));
  console.log("posição de Portugal nas rendas:", byRent.indexOf("PT") + 1, byRent.map((g) => NAME[g] + " " + r1(r(g) - 100)).join("; "));
  assert(byRent.indexOf("PT") === 12, "rendas: Portugal na 13.ª maior subida (+36,4%)");
  assert(r1(h("PT") / r("PT")) === 1.9 && r1(h("PT") / 100) === 2.6, "Portugal: casas ×2,6; rácio casas/rendas ×1,9");
  assert(r1(r("PT") - 100) === 36.4 && r1(c("PT") - 100) === 24.8 && r1(c("EU27_2020") - 100) === 32.9, "rendas +36,4%, inflação geral em Portugal +24,8% (UE +32,9%)");
  assert(gap("FI") === -16.3 && h("FI") < 100, "Finlândia: única com preços das casas abaixo de 2015 e a subir menos do que as rendas (−16,3%)");
  const ptHouse = ["2019", "2022", "2024"].map((t) => h("PT", t));
  assert(ptHouse.join() === "141.88,190.17,224.44" && r1((h("PT") / h("PT", "2024") - 1) * 100) === 17.6, "Portugal: 2024→2025 +17,6% nos preços das casas");
  write("casas-rendas-ue-2015-2025", {
    rows,
    config: {
      unit: "%", decimals: 1, pinned: ["UE-27"], posLabel: "Subida desde 2015", negLabel: "Descida", highlightLabel: "Portugal",
      howToRead: "Cada barra mostra quanto subiu um índice entre 2015 e 2025. A primeira vista compara os preços das casas; a segunda, as rendas pagas pelos inquilinos; a terceira mostra quanto os preços das casas subiram a mais do que as rendas. A Grécia não tem índice de preços da habitação no Eurostat.",
      views: [
        { id: "gap", key: "gap", label: "Casas face às rendas", axisLabel: "Quanto os preços das casas subiram a mais do que as rendas, 2015–2025 (%)", axisShort: "Casas face às rendas, 2015–2025 (%)" },
        { id: "house", key: "house", label: "Preços das casas", axisLabel: "Variação do índice de preços da habitação, 2015–2025 (%)", axisShort: "Preços das casas, 2015–2025 (%)" },
        { id: "rent", key: "rent", label: "Rendas", axisLabel: "Variação do índice de rendas pagas pelos inquilinos (IHPC), 2015–2025 (%)", axisShort: "Rendas (IHPC), 2015–2025 (%)" },
      ],
      sorts: [["value", "Por valor"], ["label", "Alfabética"]],
    },
    summary: { pt: { house: h("PT"), rent: r("PT"), hicp: c("PT"), gap: gap("PT") }, eu: { house: h("EU27_2020"), rent: r("EU27_2020"), hicp: c("EU27_2020"), gap: gap("EU27_2020") }, topGap: byGap.slice(0, 5).map((g) => [NAME[g], gap(g)]), topHouse: byHouse.slice(0, 3).map((g) => [NAME[g], h(g)]) },
  }, [fH, fR, fC, path.join(D, "FONTE.md")]);
}

// 3. Amêndoa em Portugal, 2000–2025 (Eurostat apro_cpsh1)
{
  const D = path.join(RAW, "amendoa-pt"), f = path.join(D, "eurostat_apro_cpsh1_F4300_F4400.json");
  const { v, times } = jstat(f);
  const g = (geo, s, t, crop = "F4300") => v({ freq: "A", crops: crop, strucpro: s, geo, time: t });
  const P = (geo, t) => g(geo, "HPRD_HUMD_EU_THS_T", t), A = (geo, t) => g(geo, "AR_THS_HA", t);
  const yrs = times.filter((t) => t >= "2000" && t <= "2025");
  assert(yrs.length === 26 && yrs.every((t) => P("PT", t) != null && A("PT", t) != null), "Portugal: produção e área de amêndoa em todos os anos 2000–2025");
  const rows = yrs.map((t) => ({ cat: t, prod: P("PT", t), area: A("PT", t), yield: r2(P("PT", t) / A("PT", t)) }));
  assert(P("PT", "2015") === 10.09 && P("PT", "2024") === 90.76 && P("PT", "2025") === 86.22, "produção: 10,09 mil t (2015), 90,76 (2024), 86,22 (2025, provisório)");
  assert(r1(P("PT", "2024") / P("PT", "2015")) === 9, "2015→2024: produção ×9,0");
  assert(A("PT", "2015") === 30.15 && A("PT", "2024") === 73.77 && A("PT", "2025") === 73.77 && r1(A("PT", "2024") / A("PT", "2015")) === 2.4, "área: 30,15 → 73,77 mil ha (×2,4); 2025 igual a 2024 (provisório)");
  const minY = yrs.reduce((a, b) => (P("PT", b) < P("PT", a) ? b : a));
  assert(minY === "2013" && P("PT", "2013") === 4.45, "mínimo da série: 2013 (4,45 mil t)");
  assert(P("PT", "2000") === 16.74 && A("PT", "2000") === 37.92 && A("PT", "2010") === 26.84, "2000: 16,74 mil t em 37,92 mil ha; 2010: 26,84 mil ha (mínimo da área)");
  assert(Math.min(...yrs.map((t) => A("PT", t))) === 26.84, "26,84 mil ha é a área mínima (2009–2010)");
  assert(r2(P("PT", "2015") / A("PT", "2015")) === 0.33 && r2(P("PT", "2024") / A("PT", "2024")) === 1.23, "produção por hectare: 0,33 t (2015) → 1,23 t (2024)");
  // posição na UE
  const others = ["ES", "IT", "EL", "FR"];
  for (const t of ["2023", "2024", "2025"]) {
    const rest = r2(P("EU27_2020", t) - P("PT", t) - others.reduce((s, c) => s + P(c, t), 0));
    console.log(t, "UE-27 menos Portugal, Espanha, Itália, Grécia e França:", rest);
    assert(rest < 5, `${t}: os restantes países somam menos de 5 mil t`);
  }
  assert(P("PT", "2023") < P("IT", "2023") && P("PT", "2024") > P("IT", "2024") && P("PT", "2025") > P("IT", "2025"), "Portugal ultrapassa a Itália em 2024 e fica em 2.º na UE, atrás de Espanha");
  assert(P("ES", "2024") === 369.7 && P("IT", "2024") === 74.96 && P("EU27_2020", "2024") === 570.72, "2024: Espanha 369,7; Itália 74,96; UE 570,72 mil t");
  assert(r1(P("PT", "2024") / P("EU27_2020", "2024") * 100) === 15.9 && r1(P("PT", "2015") / P("EU27_2020", "2015") * 100) === 3.2, "quota de Portugal na UE: 3,2% (2015) → 15,9% (2024)");
  const chest = (t) => g("PT", "HPRD_HUMD_EU_THS_T", t, "F4400");
  console.log("castanha (contexto, não publicado):", yrs.map((t) => t + ":" + chest(t)).join(" "));
  write("amendoa-portugal-2000-2025", {
    rows,
    views: [
      { id: "prod", label: "Produção", yLabel: "Produção de amêndoa em Portugal (milhares de toneladas)", unit: " mil t", decimals: 1, labelEvery: 5, labelEveryNarrow: 5,
        series: [{ key: "prod", label: "Produção", color: "--accent" }], tipExtra: [{ key: "area", label: "Área", suffix: " mil ha" }],
        notes: [{ cat: "2013", text: "2013: 4,5 mil t", short: "4,5" }, { cat: "2024", text: "2024: 90,8 mil t", short: "90,8" }] },
      { id: "area", label: "Área", yLabel: "Área de amendoal em Portugal (milhares de hectares)", unit: " mil ha", decimals: 1, labelEvery: 5, labelEveryNarrow: 5,
        series: [{ key: "area", label: "Área", color: "--accent" }], tipExtra: [{ key: "prod", label: "Produção", suffix: " mil t" }],
        notes: [{ cat: "2010", text: "2010: 26,8 mil ha", short: "26,8" }, { cat: "2024", text: "2024: 73,8 mil ha", short: "73,8" }] },
    ],
    summary: { prod: { y2000: P("PT", "2000"), y2013: P("PT", "2013"), y2015: P("PT", "2015"), y2024: P("PT", "2024"), y2025: P("PT", "2025") }, area: { y2000: A("PT", "2000"), y2010: A("PT", "2010"), y2015: A("PT", "2015"), y2024: A("PT", "2024") }, eu2024: { ES: P("ES", "2024"), PT: P("PT", "2024"), IT: P("IT", "2024"), EU: P("EU27_2020", "2024") } },
  }, [f, path.join(D, "FONTE.md")]);
}

// 4. Idade mediana no Congresso dos EUA, 1919–2023 (FiveThirtyEight)
{
  const D = path.join(RAW, "congresso-eua"), f = path.join(D, "fivethirtyeight_data_aging_congress.csv");
  const all = csv(f);
  assert(all.length === 29120, `29 120 registos (membro × Congresso): ${all.length}`);
  const med = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const byC = new Map();
  for (const r of all) { const k = +r.congress; if (!byC.has(k)) byC.set(k, { start: r.start_date, H: [], S: [] }); byC.get(k)[r.chamber === "Senate" ? "S" : "H"].push(+r.age_years); }
  const cs = [...byC.keys()].sort((a, b) => a - b);
  assert(cs[0] === 66 && cs.at(-1) === 118 && cs.length === 53, "53 Congressos, do 66.º (1919) ao 118.º (2023)");
  const rows = cs.map((k) => { const o = byC.get(k), y = +o.start.slice(0, 4), a = [...o.H, ...o.S]; return { x: y, label: `${k}.º Congresso (${y})`, house: r1(med(o.H)), senate: r1(med(o.S)), all: r1(med(a)), over70: r1((a.filter((z) => z >= 70).length / a.length) * 100), n: a.length }; });
  const R = (y) => rows.find((r) => r.x === y);
  assert(R(2023).senate === 65.3 && Math.max(...rows.map((r) => r.senate)) === 65.3, "Senado 2023: idade mediana 65,3 anos, a mais alta desde 1919");
  assert(R(2023).house === 57.8 && R(2021).house === 58.3 && Math.max(...rows.map((r) => r.house)) === 58.3, "Câmara: 57,8 anos em 2023; máximo 58,3 em 2021");
  assert(R(1981).all === 49.3 && R(2023).all === 59.1 && Math.min(...rows.map((r) => r.all)) === 49.3, "Congresso inteiro: 49,3 anos em 1981 (mínimo) → 59,1 em 2023");
  assert(Math.max(...rows.map((r) => r.all)) === 59.4 && R(2021).all === 59.4, "máximo do Congresso inteiro: 59,4 (2021)");
  assert(R(1981).senate === 51.7 && R(1981).house === 48.5, "1981: Senado 51,7; Câmara 48,5");
  assert(r1(R(2023).senate - R(1981).senate) === 13.6, "Senado: +13,6 anos entre 1981 e 2023");
  assert(R(2023).over70 === 19.8 && R(1981).over70 === 3.5 && R(1979).over70 === 3.5, "membros com 70 anos ou mais no início do Congresso: 3,5% (1979, 1981) → 19,8% (2023)");
  assert(rows.filter((r) => r.x < 2005).every((r) => r.over70 < 9.5), "antes de 2005, nunca mais de 9,2% com 70 anos ou mais");
  assert(R(1919).all === 51 && R(1919).senate === 56.8, "1919: Congresso 51,0; Senado 56,8");
  write("congresso-eua-idade-1919-2023", {
    rows: rows.map(({ n, ...r }) => r),
    config: { x: { label: "Ano de início", tableLabel: "Congresso", min: 1919, max: 2023, ticks: [1923, 1935, 1947, 1959, 1971, 1983, 1995, 2007, 2019] },
      y: { label: "Idade mediana, em anos — eixo a partir de 44", suffix: " anos", decimals: 1, logDefault: false, linMin: 44, linMax: 68 },
      series: [{ key: "senate", label: "Senado", short: "Senado", color: "--accent-2", width: 3 }, { key: "house", label: "Câmara dos Representantes", short: "Câmara", color: "--accent-3", width: 2.4 }],
      scaleToggle: false, dots: true, shortEndLabels: true, labelMargin: [86, 104],
      annotations: [{ x: 1981, key: "senate", text: "1981: 51,7", anchor: "end", dx: 2, dy: 17 }, { x: 1981, key: "house", text: "1981: 48,5", anchor: "middle", dy: 18 }, { x: 2023, key: "senate", text: "2023: 65,3", short: "65,3", anchor: "end", dx: -8, dy: -10 }] },
    summary: { y1919: R(1919), y1981: R(1981), y2021: R(2021), y2023: R(2023) },
  }, [f, path.join(D, "fivethirtyeight_README.md"), path.join(D, "fivethirtyeight_LICENSE.txt"), path.join(D, "FONTE.md")]);
}

// 5. População do Leste e do Oeste da Alemanha, 1990–2025 (Eurostat demo_r_d2jan, NUTS 1)
{
  const D = path.join(RAW, "alemanha-leste"), f = path.join(D, "eurostat_demo_r_d2jan_DE_NUTS1.json");
  const { v, times } = jstat(f);
  const P = (g, t) => v({ freq: "A", unit: "NR", sex: "T", age: "TOTAL", geo: g, time: t });
  const E = ["DE4", "DE8", "DED", "DEE", "DEG"], W = ["DE1", "DE2", "DE5", "DE6", "DE7", "DE9", "DEA", "DEB", "DEC", "DEF"];
  const NM = { DE4: "Brandemburgo", DE8: "Meclemburgo-Pomerânia Ocidental", DED: "Saxónia", DEE: "Saxónia-Anhalt", DEG: "Turíngia", DE1: "Bade-Vurtemberga", DE2: "Baviera", DE5: "Bremen", DE6: "Hamburgo", DE7: "Hesse", DE9: "Baixa Saxónia", DEA: "Renânia do Norte-Vestefália", DEB: "Renânia-Palatinado", DEC: "Sarre", DEF: "Schleswig-Holstein", DE3: "Berlim" };
  assert(times[0] === "1990" && times.at(-1) === "2025" && times.length === 36, "1990–2025");
  const missing = times.filter((t) => [...E, ...W, "DE3"].some((g) => P(g, t) == null));
  assert(missing.join() === "2013", "único ano sem valores: 2013");
  const sum = (G, t) => (G.some((g) => P(g, t) == null) ? null : G.reduce((s, g) => s + P(g, t), 0));
  const e0 = sum(E, "1990"), w0 = sum(W, "1990"), b0 = P("DE3", "1990");
  const rows = times.map((t) => ({ x: +t, label: `1 jan. ${t}`, east: sum(E, t) == null ? null : r1((sum(E, t) / e0) * 100), west: sum(W, t) == null ? null : r1((sum(W, t) / w0) * 100), berlin: P("DE3", t) == null ? null : r1((P("DE3", t) / b0) * 100) }));
  assert(e0 === 15154584 && sum(E, "2025") === 12408640, "Leste (5 estados, sem Berlim): 15 154 584 (1990) → 12 408 640 (2025)");
  assert(w0 === 60548522 && sum(W, "2025") === 67483235, "Oeste (10 estados, sem Berlim): 60 548 522 → 67 483 235");
  const eChg = r1((sum(E, "2025") / e0 - 1) * 100), wChg = r1((sum(W, "2025") / w0 - 1) * 100), bChg = r1((P("DE3", "2025") / b0 - 1) * 100);
  assert(eChg === -18.1 && wChg === 11.5 && bChg === 8.4, `variação 1990–2025: Leste ${eChg}%, Oeste +${wChg}%, Berlim +${bChg}%`);
  assert(r1((e0 - sum(E, "2025")) / 1e6) === 2.7, "o Leste perdeu 2,7 milhões de habitantes");
  const chg = (g) => r1((P(g, "2025") / P(g, "1990") - 1) * 100);
  assert(E.every((g) => chg(g) < 0) && chg("DEE") === -28 && chg("DEG") === -21.7 && chg("DE8") === -19.9 && chg("DED") === -17.5 && chg("DE4") === -3.2, "todos os estados do Leste perderam: Saxónia-Anhalt −28,0%, Turíngia −21,7%, Meclemburgo −19,9%, Saxónia −17,5%, Brandemburgo −3,2%");
  assert(W.filter((g) => chg(g) < 0).join() === "DEC" && chg("DEC") === -5 && chg("DE2") === 18.1, "no Oeste só o Sarre perdeu (−5,0%); Baviera +18,1%");
  const R = (y) => rows.find((r) => r.x === y);
  assert(R(2010).east === 85.4 && R(2011).east === 83.4 && R(2014).east === 82.5 && R(2025).east === 81.9, "Leste: 85,4 (2010), 83,4 (2011, quebra), 82,5 (2014), 81,9 (2025)");
  const since14 = rows.filter((r) => r.x >= 2014 && r.east != null).map((r) => r.east);
  assert(Math.max(...since14) === 83.1 && Math.min(...since14) === 81.9, "desde 2014, o Leste manteve-se entre 81,9 e 83,1 (1990 = 100)");
  assert(R(2010).west === 108 && R(2011).west === 106.2, "Oeste: 108,0 (2010) → 106,2 (2011, quebra)");
  assert(r1((P("DE", "2011") / P("DE", "2010") - 1) * 100) === -1.9, "revisão do recenseamento de 2011: Alemanha −1,9% de um ano para o outro");
  assert(P("DE", "1990") - (e0 + w0 + b0) === 9299 && times.filter((t) => t !== "1990" && t !== "2013").every((t) => Math.abs(P("DE", t) - (sum(E, t) + sum(W, t) + P("DE3", t))) <= 100), "a soma dos estados fica 9 299 pessoas abaixo do total nacional em 1990 (diferença ≤ 100 nos outros anos)");
  write("alemanha-leste-populacao-1990-2025", {
    rows,
    config: { x: { label: "Ano", tableLabel: "Data", min: 1990, max: 2025, ticks: [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2025] },
      y: { label: "População, índice 1990 = 100 — eixo a partir de 75", suffix: "", decimals: 1, logDefault: false, linMin: 75, linMax: 115 },
      series: [{ key: "west", label: "Oeste (10 estados)", short: "Oeste", color: "--ink-2", width: 2.4 }, { key: "berlin", label: "Berlim", short: "Berlim", color: "--accent-4", width: 2 }, { key: "east", label: "Leste (5 estados)", short: "Leste", color: "--accent-2", width: 3 }],
      scaleToggle: false, dots: false, gaps: true, shortEndLabels: true, labelMargin: [86, 104],
      annotations: [{ x: 2011, key: "east", text: "2011: revisão do recenseamento", short: "2011: recenseamento", anchor: "end", dx: -4, dy: 20 }] },
    summary: { east: { y1990: e0, y2025: sum(E, "2025"), chg: eChg }, west: { y1990: w0, y2025: sum(W, "2025"), chg: wChg }, berlin: { y1990: b0, y2025: P("DE3", "2025"), chg: bChg }, states: Object.fromEntries([...E, ...W, "DE3"].map((g) => [NM[g], chg(g)])) },
  }, [f, path.join(D, "FONTE.md")]);
}

if (fails) console.error(`\n${fails} verificação(ões) falharam.`); else console.log("\nTodos os asserts passaram.");
