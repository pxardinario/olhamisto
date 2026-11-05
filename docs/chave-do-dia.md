# A Chave do Dia

Rubrica fixa que **fecha todas as edições**, depois das histórias. Muda de registo: as histórias mostram o mundo através de dados; a Chave dá uma ferramenta para o ler. É uma lição sobre um conceito (modelo mental, princípio de economia, facto de ciência, padrão histórico), contada em texto e com um esquema simples. **Não é um gráfico de dados** e não conta como uma das cinco histórias.

Exemplos publicados: «A falácia da janela partida» (2026-11-03), «O paradoxo da produtividade» (2026-11-04), «A regressão para a média» (2026-11-05). Usa-os como modelo de tom, extensão e rigor.

## Eixos e rotação
Seis eixos (campo `axis`):

| `axis` | Rótulo |
|---|---|
| `portugal` | Portugal em foco (demografia, mar, fiscalidade, economia real) |
| `pensamento` | Pensamento crítico e modelos mentais (vieses, falácias, estatística do dia a dia) |
| `sabedoria` | Produtividade e sabedoria prática (tempo, decisões, psicologia social) |
| `economia` | Economia e finanças (mercados, inflação, incentivos, teoria de jogos) |
| `geopolitica` | Geopolítica e história |
| `ciencia` | Ciência e tecnologia (física, biologia, neurociência, astronomia) |

**Regra de rotação:** lê o campo `chave` de cada edição em `site/data/index.json`. Escolhe um eixo que não tenha saído nas **últimas 4 edições**; entre esses, prefere o que saiu há mais tempo. Nunca repetir um conceito já publicado (compara `chave.title` e `chave.id`). A Chave não precisa de estar ligada às histórias do dia; se uma ligação natural existir, é bem-vinda, mas não se força.

**Ideias:** `editorial/chaves.json` tem uma lista de partida, algumas com **ressalvas de rigor obrigatórias**. Podes usar ideias novas. Quando publicares uma ideia da lista, retira-a.

## Estrutura (campos em `edition.chave`)
- `title` — nome do conceito, curto («A regressão para a média»).
- `concept` — uma ou duas frases que definem o conceito sem jargão.
- `lesson` — **2 ou 3 parágrafos de 40–70 palavras**. Primeiro um caso ou uma cena concreta; depois o mecanismo, com uma analogia; por fim o limite ou a ressalva honesta. Leitura total da rubrica: cerca de 2 minutos.
- `diagram` — `{title, svg, caption}`. Esquema conceptual em SVG inline (fluxo, comparação, antes/depois, ciclo). Regras: `viewBox` com 340 de largura; cores só com `var(--key-ink)`, `var(--key-ink-2)`, `var(--key-rule)`, `var(--key-acc)` e `rgba(200,144,42,.16)` para realces; texto ≥ 10,5 px; `role="img"` e `aria-label` com a descrição completa; ids internos (marcadores) com prefixo `chave-`; sem `<script>` nem atributos `on…`. Se usar números, têm de estar nas fontes; se for ilustrativo, a legenda diz «Esquema ilustrativo, não são dados reais».
- `aside` — **«Já agora»**: uma curiosidade histórica ou estatística verificada, com data ou número concretos.
- `application` — **«Onde se aplica»**: situações reais em que o conceito aparece. **Descritivo, nunca imperativo**: não dar tarefas ao leitor, não o tratar por «tu», não fazer desafios.
- `motto` — uma frase curta e memorável, impessoal (sem «tu» nem imperativo dirigido ao leitor).
- `certainty` — grau de certeza, visível no topo: «Consenso», «Consenso, com uma ressalva», «Consenso estatístico», «Dados oficiais · causas debatidas», «Tese debatida», «Mito popular (desmontado)».
- `sources[]` `{name, url, accessed}` e `notes[]` (método, limitações e explicação do grau de certeza).
- `verification` `{status, by, date, note}`.
- `id` (kebab-case, permanente), `axis`, `axisLabel`.

## Rigor (o que distingue esta rubrica das «pílulas» que circulam)
1. Cada facto, data e número tem fonte com URL. Fontes primárias ou académicas sempre que possível.
2. Distinguir **consenso**, **tese debatida** e **mito popular**, e dizê-lo no `certainty` e nas `notes`. Uma Chave pode ser precisamente sobre um mito desmontado.
3. Desconfiar das curiosidades famosas: verificar a origem antes de usar uma história conhecida (muitas são lendas ou simplificações). Se for simplificação, dizê-lo.
4. Analogias servem para explicar, não para provar.
5. A verificação independente (agente H) confere a Chave como confere as peças. **Se a Chave não passar a verificação, a edição sai sem Chave** e regista-se em `limitations` uma frase começada por «Chave do Dia:» com o motivo. A Chave nunca atrasa nem impede a publicação das histórias.

## Voz
PT-PT, adulta, direta, sem paternalismo, para leitores de 35 a 60 anos informados. Pode ter graça na escolha do exemplo ou do título, mas não piadas. Sem «Sabias que…?», sem emojis, sem exclamações.
