# Fonte — Tábuas de mortalidade do período, Suécia (1751–2024), Portugal (1940–2023), França e Inglaterra e País de Gales

- Human Mortality Database (HMD), University of California, Berkeley, e Max Planck Institute for Demographic Research, tábuas de mortalidade por idade simples, ambos os sexos («total»), dados publicados a 25-09-2025. Licença CC BY 4.0 (mortality.org, User Agreement).
- Lido através do catálogo de dados da Our World in Data (tabela `garden/hmd/2025-10-22/hmd/life_tables`, descarregada pela OWID a 22-10-2025; metadados em `life_tables.meta.json`). Convertido de parquet para CSV em 2026-11-27 sem alterar valores; ficaram só as linhas de período (`type=period`), sexo total e idades 0, 10 e 65 de quatro países.
- Colunas: `life_expectancy` (esperança de vida à idade indicada, em anos), `number_survivors` (sobreviventes à idade exata, em 100 000 nascidos), `probability_of_death` (probabilidade de morrer antes da idade seguinte).
- mortality.org não está acessível neste ambiente; os valores não foram conferidos no sítio da HMD.
