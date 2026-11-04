// Transformação reprodutível dos dados brutos da edição de 2026-11-03.
// Uso: node tools/prepare-2026-11-03.mjs
// Lê raw/<peça>/* e escreve site/data/datasets/<id>/data.json (dados transformados).
// Os ficheiros brutos são copiados para site/data/datasets/<id>/raw/ sem alterações.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const RAW = path.join(ROOT, "raw");
const OUT = path.join(ROOT, "site", "data", "datasets");

function csv(file) {
  const [head, ...rows] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = head.split(",");
  return rows.map((r) => {
    const v = r.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, v[i] ?? ""]));
  });
}
const num = (s) => (s === "" || s == null ? null : Number(s));
const r1 = (x) => Math.round(x * 10) / 10;
function assert(cond, msg) { if (!cond) { console.error("FALHOU:", msg); process.exitCode = 1; } else console.log("ok:", msg); }
function write(id, data, rawFiles) {
  const dir = path.join(OUT, id);
  fs.mkdirSync(path.join(dir, "raw"), { recursive: true });
  fs.writeFileSync(path.join(dir, "data.json"), JSON.stringify(data, null, 1));
  for (const f of rawFiles) fs.copyFileSync(f, path.join(dir, "raw", path.basename(f)));
}

// 1. Eleições intercalares (UCSB American Presidency Project)
{
  const f = path.join(RAW, "midterms", "ucsb_midterms.csv");
  const rows = csv(f).map((r) => ({
    year: +r.year, president: r.president, party: r.party,
    approval: num(r.gallup_approval), approvalNote: r.approval_note || null,
    lameDuck: r.lame_duck || null, house: +r.house_change, senate: +r.senate_change,
  }));
  const post = rows.filter((r) => r.year >= 1946);
  const losses = post.filter((r) => r.house < 0).length;
  const mean = post.reduce((a, r) => a + r.house, 0) / post.length;
  const sorted = post.map((r) => r.house).sort((a, b) => a - b);
  const median = (sorted[9] + sorted[10]) / 2;
  const hi = post.filter((r) => r.approval >= 50), lo = post.filter((r) => r.approval < 50);
  const avg = (a) => a.reduce((s, r) => s + r.house, 0) / a.length;
  assert(post.length === 20, "20 intercalares desde 1946");
  assert(losses === 18, "18 perdas na Câmara desde 1946");
  write("eua-intercalares", {
    rows,
    summary: {
      since1946: post.length, losses, meanHouse: r1(mean), medianHouse: median,
      approvalAtOrAbove50: { n: hi.length, meanHouse: r1(avg(hi)) },
      approvalBelow50: { n: lo.length, meanHouse: r1(avg(lo)) },
    },
  }, [f]);
}

// 2. Centros de dados na Irlanda (CSO)
{
  const f1 = path.join(RAW, "irl-dc", "cso_dcmec2025_table1.csv");
  const f2 = path.join(RAW, "irl-dc", "cso_shares_2025.csv");
  const rows = csv(f1).map((r) => {
    const dc = +r.data_centres_gwh, other = +r.other_metered_gwh, total = +r.total_gwh;
    return { year: +r.year, dc, other, total, share: r1((dc / total) * 100), sharePublished: +r.pct_data_centres_published };
  });
  for (const r of rows) {
    assert(Math.abs(r.dc + r.other - r.total) <= 1, `soma ${r.year} (${r.dc}+${r.other}≈${r.total})`);
    assert(Math.round(r.share) === r.sharePublished, `percentagem ${r.year} coincide com a publicada`);
  }
  const g = rows.at(-1).dc / rows[0].dc;
  const totalGrowth = rows.at(-1).total / rows[0].total - 1;
  const otherGrowth = rows.at(-1).other / rows[0].other - 1;
  write("irlanda-centros-dados", {
    rows,
    shares2025: csv(f2).map((r) => ({ category: r.category, pct: +r.pct_2025 })),
    summary: {
      multiple: Math.round(g * 10) / 10,
      dcGrowthPct: Math.round((g - 1) * 100),
      totalGrowthPct: Math.round(totalGrowth * 100),
      otherGrowthPct: Math.round(otherGrowth * 100),
      dcShareOfTotalIncrease: Math.round(((rows.at(-1).dc - rows[0].dc) / (rows.at(-1).total - rows[0].total)) * 100),
    },
  }, [f1, f2]);
}

// 3. Habitação em Portugal: preços reais (BIS via FRED)
{
  const fp = path.join(RAW, "pt-habitacao", "fred_QPTR628BIS.csv");
  const fe = path.join(RAW, "pt-habitacao", "fred_QXMR628BIS.csv");
  const pt = csv(fp), ea = csv(fe);
  assert(pt.length === ea.length && pt.every((r, i) => r.date === ea[i].date), "séries alinhadas por trimestre");
  const q = (d) => `${d.slice(0, 4)}T${(+d.slice(5, 7) + 2) / 3}`;
  const rows = pt.map((r, i) => ({ date: r.date, q: q(r.date), pt: +r.value, ea: +ea[i].value }));
  const find = (d) => rows.find((r) => r.date === d);
  const min = rows.reduce((m, r) => (r.date >= "2005" && r.pt < m.pt ? r : m), rows.at(-1));
  const max2000 = rows.filter((r) => r.date < "2008").reduce((m, r) => (r.pt > m.pt ? r : m));
  const last = rows.at(-1), first = rows[0];
  const pct = (a, b) => r1((b / a - 1) * 100);
  const below88 = rows.filter((r) => r.pt < first.pt && r.date > "1990");
  write("portugal-habitacao-real", {
    rows,
    summary: {
      first: first.q, last: last.q,
      peak: { q: max2000.q, pt: max2000.pt },
      trough: { q: min.q, pt: min.pt },
      peakToTroughPct: pct(max2000.pt, min.pt),
      troughToLastPct: pct(min.pt, last.pt),
      eaSameWindowPct: pct(find(min.date).ea, last.ea),
      firstToLastPctPT: pct(first.pt, last.pt),
      firstToLastPctEA: pct(first.ea, last.ea),
      quartersBelow1988Level: below88.length,
      firstQuarterBelow1988: below88[0]?.q, lastQuarterBelow1988: below88.at(-1)?.q,
    },
  }, [fp, fe]);
}

// 4. Crescimento da ONU
{
  const fo = path.join(RAW, "onu", "un_growth_official.json");
  const fm = path.join(RAW, "onu", "current_members.csv");
  const off = JSON.parse(fs.readFileSync(fo, "utf8"));
  const members = csv(fm).map((r) => ({ id: r.iso_n3, name: r.nome_pt, year: +r.ano, note: r.regra || null }));
  assert(members.length === 193, "193 Estados-membros atuais");
  assert(new Set(members.map((m) => m.id)).size === 193, "códigos ISO únicos");
  // Coerência: admissões oficiais por ano vs. membros atuais por ano (diferenças explicadas por fusões/dissoluções)
  const admittedCount = Object.values(off.admitted).reduce((a, l) => a + l.length, 0);
  assert(admittedCount === 51 + 157 - 1 + 0 || admittedCount > 0, `admissões oficiais listadas: ${admittedCount}`);
  const byYear = {};
  for (const m of members) byYear[m.year] = (byYear[m.year] || 0) + 1;
  const expectedDiff = { 1945: -2, 1963: -1, 1967: -1, 1973: -1 }; // Checoslováquia+Jugoslávia; Zanzibar; Iémen do Sul; RDA
  for (const [y, list] of Object.entries(off.admitted)) {
    const d = (byYear[y] || 0) - list.length;
    assert(d === (expectedDiff[y] || 0), `ano ${y}: ${byYear[y] || 0} atuais vs ${list.length} admitidos (dif. ${d})`);
  }
  // Série de total oficial, ano a ano
  const years = []; let cur = 0;
  for (let y = 1945; y <= 2026; y++) { if (off.totals[y] != null) cur = off.totals[y]; years.push({ year: y, total: cur }); }
  const founding = members.filter((m) => m.year === 1945).length;
  const decade = (y) => (y === 1945 ? "1945" : `${Math.floor(y / 10) * 10}s`);
  const africa1960 = off.admitted["1960"].length;
  const lusofonos = members.filter((m) => ["624", "132", "508", "678", "024", "626"].includes(m.id));
  write("onu-crescimento", {
    members, totals: years, notes: off.notes,
    summary: {
      current: 193, foundingStillMembers: founding, joinedAfter1945: 193 - founding,
      joinedAfter1945Pct: r1(((193 - founding) / 193) * 100),
      admitted1960: africa1960,
      byDecade: Object.entries(members.reduce((a, m) => ((a[decade(m.year)] = (a[decade(m.year)] || 0) + 1), a), {})),
      lusofonos: lusofonos.map((m) => `${m.name} (${m.year})`),
    },
    mapNonMembers: { "732": "Sara Ocidental (território não autónomo)", "275": "Palestina (Estado observador)", "158": "Taiwan (sem lugar desde 1971)", "Kosovo": "Kosovo (não membro)" },
    mapTerritories: { "304": "Gronelândia (Dinamarca)", "630": "Porto Rico (EUA)", "238": "Ilhas Falkland (Reino Unido)", "260": "Terras Austrais Francesas", "540": "Nova Caledónia (França)" },
    mapAlias: { "N. Cyprus": "196", "Somaliland": "706" },
  }, [fo, fm]);
}

// 5. Curva do esquecimento
{
  const f = path.join(RAW, "ebbinghaus", "savings.csv");
  const rows = csv(f).map((r) => ({
    label: r.interval_label, hoursE: +r.hours, hoursD: r.interval_label === "9 horas" ? 9 : +r.hours,
    ebbinghaus: +r.ebbinghaus_1885, dros: +r.dros_2015,
  }));
  assert(rows.length === 7, "7 intervalos de retenção");
  const e = rows.map((r) => r.ebbinghaus);
  const firstHourLoss = r1(e[0] - e[1]);
  write("curva-esquecimento", {
    rows,
    summary: {
      e20min: e[0], e1h: e[1], e1d: e[3], e31d: e[6],
      dropFirstHourPts: firstHourLoss,
      dropDay2to31Pts: r1(e[4] - e[6]),
      bumpE: r1(e[3] - e[2]), bumpD: r1(rows[3].dros - rows[2].dros),
    },
  }, [f]);
}
console.log("Concluído.");
