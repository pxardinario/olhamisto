# Mapa de fontes acessíveis

Para que serve: poupar tempo em becos sem saída. Antes de escolher uma candidata, confirma aqui se a fonte é alcançável neste ambiente e com que licença. Quando descobrires uma fonte nova que funciona (ou uma que deixou de funcionar), atualiza este ficheiro na mesma edição, com a data do teste.

## Como o ambiente chega à web

- **Linha de comandos (curl, git):** só chega ao GitHub (incluindo `raw.githubusercontent.com`) e aos registos de pacotes (npm, PyPI). Testado em 2026-11-05: `ec.europa.eu` e `www.ine.pt` não respondem pela linha de comandos.
- **WebFetch:** chega à web em geral, mas só abre URLs que tenham aparecido antes num resultado de WebSearch. Converte a página em texto: tabelas HTML funcionam; gráficos em imagem, mapas e PDFs pesados quase nunca.
- **Consequência prática:** dados que existam como CSV no GitHub são os mais fiáveis de obter, porque se descarregam completos e sem transcrição manual. Prefere-os quando a fonte original for a mesma.

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
| TidyTuesday, conjuntos de dados semanais | github.com/rfordatascience/tidytuesday | **varia por conjunto**: confirmar a licença de cada um | 2026-11-05 (repositório acessível) |

Regras: confirma sempre a licença no próprio repositório (README, LICENSE ou datapackage.json) e regista-a no `raw/` da peça. Os ficheiros agregadores (OWID, Datasets) citam a fonte primária: cita as duas.

## Fontes que funcionam por WebFetch (com cuidado)

- **INE e PORDATA:** destaques e quadros em HTML funcionam; ficheiros Excel e PDFs grandes muitas vezes não.
- **Eurostat:** o data browser e as tabelas em HTML costumam funcionar; o Statistics Explained falhou em 2026-11-04, e os valores por país aparecem muitas vezes só em mapas ou gráficos de imagem (falhou para habitação em 2026-11-03 e para IA em 2026-11-05).
- **Banco de Portugal (BPstat), OCDE, Banco Mundial, FRED:** preferir páginas de séries com os valores em texto.
- **Artigos científicos:** o resumo raramente chega; procurar o pacote de dados de replicação (OSF, openICPSR, Dataverse, Zenodo) e confirmar a licença.

## Becos sem saída conhecidos

- Valores que só existem em mapas ou gráficos de imagem.
- PDFs e Excel do relatório anual da NATO (2026-11-04).
- Registos internacionais de dadores de órgãos: sem licença de reutilização clara (2026-11-05).
