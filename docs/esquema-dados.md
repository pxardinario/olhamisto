# Esquema de dados

## `data/editions/AAAA-MM-DD.json` (`ronda-visual/edition@1`)
| Campo | Tipo | Notas |
|---|---|---|
| date, number, status | string, int, "publicada" | |
| opening | string | frase de abertura (curta) |
| lead | id | peça principal |
| limitations | string[] | candidatas rejeitadas, verificações parciais, falhas |
| pieces[] | Piece | idealmente 5 |

**Piece:** `id` (estável, kebab-case, único em todo o arquivo) · `slug` · `kind` (`atualidade`/`descoberta`) · `theme` + `themeLabel` · `vizType` (`barras`, `linha`, `area`, `mapa`, `cronologia`, `tabela`, `dispersao`, …) + `vizLabel` · `interactive` · `title` · `question` (questão editorial) · `finding` (descoberta principal) · `context`, `interpretation` (40–70 palavras) · `chart` {`type` = renderizador, `dataset` = pasta} · `period` · `unit` · `sources[]` {`name`, `url`, `accessed`} · `method[]` (notas metodológicas, transformações, limitações) · `verification` {`status`, `by`, `date`, `note`}.

## `data/datasets/<id>/`
- `raw/` — ficheiros originais transcritos (CSV/JSON), imutáveis.
- `data.json` — dados transformados: `rows` (ou `members`) + `summary` (números citados no texto) + campos auxiliares do renderizador.

## `data/index.json` (`ronda-visual/index@1`, gerado)
`latest`, `editions[]` com metadados de cada peça (id, título, tema, tipo de visualização, questão, descoberta, período, dataset, fontes, estado de verificação). É a memória editorial consultada antes de cada edição.

## `data/corrections.json`
`{"corrections": [{date, edition, piece, title, change}]}` — registo público, mostrado em `/correcoes/`.

## Endereços públicos
Edição: `/AAAA/MM/DD/` · Peça: `/AAAA/MM/DD/<id>/` · Imagem de partilha: `/og/<id>.png` · `/feed.xml`, `/sitemap.xml`. Os `id` de peça são permanentes: nunca mudar depois de publicados.
