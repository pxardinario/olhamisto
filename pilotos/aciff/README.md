# Barómetro Figueira — boletim-piloto para a ACIFF

Proposta de boletim económico mensal para os associados da ACIFF, feito com o mesmo processo do Olhamisto: dados primários, transformações com `assert` e verificação independente antes de publicar. Não faz parte do site olhamisto.com.

## Como gerar uma edição

```bash
node pilotos/aciff/2026-11/prepare.mjs   # lê raw/, confere cada número publicado, escreve data.json
node pilotos/aciff/2026-11/build.mjs     # escreve boletim.html
```

Para uma nova edição, copiar a pasta do mês, voltar a descarregar `raw/` (URLs em `raw/FONTES.md`) e atualizar os `assert` com os novos valores.

## Notas de recolha (aprendidas a 2026-11-16)

- **INE:** dormidas (0012088) e hóspedes (0012089) mensais por município (NUTS 2024) saem cerca de 6–7 semanas depois do mês. A Figueira tem o geocódigo 1920605.
- **IEFP:** «Estatísticas Mensais por Concelhos» em https://www.iefp.pt/estatisticas. As ligações aos ficheiros ODS estão no JSON embutido na página (`odsLink`). Converter com `soffice --headless --convert-to csv:...:-1` (todas as folhas). O Quadro I tem o total por concelho na coluna 13.
- **E-REDES:** o conjunto `3-consumos-faturados-por-municipio-ultimos-10-anos` (CC BY 4.0) aceita agregação ODSQL (`group_by`). A Figueira tem o código 0605. O último mês publicado pode ser corrigido por acertos de faturação.
- **BPstat:** `tools/bpstat-search.mjs` só funciona atrás do proxy com `NODE_USE_ENV_PROXY=1`. Série 12533747: juro de novos empréstimos até 1 M€ às empresas.
- **Concursos:** www.base.gov.pt devolveu 404. O IMPIC publica os anúncios do ano no dados.gov.pt (`anuncios2026.json`, cerca de 60 MB, atualizado semanalmente). Os prazos medianos são de 12 dias, por isso o alerta de concursos deve ser semanal.
- **Fundos:** `POST https://centro2030.pt/wp-json/avisos/query` com `estadoAvisoId=7&programaId=104|100&NUTSIIId=3&page=N` (páginas de 5; a última devolve 404).
- **Node e proxy:** o `fetch` do Node não usa o proxy deste ambiente; usar `curl` ou `NODE_USE_ENV_PROXY=1`.
- **INE, conjuntura:** a API devolve só o último mês se não se passar `Dim1=T`. IPC por categoria (COICOP 2018): 0014647 (restauração = 111). Comércio: 0012018 (47, CR2, CR4). Confiança: 0001173 e 0001163. As ligações caem com frequência; repetir.
- **Avisos de fundos:** a lista não diz quem pode candidatar-se. É preciso ler o PDF (`/wp-json/avisos/download?container=…&path=…&filename=…`). Exemplos: um aviso de «ações coletivas» pode ser um convite só para a AICEP, e a fase aberta de um sistema de incentivos pode estar reservada a grandes empresas. `prepare.mjs` confere no texto do aviso cada facto usado nas descrições.
