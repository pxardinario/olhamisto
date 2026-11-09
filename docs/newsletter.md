# Newsletter semanal (Substack)

Uma edição por semana, que resume as edições publicadas no site. Não é uma cópia diária do site. O Substack não tem API de publicação, e não se usam APIs não oficiais (exigiriam o cookie da sessão do Pedro). Por isso, os agentes preparam tudo e o Pedro só cola e agenda (cerca de 20 a 30 minutos por semana).

## Estrutura de cada número
Cada número começa com título, subtítulo e um parágrafo de introdução. Seguem-se 3 a 4 destaques, só de peças com verificação «verificada»: imagem de partilha, um parágrafo de 40–70 palavras escrito para a newsletter e a ligação para a peça interativa. Depois vêm a lista das restantes peças por edição, com «(verificação parcial)» onde for o caso, as Chaves do Dia (título, eixo, conceito e ligação), as correções do período (todas, com resumo fiel de `site/data/corrections.json`) e, a fechar, a etiqueta «Feito por IA», a despedida (margem: pode ter humor, nunca sobre os temas) e a assinatura.

Há também 3 Notes curtas (até 125 caracteres mais «Feito por IA.»), uma por dia depois do envio, sem pedir subscrições.

## Critérios dos destaques
Dar preferência a peças de descoberta, que não envelhecem numa semana, e a peças com ângulo português. Variar os temas e não escolher mais de uma peça da mesma edição se houver alternativa equivalente. Evitar peças de atualidade cujo contexto já mudou.

## Processo
1. Escrever `newsletter/nNNN.json` (ver `newsletter/n001.json`): edições cobertas, textos, notas, `correctionsNote` para cada correção do período.
2. `node tools/newsletter.mjs newsletter/nNNN.json`. Falha se um número escrito à mão não constar da peça ou da correção de origem, se um parágrafo sair dos 40–70 palavras, se um destaque não estiver verificado ou se faltar o texto de uma correção.
3. Verificação independente (agente H) do JSON e do `email.html` gerado. Corrigir e voltar ao passo 2.
4. Confirmar que as imagens `public/og/<id>.png` dos destaques estão atualizadas e publicadas (o `email.html` usa os endereços de olhamisto.com).
5. Fazer commit da pasta `newsletter/nNNN/` e avisar o Pedro: as instruções estão em `newsletter/nNNN/LEIAME.md`.

## Automação
Uma tarefa agendada corre ao sábado de manhã (Europe/Lisbon). Cobre as edições publicadas desde o último número, isto é, com número superior ao maior de `editions` em `newsletter/n*.json`. Escreve o número seguinte, gera e verifica, faz commit para `main` e envia ao Pedro o `email.html`, as `notas.md`, o `LEIAME.md` e as imagens. Não publica no Substack. Se não houver edições novas, termina sem commit.
