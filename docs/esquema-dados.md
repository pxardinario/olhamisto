# Esquema de dados

## `data/editions/AAAA-MM-DD.json` (`ronda-visual/edition@1`)
| Campo | Tipo | Notas |
|---|---|---|
| date, number, status | string, int, "publicada" | |
| opening | string | frase de abertura (curta) |
| lead | id | peça principal |
| limitations | string[] | candidatas rejeitadas, verificações parciais, falhas |
| pieces[] | Piece | idealmente 5 |
| chave | Chave | «A Chave do Dia», obrigatória a partir de 2026-11-06 (ou nota «Chave do Dia: …» em `limitations`) |

**Piece:** `id` (estável, kebab-case, único em todo o arquivo) · `slug` · `kind` (`atualidade`/`descoberta`) · `theme` + `themeLabel` · `vizType` (`barras`, `linha`, `area`, `mapa`, `cronologia`, `tabela`, `dispersao`, …) + `vizLabel` · `interactive` · `title` · `question` (questão editorial) · `finding` (descoberta principal) · `context`, `interpretation` (40–70 palavras) · `chart` {`type` = renderizador, `dataset` = pasta} · `period` · `unit` · `sources[]` {`name`, `url`, `accessed`} (o nome começa pela entidade que produziu os dados; cópias e espelhos — GitHub, repositórios de terceiros — levam «cópia» ou «secundária» no nome, para não aparecerem na linha «Fonte:» do gráfico nem no PNG) · `method[]` (notas metodológicas, transformações, limitações) · `verification` {`status`, `by`, `date`, `note`}.

**Chave:** `id` (kebab-case, permanente) · `axis` (`portugal`/`pensamento`/`sabedoria`/`economia`/`geopolitica`/`ciencia`) + `axisLabel` · `certainty` · `title` · `concept` · `lesson[]` (2–3 parágrafos de 40–70 palavras) · `diagram` {`title`, `svg`, `caption`} · `aside` («Já agora») · `application` («Onde se aplica») · `motto` · `sources[]` {`name`, `url`, `accessed`} · `notes[]` · `verification` {`status`, `by`, `date`, `note`}. Detalhe em docs/chave-do-dia.md. Renderizada por `site/assets/js/chave.js` (navegador e pré-renderização).

## `data/datasets/<id>/`
- `raw/` — ficheiros originais transcritos (CSV/JSON), imutáveis.
- `data.json` — dados transformados: `rows` (ou `members`) + `summary` (números citados no texto) + campos auxiliares do renderizador.

## `data/index.json` (`ronda-visual/index@1`, gerado)
`latest`, `editions[]` com metadados de cada peça e, quando existe, da Chave do Dia (`chave`: id, título, eixo, verificação — base da regra de rotação) (id, título, tema, tipo de visualização, questão, descoberta, período, dataset, fontes, estado de verificação). É a memória editorial consultada antes de cada edição.

## `data/corrections.json`
`{"corrections": [{date, edition, piece, title, change}]}` — registo público, mostrado em `/correcoes/`.

## Endereços públicos
Edição: `/AAAA/MM/DD/` · Peça: `/AAAA/MM/DD/<id>/` · Imagem de partilha: `/og/<id>.png` · `/feed.xml`, `/sitemap.xml`. Os `id` de peça são permanentes: nunca mudar depois de publicados.
