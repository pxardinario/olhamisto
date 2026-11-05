// «A Chave do Dia» — rubrica que fecha a edição: uma lição sobre um conceito, sem gráfico de dados.
// Usado no navegador (app.js) e na pré-renderização (tools/build-static.mjs), para o HTML ser igual nos dois.
// O campo `diagram.svg` é SVG escrito pela redação (não vem de terceiros) e é inserido tal como está.

export const CHAVE_AXES = {
  portugal: "Portugal em foco",
  pensamento: "Pensamento crítico e modelos mentais",
  sabedoria: "Produtividade e sabedoria prática",
  economia: "Economia e finanças",
  geopolitica: "Geopolítica e história",
  ciencia: "Ciência e tecnologia",
};

const KEY_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="8" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.3 8H15M12.5 8v3M14.5 8v2" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`;

export function chaveHTML(c, esc) {
  if (!c) return "";
  const axis = c.axisLabel || CHAVE_AXES[c.axis] || "";
  const src = (c.sources || []).map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.name)}</a></li>`).join("");
  const notes = (c.notes || []).map((n) => `<li>${esc(n)}</li>`).join("");
  const d = c.diagram;
  return `<section class="chave" id="chave-${esc(c.id)}" aria-labelledby="chave-${esc(c.id)}-t">
  <div class="chave-label">
    <span class="chave-name">${KEY_ICON}A Chave do Dia</span>
    ${axis ? `<span>${esc(axis)}</span>` : ""}
    ${c.certainty ? `<span class="chave-certeza" title="Grau de certeza do conceito">${esc(c.certainty)}</span>` : ""}
    <span class="ai-tag">Feito por IA</span>
  </div>
  <h2 id="chave-${esc(c.id)}-t">${esc(c.title)}</h2>
  <p class="chave-conceito">${esc(c.concept)}</p>
  <div class="chave-cols">
    <div class="chave-licao">${(c.lesson || []).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    ${d ? `<figure class="chave-esquema">${d.title ? `<p class="chave-esquema-t">${esc(d.title)}</p>` : ""}${d.svg || ""}${d.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : ""}</figure>` : ""}
  </div>
  <div class="chave-extras">
    ${c.aside ? `<div class="chave-box"><h3>Já agora</h3><p>${esc(c.aside)}</p></div>` : ""}
    ${c.application ? `<div class="chave-box"><h3>Onde se aplica</h3><p>${esc(c.application)}</p></div>` : ""}
  </div>
  ${c.motto ? `<p class="chave-motto"><q>${esc(c.motto)}</q></p>` : ""}
  <details class="chave-meta"><summary>Fontes e grau de certeza</summary><div><ul>${src}</ul>${notes ? `<ul>${notes}</ul>` : ""}</div></details>
</section>`;
}
