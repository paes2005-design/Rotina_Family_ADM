# Rotina Family — Painel do Administrador

O **Rotina Family** é uma solução de organização familiar gamificada, composta por dois aplicativos conectados ao mesmo ambiente Firebase: o **Painel do Administrador** e o **Aplicativo do Cliente**.

## Papel do Administrador

O Painel do Administrador é destinado aos responsáveis pela família. Nele é possível criar e gerenciar integrantes, definir PINs individuais, cadastrar tarefas recorrentes, estabelecer horários, tolerâncias e pontuações, acompanhar execuções e justificativas, consultar indicadores e administrar recompensas.

O administrador influencia diretamente o aplicativo do Cliente: tarefas cadastradas aqui aparecem para o respectivo integrante; alterações de horários, regras e pontuação são refletidas no Cliente; pedidos de recompensas chegam ao responsável para aprovação ou recusa; e o desempenho alimenta rankings e indicadores familiares.

## Principais recursos

- Cadastro de integrantes com identificação permanente por `perfilId` e PIN individual.
- Cadastro e edição de tarefas recorrentes com agrupamento por `tarefaGrupoId`.
- Monitor de tarefas com horários sugeridos e realizados, status, pontos e justificativas.
- Dashboard com rankings diário, semanal e mensal.
- Filtro por integrante e data de referência.
- Sequências, conquistas e acompanhamento de desempenho.
- Catálogo de recompensas e aprovação/recusa de resgates.
- Firebase Authentication para administradores.
- Sincronização em tempo real com o aplicativo Cliente.
- Suporte PWA e persistência local para uso após uma primeira sincronização online.

## Como ADM e Cliente se comunicam

Os dois aplicativos utilizam o mesmo projeto Firebase/Firestore. O ADM registra perfis, tarefas, regras e recompensas. O Cliente consulta essas informações pelo código da família e pelo perfil autorizado. Quando o integrante inicia ou conclui uma tarefa, justifica um atraso ou solicita uma recompensa, os registros são sincronizados com o Firestore e passam a ficar disponíveis para o ADM.

## Proposta de valor

O Rotina Family transforma a rotina doméstica em uma experiência organizada, transparente e motivadora. Pais e responsáveis mantêm o controle das regras e do acompanhamento, enquanto os integrantes visualizam suas próprias metas, pontuação, conquistas e recompensas.

A solução pode ser utilizada para rotinas infantis, estudos, organização doméstica, hábitos e responsabilidades familiares.

## Tecnologia

- HTML, CSS e JavaScript
- Firebase Firestore
- Firebase Authentication
- PWA / Service Worker
- GitHub Pages
- Reconhecimento de fala do navegador para converter justificativas faladas em texto, quando suportado

## Aplicativo complementar

Este repositório corresponde ao **Painel do Administrador**. O ecossistema é complementado pelo repositório **Rotina_Family_Cliente**, utilizado pelos integrantes da família.
