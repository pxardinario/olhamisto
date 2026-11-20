# Fonte — investimento direto estrangeiro em Portugal, posições, por país do investidor imediato e do investidor final

- Eurostat — `bop_fdi6_pos` «EU direct investment positions by country, ultimate and immediate counterpart and economic activity (BPM6)» (atualizado a 2026-11-18; dados compilados pelo Banco de Portugal).
  Filtro: geo=PT; stk_flow=NI (investimento direto em Portugal, líquido); fdi_item=DI__D__F (investimento direto na economia declarante); nace_r2=FDI (todas as atividades); currency=MIO_EUR (milhões de euros); entity=TOTAL; counterp=IMM (contraparte imediata) e ULT (investidor final); todos os anos e parceiros.
  API: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/bop_fdi6_pos?format=JSON&lang=EN&geo=PT&nace_r2=FDI&stk_flow=NI&fdi_item=DI__D__F&currency=MIO_EUR&entity=TOTAL — descarregado em 2026-11-20, sem alterações.
- Licença: Eurostat, reutilização permitida com atribuição (CC BY 4.0).
- Notas: na contraparte do investidor final, o agregado WRL_REST exclui Portugal; somado ao valor de Portugal como investidor final, dá o total da contraparte imediata em todos os anos de 2013 a 2025. Antes de 2013 a repartição por país do investidor final está praticamente vazia. Alguns países têm valores confidenciais (ausentes), por isso a soma dos países não iguala o total.
