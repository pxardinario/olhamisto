// Gera o PDF A4 do boletim: node pilotos/aciff/pdf.cjs [boletim.html] [saida.pdf] (requer playwright)
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.emulateMedia({ media: 'print', colorScheme: 'light' });
  await p.goto('file://' + require('path').resolve(process.argv[2] || 'pilotos/aciff/2026-11/boletim.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const fonts = await p.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight));
  console.log('fontes carregadas:', [...new Set(fonts)].join(', '));
  await p.pdf({
    path: require('path').resolve(process.argv[3] || 'pilotos/aciff/2026-11/barometro-figueira-2026-11.pdf'),
    format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8px Arial,sans-serif;color:#55666f;padding:0 12mm;display:flex;justify-content:space-between"><span>Barómetro Figueira · novembro de 2026 · Feito por IA</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>',
  });
  await b.close();
})();
