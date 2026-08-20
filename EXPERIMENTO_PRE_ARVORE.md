# Rotina Family ADM — base experimental pré-árvore

Esta branch congela o último estado do ADM imediatamente anterior à implantação da árvore de famílias e da nova regra de bloqueio comercial.

- Branch: `experimento-pre-arvore-2026-08-20`
- Commit-base: `14e6eabb674483dd850dee95e1dde983498f351e`
- Linha de corte: antes de `5ac46c5be0e62bff74106c77f9e747017eafdeac` (`Add 15-day trial and commercial access guard`)
- Não incluir nesta base: `commercial-access-admin.js`, `master-family-tree.js` nem alterações posteriores de resiliência da sessão Master até que o restante do aplicativo seja validado.

Objetivo: testar e recuperar o funcionamento já existente do Rotina Family sem a regressão introduzida pelo conjunto árvore + bloqueio comercial.

O branch `main` não deve ser usado como referência de estabilidade durante estes testes.
