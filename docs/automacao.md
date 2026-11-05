# Automação diária

**Onde corre:** tarefa agendada na nuvem (claude.ai), 2.ª a 6.ª às 07:13 (Europe/Lisbon), para a edição estar publicada por volta das 08:00. Cada execução é uma sessão nova; a continuidade vive no **repositório GitHub `pxardinario/olhamisto`**.

**Publicação:** Cloudflare Workers (static assets), ligado ao repositório por Workers Builds. Cada `git push` para `main` publica `public/` em https://olhamisto.com em cerca de um minuto. Sem passo de build na Cloudflare.

## Cada execução
1. Data em Europe/Lisbon; termina se for fim de semana ou se a edição do dia já existir.
2. O repositório pxardinario/olhamisto vem ligado à tarefa agendada «Olhamisto diário v2» (criada no modo de código, com credenciais de escrita). Usa a cópia da sessão, `git checkout main && git pull --ff-only`, `npm install`.
3. Lê `AGENTS.md`, `docs/` (incluindo `docs/fontes.md`), `site/data/index.json`, `site/data/corrections.json` e `editorial/candidatas.json`.
4. Pesquisa, seleção, dados (`raw/`), `tools/prepare-AAAA-MM-DD.mjs`, edição em `site/data/editions/AAAA-MM-DD.json`.
5. `build-index` → `validate` (OK) → verificação independente por subagente → correções.
6. `build-static` → servir `public/` → `og-images` → `build-static` outra vez (para o feed incluir as imagens novas) → `tests/site.mjs` (tem de passar).
6b. Atualiza `editorial/candidatas.json` (e `docs/fontes.md` se for o caso).
7. `git commit -m "Edição n.º X — AAAA-MM-DD"` e `git push origin main`.
8. Mensagem curta: títulos, ligação https://olhamisto.com e limitações.

## Falhas
- Validação, verificação ou testes falham sem correção possível → **não há push**; fica a edição anterior.
- Push recusado (permissões) → não publicar noutro sítio; relatar o erro ao Pedro.
- Nunca reescrever o histórico do Git (`--force`), nunca apagar edições anteriores.

## Email (fase seguinte)
O feed `https://olhamisto.com/feed.xml` tem um item por edição, pensado para campanhas automáticas por RSS (MailerLite, Brevo, Beehiiv). A plataforma de email lê o feed; a tarefa agendada não guarda nem usa credenciais de envio.

## Revisão semanal
À sexta-feira, a tarefa «Olhamisto — revisão semanal» corre `node tools/weekly-report.mjs` (só leitura) e manda ao Pedro um resumo: peças por edição, temas, tipos de gráfico, fontes, verificações parciais, correções, cumprimento da quota de variedade e estado da lista de espera. Não altera nada no repositório.
