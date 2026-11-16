// Boletim-piloto ACIFF — edição de novembro de 2026.
// Lê raw/ (dados das fontes, sem alteração) e escreve data.json com cada número publicado.
// Cada número publicado tem um assert contra o valor lido diretamente da fonte.
// Uso: node pilotos/aciff/2026-11/prepare.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.join(DIR, "raw");
const rd = (p) => JSON.parse(fs.readFileSync(path.join(RAW, p), "utf8"));
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (a, b) => r1((a / b - 1) * 100);
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const EDICAO = "2026-11-17";

// ---------- 1. Turismo (INE) ----------
const PARES = { "1920605": "Figueira da Foz", "1910105": "Aveiro", "1910110": "Ílhavo", "1920603": "Coimbra", "1931009": "Leiria", "1D11011": "Nazaré", "1D11014": "Peniche", PT: "Portugal" };
function ineSerie(varcd, geo) {
  const j = rd(`ine_${varcd}_${geo}.json`)[0];
  const out = [];
  for (const [mes, arr] of Object.entries(j.Dados)) {
    const [nome, ano] = mes.split(" de ");
    const m = MESES.indexOf(nome.toLowerCase());
    assert.ok(m >= 0, `mês desconhecido: ${mes}`);
    const v = arr.find((r) => r.geocod === geo && (r.dim_3 === "T" || r.dim_3_t === "Total" || arr.length === 1));
    assert.ok(v && v.valor !== undefined && v.valor !== null && v.valor !== "", `sem valor ${varcd} ${geo} ${mes}`);
    out.push({ periodo: `${ano}-${String(m + 1).padStart(2, "0")}`, valor: Number(v.valor) });
  }
  return out.sort((a, b) => a.periodo.localeCompare(b.periodo));
}
const dorm = Object.fromEntries(Object.keys(PARES).map((g) => [g, ineSerie("0012088", g)]));
const hosp = Object.fromEntries(Object.keys(PARES).map((g) => [g, ineSerie("0012089", g)]));
const get = (s, p) => { const x = s.find((r) => r.periodo === p); assert.ok(x, `período ${p} em falta`); return x.valor; };
const ytd = (s, ano, ate) => s.filter((r) => r.periodo >= `${ano}-01` && r.periodo <= `${ano}-${ate}`).reduce((a, r) => a + r.valor, 0);

const FF = "1920605";
const ultimoTur = dorm[FF].at(-1).periodo;
assert.equal(ultimoTur, "2026-08");
const turismo = {
  periodo: ultimoTur,
  estado: "agosto de 2026: dados preliminares; janeiro a julho de 2026: provisórios (INE)",
  dormidas: get(dorm[FF], "2026-08"),
  dormidas_ano_anterior: get(dorm[FF], "2025-08"),
  hospedes: get(hosp[FF], "2026-08"),
  hospedes_ano_anterior: get(hosp[FF], "2025-08"),
};
turismo.var_dormidas = pct(turismo.dormidas, turismo.dormidas_ano_anterior);
turismo.var_hospedes = pct(turismo.hospedes, turismo.hospedes_ano_anterior);
turismo.estada = r2(turismo.dormidas / turismo.hospedes);
turismo.estada_ano_anterior = r2(turismo.dormidas_ano_anterior / turismo.hospedes_ano_anterior);
turismo.ytd_2026 = ytd(dorm[FF], 2026, "08");
turismo.ytd_2025 = ytd(dorm[FF], 2025, "08");
turismo.var_ytd = pct(turismo.ytd_2026, turismo.ytd_2025);
turismo.var_portugal = pct(get(dorm.PT, "2026-08"), get(dorm.PT, "2025-08"));
turismo.pares = Object.entries(PARES).filter(([g]) => g !== "PT").map(([g, nome]) => ({
  nome, var_agosto: pct(get(dorm[g], "2026-08"), get(dorm[g], "2025-08")), var_ytd: pct(ytd(dorm[g], 2026, "08"), ytd(dorm[g], 2025, "08")),
})).sort((a, b) => b.var_agosto - a.var_agosto);
turismo.serie = dorm[FF].filter((r) => r.periodo >= "2024-01");

// valores publicados, conferidos contra a leitura direta
assert.equal(turismo.dormidas, 61496);
assert.equal(turismo.dormidas_ano_anterior, 65300);
assert.equal(turismo.var_dormidas, -5.8);
assert.equal(turismo.hospedes, 26633);
assert.equal(turismo.var_hospedes, -2.1);
assert.equal(turismo.var_portugal, 1.7);
assert.equal(turismo.estada, 2.31);
assert.equal(turismo.estada_ano_anterior, 2.4);
assert.equal(turismo.var_ytd, -2.9);

// ---------- 2. Desemprego registado (IEFP) ----------
function parseCSV(txt) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const CONC = ["FIGUEIRA DA FOZ", "AVEIRO", "ÍLHAVO", "COIMBRA", "LEIRIA", "NAZARÉ", "PENICHE"];
const iefp = {};
for (const f of fs.readdirSync(path.join(RAW, "iefp/csv"))) {
  const rows = parseCSV(fs.readFileSync(path.join(RAW, "iefp/csv", f), "utf8"));
  const ym = rows[1].find((c) => c.includes("Ano M")).split(":")[1].trim();
  const per = `${ym.slice(0, 4)}-${ym.slice(4)}`;
  const reg = {};
  for (const r of rows) {
    if (CONC.includes((r[4] || "").trim())) reg[r[4].trim()] = Number(r[12]);
    if ((r[3] || "").trim() === "Total" && (r[4] || "").trim() === "Centro") reg._Centro = Number(r[12]);
  }
  assert.equal(Object.keys(reg).length, CONC.length + 1, `concelhos em falta em ${f}`);
  iefp[per] = reg;
}
const pers = Object.keys(iefp).sort();
assert.equal(pers.at(-1), "2026-09");
const desemprego = {
  periodo: "2026-09",
  valor: iefp["2026-09"]["FIGUEIRA DA FOZ"],
  ano_anterior: iefp["2025-09"]["FIGUEIRA DA FOZ"],
  centro: iefp["2026-09"]._Centro,
  centro_ano_anterior: iefp["2025-09"]._Centro,
};
desemprego.var = pct(desemprego.valor, desemprego.ano_anterior);
desemprego.var_centro = pct(desemprego.centro, desemprego.centro_ano_anterior);
desemprego.pares = CONC.map((c) => ({ nome: c === "FIGUEIRA DA FOZ" ? "Figueira da Foz" : c[0] + c.slice(1).toLowerCase(), var: pct(iefp["2026-09"][c], iefp["2025-09"][c]) }))
  .map((p) => ({ ...p, nome: p.nome.replace("ílhavo", "Ílhavo").replace("Ílhavo", "Ílhavo") })).sort((a, b) => a.var - b.var);
desemprego.serie = pers.map((p) => ({ periodo: p, valor: iefp[p]["FIGUEIRA DA FOZ"] }));
assert.equal(desemprego.valor, 2082);
assert.equal(desemprego.ano_anterior, 2296);
assert.equal(desemprego.var, -9.3);
assert.equal(desemprego.var_centro, -6.8);

// ---------- 3. Eletricidade (E-REDES) ----------
const el = rd("eredes/figueira_mensal_tensao_2023-2026.json").results;
const MAT = "Muito Alta, Alta e Média Tensões", BT = "Baixa Tensão";
const elS = (nivel) => el.filter((r) => r.nivel_de_tensao === nivel).map((r) => ({ periodo: r.data.slice(0, 7), valor: r.kwh / 1e6 })).sort((a, b) => a.periodo.localeCompare(b.periodo));
const mat = elS(MAT), bt = elS(BT);
assert.equal(mat.at(-1).periodo, "2026-07");
const freg = rd("eredes/figueira_freguesia_mat_2025-2026.json").results;
const lavos = (p) => { const x = freg.find((r) => r.data.startsWith(p) && r.freguesia === "LAVOS"); assert.ok(x, `Lavos ${p}`); return x.kwh / 1e6; };
const pais = rd("eredes/pais_mensal_tensao_2025-2026.json").results;
const paisMAT = (p) => pais.find((r) => r.data.startsWith(p) && r.nivel_de_tensao === MAT).kwh / 1e6;
const eletricidade = {
  periodo: "2026-07",
  mat: r1(get(mat, "2026-07")), mat_mes_anterior: r1(get(mat, "2026-06")), mat_ano_anterior: r1(get(mat, "2025-07")),
  lavos: r1(lavos("2026-07")), lavos_mes_anterior: r1(lavos("2026-06")), lavos_ano_anterior: r1(lavos("2025-07")),
  bt: r1(get(bt, "2026-07")), bt_ano_anterior: r1(get(bt, "2025-07")),
  var_pais_mat: pct(paisMAT("2026-07"), paisMAT("2025-07")),
  serie_mat: mat.filter((r) => r.periodo >= "2024-01").map((r) => ({ ...r, valor: r1(r.valor) })),
  serie_bt: bt.filter((r) => r.periodo >= "2024-01").map((r) => ({ ...r, valor: r1(r.valor) })),
  peso_lavos_junho: Math.round((lavos("2026-06") / get(mat, "2026-06")) * 100),
};
eletricidade.var_mat = pct(get(mat, "2026-07"), get(mat, "2025-07"));
eletricidade.var_bt = pct(get(bt, "2026-07"), get(bt, "2025-07"));
assert.equal(eletricidade.mat, 45.1);
assert.equal(eletricidade.mat_ano_anterior, 87.1);
assert.equal(eletricidade.lavos, 2.8);
assert.equal(eletricidade.lavos_mes_anterior, 48.3);
assert.equal(eletricidade.lavos_ano_anterior, 48.6);
assert.equal(eletricidade.var_mat, -48.2);
assert.equal(eletricidade.peso_lavos_junho, 55);
assert.equal(eletricidade.var_pais_mat, -1.4);
assert.equal(eletricidade.var_bt, 3.1);
// concelhos de comparação: consumo MAT de julho em linha com junho (±10 %)
const paresEl = rd("eredes/pares_jun-jul_2026.json").results.filter((r) => r.nivel_de_tensao === MAT);
for (const c of ["0603", "1009", "0110"]) {
  const jun = paresEl.find((r) => r.coddistritoconcelho === c && r.data.startsWith("2026-06")).kwh;
  const jul = paresEl.find((r) => r.coddistritoconcelho === c && r.data.startsWith("2026-07")).kwh;
  assert.ok(Math.abs(jul / jun - 1) < 0.1, `par ${c} fora de ±10 %`);
}
const antes = mat.filter((r) => r.periodo >= "2024-01" && r.periodo <= "2026-06").map((r) => r.valor);
assert.equal(Math.floor(Math.min(...antes)), 69);
assert.equal(Math.ceil(Math.max(...antes)), 100);

// ---------- 4. Crédito às PME (BPstat) ----------
const bp = rd("bpstat/12533747.json");
const idx = bp.dimension.reference_date.category.index;
const datas = Array.isArray(idx) ? idx : Object.keys(idx).sort((a, b) => idx[a] - idx[b]);
assert.equal(bp.size.at(-1), datas.length);
const juros = datas.map((d, i) => ({ periodo: d.slice(0, 7), valor: bp.value[i] }));
const ult = juros.at(-1);
assert.equal(ult.periodo, "2026-09");
let subidas = 0;
for (let i = juros.length - 1; i > 0 && juros[i].valor > juros[i - 1].valor; i--) subidas++;
const credito = {
  periodo: ult.periodo, valor: ult.valor, ano_anterior: get(juros, "2025-09"),
  subidas_consecutivas: subidas, minimo_recente: get(juros, "2026-03"),
  serie: juros.filter((r) => r.periodo >= "2024-10"),
};
credito.var_pp = r2(credito.valor - credito.ano_anterior);
assert.equal(credito.valor, 4.36);
assert.equal(credito.ano_anterior, 3.75);
assert.equal(credito.var_pp, 0.61);
assert.equal(credito.subidas_consecutivas, 6);

// ---------- 5. Concursos públicos (IMPIC/BASE) ----------
const an = rd("base/anuncios2026_regiao.json");
const procs = an.filter((x) => x.tipoActo !== "Anúncio de Alteração" && x.PrazoPropostas > 0);
const prazos = procs.map((x) => x.PrazoPropostas).sort((a, b) => a - b);
const mediana = prazos.length % 2 ? prazos[(prazos.length - 1) / 2] : (prazos[prazos.length / 2 - 1] + prazos[prazos.length / 2]) / 2;
const ate10 = prazos.filter((p) => p <= 10).length;
// abertos: prazo depois da data da edição; para procedimentos alterados, vale o anúncio mais recente
const ultimoPorProc = new Map();
for (const x of an) {
  const raiz = x.anuncioAnterior?.[0]?.antNAnuncio || x.nAnuncio;
  const cur = ultimoPorProc.get(raiz);
  if (!cur || x.dataPublicacao > cur.dataPublicacao) ultimoPorProc.set(raiz, x);
}
const abertos = [...ultimoPorProc.values()].filter((x) => (x.DataLimitePropostas || "") >= EDICAO)
  .sort((a, b) => a.DataLimitePropostas.localeCompare(b.DataLimitePropostas))
  .map((x) => ({
    prazo: x.DataLimitePropostas, entidade: x.designacaoEntidade.replace(", E. P. E.", ""),
    objeto: x.descricaoAnuncio.trim(), preco_base: x.PrecoBase === "Inexistente" ? null : Number(x.PrecoBase),
    cpv: (x.CPVs || [""])[0].replace(/^[\d-]+ - /, ""), anuncio: x.nAnuncio, url: x.url, alteracao: x.tipoActo === "Anúncio de Alteração",
  }));
const concursos = {
  ate: "2026-11-13", n_anuncios_2026: procs.length, prazo_mediano_dias: mediana, ate_10_dias: ate10,
  pct_ate_10_dias: Math.round((ate10 / procs.length) * 100), abertos,
};
assert.equal(abertos.length, 5);
assert.equal(concursos.prazo_mediano_dias, 12);
assert.equal(concursos.pct_ate_10_dias, 48);
assert.equal(concursos.n_anuncios_2026, 229);
assert.ok(abertos.every((a) => a.prazo >= EDICAO));

// ---------- 6. Fundos europeus (Portugal 2030) ----------
const avisos = new Map();
for (const f of fs.readdirSync(path.join(RAW, "fundos"))) for (const x of rd(`fundos/${f}`).avisos || []) avisos.set(x.aviso.codigoAviso, x);
const empresas = [...avisos.values()].filter((x) => {
  const tip = x.estrutura.map((e) => e.tipologiaOperacaoDesignacao || "").join(" ");
  return x.calendario.dataFimAtual.slice(0, 10) >= EDICAO && (/\(SI\)/.test(tip) || /Ações coletivas/i.test(tip));
}).map((x) => ({
  codigo: x.aviso.codigoAviso, nome: x.aviso.designacaoPT.trim().replace(/\s+/g, " "),
  fim: x.calendario.dataFimAtual.slice(0, 10), dotacao_meur: r1(x.estrutura.reduce((a, e) => a + (e.dotacao || 0), 0) / 1e6),
  coletiva: x.estrutura.some((e) => /Ações coletivas/i.test(e.tipologiaOperacaoDesignacao || "")),
})).sort((a, b) => a.fim.localeCompare(b.fim) || a.nome.localeCompare(b.nome));
assert.equal(empresas.length, 13);

const data = { edicao: EDICAO, gerado: new Date().toISOString(), turismo, desemprego, eletricidade, credito, concursos, fundos: { empresas } };
fs.writeFileSync(path.join(DIR, "data.json"), JSON.stringify(data, null, 1));
console.log("OK — data.json escrito.");
console.log(JSON.stringify({ turismo: { ...turismo, serie: undefined }, desemprego: { ...desemprego, serie: undefined }, eletricidade: { ...eletricidade, serie_mat: undefined }, credito: { ...credito, serie: undefined }, concursos, fundos: empresas }, null, 1));
