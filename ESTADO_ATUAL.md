# Estado Atual — Rotina Family ADM

## Projeto ativo
- Projeto: Rotina Family
- Aplicação: ADM
- Repositório: `paes2005-design/Rotina_Family_ADM`
- Sprint: Sprint 2
- Branch de trabalho: `sprint2-adm-recompensas`

## Trabalhando agora
- Restaurar e consolidar o layout do ADM.
- Recompensas à esquerda no desktop.
- Conquistas à direita no desktop.
- Histórico abaixo das duas áreas, ocupando a largura disponível.
- No mobile do ADM: Recompensas → Conquistas → Histórico, em sequência vertical.
- Manter a identidade visual já aprovada, sem redesenhar desnecessariamente a tela.

## Não alterar
- `paes2005-design/Rotina_Family_Cliente`
- Qualquer arquivo, build, Service Worker, layout ou publicação do Cliente enquanto este estado estiver ativo.

## Regra de segurança
Se uma instrução estiver sendo executada para o ADM e a ação apontar para repositório, arquivo ou build identificado como Cliente/Participante, tratar como inconsistência e interromper a escrita até reconciliar o alvo correto.

## Publicação
- Desenvolvimento e testes: branch `sprint2-adm-recompensas`.
- `main`: somente após validação da alteração.
- Alterar não significa publicar automaticamente.
- Publicação deve ser tratada como etapa separada, salvo quando houver pedido explícito para publicar.

## Retomada em nova conversa
Antes de qualquer escrita no GitHub, ler este arquivo, conferir o repositório ativo, a branch ativa e os commits mais recentes. Este arquivo é a fonte de verdade operacional para a retomada do trabalho.
