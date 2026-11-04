# Instruções de execução

```bash
npm install
node tools/prepare-AAAA-MM-DD.mjs     # transforma raw/ → site/data/datasets/
node tools/build-index.mjs            # regenera o arquivo
node tools/validate.mjs [AAAA-MM-DD]  # tem de terminar em OK
node tools/build-static.mjs           # gera public/
(cd public && python3 -m http.server 8790 &)
node tools/og-images.mjs http://127.0.0.1:8790
node tests/site.mjs http://127.0.0.1:8790 /tmp/capturas
```
Rever as capturas `desktop-*.png` e `mobile-*.png` (sem sobreposições, sem texto cortado, sem scroll horizontal).

## Criar uma edição nova
1. `raw/<peça>/…` com as transcrições das fontes.
2. Copiar e adaptar um `tools/prepare-*.mjs` (asserts para cada número citado).
3. Escrever `site/data/editions/AAAA-MM-DD.json` (ver `esquema-dados.md`).
4. Se precisares de um gráfico novo, acrescenta um renderizador genérico em `site/assets/js/charts.js` e regista-o em `CHART_TYPES` (validate) e em `dataTable`/`toCSV`.
5. Validar, verificar (agente H), gerar, testar, `git push`.
