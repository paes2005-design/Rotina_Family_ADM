# Protocolo de Execução — Rotina Family

Este protocolo deve ser seguido em qualquer retomada, especialmente quando o trabalho continuar em uma nova conversa.

## 1. Um alvo ativo por vez
Antes de qualquer alteração, identificar e conferir:
- Projeto
- Aplicação: ADM ou Cliente
- Repositório exato
- Sprint ou etapa atual
- Branch de trabalho

Enquanto um alvo estiver ativo, o outro deve ser tratado como bloqueado para escrita, salvo instrução explícita em contrário.

## 2. Leitura antes de escrita
Antes do primeiro commit de uma retomada:
1. Ler `ESTADO_ATUAL.md`.
2. Conferir o repositório selecionado.
3. Conferir a branch ativa.
4. Conferir os commits mais recentes.
5. Verificar se a ação planejada pertence ao alvo ativo.

Nunca reconstruir o estado do projeto apenas pela memória da conversa.

## 3. Desenvolvimento fora da main
Mudanças funcionais ou visuais devem ser feitas primeiro em branch de trabalho.
A `main` deve representar estado validado/publicável.

## 4. Publicação é uma etapa separada
Implementar, testar e publicar são ações distintas.
Uma solicitação para alterar não autoriza automaticamente publicação em produção, salvo quando o pedido de publicação estiver explícito.

## 5. Estado persistente no repositório
`ESTADO_ATUAL.md` é a fonte de verdade operacional para continuidade entre conversas.
Ao concluir uma etapa, mudar de sprint, trocar de aplicação ou alterar o alvo, atualizar esse arquivo.

## 6. Trava cruzada ADM/Cliente
Antes de qualquer escrita, comparar a intenção com o destino:
- Intenção ADM + destino Cliente/Participante = BLOQUEAR.
- Intenção Cliente/Participante + destino ADM = BLOQUEAR.

Nesses casos, não executar a escrita até reconciliar o alvo.

## 7. Critério de conclusão
Uma alteração só é considerada concluída quando:
- foi feita no repositório correto;
- está na branch correta;
- passou pelos testes disponíveis;
- não alterou o aplicativo bloqueado;
- e, quando aplicável, foi publicada somente após a etapa de validação.
