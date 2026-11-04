# Automação diária

**Onde corre:** tarefa agendada na nuvem (claude.ai), 2.ª a 6.ª às 07:13 (Europe/Lisbon), para a edição estar publicada por volta das 08:00. Cada execução é uma sessão nova; a continuidade vive no **repositório GitHub `pxardinario/olhamisto`**.

**Publicação:** Cloudflare Workers (static assets), ligado ao repositório por Workers Builds. Cada `git push` para `main` publica `public/` em https://olhamisto.com em cerca de um minuto. Sem passo de build na Cloudflare.

## Cada execução
1. Data em Europe/Lisbon; termina se for fim de semana ou se a edição do dia já existir.
2. `add_repo` (pxardinario/olhamisto, acesso de escrita), `git clone --depth 1`, `npm install`.
3. Lê `AGENTS.md`, `docs/`, `site/data/index.json`, `site/data/corrections.json`.
4. Pesquisa, seleção, dados (`raw/`), `tools/prepare-AAAA-MM-DD.mjs`, edição em `site/data/editions/AAAA-MM-DD.json`.
5. `build-index` → `validate` (OK) → verificação independente por subagente → correções.
6. `build-static` → servir `public/` → `og-images` → `tests/site.mjs` (tem de passar).
7. `git commit -m "Edição n.º X — AAAA-MM-DD"` e `git push origin main`.
8. Mensagem curta: títulos, ligação https://olhamisto.com e limitações.

## Falhas
- Validação, verificação ou testes falham sem correção possível → **não há push**; fica a edição anterior.
- Push recusado (permissões) → não publicar noutro sítio; relatar o erro ao Pedro.
- Nunca reescrever o histórico do Git (`--force`), nunca apagar edições anteriores.

## Email (fase seguinte)
O feed `https://olhamisto.com/feed.xml` tem um item por edição, pensado para campanhas automáticas por RSS (MailerLite, Brevo, Beehiiv). A plataforma de email lê o feed; a tarefa agendada não guarda nem usa credenciais de envio.
