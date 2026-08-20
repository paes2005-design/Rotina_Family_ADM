const WRAP_FLAG = '__rotinaMasterApiDiagnosticsWrapped';

function safeActionFromOptions(path, options = {}) {
  let action = path || 'master-api';
  let targetUid = '';
  try {
    if (options.body) {
      const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
      if (body?.action) action = String(body.action);
      if (body?.targetUid) targetUid = String(body.targetUid).slice(0, 128);
    }
  } catch (_) {}
  return { action: String(action).slice(0, 80), targetUid };
}

function classifyMasterError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (message.includes('administrador não encontrado')) return 'administrador_nao_encontrado';
  if (message.includes('insufficient_permission') || message.includes('permiss')) return 'permissao';
  if (message.includes('sessão') || message.includes('token')) return 'sessao';
  if (message.includes('master')) return 'protecao_master';
  if (message.includes('http')) return 'http';
  return 'outro';
}

function wrapMasterApi() {
  const original = window.rotinaMasterApi;
  if (typeof original !== 'function' || original[WRAP_FLAG]) return false;

  const wrapped = async function(path, options = {}) {
    const startedAt = performance.now();
    const { action, targetUid } = safeActionFromOptions(path, options);
    const method = String(options.method || 'GET').toUpperCase();
    window.rotinaLog?.('master.api_inicio', {
      acao: action,
      alvoUid: targetUid,
      metodo: method,
      rota: String(path || '').slice(0, 80)
    });
    try {
      const result = await original(path, options);
      window.rotinaLog?.('master.api_sucesso', {
        acao: action,
        alvoUid: targetUid,
        metodo: method,
        duracaoMs: Math.round(performance.now() - startedAt)
      });
      return result;
    } catch (error) {
      window.rotinaLog?.('master.api_erro', {
        acao: action,
        alvoUid: targetUid,
        metodo: method,
        erroTipo: classifyMasterError(error),
        duracaoMs: Math.round(performance.now() - startedAt)
      }, 'error');
      throw error;
    }
  };
  wrapped[WRAP_FLAG] = true;
  window.rotinaMasterApi = wrapped;
  window.rotinaLog?.('master.diagnostico_ativo', { versao: 1 });
  return true;
}

function logMasterButton(event) {
  const button = event.target.closest('#adminMaster button[data-action]');
  if (!button) return;
  window.rotinaLog?.('master.botao_acionado', {
    acao: String(button.dataset.action || '').slice(0, 80),
    alvoUid: String(button.dataset.uid || '').slice(0, 128),
    desativadoAtual: button.dataset.disabled === 'true'
  });
}

document.addEventListener('click', logMasterButton, true);

let attempts = 0;
const timer = setInterval(() => {
  attempts += 1;
  if (wrapMasterApi() || attempts >= 80) clearInterval(timer);
}, 125);
wrapMasterApi();
