# Fontes do boletim-piloto ACIFF (edição de novembro de 2026)

Consulta: 2026-11-16 (Europe/Lisbon); dados do INE sobre turismo (`ine_00120*`, `ine_meta_0012088.json`) descarregados de novo a 2026-11-18, com setembro de 2026. Ficheiros guardados sem alteração, salvo as exceções indicadas.

| Pasta | Fonte | URL | Licença |
|---|---|---|---|
| `ine_0012088_*.json` | INE, dormidas nos estabelecimentos de alojamento turístico, mensal, por município (NUTS 2024), segmento Total | https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0012088&Dim1=T&Dim2=<geocod>&Dim3=T&lang=PT | CC BY 4.0 (INE via dados.gov.pt) |
| `ine_0012089_*.json` | INE, hóspedes, idem | idem com varcd=0012089 | CC BY 4.0 |
| `iefp/*.ods` | IEFP, «Desemprego registado por concelhos», jan. 2025 a set. 2026 (ficheiros mensais) | https://www.iefp.pt/estatisticas (ligações odsLink em «Estatísticas Mensais por Concelhos») | Informação do setor público, reutilização ao abrigo da Lei n.º 68/2021, com atribuição |
| `iefp/csv/*Quadro_I.csv` | Conversão automática (LibreOffice, sem edição) da folha «Quadro I» de cada ODS | — | — |
| `eredes/*.json` | E-REDES, «Monthly consumption by municipality» (3-consumos-faturados-por-municipio-ultimos-10-anos), energia ativa faturada, agregada por mês e nível de tensão via API | https://e-redes.opendatasoft.com/explore/dataset/3-consumos-faturados-por-municipio-ultimos-10-anos/ | CC BY 4.0 (metadados.json) |
| `bpstat/12533747*.json` | Banco de Portugal, BPstat, taxa de juro (TAA) de novas operações de empréstimos até 1 M€ às empresas não financeiras | https://bpstat.bportugal.pt/serie/12533747 | Reutilização com citação da fonte (termos BPstat) |
| `base/anuncios2026_regiao.json` | IMPIC, «Contratos Públicos – Portal Base – Anúncios de 2012 a 2026», ficheiro anuncios2026.json (atualizado 2026-11-15). **Exceção:** o ficheiro completo (62 MB, sha256 em `anuncios2026.sha256`) foi filtrado às entidades da região (lista de NIF no script) para não pesar no repositório | https://dados.gov.pt/pt/datasets/66d72fbc58cd7a63dae28712/ | «other-pd» (domínio público) |
| `fundos/avisos_*.json` | Balcão dos Fundos/Centro 2030, avisos com estado «aberto» (estadoAvisoId=7), programas 104 (Centro 2030) e 100 (COMPETE 2030), filtro NUTS II Centro | POST https://centro2030.pt/wp-json/avisos/query | Informação pública dos programas; citar «Portugal 2030» |
| `ine_meta_0012088.json` | INE, metadados das dormidas (nota de dados provisórios e preliminares) | https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=0012088&lang=PT | CC BY 4.0 |
| `ine_conj/ipc_*.json` | INE, IPC, taxa de variação homóloga, base 2025 (0014647), Portugal: total (T), produtos alimentares e bebidas não alcoólicas (01), vestuário e calçado (03), serviços de restauração (111) | https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=0014647&Dim1=T&Dim2=PT&Dim3=<cat>&lang=PT | CC BY 4.0 |
| `ine_conj/retalho_*.json` | INE, índice de volume de negócios no comércio, ajustado de efeitos de calendário e deflacionado, variação homóloga (0012018): comércio a retalho (47), alimentar (CR2), não alimentar exceto combustível (CR4) | idem com varcd=0012018 | CC BY 4.0 |
| `ine_conj/conf_*.json` | INE, indicador de confiança dos consumidores (0001173) e do comércio a retalho (0001163, Dim3=1) | idem | CC BY 4.0 |
| `fundos/pdf/*.pdf` e `.txt` | Texto integral de cada aviso (documento «Aviso» mais recente), descarregado do Balcão dos Fundos via centro2030.pt; `.txt` extraído com pdftotext -layout | ligações em `fundos/avisos_urls.tsv` | Informação pública dos programas |

Não acessíveis nesta edição: site do Porto da Figueira da Foz (proxy recusou), Portal BASE (www.base.gov.pt devolveu 404; usou-se o espelho do IMPIC no dados.gov.pt), Portal das Finanças (calendário fiscal, não pedido).
