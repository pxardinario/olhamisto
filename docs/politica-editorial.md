# Política editorial

**Missão.** Até cinco histórias por dia útil, contadas sobretudo visualmente, para leitores portugueses curiosos e críticos, interessados em história, política, economia, sociedade, tecnologia, marketing, turismo, empreendedorismo, cultura alternativa e ciência do comportamento. Não é um dashboard nem uma galeria de gráficos. Público e gratuito em olhamisto.com.

**Primeiro a história.** Procura-se algo que valha a pena explicar (evolução inesperada, diferença significativa, desigualdade pouco conhecida, contradição entre perceção e realidade, decisão com efeitos mensuráveis). Só depois se escolhe a visualização.

**Teste editorial.** Antes de aprovar: «Que coisa interessante vai o leitor perceber?». A resposta tem de ser concreta e sustentada pelos dados (fica registada no campo `finding`).

**Mistura.** Orientação de 2 peças de atualidade e 3 de descoberta, ajustável à qualidade. Atualidade ≠ manchetes: é o que os números explicam melhor.

**Matriz de seleção** (apoio ao julgamento, não substituto):

| Critério | Peso |
|---|---:|
| Importância/interesse da descoberta | 30% |
| Potencial de comunicação visual | 25% |
| Qualidade e fiabilidade dos dados | 25% |
| Surpresa/perspetiva original | 10% |
| Interesse para o leitor-alvo | 10% |

**Diversidade.** Pelo menos 3 temas por edição; ao longo de semanas, diversidade evidente.

**Quota de variedade (obrigatória).** O risco principal desta revista não é falhar uma regra, é tornar-se previsível sem nunca falhar nenhuma. Por isso, em cada edição:
- no máximo **2 peças** do tipo «tabela oficial de Portugal comparado com a Europa ou a OCDE» (INE, Eurostat, PORDATA, OCDE com Portugal destacado entre países);
- pelo menos **1 peça** cuja fonte não seja estatística oficial: estudo científico, série histórica longa, base de dados temática (cultura, desporto, ciência, tecnologia, comportamento), arquivo;
  esta quota cumpre-se com uma descoberta que explica algo, não com uma curiosidade: conjuntos «prontos a usar» (FiveThirtyEight, TidyTuesday e semelhantes) só contam se a peça passar o teste de relevância abaixo;
- pelo menos **1 peça** sem Portugal como ângulo principal;
- não repetir o mesmo tipo de gráfico mais de 2 vezes na mesma edição.
Se a quota obrigar a publicar menos peças, publica-se menos; nunca se enfraquece a verificação para a cumprir. Regista em `limitations` quando a quota não for cumprida e porquê.

**Repetição.** Não repetir visualizações com mudanças cosméticas. Regressar a um tema só com dados novos que alterem a interpretação — e dizer o que mudou.

**Teste de relevância (obrigatório para peças sem Portugal como ângulo principal).** A peça tem de cumprir pelo menos uma destas condições: (a) explica um fenómeno que também existe em Portugal ou na Europa, e o texto di-lo; (b) é atualidade com impacto além do país de origem; (c) é uma série longa ou um estudo que muda a forma de ver um tema geral (ciência, história, comportamento). Uma curiosidade sem consequência («nenhum filme tinha menos estrelas do que a média») não passa, mesmo com bons dados. Temas internos dos EUA: no máximo **1 peça por semana**, salvo atualidade com impacto global. Dados de um arquivo que já não é atualizado só servem como série histórica, nunca como retrato do presente.

**Evitar.** Gráficos sem interesse editorial; estatísticas escolhidas por estarem disponíveis; mapas que não comunicam; dados desatualizados como atuais; escalas enganadoras; causalidade sem prova; títulos sensacionalistas.

**Escrita.** PT-PT, voz ativa, sem linguagem promocional nem paternalismo. Título curto e específico; contexto (40–70 palavras); interpretação (40–70 palavras) que acrescenta, não repete, os números do gráfico.

**Política de qualidade.** Se não houver cinco histórias com dados verificáveis, publica-se menos e regista-se porquê em `limitations`. Candidatas rejeitadas por falta de dados também são registadas.

**Lista de espera (`editorial/candidatas.json`).** A pesquisa de cada dia não começa do zero:
1. **Antes de pesquisar**, lê a lista. Escolhe primeiro as candidatas `pronta`. Depois tenta resolver 1 ou 2 `bloqueada` usando a pista do campo `bloqueio` e o mapa `docs/fontes.md`; se resolver, produz a peça.
2. **Depois de fechar a edição**, atualiza a lista: retira as que foram publicadas; acrescenta as candidatas promissoras rejeitadas hoje (com fonte, licença, estado e o bloqueio concreto); incrementa `tentativas` das que voltaram a falhar. Com `tentativas` ≥ 3, passa a `descartada` e diz porquê.
3. Mantém a lista curta e útil: no máximo 30 entradas ativas; remove as descartadas com mais de 30 dias.
4. Uma candidata de atualidade que perdeu a atualidade sai da lista, a não ser que funcione como descoberta.

**Mapa de fontes (`docs/fontes.md`).** Antes de investir numa candidata, confirma lá se a fonte é alcançável neste ambiente. Quando descobrires uma fonte que funciona ou deixou de funcionar, atualiza o mapa com a data do teste.

**A Chave do Dia.** Todas as edições fecham com uma lição sobre um conceito, sem gráfico de dados, com rotação entre seis eixos e o mesmo rigor das peças. Regras em `docs/chave-do-dia.md`.
