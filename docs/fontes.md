# Mapa de fontes acessíveis

Para que serve: poupar tempo em becos sem saída. Antes de escolher uma candidata, confirma aqui se a fonte é alcançável neste ambiente e com que licença. Quando descobrires uma fonte nova que funciona (ou uma que deixou de funcionar), atualiza este ficheiro na mesma edição, com a data do teste.

## Como o ambiente chega à web

- **Desde 2026-11-09, a tarefa diária corre no ambiente «Olhamisto»**, com acesso de rede próprio pela linha de comandos a: `*.ine.pt`, `*.pordata.pt`, `*.europa.eu` (Eurostat, BCE), `*.bportugal.pt`, `*.oecd.org`, `*.worldbank.org`, `fred.stlouisfed.org`, `*.ourworldindata.org`, `*.un.org`, `dados.gov.pt`, `zenodo.org`, `osf.io`, além do GitHub e dos registos de pacotes. Para acrescentar um domínio, é o Pedro que o faz nas definições do ambiente (não se contorna por outras vias).
- **Teste obrigatório no início de cada execução:** `node tools/net-check.mjs`. Se uma fonte falhar, usa as alternativas abaixo e regista em `limitations` as candidatas afetadas. Depois do primeiro teste com sucesso, atualiza esta secção com a data e os resultados (e corrige os endereços de API que não funcionarem).
- **Ordem de preferência para dados:** (1) API ou ficheiro oficial descarregado com `curl` para `raw/<peça>/` (série completa, sem transcrição manual); (2) cópia no GitHub da mesma série (citar a fonte primária); (3) transcrição de uma página por WebFetch, só para poucos valores e com verificação reforçada.
- **Linha de comandos no ambiente antigo (até 2026-11-06):** só chegava ao GitHub e aos registos de pacotes.
- **WebFetch:** chega à web em geral, mas só abre URLs que tenham aparecido antes num resultado de WebSearch. Converte a página em texto: tabelas HTML funcionam; gráficos em imagem, mapas e PDFs pesados quase nunca.
- **Consequência prática:** dados que existam como CSV no GitHub são os mais fiáveis de obter, porque se descarregam completos e sem transcrição manual. Prefere-os quando a fonte original for a mesma.

## APIs oficiais (a confirmar no primeiro teste; ajustar se falharem)

| Fonte | Padrão de endereço | Notas |
|---|---|---|
| Eurostat | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/<código>?format=JSON&lang=EN&geo=PT&geo=EU27_2020` | JSON-stat; o código do conjunto está no data browser. CSV: `https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/<código>/?format=SDMX-CSV` |
| INE | `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=<código>&lang=PT` | o código do indicador (varcd) aparece no endereço do indicador no portal do INE |
| Banco de Portugal (BPstat) | API em `bpstat.bportugal.pt` | confirmar a documentação da API no próprio site |
| OCDE | `https://sdmx.oecd.org/public/rest/data/<fluxo>/<chave>?format=csvfilewithlabels` | o explorador de dados da OCDE mostra o pedido da API |
| Banco Mundial | `https://api.worldbank.org/v2/country/<ISO3>/indicator/<código>?format=json&per_page=20000` | CC BY 4.0 |
| FRED | `https://fred.stlouisfed.org/graph/fredgraph.csv?id=<série>` | sem chave; confirmar a licença da série (algumas são de terceiros) |
| Our World in Data | `https://ourworldindata.org/grapher/<gráfico>.csv` | CC BY 4.0; confirmar a fonte primária de cada gráfico |

## Fontes testadas pela linha de comandos (descarga direta)

| Fonte | Endereço | Licença | Testado |
|---|---|---|---|
| Our World in Data, emissões de CO₂ e GEE por país e ano | raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv | CC BY 4.0 (dados de terceiros: ver a fonte original indicada no ficheiro) | 2026-11-05, 14 MB |
| Our World in Data, energia por país e ano | raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv | CC BY 4.0 (idem) | 2026-11-05, 9 MB |
| Datasets (Open Knowledge), PIB por país | raw.githubusercontent.com/datasets/gdp/main/data/gdp.csv | CC BY 4.0 (datapackage.json) | 2026-11-05 |
| Datasets, população por país | raw.githubusercontent.com/datasets/population/main/data/population.csv | ver datapackage.json | 2026-11-05 |
| Datasets, temperatura global anual | raw.githubusercontent.com/datasets/global-temp/main/data/annual.csv | CC BY 4.0 (datapackage.json) | 2026-11-05 |
| Datasets, CO₂ atmosférico (Mauna Loa) | raw.githubusercontent.com/datasets/co2-ppm/main/data/co2-mm-mlo.csv | ver datapackage.json | 2026-11-05 |
| FiveThirtyEight, conjuntos de dados | github.com/fivethirtyeight/data | CC BY 4.0 | 2026-11-05 (repositório acessível) |
| Datasets, preços do petróleo (Brent e WTI, diários, EIA) | raw.githubusercontent.com/datasets/oil-prices/main/data/brent-daily.csv | ODC-PDDL-1.0 | 2026-11-06, atualizado até 3/11/2026; faltam dias em vários anos antes de 2007 |
| OWID, arquivo owid-datasets (centenas de conjuntos históricos: Maddison 2020, homicídios de Eisner, alfabetização, livros…) | github.com/owid/owid-datasets (`git clone --depth 1 --filter=blob:none --no-checkout` e `git ls-tree`; ficheiros por raw.githubusercontent.com) | CC BY 4.0, mas confirmar a fonte de cada conjunto (p. ex. linhas do IHME têm licença não comercial) | 2026-11-06; alguns CSV estão vazios |
| Reproducibility Project: Psychology | github.com/CenterForOpenScience/rpp (`git show c755df6:rpp_data.csv`) | CC0 1.0 (projeto OSF osf.io/ezcuj) | 2026-11-06; o CSV convertido em data_allformats tem colunas desalinhadas, usar o rpp_data.csv do histórico |
| TidyTuesday, conjuntos de dados semanais | github.com/rfordatascience/tidytuesday | **varia por conjunto**: confirmar a licença de cada um | 2026-11-05 (repositório acessível) |

Regras: confirma sempre a licença no próprio repositório (README, LICENSE ou datapackage.json) e regista-a no `raw/` da peça. Os ficheiros agregadores (OWID, Datasets) citam a fonte primária: cita as duas.

## Fontes que funcionam por WebFetch (com cuidado)

- **INE e PORDATA:** destaques e quadros em HTML funcionam; ficheiros Excel e PDFs grandes muitas vezes não.
- **Eurostat:** o data browser e as tabelas em HTML costumam funcionar; o Statistics Explained falhou em 2026-11-04, e os valores por país aparecem muitas vezes só em mapas ou gráficos de imagem (falhou para habitação em 2026-11-03 e para IA em 2026-11-05).
- **Banco de Portugal (BPstat), OCDE, Banco Mundial, FRED:** preferir páginas de séries com os valores em texto.
- **Artigos científicos:** o resumo raramente chega; procurar o pacote de dados de replicação (OSF, openICPSR, Dataverse, Zenodo) e confirmar a licença.

## Becos sem saída conhecidos

- 2026-11-06: o WebFetch falhou para todos os domínios fora do GitHub (ine.pt, osf.io, jornais), com erro de resolução de nomes. A API api.github.com também foi recusada; `git clone` e raw.githubusercontent.com funcionaram. Nesses dias, contar só com dados do GitHub.

- Valores que só existem em mapas ou gráficos de imagem.
- PDFs e Excel do relatório anual da NATO (2026-11-04).
- Registos internacionais de dadores de órgãos: sem licença de reutilização clara (2026-11-05).
