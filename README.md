# Olhamisto

*Antes de opinar, olha-me isto.* — **https://olhamisto.com**

Revista digital de jornalismo visual, gratuita e pública: até cinco histórias por dia útil, contadas sobretudo através de gráficos, mapas e tabelas visuais. **Feito por IA**: cada edição é investigada, escrita e visualizada por agentes de inteligência artificial (Claude, da Anthropic) e verificada por um agente verificador independente antes de ser publicada, sem revisão humana prévia. Erros corrigidos e registados em `/correcoes/`.

## Como funciona

```
site/            fonte do site (template.html, assets/, data/)
  data/editions/AAAA-MM-DD.json   conteúdo editorial de cada edição
  data/datasets/<id>/data.json    dados transformados de cada visualização (+ raw/ originais)
  data/index.json                 índice do arquivo (gerado)
  data/corrections.json           registo público de correções
raw/<peça>/      dados brutos transcritos das fontes, sem alterações
tools/           prepare-AAAA-MM-DD.mjs (transformações com asserts), build-index, build-static, og-images, validate
tests/site.mjs   teste de navegador de todo o site (desktop + iPhone)
public/          site gerado e publicado (não editar à mão)
docs/            política editorial, regras de visualização, validação, esquema, automação
AGENTS.md        instruções operacionais para os agentes
wrangler.jsonc   configuração da Cloudflare (Workers static assets)
```

Cada envio para `main` é publicado pela Cloudflare (Workers Builds, sem passo de build: `public/` já vem gerado).

## Executar localmente

```bash
npm install
node tools/build-index.mjs && node tools/validate.mjs && node tools/build-static.mjs
(cd public && python3 -m http.server 8790 &)
node tools/og-images.mjs http://127.0.0.1:8790     # imagens de partilha em falta
node tests/site.mjs http://127.0.0.1:8790 /tmp/capturas
```

## Licenças

Código: MIT. Textos e visualizações: CC BY 4.0, com atribuição a «Olhamisto». Dados: segundo a licença de cada fonte, indicada em cada peça. Tipos de letra Fraunces e IBM Plex Sans (SIL OFL), D3 (ISC), Natural Earth / world-atlas (domínio público / ISC).
