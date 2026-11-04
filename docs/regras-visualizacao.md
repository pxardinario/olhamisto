# Regras de visualização

- **Formato depois da história.** Barras para comparar categorias; linhas para tempo; dispersão para relações; mapas só quando a geografia é parte da explicação; cronologias para processos; tabelas quando os valores exatos importam.
- **Sem circulares** quando houver alternativa mais clara. **Sem 3D.**
- **Barras começam em zero.** Séries de índice podem começar noutro valor — sempre assinalado no gráfico («escala começa em 60») e na nota metodológica.
- **Sem eixos duplos** para sugerir relações.
- **Mapas:** valores relativos (per capita, %) em vez de absolutos quando a dimensão do território/população enganar. Indicar a escala da geometria e o tratamento de territórios disputados/dependentes.
- **Anotar a descoberta.** O olho deve cair primeiro na conclusão (cor de destaque, rótulo direto), não na legenda.
- **Rótulos diretos** em vez de legendas sempre que possível; legenda presente para acessibilidade.
- **Cores:** paleta da revista (terracota `--accent` para o destaque; azul tinta `--accent-2` para a comparação; neutros para o contexto). Partidos dos EUA: azul (D) / vermelho (R), convenção neutra.
- **Interatividade só quando revela algo** (alternar escala, comparar séries, percorrer tempo). Objetivo de ≥ 2 interativas por edição. Tudo funciona por toque e teclado; existe sempre a tabela de dados equivalente.
- **Mobile:** sem scroll horizontal; rótulos encurtados abaixo de 600 px; se o gráfico não funcionar, criar representação própria para mobile.
- **Movimento:** animações curtas; respeitar `prefers-reduced-motion`.
- **Exportação:** PNG (2×), SVG com estilos embutidos e CSV dos dados transformados.

## Guia de leitura e cores reservadas

- Formas menos comuns (halteres, áreas empilhadas, mapas, pequenos múltiplos) levam sempre uma frase «como ler» (`config.howToRead` no `dumbbell`), em linguagem corrente: o que é cada linha ou ponto e o que procurar.
- A legenda mostra a forma real do marcador (ponto, anel, linha), não um quadrado genérico.
- O terracota (`--accent`) está reservado ao destaque de Portugal. Não serve para uma terceira série, para não sugerir que essa série tem a ver com Portugal.
