// Testa, no início de cada execução, que fontes oficiais respondem pela linha de comandos.
// Uso: node tools/net-check.mjs  → imprime uma tabela e grava /tmp/net-check.json
// Usa curl (respeita o proxy do ambiente). Não altera nada no repositório.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const TESTS = [
  ["INE (API de indicadores)", "https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0008074&lang=PT"],
  ["Eurostat (API)", "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/tps00001?format=JSON&geo=PT&lang=EN"],
  ["Pordata", "https://www.pordata.pt/"],
  ["Banco de Portugal (BPstat)", "https://bpstat.bportugal.pt/"],
  ["OCDE (SDMX)", "https://sdmx.oecd.org/public/rest/dataflow/all?detail=allstubs"],
  ["Banco Mundial (API)", "https://api.worldbank.org/v2/country/PRT/indicator/SP.POP.TOTL?format=json&per_page=2"],
  ["FRED (CSV)", "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DCOILBRENTEU"],
  ["Our World in Data (grapher)", "https://ourworldindata.org/grapher/life-expectancy.csv"],
  ["ONU (dados)", "https://data.un.org/"],
  ["dados.gov.pt", "https://dados.gov.pt/"],
  ["Zenodo", "https://zenodo.org/"],
  ["OSF", "https://osf.io/"],
  ["GitHub (raw)", "https://raw.githubusercontent.com/datasets/gdp/main/README.md"],
];
const out = [];
for (const [name, url] of TESTS) {
  let code = "000", err = "";
  try {
    code = execFileSync("curl", ["-sS", "-L", "-o", "/dev/null", "-w", "%{http_code}", "-m", "25", "-A", "Olhamisto/1.0 (+https://olhamisto.com)", url], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) { err = String(e.stderr || e.message).split("\n")[0].slice(0, 120); }
  const ok = /^2|^3/.test(code);
  out.push({ name, url, code, ok, err });
  console.log(`${ok ? "OK   " : "FALHA"} ${code}  ${name}${err ? "  — " + err : ""}`);
}
fs.writeFileSync("/tmp/net-check.json", JSON.stringify({ date: new Date().toISOString(), results: out }, null, 1));
const fails = out.filter((r) => !r.ok);
console.log(fails.length ? `\n${fails.length} fonte(s) inacessível(eis) pela linha de comandos: regista em limitations se isso afetar candidatas.` : "\nTodas as fontes responderam.");
