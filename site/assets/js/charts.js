// Motor de visualizações de «Olhamisto».
// Cada tipo recebe (host, data, ctx) e desenha dentro de host.chart; controlos vão para host.controls.
// Todos redesenham ao mudar a largura (ResizeObserver) e expõem uma tabela de dados acessível.
/* global d3, topojson */

const fmt1 = (x) => x.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = (x) => Math.round(x).toLocaleString("pt-PT");
const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toLocaleString("pt-PT");
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function responsive(el, draw) {
  let w = 0, raf = 0;
  const run = () => { const nw = Math.round(el.clientWidth); if (nw && nw !== w) { w = nw; draw(w); } };
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); });
  ro.observe(el);
  run();
  return { redraw: () => { w = 0; run(); }, destroy: () => ro.disconnect() };
}
function svgIn(el, w, h, label) {
  d3.select(el).selectAll("svg").remove();
  return d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`).attr("width", w).attr("height", h)
    .attr("role", "img").attr("aria-label", label).attr("xmlns", "http://www.w3.org/2000/svg");
}
function tooltip(el) {
  let t = el.querySelector(".tooltip");
  if (!t) { t = document.createElement("div"); t.className = "tooltip"; t.setAttribute("aria-hidden", "true"); el.appendChild(t); }
  return {
    show(html, x, y) {
      t.innerHTML = html; t.classList.add("on");
      const W = el.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
      let left = x + 14, top = y - th - 10;
      if (left + tw > W) left = x - tw - 14;
      if (left < 0) left = 4;
      if (top < 0) top = y + 14;
      t.style.left = left + "px"; t.style.top = top + "px";
    },
    hide() { t.classList.remove("on"); },
  };
}
function segmented(container, options, value, onChange, label) {
  const g = document.createElement("div");
  g.className = "seg"; g.setAttribute("role", "group"); g.setAttribute("aria-label", label);
  for (const [v, text] of options) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = text; b.dataset.v = v;
    b.setAttribute("aria-pressed", String(v === value));
    b.addEventListener("click", () => {
      g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      onChange(v);
    });
    g.appendChild(b);
  }
  container.appendChild(g);
  return g;
}
function legend(container, items) {
  const ul = document.createElement("ul"); ul.className = "legend";
  for (const it of items) {
    const li = document.createElement("li");
    const st = it.shape === "ring" ? `background:transparent;border:2px solid ${it.color}` : it.dash ? `background:repeating-linear-gradient(90deg,${it.color} 0 6px,transparent 6px 9px)` : `background:${it.color}${it.opacity ? `;opacity:${it.opacity}` : ""}`;
    li.innerHTML = `<i class="${it.line ? "line" : ""}${it.shape === "dot" || it.shape === "ring" ? " dot" : ""}" style="${st}"></i>${it.label}`;
    ul.appendChild(li);
  }
  container.appendChild(ul);
}
// Texto com halo para legibilidade sobre linhas
function halo(sel) { return sel.attr("paint-order", "stroke").attr("stroke", css("--card")).attr("stroke-width", 4).attr("stroke-linejoin", "round"); }

/* ------------------------------------------------------------------ */
/* 1. Intercalares dos EUA: barras divergentes ⇄ dispersão vs. aprovação */
function midterms(host, data) {
  const rows = data.rows.filter((r) => r.year >= 1946);
  let mode = "anos";
  const tip = tooltip(host.chart);
  segmented(host.controls, [["anos", "Por ano"], ["aprovacao", "Vs. popularidade"]], mode, (v) => { mode = v; r.redraw(); }, "Modo de visualização");
  legend(host.legend, [{ color: css("--dem"), label: "Presidente democrata" }, { color: css("--rep"), label: "Presidente republicano" }]);
  const col = (p) => (p === "D" ? css("--dem") : css("--rep"));
  const html = (d) => `<b>${d.year} · ${d.president} (${d.party})</b><br>Câmara: ${signed(d.house)} lugares<br>Senado: ${signed(d.senate)}<br>Aprovação Gallup: ${d.approval}%${d.approvalNote ? ` (${d.approvalNote})` : ""}`;

  const r = responsive(host.chart, (W) => {
    const narrow = W < 560;
    if (mode === "anos") {
      const H = narrow ? 360 : 400, m = { t: 34, r: 8, b: 36, l: 40 };
      const svg = svgIn(host.chart, W, H, "Barras: variação de lugares na Câmara do partido do presidente em cada eleição intercalar, 1946–2022");
      const x = d3.scaleBand().domain(rows.map((d) => d.year)).range([m.l, W - m.r]).padding(0.22);
      const y = d3.scaleLinear().domain([-70, 15]).range([H - m.b, m.t]);
      svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(6)).join("line")
        .attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => signed(v)).tickSize(0)).call((g) => g.select(".domain").remove());
      const mean = data.summary.meanHouse;
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(mean)).attr("y2", y(mean)).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "5 4");
      halo(svg.append("text").attr("class", "ann").attr("x", m.l + 4).attr("y", y(mean) - 6).style("font-size", "11.5px").text(`média 1946–2022: ${fmt1(mean).replace("-", "−")}`));
      svg.append("g").selectAll("rect").data(rows).join("rect")
        .attr("x", (d) => x(d.year)).attr("width", x.bandwidth())
        .attr("y", (d) => y(Math.max(0, d.house))).attr("height", (d) => Math.abs(y(d.house) - y(0)))
        .attr("fill", (d) => col(d.party)).attr("opacity", (d) => (d.house > 0 ? 1 : 0.88))
        .attr("tabindex", 0).attr("aria-label", (d) => `${d.year}, ${d.president}: ${signed(d.house)} lugares`)
        .on("pointerenter pointermove", (e, d) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(d), px, py); })
        .on("pointerleave blur", () => tip.hide())
        .on("focus", function (e, d) { const b = this.getBBox(); tip.show(html(d), (b.x / W) * host.chart.clientWidth, 40); });
      svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
      const every = narrow ? 2 : 1;
      svg.append("g").selectAll("text").data(rows.filter((d, i) => i % every === 0)).join("text")
        .attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", H - m.b + 16).attr("text-anchor", "middle").attr("class", "ann-muted")
        .text((d) => (narrow ? "’" + String(d.year).slice(2) : d.year));
      // valores nos extremos e nas exceções
      const label = rows.filter((d) => d.house > 0 || d.house <= -54);
      svg.append("g").selectAll("text").data(label).join("text")
        .attr("x", (d) => x(d.year) + x.bandwidth() / 2).attr("y", (d) => (d.house > 0 ? y(d.house) - 5 : y(d.house) + 13))
        .attr("text-anchor", "middle").attr("class", "ann").style("font-weight", 600).style("font-size", narrow ? "10px" : "12px").text((d) => signed(d.house));
      const g02 = rows.find((d) => d.year === 2002);
      halo(svg.append("text").attr("class", "ann").attr("x", x(1998) - 4).attr("y", y(13)).attr("text-anchor", "end")
        .text(narrow ? "As 2 exceções" : "As duas exceções: 1998 e 2002"));
      svg.append("text").attr("class", "ann-muted").attr("x", m.l + 2).attr("y", m.t - 14).text(narrow ? "Lugares na Câmara, partido do presidente" : "Lugares na Câmara dos Representantes ganhos/perdidos pelo partido do presidente");
      void g02;
    } else {
      const H = narrow ? 380 : 420, m = { t: 34, r: 16, b: 46, l: 44 };
      const svg = svgIn(host.chart, W, H, "Dispersão: aprovação do presidente versus variação de lugares na Câmara, 1946–2022");
      const x = d3.scaleLinear().domain([25, 70]).range([m.l, W - m.r]);
      const y = d3.scaleLinear().domain([-70, 15]).range([H - m.b, m.t]);
      svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(6)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
      svg.append("rect").attr("x", x(25)).attr("width", x(50) - x(25)).attr("y", m.t).attr("height", H - m.b - m.t).attr("fill", css("--paper-2")).attr("opacity", .55);
      svg.append("line").attr("x1", x(50)).attr("x2", x(50)).attr("y1", m.t).attr("y2", H - m.b).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "4 4");
      svg.append("text").attr("class", "ann-muted").attr("x", x(50) - 6).attr("y", m.t + 12).attr("text-anchor", "end").text(`< 50%: média ${fmt1(data.summary.approvalBelow50.meanHouse).replace("-", "−")}`);
      svg.append("text").attr("class", "ann-muted").attr("x", x(50) + 6).attr("y", m.t + 12).text(`≥ 50%: média ${fmt1(data.summary.approvalAtOrAbove50.meanHouse).replace("-", "−")}`);
      svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 5 : 9).tickFormat((v) => v + "%").tickSizeOuter(0));
      svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => signed(v)).tickSize(0)).call((g) => g.select(".domain").remove());
      svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
      svg.append("text").attr("class", "ann-muted").attr("x", W - m.r).attr("y", H - 8).attr("text-anchor", "end").text("Aprovação Gallup do presidente antes da eleição →");
      svg.append("text").attr("class", "ann-muted").attr("x", m.l + 2).attr("y", m.t - 14).text("Lugares na Câmara ganhos/perdidos");
      svg.append("g").selectAll("circle").data(rows).join("circle")
        .attr("cx", (d) => x(d.approval)).attr("cy", (d) => y(d.house)).attr("r", narrow ? 6 : 7)
        .attr("fill", (d) => col(d.party)).attr("stroke", css("--card")).attr("stroke-width", 1.5).attr("tabindex", 0)
        .attr("aria-label", (d) => `${d.year}: aprovação ${d.approval}%, ${signed(d.house)} lugares`)
        .on("pointerenter pointermove", (e, d) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(d), px, py); })
        .on("pointerleave blur", () => tip.hide());
      const lab = narrow ? [1946, 2002, 2010, 2022] : [1946, 1966, 1974, 1994, 1998, 2002, 2006, 2010, 2018, 2022];
      halo(svg.append("g").selectAll("text").data(rows.filter((d) => lab.includes(d.year))).join("text")
        .attr("x", (d) => x(d.approval) + 9).attr("y", (d) => y(d.house) + 4).attr("class", "ann").style("font-size", "11.5px").text((d) => d.year));
    }
  });
  return r;
}

/* ------------------------------------------------------------------ */
/* 2. Irlanda: área empilhada (estática) + barras de quota em 2025 */
function irelandArea(host, data) {
  const rows = data.rows;
  legend(host.legend, [{ color: css("--accent"), label: "Centros de dados" }, { color: css("--muted"), label: "Todos os outros consumidores medidos" }]);
  return responsive(host.chart, (W) => {
    const narrow = W < 600;
    const H = narrow ? 490 : 420;
    const m = { t: narrow ? 58 : 30, r: narrow ? 14 : 215, b: narrow ? 180 : 34, l: 52 };
    const svg = svgIn(host.chart, W, H, "Área empilhada do consumo de eletricidade medido na Irlanda, 2015–2025: centros de dados e restantes consumidores");
    const x = d3.scaleLinear().domain([2015, 2025]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 35000]).range([H - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(7)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    const aOther = d3.area().x((d) => x(d.year)).y0(y(0)).y1((d) => y(d.other));
    const aDc = d3.area().x((d) => x(d.year)).y0((d) => y(d.other)).y1((d) => y(d.total));
    svg.append("path").datum(rows).attr("d", aOther).attr("fill", css("--muted")).attr("opacity", .55);
    svg.append("path").datum(rows).attr("d", aDc).attr("fill", css("--accent"));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 5 : 10).tickFormat(d3.format("d")).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(7).tickFormat((v) => (v / 1000).toLocaleString("pt-PT") + " mil").tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("text").attr("class", "ann-muted").attr("x", m.l).attr("y", narrow ? 14 : m.t - 12).text("Eletricidade medida, GWh por ano");
    // Linha de referência: nível dos outros em 2015
    const o15 = rows[0].other;
    svg.append("line").attr("x1", x(2015)).attr("x2", x(2025)).attr("y1", y(o15)).attr("y2", y(o15)).attr("stroke", css("--ink")).attr("stroke-dasharray", "3 3").attr("opacity", .6);
    halo(svg.append("text").attr("class", "ann").attr("x", x(2016)).attr("y", y(rows[0].other) + 18).text(`Outros consumidores: +${data.summary.otherGrowthPct}% em 10 anos`));
    // Anotações de extremos
    const last = rows.at(-1), first = rows[0];
    halo(svg.append("text").attr("class", "ann").attr("x", x(2015) + 4).attr("y", y(first.total) - 8).text(`${fmt0(first.dc)} GWh (${fmt1(first.share)}%)`));
    const lx = narrow ? x(2025) - 4 : x(2025) + 8;
    const anchor = narrow ? "end" : "start";
    halo(svg.append("text").attr("class", "ann").attr("x", lx).attr("y", y(last.total) - (narrow ? 26 : 8)).attr("text-anchor", anchor).style("font-weight", 700).style("fill", css("--accent")).text(`${fmt0(last.dc)} GWh`));
    halo(svg.append("text").attr("class", "ann").attr("x", lx).attr("y", y(last.total) + (narrow ? -10 : 8)).attr("text-anchor", anchor).text(`${fmt1(last.share)}% do total em 2025`));
    if (!narrow) {
      svg.append("text").attr("class", "ann").attr("x", x(2025) + 8).attr("y", y((last.total + last.other) / 2) + 32).text("Centros de dados:");
      svg.append("text").attr("class", "big").attr("x", x(2025) + 8).attr("y", y((last.total + last.other) / 2) + 66).style("font-size", "34px").style("fill", css("--accent")).text(`${data.summary.dcShareOfTotalIncrease}%`);
      svg.append("text").attr("class", "ann-muted").attr("x", x(2025) + 8).attr("y", y((last.total + last.other) / 2) + 84).text("do aumento do consumo");
      svg.append("text").attr("class", "ann-muted").attr("x", x(2025) + 8).attr("y", y((last.total + last.other) / 2) + 99).text("total entre 2015 e 2025");
    }
    // Barras de comparação 2025
    const bx0 = narrow ? m.l : x(2025) + 8, bw = narrow ? W - m.l - 20 : m.r - 20;
    const by0 = narrow ? H - m.b + 62 : y(o15) + 100;
    const bars = [...data.shares2025].sort((a, b) => b.pct - a.pct);
    const bs = d3.scaleLinear().domain([0, 30]).range([0, narrow ? bw * 0.55 : bw * 0.4]);
    const short = { "Todas as habitações": "todas as hab.", "Centros de dados": "centros de dados", "Habitações urbanas": "hab. urbanas", "Habitações rurais": "hab. rurais" };
    const gb = svg.append("g").attr("transform", `translate(${bx0},${by0})`);
    if (narrow) {
      gb.append("text").attr("class", "ann").attr("y", -22).html(`Centros de dados: <tspan style="font-weight:700;fill:${css("--accent")}">${data.summary.dcShareOfTotalIncrease}%</tspan> do aumento`);
      gb.append("text").attr("class", "ann-muted").attr("y", -6).text("do consumo total, 2015–2025");
    }
    gb.append("text").attr("class", "ann-muted").attr("y", narrow ? 10 : 0).text("Quota do consumo medido, 2025");
    bars.forEach((b, i) => {
      const yy = (narrow ? 22 : 12) + i * 22;
      gb.append("rect").attr("x", 0).attr("y", yy).attr("height", 14).attr("width", bs(b.pct)).attr("fill", b.category === "Centros de dados" ? css("--accent") : css("--ink-3")).attr("opacity", b.category === "Centros de dados" ? 1 : b.category === "Todas as habitações" ? .8 : .45);
      gb.append("text").attr("class", "ann").attr("x", bs(b.pct) + 6).attr("y", yy + 11.5).style("font-size", "11.5px").text(`${b.pct}% ${short[b.category] || b.category.toLowerCase()}`);
    });
  });
}

/* ------------------------------------------------------------------ */
/* 3. Habitação real: PT vs zona euro, com cursor */
function houseLines(host, data) {
  const rows = data.rows.map((d) => ({ ...d, t: new Date(d.date) }));
  const s = data.summary;
  const tip = tooltip(host.chart);
  let showEA = true;
  segmented(host.controls, [["sim", "Com zona euro"], ["nao", "Só Portugal"]], "sim", (v) => { showEA = v === "sim"; r.redraw(); }, "Comparação");
  legend(host.legend, [{ color: css("--accent"), label: "Portugal", line: true }, { color: css("--accent-2"), label: "Zona euro (agregado BIS)", line: true }]);
  const r = responsive(host.chart, (W) => {
    const narrow = W < 600;
    const H = narrow ? 360 : 430, m = { t: 34, r: narrow ? 14 : 70, b: 34, l: 40 };
    const svg = svgIn(host.chart, W, H, "Linhas: preço real da habitação em Portugal e na zona euro, índice 2010=100, 1988–2026");
    const x = d3.scaleTime().domain(d3.extent(rows, (d) => d.t)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([60, 210]).range([H - m.b, m.t]);
    const t = (q) => rows.find((d) => d.q === q).t;
    // faixa de queda
    svg.append("rect").attr("x", x(t(s.peak.q))).attr("width", x(t(s.trough.q)) - x(t(s.peak.q))).attr("y", m.t).attr("height", H - m.b - m.t).attr("fill", css("--paper-2")).attr("opacity", .8);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(6)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(100)).attr("y2", y(100)).attr("stroke", css("--ink-3"));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 5 : 10).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("text").attr("class", "ann-muted").attr("x", m.l).attr("y", m.t - 14).text("Índice real, 2010 = 100 (escala começa em 60)");
    const line = (k) => d3.line().x((d) => x(d.t)).y((d) => y(d[k])).curve(d3.curveMonotoneX);
    if (showEA) svg.append("path").datum(rows).attr("d", line("ea")).attr("fill", "none").attr("stroke", css("--accent-2")).attr("stroke-width", 2.2);
    svg.append("path").datum(rows).attr("d", line("pt")).attr("fill", "none").attr("stroke", css("--accent")).attr("stroke-width", 3);
    // marcadores
    const pk = rows.find((d) => d.q === s.peak.q), tr = rows.find((d) => d.q === s.trough.q), la = rows.at(-1);
    for (const p of [pk, tr, la]) svg.append("circle").attr("cx", x(p.t)).attr("cy", y(p.pt)).attr("r", 4.5).attr("fill", css("--accent")).attr("stroke", css("--card")).attr("stroke-width", 2);
    halo(svg.append("text").attr("class", "ann").attr("x", x(pk.t)).attr("y", y(pk.pt) - 12).attr("text-anchor", "middle").text(`Máximo ${pk.q.replace("T", " T")}`));
    const midT = new Date((pk.t.getTime() + tr.t.getTime()) / 2);
    halo(svg.append("text").attr("class", "ann").attr("x", x(midT)).attr("y", y(70)).attr("text-anchor", "middle").style("font-weight", 600).text(`${fmt1(s.peakToTroughPct).replace("-", "−")}%`));
    halo(svg.append("text").attr("class", "ann-muted").attr("x", x(midT)).attr("y", y(70) + 15).attr("text-anchor", "middle").text("em 12 anos e meio"));
    halo(svg.append("text").attr("class", "ann").attr("x", x(tr.t) + 8).attr("y", y(tr.pt) + 16).attr("text-anchor", "start").text(`Mínimo ${tr.q.replace("T", " T")}`));
    const lx = narrow ? x(la.t) - 6 : x(la.t) + 8, anc = narrow ? "end" : "start";
    halo(svg.append("text").attr("class", "ann").attr("x", lx).attr("y", y(la.pt) + (narrow ? 22 : 4)).attr("text-anchor", anc).style("font-weight", 700).style("fill", css("--accent")).text(`+${fmt0(s.troughToLastPct)}%`));
    halo(svg.append("text").attr("class", "ann-muted").attr("x", lx).attr("y", y(la.pt) + (narrow ? 36 : 18)).attr("text-anchor", anc).text("desde 2013"));
    if (showEA) {
      halo(svg.append("text").attr("class", "ann").attr("x", lx).attr("y", y(la.ea) + (narrow ? -10 : 4)).attr("text-anchor", anc).style("fill", css("--accent-2")).text(`+${fmt0(s.eaSameWindowPct)}%`));
    }
    // cursor
    const cursor = svg.append("g").style("display", "none");
    cursor.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", css("--ink")).attr("stroke-width", 1);
    const cp = cursor.append("circle").attr("r", 5).attr("fill", css("--accent"));
    const ce = cursor.append("circle").attr("r", 4).attr("fill", css("--accent-2"));
    const bis = d3.bisector((d) => d.t).center;
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent")
      .on("pointermove pointerdown", (e) => {
        const [px] = d3.pointer(e);
        const d = rows[bis(rows, x.invert(px))];
        cursor.style("display", null).attr("transform", `translate(${x(d.t)},0)`);
        cp.attr("cy", y(d.pt)); ce.attr("cy", y(d.ea)).style("display", showEA ? null : "none");
        const [hx, hy] = d3.pointer(e, host.chart);
        tip.show(`<b>${d.q.replace("T", ", ")}.º trimestre</b><br>Portugal: ${fmt1(d.pt)}${showEA ? `<br>Zona euro: ${fmt1(d.ea)}` : ""}`, hx, hy);
      })
      .on("pointerleave", () => { cursor.style("display", "none"); tip.hide(); });
  });
  return r;
}

/* ------------------------------------------------------------------ */
/* 4. Mapa da ONU com linha temporal */
let worldPromise = null;
function loadWorld() { worldPromise ??= fetch("/assets/geo/countries-110m.json").then((r) => r.json()); return worldPromise; }
const ERAS = [
  { from: 1945, to: 1945, label: "Fundadores (1945)", v: "--ink" },
  { from: 1946, to: 1959, label: "1946–1959", v: "--accent-2" },
  { from: 1960, to: 1969, label: "1960–1969", v: "--accent" },
  { from: 1970, to: 1989, label: "1970–1989", v: "--accent-3" },
  { from: 1990, to: 2011, label: "1990–2011", v: "--accent-4" },
];
const eraOf = (y) => ERAS.find((e) => y >= e.from && y <= e.to);

function unMap(host, data, ctx) {
  const byId = new Map(data.members.map((m) => [m.id, m]));
  let year = ctx?.large ? 2011 : 1945;
  let timer = null;
  const yearsWithAdmissions = [...new Set(data.members.map((m) => m.year))].sort((a, b) => a - b);
  legend(host.legend, [...ERAS.map((e) => ({ color: css(e.v), label: e.label })), { color: css("--empty"), label: "Ainda não membro / não membro" }]);

  const stage = document.createElement("div"); stage.className = "un-stage";
  stage.innerHTML = `
    <div class="un-counter"><span class="yr" aria-live="polite"></span><span class="tot"><b></b> membros</span><span class="added"></span></div>
    <div class="map"></div>
    <div class="slider-row"><button class="play" type="button" aria-label="Reproduzir a evolução">▶</button>
      <input type="range" min="1945" max="2011" step="1" aria-label="Ano"></div>
    <div class="steps"></div>`;
  host.chart.appendChild(stage);
  const yrEl = stage.querySelector(".yr"), totEl = stage.querySelector(".tot b"), addEl = stage.querySelector(".added");
  const mapEl = stage.querySelector(".map"), stepsEl = stage.querySelector(".steps");
  const slider = stage.querySelector("input"), play = stage.querySelector(".play");
  slider.value = year;
  const tip = tooltip(host.chart);
  let paths = null, stepMarker = null, stepX = null, stepY = null;

  function admitted(y) { return data.members.filter((m) => m.year === y).map((m) => m.name); }
  function update() {
    yrEl.textContent = year;
    const tot = data.totals.find((t) => t.year === year).total;
    totEl.textContent = tot;
    const a = admitted(year);
    addEl.textContent = a.length ? `Entram em ${year}: ${a.join(", ")}` : (year === 1945 ? "" : "Sem novas admissões de Estados atuais neste ano.");
    if (year === 1945) addEl.textContent = `${a.length} fundadores ainda membros com a mesma identidade (de 51).`;
    if (paths) paths.attr("fill", (f) => fillFor(f));
    if (stepMarker) stepMarker.attr("cx", stepX(year)).attr("cy", stepY(tot));
  }
  function memberFor(f) {
    const id = f.id ?? data.mapAlias[f.properties.name];
    return byId.get(id);
  }
  function fillFor(f) {
    const m = memberFor(f);
    if (!m || m.year > year) return css("--empty");
    return css(eraOf(m.year).v);
  }
  function setYear(y) { year = Math.max(1945, Math.min(2011, y)); slider.value = year; update(); }
  slider.addEventListener("input", () => { stop(); setYear(+slider.value); });
  function stop() { if (timer) { clearInterval(timer); timer = null; play.textContent = "▶"; play.setAttribute("aria-label", "Reproduzir a evolução"); } }
  play.addEventListener("click", () => {
    if (timer) return stop();
    if (year >= 2011) setYear(1945);
    play.textContent = "❚❚"; play.setAttribute("aria-label", "Pausar");
    const step = () => { const nx = yearsWithAdmissions.find((y) => y > year); if (!nx) return stop(); setYear(nx); };
    if (reduceMotion()) { setYear(2011); stop(); return; }
    timer = setInterval(step, 650);
  });

  const ro = responsive(mapEl, async (W) => {
    const world = await loadWorld();
    const fc = topojson.feature(world, world.objects.countries);
    fc.features = fc.features.filter((f) => f.properties.name !== "Antarctica");
    const H = Math.round(W * 0.5);
    const svg = svgIn(mapEl, W, H, "Mapa-mundo colorido pelo ano de admissão de cada Estado na ONU");
    const proj = d3.geoEqualEarth().fitExtent([[2, 2], [W - 2, H - 2]], fc);
    const path = d3.geoPath(proj);
    paths = svg.append("g").selectAll("path").data(fc.features).join("path").attr("class", "country").attr("d", path)
      .attr("fill", (f) => fillFor(f))
      .on("pointerenter pointermove", function (e, f) {
        d3.select(this).classed("hl", true).raise();
        const m = memberFor(f);
        const id = f.id ?? f.properties.name;
        let h;
        if (m) h = `<b>${m.name}</b><br>Membro desde ${m.year}${m.note ? `<br><span>${m.note}</span>` : ""}`;
        else h = `<b>${data.mapNonMembers[id] || data.mapTerritories[id] || f.properties.name}</b><br>Não é Estado-membro`;
        const [px, py] = d3.pointer(e, host.chart); tip.show(h, px, py);
      })
      .on("pointerleave", function () { d3.select(this).classed("hl", false); tip.hide(); });
    update();
  });

  const rs = responsive(stepsEl, (W) => {
    const H = 90, m = { t: 10, r: 10, b: 22, l: 34 };
    const svg = svgIn(stepsEl, W, H, "Gráfico em degraus do número total de membros da ONU por ano, 1945–2011");
    stepX = d3.scaleLinear().domain([1945, 2026]).range([m.l, W - m.r]);
    stepY = d3.scaleLinear().domain([0, 200]).range([H - m.b, m.t]);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(stepX).ticks(W < 500 ? 5 : 9).tickFormat(d3.format("d")).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(stepY).tickValues([0, 100, 193]).tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("path").datum(data.totals).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 1.6)
      .attr("d", d3.line().x((d) => stepX(d.year)).y((d) => stepY(d.total)).curve(d3.curveStepAfter));
    for (const [yy, lab] of [[1960, "1960: +17"], [1992, "1992: +13"]]) {
      svg.append("text").attr("class", "ann-muted").attr("x", stepX(yy) + 4).attr("y", stepY(data.totals.find((t) => t.year === yy).total) + 14).text(lab);
    }
    stepMarker = svg.append("circle").attr("r", 5).attr("fill", css("--accent")).attr("stroke", css("--card")).attr("stroke-width", 2);
    update();
  });
  update();
  return { redraw() { ro.redraw(); rs.redraw(); }, destroy() { stop(); ro.destroy(); rs.destroy(); } };
}

/* ------------------------------------------------------------------ */
/* 5. Curva do esquecimento: escala log ⇄ linear */
function forgetting(host, data) {
  const rows = data.rows;
  let scale = "log", showD = true;
  const tip = tooltip(host.chart);
  segmented(host.controls, [["log", "Tempo logarítmico"], ["lin", "Tempo linear"]], scale, (v) => { scale = v; r.redraw(); }, "Escala do tempo");
  segmented(host.controls, [["sim", "Com réplica 2015"], ["nao", "Só 1885"]], "sim", (v) => { showD = v === "sim"; r.redraw(); }, "Séries");
  legend(host.legend, [{ color: css("--accent"), label: "Ebbinghaus (1885)", line: true }, { color: css("--accent-2"), label: "Réplica Murre & Dros (2015)", line: true, dash: true }]);
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560;
    const H = narrow ? 340 : 380, m = { t: 30, r: narrow ? 16 : 110, b: 44, l: 42 };
    const svg = svgIn(host.chart, W, H, "Curvas de poupança na reaprendizagem em função do tempo desde a aprendizagem");
    const x = scale === "log" ? d3.scaleLog().domain([0.3, 800]).range([m.l, W - m.r]) : d3.scaleLinear().domain([0, 750]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 60]).range([H - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(6)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    const ticks = scale === "log" ? [[0.33, "20 min"], [1, "1 h"], [8.8, "9 h"], [24, "1 dia"], [48, ""], [144, "6 dias"], [744, "31 dias"]]
      : [[0, "0"], [168, "1 sem."], [336, "2 sem."], [504, "3 sem."], [744, "31 dias"]];
    const ax = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`);
    ax.call(d3.axisBottom(x).tickValues(ticks.map((t) => t[0])).tickFormat((v) => ticks.find((t) => t[0] === v)[1]).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((v) => v + "%").tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("text").attr("class", "ann-muted").attr("x", m.l).attr("y", m.t - 12).text("Tempo poupado ao reaprender a lista (%)");
    svg.append("text").attr("class", "ann-muted").attr("x", W - m.r).attr("y", H - 6).attr("text-anchor", "end").text(scale === "log" ? "Tempo desde a aprendizagem (escala logarítmica) →" : "Tempo desde a aprendizagem →");
    const series = [{ k: "ebbinghaus", h: "hoursE", c: css("--accent"), n: "Ebbinghaus 1885" }];
    if (showD) series.push({ k: "dros", h: "hoursD", c: css("--accent-2"), n: "Réplica 2015" });
    // destaque do primeiro intervalo vs. último
    if (scale === "log") {
      svg.append("rect").attr("x", x(0.33)).attr("width", x(1) - x(0.33)).attr("y", m.t).attr("height", H - m.b - m.t).attr("fill", css("--paper-2")).attr("opacity", .8);
      svg.append("rect").attr("x", x(48)).attr("width", x(744) - x(48)).attr("y", m.t).attr("height", H - m.b - m.t).attr("fill", css("--paper-2")).attr("opacity", .45);
      halo(svg.append("text").attr("class", "ann").attr("x", (x(0.33) + x(1)) / 2).attr("y", y(6)).attr("text-anchor", "middle").style("font-size", "11.5px").text(`−${fmt1(data.summary.dropFirstHourPts)} pts`));
      halo(svg.append("text").attr("class", "ann-muted").attr("x", (x(0.33) + x(1)) / 2).attr("y", y(6) + 14).attr("text-anchor", "middle").text("40 min"));
      halo(svg.append("text").attr("class", "ann").attr("x", (x(48) + x(744)) / 2).attr("y", y(6)).attr("text-anchor", "middle").style("font-size", "11.5px").text(`−${fmt1(data.summary.dropDay2to31Pts)} pts`));
      halo(svg.append("text").attr("class", "ann-muted").attr("x", (x(48) + x(744)) / 2).attr("y", y(6) + 14).attr("text-anchor", "middle").text("29 dias (1885)"));
    }
    for (const s of series) {
      svg.append("path").datum(rows).attr("fill", "none").attr("stroke", s.c).attr("stroke-width", s.k === "ebbinghaus" ? 3 : 2.2).attr("stroke-dasharray", s.k === "dros" ? "6 4" : null)
        .attr("d", d3.line().x((d) => x(d[s.h])).y((d) => y(d[s.k])));
      svg.append("g").selectAll("circle").data(rows).join("circle").attr("cx", (d) => x(d[s.h])).attr("cy", (d) => y(d[s.k])).attr("r", 5)
        .attr("fill", s.c).attr("stroke", css("--card")).attr("stroke-width", 1.5).attr("tabindex", 0)
        .attr("aria-label", (d) => `${s.n}, ${d.label}: ${fmt1(d[s.k])}%`)
        .on("pointerenter pointermove", (e, d) => { const [px, py] = d3.pointer(e, host.chart); tip.show(`<b>${d.label}</b><br>Ebbinghaus: ${fmt1(d.ebbinghaus)}%<br>Réplica: ${fmt1(d.dros)}%`, px, py); })
        .on("pointerleave blur", () => tip.hide());
      if (!narrow) {
        const l = rows.at(-1);
        halo(svg.append("text").attr("class", "ann").attr("x", x(l[s.h]) + 9).attr("y", y(l[s.k]) + 4).style("fill", s.c).style("font-weight", 600).text(`${fmt1(l[s.k])}%`));
      }
    }
    const f = rows[0];
    halo(svg.append("text").attr("class", "ann").attr("x", x(f.hoursE) + 9).attr("y", y(f.ebbinghaus) - 6).style("fill", css("--accent")).style("font-weight", 600).text(`${fmt1(f.ebbinghaus)}%`));
    if (showD) {
      const d1 = rows[3];
      halo(svg.append("text").attr("class", "ann-muted").attr("x", scale === "log" ? x(15) : x(d1.hoursD) + 8).attr("y", y(scale === "log" ? 22 : d1.dros - 6)).attr("text-anchor", scale === "log" ? "middle" : "start").text("réplica: sobe de 9 h para 1 dia"));
    }
  });
  return r;
}


/* ------------------------------------------------------------------ */
/* GENÉRICOS (2026-11-04): columns, lines, dumbbell — parametrizados pelo JSON do dataset */
const fmtN = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : x.toLocaleString("pt-PT", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−"));
const fmtS = (x, d = 1) => (x > 0 ? "+" : "") + fmtN(x, d);

/* columns: colunas (simples ou empilhadas, com valores negativos) + linha opcional do total; várias vistas alternáveis.
   data.rows[{cat,...}], data.views[{id,label,yLabel,unit,decimals,series[{key,label,color,negColor,altColor,altLabel (cor alternativa nas linhas com alt: true)}],line{key,label},valueLabels,tipExtra[],notes[{cat,text}]}] */
function columns(host, data) {
  const rows = data.rows, views = data.views;
  let view = views[0];
  const tip = tooltip(host.chart);
  if (views.length > 1) segmented(host.controls, views.map((v) => [v.id, v.label]), view.id, (v) => { view = views.find((x) => x.id === v); drawLegend(); r.redraw(); }, "Vista");
  function drawLegend() {
    host.legend.innerHTML = "";
    const alt = view.series.filter((s) => s.altColor);
    const items = view.series.length > 1 || view.line || alt.length ? [...view.series].reverse().flatMap((s) => [{ color: css(s.color), label: s.label }, ...(s.altColor ? [{ color: css(s.altColor), label: s.altLabel }] : [])]) : [];
    if (view.line) items.push({ color: css("--ink"), label: view.line.label, line: true });
    if (items.length) legend(host.legend, items);
  }
  drawLegend();
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560, v = view, d = v.decimals ?? 1;
    const wrapW = narrow ? Math.floor((W - 10) / 6.4) : 200, words = v.yLabel.split(" "), yl = [""];
    for (const w of words) { if ((yl.at(-1) + " " + w).trim().length > wrapW) yl.push(w); else yl[yl.length - 1] = (yl.at(-1) + " " + w).trim(); }
    const H = (narrow ? 340 : 380) + (yl.length - 1) * 14, m = { t: 26 + yl.length * 14, r: 10, b: 34, l: narrow ? 34 : 44 };
    const stacked = v.series.length > 1;
    const svg = svgIn(host.chart, W, H, v.yLabel);
    const x = d3.scaleBand().domain(rows.map((r) => r.cat)).range([m.l, W - m.r]).padding(narrow ? 0.18 : 0.26);
    // empilhamento com negativos abaixo do zero
    const stacks = rows.map((row) => { let pos = 0, neg = 0; return v.series.map((s) => { const val = row[s.key]; const y0 = val >= 0 ? pos : neg; if (val >= 0) pos += val; else neg += val; return { row, s, val, y0, y1: y0 + val }; }); });
    let lo = d3.min(stacks.flat(), (e) => Math.min(e.y0, e.y1)), hi = d3.max(stacks.flat(), (e) => Math.max(e.y0, e.y1));
    if (v.line) { lo = Math.min(lo, d3.min(rows, (r) => r[v.line.key])); hi = Math.max(hi, d3.max(rows, (r) => r[v.line.key])); }
    const y = d3.scaleLinear().domain([Math.min(0, lo), Math.max(0, hi, v.yMax ?? 0)]).nice().range([H - m.b, m.t]);
    svg.append("g").attr("class", "grid").selectAll("line").data(y.ticks(6)).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat((t) => fmtN(t, Number.isInteger(t) ? 0 : 1)).tickSize(0)).call((g) => g.select(".domain").remove());
    yl.forEach((t, i) => halo(svg.append("text").attr("class", "ann-muted").attr("x", m.l - (narrow ? 30 : 40)).attr("y", 14 + i * 14).text(t)));
    const html = (row) => `<b>${row.cat}</b>` + v.series.map((s) => `<br>${s.label}: ${fmtN(row[s.key], d)}${v.unit === "pp" ? " pp" : v.unit === "$" ? " $" : v.unit || ""}`).join("") +
      (v.line ? `<br><b>${v.line.label}: ${fmtN(row[v.line.key], 1)}</b>` : "") + (v.tipExtra || []).map((t) => `<br>${t.label}: ${typeof row[t.key] === "number" ? fmtN(row[t.key], 1) : row[t.key]}${t.suffix}`).join("");
    const g = svg.append("g");
    g.selectAll("g").data(stacks).join("g").selectAll("rect").data((st) => st).join("rect")
      .attr("x", (e) => x(e.row.cat)).attr("width", x.bandwidth())
      .attr("y", (e) => y(Math.max(e.y0, e.y1))).attr("height", (e) => Math.max(0.5, Math.abs(y(e.y0) - y(e.y1))))
      .attr("fill", (e) => css(e.row.alt && e.s.altColor ? e.s.altColor : e.val < 0 && e.s.negColor ? e.s.negColor : e.s.color)).attr("opacity", (e) => (stacked && e.s.key !== v.series.at(-1).key ? 0.75 : 1));
    // alvos de interação por coluna (inclui teclado)
    svg.append("g").selectAll("rect").data(rows).join("rect").attr("class", "hit").attr("x", (row) => x(row.cat) - (x.step() - x.bandwidth()) / 2).attr("width", x.step())
      .attr("y", m.t).attr("height", H - m.t - m.b).attr("fill", "transparent").attr("tabindex", 0)
      .attr("aria-label", (row) => html(row).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .on("pointerenter pointermove", (e, row) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(row), px, py); })
      .on("pointerleave blur", () => tip.hide())
      .on("focus", (e, row) => tip.show(html(row), ((x(row.cat) + x.bandwidth() / 2) / W) * host.chart.clientWidth, 60));
    svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    const every = narrow ? (v.labelEveryNarrow || (rows.length > 8 ? 2 : 1)) : (v.labelEvery || 1);
    svg.append("g").selectAll("text").data(rows.filter((_, i) => i % every === (rows.length - 1) % every)).join("text").attr("class", "ann-muted")
      .attr("x", (row) => x(row.cat) + x.bandwidth() / 2).attr("y", H - m.b + 16).attr("text-anchor", "middle").text((row) => row.cat);
    if (v.line) {
      const ln = d3.line().x((row) => x(row.cat) + x.bandwidth() / 2).y((row) => y(row[v.line.key]));
      svg.append("path").datum(rows).attr("d", ln).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 2);
      svg.append("g").selectAll("circle").data(rows).join("circle").attr("cx", (row) => x(row.cat) + x.bandwidth() / 2).attr("cy", (row) => y(row[v.line.key])).attr("r", 3.5)
        .attr("fill", css("--card")).attr("stroke", css("--ink")).attr("stroke-width", 2).style("pointer-events", "none");
      const L = rows.at(-1), F = rows[0];
      halo(svg.append("text").attr("class", "ann").attr("x", x(L.cat) + x.bandwidth() / 2).attr("y", y(L[v.line.key]) - 10).attr("text-anchor", "end").style("font-weight", 700).text(`${fmtN(L[v.line.key], 1)}%`));
      halo(svg.append("text").attr("class", "ann").attr("x", x(F.cat)).attr("y", y(F[v.line.key]) - 10).attr("text-anchor", "start").text(`${fmtN(F[v.line.key], 1)}%`));
    }
    if (v.valueLabels) {
      const show = narrow && rows.length > 14 ? rows.filter((row, i) => i === 0 || i === rows.length - 1 || row[v.series[0].key] === d3.max(rows, (q) => q[v.series[0].key]) || row[v.series[0].key] === d3.min(rows, (q) => q[v.series[0].key]) || row[v.series[0].key] < 0) : rows;
      svg.append("g").selectAll("text").data(show).join("text").attr("class", "ann").style("font-size", narrow ? "10.5px" : "11.5px").style("font-weight", 600)
        .attr("x", (row) => x(row.cat) + x.bandwidth() / 2).attr("text-anchor", "middle")
        .attr("y", (row) => (row[v.series[0].key] >= 0 ? y(row[v.series[0].key]) - 5 : y(0) + 14)).style("fill", (row) => (row[v.series[0].key] < 0 ? css("--card") : null))
        .text((row) => (v.unit === " meses" ? fmtS(row[v.series[0].key], d) : fmtN(row[v.series[0].key], v.unit === "$" ? 0 : d)));
    }
    for (const n of v.notes || []) {
      if (!x(n.cat) && x(n.cat) !== 0) continue;
      const cx = x(n.cat) + x.bandwidth() / 2, right = cx > W * 0.4;
      svg.append("line").attr("class", "ann-line").attr("x1", cx).attr("x2", cx).attr("y1", m.t + 4).attr("y2", y(0) + (y(0) > H - m.b - 30 ? -4 : 0));
      halo(svg.append("text").attr("class", "ann").style("font-size", "11.5px").attr("x", cx + (right ? -5 : 5)).attr("y", m.t + (narrow ? 34 : 12)).attr("text-anchor", right ? "end" : "start").text(narrow && n.short ? n.short : n.text));
    }
  });
  return r;
}

/* lines: séries temporais com escala log ⇄ linear, cursor, rótulos diretos.
   data.rows[{x, key...}], data.config{x{min,max,ticks,tableLabel}, y{label,suffix,decimals,logDefault,logMin,logMax,linMin,linMax}; rows podem ter label (texto do cursor/tabela, p. ex. meses), series[{key,label,color,width}], scaleToggle, dots, gaps (anos sem valor ficam em branco, sem ligar os pontos), annotations[], shade[]} */
function lines(host, data) {
  const C = data.config, rows = data.rows;
  let log = !!C.y.logDefault;
  const tip = tooltip(host.chart);
  if (C.scaleToggle) segmented(host.controls, [["log", "Escala logarítmica"], ["lin", "Escala linear"]], log ? "log" : "lin", (v) => { log = v === "log"; r.redraw(); }, "Escala do eixo vertical");
  if (C.howToRead) { const p = document.createElement("p"); p.className = "how-to-read"; p.textContent = C.howToRead; host.legend.appendChild(p); }
  if (C.series.length > 1) legend(host.legend, C.series.filter((s, i, a) => a.findIndex((q) => q.color === s.color) === i || s.color !== "--muted").map((s) => ({ color: css(s.color), label: s.color === "--muted" ? "Outros países" : s.label, line: true })));
  const d = C.y.decimals ?? 1;
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560;
    const H = narrow ? 340 : 400, m = { t: 34, r: C.series.length > 1 ? (C.labelMargin ? C.labelMargin[narrow ? 0 : 1] : narrow ? 64 : 92) : 16, b: 32, l: narrow ? 40 : 48 };
    const svg = svgIn(host.chart, W, H, C.y.label);
    const x = d3.scaleLinear().domain([C.x.min, C.x.max]).range([m.l, W - m.r]);
    const y = log ? d3.scaleLog().domain([C.y.logMin, C.y.logMax]).range([H - m.b, m.t]) : d3.scaleLinear().domain([C.y.linMin ?? 0, C.y.linMax]).range([H - m.b, m.t]);
    if (!log && (C.y.linMin ?? 0) < 0) svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
    for (const sh of C.shade || []) {
      svg.append("rect").attr("x", x(sh.from - 0.5)).attr("width", x(sh.to + 0.5) - x(sh.from - 0.5)).attr("y", m.t).attr("height", H - m.t - m.b).attr("fill", css("--paper-2")).attr("opacity", 0.9);
      if (sh.label && !narrow) svg.append("text").attr("class", "ann-muted").attr("x", (x(sh.from) + x(sh.to)) / 2).attr("y", H - m.b - 6).attr("text-anchor", "middle").text(sh.label);
    }
    const yt = log ? y.ticks(10).filter((t) => [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200].some((k) => Math.abs(t - k) < 1e-9)) : y.ticks(6);
    svg.append("g").attr("class", "grid").selectAll("line").data(yt).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(yt).tickFormat((t) => fmtN(t, t > 0 && t < 1 ? 1 : 0)).tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(narrow ? C.x.ticks.filter((_, i) => i % 2 === 0 || i === C.x.ticks.length - 1) : C.x.ticks).tickFormat(d3.format("d")).tickSizeOuter(0));
    halo(svg.append("text").attr("class", "ann-muted").attr("x", m.l - (narrow ? 36 : 44)).attr("y", 14).text((narrow ? C.y.label.replace(/ \(.*\)$/, "") : C.y.label) + (log ? " — escala log." : "")));
    const order = [...C.series].sort((a, b) => (a.color === "--muted" ? -1 : 0) - (b.color === "--muted" ? -1 : 0));
    for (const s of order) {
      svg.append("path").datum(C.gaps ? rows : rows.filter((q) => q[s.key] != null)).attr("fill", "none").attr("stroke", css(s.color)).attr("stroke-width", s.width || 1.6).attr("opacity", s.color === "--muted" ? 0.8 : 1)
        .attr("stroke-linejoin", "round").attr("d", d3.line().defined((q) => q[s.key] != null).x((q) => x(q.x)).y((q) => y(q[s.key])));
      if (C.dots && s.color !== "--muted") svg.append("g").selectAll("circle").data(rows.filter((q) => q[s.key] != null)).join("circle").attr("cx", (q) => x(q.x)).attr("cy", (q) => y(q[s.key])).attr("r", 2.6).attr("fill", css(s.color)).style("pointer-events", "none");
    }
    // rótulos diretos no fim, sem sobreposição
    if (C.series.length > 1) {
      const L = rows.at(-1);
      const lastOf = (k) => [...rows].reverse().find((q) => q[k] != null) || L;
      const labs = C.series.map((s) => ({ s, y: y(lastOf(s.key)[s.key]), v: lastOf(s.key)[s.key] })).sort((a, b) => a.y - b.y);
      const gap = narrow ? 12 : 13;
      for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < gap) labs[i].y = labs[i - 1].y + gap;
      const over = labs.at(-1).y - (H - m.b); if (over > 0) labs.forEach((l) => (l.y -= over));
      for (const l of labs) halo(svg.append("text").attr("class", "ann").style("font-size", narrow ? "10.5px" : "11.5px").style("font-weight", l.s.color === "--muted" ? 400 : 700)
        .style("fill", l.s.color === "--muted" ? css("--ink-3") : css(l.s.color)).attr("x", x(L.x) + 6).attr("y", l.y + 4).text(`${narrow || C.shortEndLabels ? l.s.short || l.s.label.slice(0, 3) + "." : l.s.label} ${fmtN(l.v, d)}`));
    }
    for (const a of C.annotations || []) {
      if ((a.logOnly && !log) || (a.linOnly && log)) continue;
      const q = rows.find((z) => z.x === a.x); if (!q) continue;
      svg.append("circle").attr("cx", x(a.x)).attr("cy", y(q[a.key])).attr("r", 4.5).attr("fill", css((C.series.find((sr) => sr.key === a.key) || {}).color || "--accent")).attr("stroke", css("--card")).attr("stroke-width", 2);
      halo(svg.append("text").attr("class", "ann").style("font-weight", a.strong ? 700 : 400).style("fill", a.strong ? css("--accent") : null)
        .attr("x", x(a.x) + (a.dx || 0)).attr("y", y(q[a.key]) + (a.dy || 0)).attr("text-anchor", a.anchor || "start").text(narrow && a.short ? a.short : a.text));
    }
    const cursor = svg.append("g").style("display", "none").style("pointer-events", "none");
    cursor.append("line").attr("y1", m.t).attr("y2", H - m.b).attr("stroke", css("--ink")).attr("stroke-width", 1).attr("opacity", 0.6);
    const bis = d3.bisector((q) => q.x).center;
    const html = (q) => `<b>${q.label ?? q.x}</b>` + C.series.map((s) => `<br>${s.label}: ${q[s.key] == null ? "—" : fmtN(q[s.key], d) + (C.y.suffix || "")}`).join("");
    const show = (q, px, py) => { cursor.style("display", null).attr("transform", `translate(${x(q.x)},0)`); tip.show(html(q), px, py); };
    svg.append("rect").attr("x", m.l).attr("y", m.t).attr("width", W - m.l - m.r).attr("height", H - m.t - m.b).attr("fill", "transparent").attr("tabindex", 0)
      .attr("aria-label", `Gráfico de linhas; use as setas para percorrer os anos`)
      .on("pointermove pointerdown", function (e) { const [px] = d3.pointer(e); const q = rows[bis(rows, x.invert(px))]; const [hx, hy] = d3.pointer(e, host.chart); show(q, hx, hy); this._i = rows.indexOf(q); })
      .on("pointerleave blur", () => { cursor.style("display", "none"); tip.hide(); })
      .on("keydown", function (e) { if (!/Arrow(Left|Right)/.test(e.key)) return; e.preventDefault(); this._i = Math.max(0, Math.min(rows.length - 1, (this._i ?? rows.length - 1) + (e.key === "ArrowRight" ? 1 : -1))); const q = rows[this._i]; show(q, (x(q.x) / W) * host.chart.clientWidth, 50); });
  });
  return r;
}

/* dumbbell: dois valores por categoria (a → b), terceiro marcador opcional (c), linha de referência e faixa; ordenação alternável.
   data.rows[{label,a,b,c,highlight}], data.config{aLabel,bLabel,cLabel,ref,refLabel,band,bandLabel,unit,decimals,domain,sorts} */
function dumbbell(host, data) {
  const C = data.config; const d = C.decimals ?? 1;
  let sortKey = C.sorts?.[0]?.[0] || "b";
  const tip = tooltip(host.chart);
  if (C.sorts?.length > 1) segmented(host.controls, C.sorts, sortKey, (v) => { sortKey = v; r.redraw(); }, "Ordenação");
  if (C.howToRead) { const p = document.createElement("p"); p.className = "how-to-read"; p.textContent = C.howToRead; host.legend.appendChild(p); }
  legend(host.legend, [{ color: css("--ink-3"), label: C.aLabel, shape: "dot" }, { color: css("--accent-2"), label: C.bLabel, shape: "dot" }, ...(C.cLabel ? [{ color: css("--ink"), label: C.cLabel, shape: "ring" }] : []), ...(C.band ? [{ color: css("--accent-2"), opacity: 0.25, label: `Faixa ${C.bandLabel}${C.bandNote ? ` (${C.bandNote})` : ""}` }] : [])]);
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560;
    const key = (q) => (sortKey === "delta" ? (q.b ?? -9) - q.a : q.b ?? -9);
    const rows = [...data.rows].sort((p, q) => key(q) - key(p) || q.a - p.a);
    const rowH = narrow ? 17 : 18, m = { t: 44, r: narrow ? 30 : 60, b: 30, l: narrow ? 104 : 140 };
    const H = m.t + m.b + rows.length * rowH;
    const svg = svgIn(host.chart, W, H, `Gráfico de halteres: ${C.aLabel} e ${C.bLabel} por país`);
    const x = d3.scaleLinear().domain(C.domain).range([m.l, W - m.r]);
    const y = (i) => m.t + i * rowH + rowH / 2;
    if (C.band) svg.append("rect").attr("x", x(C.band[0])).attr("width", Math.max(2, x(C.band[1]) - x(C.band[0]))).attr("y", m.t - 4).attr("height", rows.length * rowH + 8).attr("fill", css("--accent-2")).attr("opacity", 0.16);
    svg.append("g").attr("class", "grid").selectAll("line").data(x.ticks(narrow ? 4 : 8)).join("line").attr("x1", x).attr("x2", x).attr("y1", m.t - 4).attr("y2", H - m.b);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 8).tickFormat((t) => fmtN(t, t % 1 ? 1 : 0) + C.unit).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${m.t - 8})`).call(d3.axisTop(x).ticks(narrow ? 4 : 8).tickFormat((t) => fmtN(t, t % 1 ? 1 : 0) + C.unit).tickSize(0)).call((g) => g.select(".domain").remove());
    svg.append("line").attr("x1", x(C.ref)).attr("x2", x(C.ref)).attr("y1", m.t - 4).attr("y2", H - m.b).attr("stroke", css("--ink")).attr("stroke-dasharray", "4 3");
    halo(svg.append("text").attr("class", "ann").style("font-size", "11.5px").attr("x", x(C.ref) + 5).attr("y", 12).text(C.refLabel));
    const html = (q) => `<b>${q.label}</b><br>${C.aLabel}: ${fmtN(q.a, d)}${C.unit}<br>${C.bLabel}: ${q.b == null ? "sem dados" : fmtN(q.b, d) + C.unit}${q.c != null ? `<br>${C.cLabel}: ${fmtN(q.c, d)}${C.unit}` : ""}`;
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (q, i) => `translate(0,${y(i)})`).attr("tabindex", 0)
      .attr("aria-label", (q) => html(q).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .on("pointerenter pointermove", (e, q) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(q), px, py); })
      .on("pointerleave blur", () => tip.hide())
      .on("focus", function (e, q) { const i = rows.indexOf(q); tip.show(html(q), (x(q.b ?? q.a) / W) * host.chart.clientWidth, y(i)); });
    g.append("rect").attr("x", 0).attr("width", W).attr("y", -rowH / 2).attr("height", rowH).attr("fill", (q) => (q.highlight ? css("--paper-2") : "transparent")).attr("opacity", 0.9);
    g.append("text").attr("x", m.l - 8).attr("y", 4).attr("text-anchor", "end").attr("class", "ann").style("font-size", narrow ? "11px" : "12px").style("font-weight", (q) => (q.highlight ? 700 : 400))
      .style("fill", (q) => (q.highlight ? css("--accent") : null)).text((q) => (narrow && q.label.length > 14 ? q.label.replace("Macedónia do Norte", "Maced. do Norte") : q.label));
    g.filter((q) => q.b != null).append("line").attr("x1", (q) => x(q.a)).attr("x2", (q) => x(q.b)).attr("stroke", css("--ink-3")).attr("stroke-width", 1.4).attr("opacity", 0.7);
    g.append("circle").attr("cx", (q) => x(q.a)).attr("r", 3.6).attr("fill", css("--ink-3"));
    g.filter((q) => q.b != null).append("circle").attr("cx", (q) => x(q.b)).attr("r", 4.6).attr("fill", (q) => (q.highlight ? css("--accent") : css("--accent-2"))).attr("stroke", css("--card")).attr("stroke-width", 1);
    g.filter((q) => q.c != null).append("circle").attr("cx", (q) => x(q.c)).attr("r", 5).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 2);
    g.filter((q) => q.b == null).append("text").attr("class", "ann-muted").attr("x", (q) => x(q.a) + 8).attr("y", 4).text("2025: sem dados");
    g.filter((q) => q.highlight && q.b != null).append("text").attr("class", "ann").style("font-size", "11px").style("font-weight", 700)
      .attr("x", (q) => (x(Math.max(q.a, q.b)) + 84 > W ? x(Math.min(q.a, q.b)) - 8 : x(Math.max(q.a, q.b)) + 8)).attr("text-anchor", (q) => (x(Math.max(q.a, q.b)) + 84 > W ? "end" : "start"))
      .attr("y", 4).text((q) => `${fmtN(q.a, d)} → ${fmtN(q.b, d)}${C.unit}`);
  });
  return r;
}


/* bars: barras horizontais divergentes (valores positivos e negativos), várias vistas (uma chave por vista), linha de referência opcional, ordenação alternável.
   data.rows[{label,highlight,total?,...keys}], data.config{views[{id,label,key,axisLabel,ref,refLabel}],unit,decimals,signed (false = sem sinal +),independentScale (escala própria em cada vista, para vistas com unidades diferentes),howToRead,sorts[[id,label]],pinned:[labels fixos no topo]} */
function bars(host, data) {
  const C = data.config, d = C.decimals ?? 1, views = C.views;
  const fmtV = (t, dd) => (C.signed === false ? fmtN(t, dd) : fmtS(t, dd));
  let view = views[0], sortKey = C.sorts?.[0]?.[0] || "value";
  const tip = tooltip(host.chart);
  if (views.length > 1) segmented(host.controls, views.map((v) => [v.id, v.label]), view.id, (v) => { view = views.find((q) => q.id === v); r.redraw(); }, "Vista");
  if (C.sorts?.length > 1) segmented(host.controls, C.sorts, sortKey, (v) => { sortKey = v; r.redraw(); }, "Ordenação");
  if (C.howToRead) { const p = document.createElement("p"); p.className = "how-to-read"; p.textContent = C.howToRead; host.legend.appendChild(p); }
  legend(host.legend, [{ color: css("--accent-2"), label: C.posLabel || "Subida" }, ...(data.rows.some((q) => views.some((w) => q[w.key] < 0)) ? [{ color: css("--accent-3"), label: C.negLabel || "Descida" }] : []), ...(C.highlightLabel ? [{ color: css("--accent"), label: C.highlightLabel }] : [])]);
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560, v = view, k = v.key;
    const pinned = rowsOf().filter((q) => (C.pinned || []).includes(q.label));
    const rest = rowsOf().filter((q) => !(C.pinned || []).includes(q.label)).sort((p, q) => (sortKey === "label" ? p.label.localeCompare(q.label, "pt") : q[k] - p[k]));
    const rows = [...pinned, ...rest];
    const rowH = narrow ? 26 : 28, m = { t: 40, r: narrow ? 44 : 60, b: 30, l: narrow ? 118 : 170 };
    const H = m.t + m.b + rows.length * rowH + (pinned.length ? 8 : 0);
    const svg = svgIn(host.chart, W, H, v.axisLabel);
    const ext = d3.extent(rows.flatMap((q) => (C.independentScale ? [q[k]] : views.map((w) => q[w.key]))).concat([0]));
    const x = d3.scaleLinear().domain([Math.min(0, ext[0]), Math.max(0, ext[1])]).nice().range([m.l, W - m.r]);
    const y = (i) => m.t + i * rowH + (pinned.length && i >= pinned.length ? 8 : 0);
    svg.append("g").attr("class", "grid").selectAll("line").data(x.ticks(narrow ? 4 : 8)).join("line").attr("x1", x).attr("x2", x).attr("y1", m.t - 4).attr("y2", H - m.b);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(narrow ? 4 : 8).tickFormat((t) => fmtV(t, 0) + C.unit).tickSizeOuter(0));
    halo(svg.append("text").attr("class", "ann-muted").attr("x", narrow ? 4 : m.l).attr("y", 14).text(narrow && v.axisShort ? v.axisShort : v.axisLabel));
    if (pinned.length) svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", y(pinned.length) - 4).attr("y2", y(pinned.length) - 4).attr("stroke", css("--rule"));
    const html = (q) => `<b>${q.label}</b>` + views.map((w) => `<br>${w.label}: ${fmtV(q[w.key], d)}${C.unit}`).join("") + (q.note ? `<br>${q.note}` : "");
    const g = svg.append("g").selectAll("g").data(rows).join("g").attr("transform", (q, i) => `translate(0,${y(i)})`).attr("tabindex", 0)
      .attr("aria-label", (q) => html(q).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .on("pointerenter pointermove", (e, q) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(q), px, py); })
      .on("pointerleave blur", () => tip.hide())
      .on("focus", function (e, q) { tip.show(html(q), (x(Math.max(0, q[k])) / W) * host.chart.clientWidth, y(rows.indexOf(q)) + rowH); });
    g.append("rect").attr("x", 0).attr("width", W).attr("y", 0).attr("height", rowH).attr("fill", (q) => (q.highlight ? css("--paper-2") : "transparent")).attr("opacity", 0.9);
    g.append("text").attr("x", m.l - 8).attr("y", rowH / 2 + 4).attr("text-anchor", "end").attr("class", "ann").style("font-size", narrow ? "11px" : "12.5px")
      .style("font-weight", (q) => (q.highlight || (C.pinned || []).includes(q.label) ? 700 : 400)).text((q) => (narrow && q.short ? q.short : q.label));
    const bh = rowH - 10;
    g.append("rect").attr("x", (q) => x(Math.min(0, q[k]))).attr("width", (q) => Math.max(1, Math.abs(x(q[k]) - x(0)))).attr("y", 5).attr("height", bh)
      .attr("fill", (q) => css(q.highlight ? "--accent" : q[k] < 0 ? "--accent-3" : "--accent-2"));
    g.append("text").attr("class", "ann").style("font-size", narrow ? "10.5px" : "11.5px").style("font-weight", 600).attr("y", rowH / 2 + 4)
      // negativos curtos perto da margem: o rótulo passa para a direita do zero, para não tapar o nome
      .attr("x", (q) => (q[k] < 0 ? (x(q[k]) - 56 < m.l ? x(0) + 4 : x(q[k]) - 4) : x(q[k]) + 4)).attr("text-anchor", (q) => (q[k] < 0 && x(q[k]) - 56 >= m.l ? "end" : "start")).text((q) => fmtV(q[k], d) + C.unit);
    svg.append("line").attr("class", "zero").attr("x1", x(0)).attr("x2", x(0)).attr("y1", m.t - 4).attr("y2", H - m.b);
    if (v.ref != null) {
      svg.append("line").attr("x1", x(v.ref)).attr("x2", x(v.ref)).attr("y1", m.t - 4).attr("y2", H - m.b).attr("stroke", css("--ink")).attr("stroke-dasharray", "4 3");
      halo(svg.append("text").attr("class", "ann").style("font-size", "11px").attr("x", x(v.ref) + 4).attr("y", m.t - 10).text(v.refLabel || ""));
    }
  });
  function rowsOf() { return data.rows; }
  return r;
}


/* scatter: dispersão genérica (um ponto por observação), diagonal y = x opcional, linhas do zero, grupos por cor e filtro de destaque.
   data.rows[{x,y,group,label,facet?}], data.config{x{label,short,min,max,ticks,decimals}, y{...}, groups[{key,label,color,shape}], diagonal{label},
   zeroLines, facets{key,options[[id,label]]}, howToRead, notes[{x,y,text,short,anchor}]} */
function scatter(host, data) {
  const C = data.config, rows = data.rows;
  let facet = C.facets ? C.facets.options[0][0] : "all";
  const tip = tooltip(host.chart);
  if (C.facets) segmented(host.controls, C.facets.options, facet, (v) => { facet = v; r.redraw(); }, "Destacar");
  if (C.howToRead) { const p = document.createElement("p"); p.className = "how-to-read"; p.textContent = C.howToRead; host.legend.appendChild(p); }
  legend(host.legend, [...C.groups.map((g) => ({ color: css(g.color), label: g.label, shape: g.shape === "ring" ? "ring" : "dot" })), ...(C.diagonal ? [{ color: css("--ink"), label: C.diagonal.label, dash: true, line: true }] : [])]);
  const gOf = (k) => C.groups.find((g) => g.key === k) || C.groups[0];
  const r = responsive(host.chart, (W) => {
    const narrow = W < 560;
    const m = { t: 30, r: 14, b: 46, l: narrow ? 44 : 52 };
    const H = Math.round(Math.min(Math.max(W * 0.78, 320), 500));
    const svg = svgIn(host.chart, W, H, `${C.y.label} em função de ${C.x.label}`);
    const x = d3.scaleLinear().domain([C.x.min, C.x.max]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([C.y.min, C.y.max]).range([H - m.b, m.t]);
    const xt = C.x.ticks || x.ticks(6), yt = C.y.ticks || y.ticks(6);
    svg.append("g").attr("class", "grid").selectAll("line").data(yt).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y).attr("y2", y);
    svg.append("g").attr("class", "grid").selectAll("line").data(xt).join("line").attr("y1", m.t).attr("y2", H - m.b).attr("x1", x).attr("x2", x);
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(narrow ? xt.filter((_, i) => i % 2 === 0) : xt).tickFormat((t) => fmtN(t, C.x.decimals ?? 1)).tickSizeOuter(0));
    svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(yt).tickFormat((t) => fmtN(t, C.y.decimals ?? 1)).tickSize(0)).call((g) => g.select(".domain").remove());
    halo(svg.append("text").attr("class", "ann-muted").attr("x", W - m.r).attr("y", H - 8).attr("text-anchor", "end").text(narrow && C.x.short ? C.x.short : C.x.label));
    halo(svg.append("text").attr("class", "ann-muted").attr("x", m.l - (narrow ? 40 : 48)).attr("y", 14).text(narrow && C.y.short ? C.y.short : C.y.label));
    if (C.zeroLines) {
      if (C.y.min < 0) svg.append("line").attr("class", "zero").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(0)).attr("y2", y(0));
      if (C.x.min < 0) svg.append("line").attr("class", "zero").attr("y1", m.t).attr("y2", H - m.b).attr("x1", x(0)).attr("x2", x(0));
    }
    if (C.diagonal) {
      const a = Math.max(C.x.min, C.y.min), b = Math.min(C.x.max, C.y.max);
      svg.append("line").attr("x1", x(a)).attr("y1", y(a)).attr("x2", x(b)).attr("y2", y(b)).attr("stroke", css("--ink")).attr("stroke-dasharray", "5 4").attr("opacity", 0.8);
      if (C.diagonal.text) halo(svg.append("text").attr("class", "ann").style("font-size", "11px").attr("x", x(b) - 4).attr("y", y(b) + 14).attr("text-anchor", "end").text(narrow && C.diagonal.short ? C.diagonal.short : C.diagonal.text));
    }
    const on = (q) => facet === "all" || q[C.facets.key] === facet;
    const html = (q) => `<b>${q.label}</b>${q.sub ? `<br>${q.sub}` : ""}<br>${C.x.tipLabel || C.x.label}: ${fmtN(q.x, C.x.tipDecimals ?? 2)}<br>${C.y.tipLabel || C.y.label}: ${fmtN(q.y, C.y.tipDecimals ?? 2)}<br>${gOf(q.group).label}`;
    const pts = svg.append("g").selectAll("circle").data([...rows].sort((a, b) => on(a) - on(b))).join("circle")
      .attr("cx", (q) => x(q.x)).attr("cy", (q) => y(q.y)).attr("r", narrow ? 4.2 : 5)
      .attr("fill", (q) => (gOf(q.group).shape === "ring" ? css("--card") : css(gOf(q.group).color)))
      .attr("stroke", (q) => (gOf(q.group).shape === "ring" ? css(gOf(q.group).color) : css("--card")))
      .attr("stroke-width", (q) => (gOf(q.group).shape === "ring" ? 1.8 : 1))
      .attr("opacity", (q) => (on(q) ? 0.9 : 0.12)).attr("tabindex", (q) => (on(q) ? 0 : -1))
      .attr("aria-label", (q) => html(q).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .on("pointerenter pointermove", (e, q) => { const [px, py] = d3.pointer(e, host.chart); tip.show(html(q), px, py); })
      .on("pointerleave blur", () => tip.hide())
      .on("focus", (e, q) => tip.show(html(q), (x(q.x) / W) * host.chart.clientWidth, y(q.y)));
    pts.filter((q) => !on(q)).style("pointer-events", "none");
    for (const n of C.notes || []) halo(svg.append("text").attr("class", "ann").style("font-size", narrow ? "10.5px" : "11.5px").style("font-weight", 600)
      .attr("x", x(n.x)).attr("y", y(n.y)).attr("text-anchor", n.anchor || "start").text(narrow && n.short ? n.short : n.text));
  });
  return r;
}

export const CHARTS = { midterms, "ireland-area": irelandArea, "house-lines": houseLines, "un-map": unMap, forgetting, columns, lines, dumbbell, bars, scatter };

/* Tabelas acessíveis (equivalente textual dos dados) */
export function dataTable(type, data) {
  const T = (head, rows) => `<div class="table-wrap"><table class="data"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  switch (type) {
    case "midterms": return T(["Ano", "Presidente", "Partido", "Aprovação", "Câmara", "Senado"], data.rows.map((r) => [r.year, r.president, r.party, r.approval == null ? "—" : r.approval + "%", signed(r.house), signed(r.senate)]));
    case "ireland-area": return T(["Ano", "Centros de dados (GWh)", "Outros (GWh)", "Total (GWh)", "Quota (%)"], data.rows.map((r) => [r.year, fmt0(r.dc), fmt0(r.other), fmt0(r.total), fmt1(r.share)]));
    case "house-lines": return T(["Trimestre", "Portugal", "Zona euro"], data.rows.map((r) => [r.q, fmt1(r.pt), fmt1(r.ea)]));
    case "un-map": return T(["Estado", "Ano de admissão", "Nota"], [...data.members].sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, "pt")).map((m) => [m.name, m.year, m.note || ""]));
    case "forgetting": return T(["Intervalo", "Ebbinghaus 1885 (%)", "Réplica 2015 (%)"], data.rows.map((r) => [r.label, fmt1(r.ebbinghaus), fmt1(r.dros)]));
    case "columns": { const v = data.views; const cols = [...new Set(v.flatMap((w) => [...w.series.map((s) => s.key), ...(w.line ? [w.line.key] : []), ...(w.tipExtra || []).map((t) => t.key)]))];
      const lab = (k) => { for (const w of v) { const s = w.series.find((q) => q.key === k) || (w.line?.key === k ? w.line : null) || (w.tipExtra || []).find((q) => q.key === k); if (s) return s.label; } return k; };
      return T(["", ...cols.map(lab)], data.rows.map((r) => [r.cat, ...cols.map((k) => (typeof r[k] === "number" ? fmtN(r[k], Number.isInteger(r[k]) ? 0 : 2) : r[k] ?? "—"))])); }
    case "lines": return T([data.config.x.tableLabel || "Ano", ...data.config.series.map((s) => s.label)], data.rows.map((r) => [r.label ?? r.x, ...data.config.series.map((s) => (r[s.key] == null ? "—" : fmtN(r[s.key], data.config.y.decimals ?? 1)))]));
    case "dumbbell": { const C = data.config; return T(["País", C.aLabel, C.bLabel, ...(C.cLabel ? [C.cLabel] : [])], [...data.rows].sort((a, b) => (b.b ?? -9) - (a.b ?? -9)).map((r) => [r.label, fmtN(r.a, C.decimals), r.b == null ? "—" : fmtN(r.b, C.decimals), ...(C.cLabel ? [r.c == null ? "" : fmtN(r.c, C.decimals)] : [])])); }
    case "scatter": { const C = data.config; return T(["", ...(C.facets ? [C.facets.label || "Grupo"] : []), C.x.tipLabel || C.x.label, C.y.tipLabel || C.y.label, "Resultado"], data.rows.map((r) => [r.label, ...(C.facets ? [(C.facets.options.find((o) => o[0] === r[C.facets.key]) || [, r[C.facets.key]])[1]] : []), fmtN(r.x, C.x.tipDecimals ?? 2), fmtN(r.y, C.y.tipDecimals ?? 2), (C.groups.find((g) => g.key === r.group) || {}).label || ""])); }
    case "bars": { const C = data.config; return T(["", ...C.views.map((w) => w.label + (C.unit ? ` (${C.unit.trim()})` : ""))], data.rows.map((r) => [r.label, ...C.views.map((w) => fmtN(r[w.key], C.decimals ?? 1))])); }
    default: return "";
  }
}
export function toCSV(type, data) {
  const rows = type === "un-map" ? data.members : ["ireland-area", "house-lines", "midterms", "forgetting", "columns", "lines", "dumbbell", "bars", "scatter"].includes(type) ? data.rows : [];
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const q = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
}
