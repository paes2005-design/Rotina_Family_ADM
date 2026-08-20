(function () {
  const APP_ID = '356292b3-a763-4a89-b0e5-21bf54bf0424';
  const CLIENT_WORKER_PATH = 'Rotina_Family_Cliente/push/onesignal/OneSignalSDKWorker.js';
  const CLIENT_WORKER_SCOPE = '/Rotina_Family_Cliente/push/onesignal/';
  const GROUP_STORAGE_KEY = 'rotina_admin_push_grupo';

  window.OneSignalDeferred = window.OneSignalDeferred || [];

  function normalizeGroup(groupId) {
    const value = String(groupId || '').trim();
    return value && value !== '--' && value !== 'CLI-Gen' ? value : '';
  }

  function tagAdmin(OneSignal, groupId) {
    const group = normalizeGroup(groupId);
    if (!group) return Promise.resolve();
    localStorage.setItem(GROUP_STORAGE_KEY, group);
    return OneSignal.User.addTags({ admAtivo: '1', admGrupoId: group });
  }

  window.identificarAdmNoPush = function (groupId) {
    const group = normalizeGroup(groupId);
    if (!group) return;
    window.OneSignalDeferred.push(OneSignal => tagAdmin(OneSignal, group));
  };

  window.ativarPushAdmin = function () {
    return new Promise(resolve => {
      let finished = false;
      const complete = result => {
        if (finished) return;
        finished = true;
        resolve(result);
      };
      window.OneSignalDeferred.push(async OneSignal => {
        try {
          await OneSignal.User.PushSubscription.optIn();
          const group = normalizeGroup(
            localStorage.getItem(GROUP_STORAGE_KEY) ||
            document.getElementById('displayCodigoCliente')?.textContent
          );
          await tagAdmin(OneSignal, group);
          complete({
            optedIn: OneSignal.User.PushSubscription.optedIn,
            id: OneSignal.User.PushSubscription.id || ''
          });
        } catch (error) {
          complete({ optedIn: false, id: '', error: String(error?.message || error) });
        }
      });
      setTimeout(() => complete({ optedIn: false, id: '', error: 'tempo-esgotado' }), 8000);
    });
  };

  window.obterStatusPushAdmin = function (callback) {
    window.OneSignalDeferred.push(OneSignal => callback?.({
      optedIn: OneSignal.User.PushSubscription.optedIn,
      id: OneSignal.User.PushSubscription.id || ''
    }));
  };

  window.desvincularAdmDoPush = function () {
    localStorage.removeItem(GROUP_STORAGE_KEY);
    window.OneSignalDeferred.push(async OneSignal => {
      try {
        await OneSignal.User.removeTags(['admAtivo', 'admGrupoId']);
      } catch (_) {}
    });
  };

  window.addEventListener('rotina-admin-session-ready', event => {
    window.identificarAdmNoPush(event.detail?.grupoId);
  });

  window.OneSignalDeferred.push(async function (OneSignal) {
    await OneSignal.init({
      appId: APP_ID,
      safari_web_id: 'web.onesignal.auto.3a07767d-f8c5-4ebf-965b-cb322da40f9f',
      serviceWorkerPath: CLIENT_WORKER_PATH,
      serviceWorkerParam: { scope: CLIENT_WORKER_SCOPE },
      notifyButton: {
        enable: true,
        size: 'medium',
        position: 'bottom-right',
        offset: { bottom: '88px', right: '14px' },
        showCredit: false,
        text: {
          'launcher.button.aria-label': 'Gerenciar notificações',
          'tip.state.unsubscribed': 'Ativar notificações',
          'tip.state.subscribed': 'Notificações ativadas',
          'tip.state.blocked': 'Notificações bloqueadas',
          'message.prenotify': 'Clique para receber solicitações de recompensas',
          'message.action.subscribed': 'Notificações ativadas com sucesso!',
          'message.action.resubscribed': 'Notificações ativadas novamente',
          'message.action.unsubscribed': 'Você não receberá mais notificações',
          'dialog.main.title': 'Notificações do Rotina Family ADM',
          'dialog.main.button.subscribe': 'ATIVAR',
          'dialog.main.button.unsubscribe': 'DESATIVAR',
          'dialog.blocked.title': 'Desbloquear notificações',
          'dialog.blocked.message': 'Siga estas instruções para permitir notificações:'
        }
      }
    });
    const pushDetails = event => {
      const notification = event?.notification || {};
      const data = notification.additionalData || notification.data || {};
      return {
        tipo: String(data.tipo || 'push').slice(0, 60),
        paginaVisivel: document.visibilityState === 'visible'
      };
    };
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', event => {
      window.rotinaLog?.('push.onesignal_primeiro_plano', pushDetails(event));
    });
    OneSignal.Notifications.addEventListener('click', event => {
      window.rotinaLog?.('push.onesignal_clicado', pushDetails(event));
    });
    OneSignal.Notifications.addEventListener('dismiss', event => {
      window.rotinaLog?.('push.onesignal_dispensado', pushDetails(event));
    });
    await tagAdmin(OneSignal, localStorage.getItem(GROUP_STORAGE_KEY));
  });
})();
