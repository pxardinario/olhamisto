# Guia de validação estatística

Obrigatório para cada peça antes da publicação.

## Integridade
- Dados brutos transcritos **sem alteração** para `raw/` (com URL e data de consulta na peça).
- Nenhum valor inventado, interpolado sem aviso ou aproximado sem indicação.
- Ausência ≠ zero. Mudanças metodológicas na série assinaladas.
- Períodos e definições compatíveis em qualquer comparação.

## Medidas
Distinguir e escolher deliberadamente: valores absolutos · percentagens · variações percentuais · pontos percentuais · per capita · nominal vs. real (deflator indicado) · PPC.

## Reprodutibilidade
- Toda a transformação vive em `tools/prepare-AAAA-MM-DD.mjs`.
- Cada número citado no texto tem um `assert` ou é escrito em `summary` no `data.json` a partir do qual o texto foi redigido.
- Controlos de coerência (ex.: somas = totais publicados; percentagens recalculadas = publicadas; contagens esperadas).

## Verificação independente (agente H)
Conferir contra a fonte original: valores (amostra ≥ 15 pontos em séries longas; todos em séries curtas), escalas, legendas, unidades, datas, cálculos e conclusões. Resultado em `verification`:
- `verificada` — tudo conferido;
- `parcial` — publicado com limitação explícita no método e na nota de edição;
- peças com erros não corrigidos **não são publicadas**.

## Escalas
Barras em zero; índices com base indicada; log assinalado no eixo; sem eixos duplos.

## Inferência
Correlação ≠ causalidade. Amostras pequenas indicadas (n). Estudos com um participante assinalados como tal.
