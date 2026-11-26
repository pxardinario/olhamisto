# Fonte — Human Fertility Database (HFD), indicadores de período e de geração

- Human Fertility Database, Max Planck Institute for Demographic Research (Alemanha) e Vienna Institute of Demography (Áustria), www.humanfertility.org, licença CC BY 4.0. Para Portugal, os dados de base são do INE (nascimentos por idade da mãe e população feminina).
- Lido através do catálogo de dados da Our World in Data (tabelas `garden/hmd/2026-10-22/hfd/period` e `.../cohort`, versão de 22-10-2026), só a ordem de nascimento «total». Convertido de feather para CSV sem alterar valores. Metadados com definições em `hfd_period.meta.json` e `hfd_cohort.meta.json`. Descarregado em 2026-11-26.
- `tfr`: índice sintético de fecundidade (período); `adjtfr`: índice ajustado ao efeito de calendário (método de Bongaarts e Feeney, calculado pela HFD); `mab`: idade média da mãe ao nascimento; `ccf`: descendência final da geração (filhos por mulher no fim da vida fértil).
