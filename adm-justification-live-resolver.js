import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, getDocFromServer } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const VERSION = 1;
const SERVER_TIMEOUT_MS = 4500;
let ultimoClique = null;

const log = (evento, detalhes = {}, nivel = 'info') => {
  try { window.rotinaLog?.(evento, { ...detalhes, justificationLiveResolverVersion: VERSION }, nivel); } catch {}
};

function contextoDoBotao(btn) {
  if (!btn) return null;
  const row = btn.closest?.('tr');
  const card = btn.closest?.('.mon-app-card');
  return {
    historicoId: btn.dataset?.historyId || '',
    id: btn.dataset?.taskId || row?.dataset?.familyTaskId || card?.dataset?.familyTaskId || '',
    perfilId: btn.dataset?.profileId || row?.dataset?.familyProfileId || card?.dataset?.familyProfileId || '',
    data: btn.dataset?.date || row?.dataset?.historyDate || card?.dataset?.familyTaskDate || '',
    justificativa: btn.dataset?.justification || '',
    tarefa: btn.dataset?.taskName || row?.dataset?.familyTaskName || card?.dataset?.familyTaskName || '',
    usuario: btn.dataset?.user || row?.dataset?.familyProfileName || card?.dataset?.familyProfileName || '',
    dia: btn.dataset?.day || row?.dataset?.familyTaskDay || card?.dataset?.familyTaskDay || '',
    horario: btn.dataset?.schedule || ((row?.dataset?.familyTaskTime || card?.dataset?.familyTaskTime) ? `${row?.dataset?.familyTaskTime || card?.dataset?.familyTaskTime || ''} - ${row?.dataset?.familyTaskEnd || card?.dataset?.familyTaskEnd || ''}` : '')
  };
}

document.addEventListener('click', event => {
  const btn = event.target?.closest?.('.mon-just-flag,.tooltip-justificativa');
  if (!btn) return;
  ultimoClique = contextoDoBotao(btn);
  log('justificativa.history_id_capturado', {
    temHistoryId: Boolean(ultimoClique?.historicoId),
    temTaskId: Boolean(ultimoClique?.id),
    data: ultimoClique?.data || ''
  });
}, true);

function combinarContexto(ctx = {}) {
  const capturado = ultimoClique || {};
  const compatTask = !ctx.id || !capturado.id || String(ctx.id) === String(capturado.id);
  const compatPerfil = !ctx.perfilId || !capturado.perfilId || String(ctx.perfilId) === String(capturado.perfilId);
  const compatData = !ctx.data || !capturado.data || String(ctx.data) === String(capturado.data);
  if (!(compatTask && compatPerfil && compatData)) return { ...ctx };
  return {
    ...capturado,
    ...ctx,
    historicoId: ctx.historicoId || ctx.historyId || capturado.historicoId || '',
    id: ctx.id || capturado.id || '',
    perfilId: ctx.perfilId || capturado.perfilId || '',
    data: ctx.data || capturado.data || '',
    justificativa: ctx.justificativa || capturado.justificativa || ''
  };
}

function snapshotAtual() {
  try { return typeof window.rotinaAdmCacheSnapshot === 'function' ? window.rotinaAdmCacheSnapshot() : null; } catch { return null; }
}

function historicoJaDisponivel(ctx, snap) {
  const lista = Array.isArray(snap?.historico) ? snap.historico : [];
  if (ctx.historicoId && lista.some(h => String(h.id || '') === String(ctx.historicoId))) return true;
  return lista.some(h =>
    (!ctx.id || String(h.tarefaId || '') === String(ctx.id)) &&
    (!ctx.perfilId || !h.perfilId || String(h.perfilId) === String(ctx.perfilId)) &&
    (!ctx.data || String(h.data || h.dataExecucao || '') === String(ctx.data))
  );
}

function comTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_HISTORY_DIRECT')), ms))
  ]);
}

async function buscarHistoricoDireto(ctx) {
  if (!ctx.historicoId || !getApps().length) return null;
  const banco = getFirestore(getApp());
  const started = performance.now();
  log('justificativa.history_direct_inicio', { historicoId: String(ctx.historicoId).slice(0, 80), data: ctx.data || '' });
  const snap = await comTimeout(getDocFromServer(doc(banco, 'historico', String(ctx.historicoId))), SERVER_TIMEOUT_MS);
  if (!snap.exists()) {
    log('justificativa.history_direct_inexistente', { duracaoMs: Math.round(performance.now() - started), data: ctx.data || '' }, 'warning');
    return null;
  }
  const h = { id: snap.id, ...snap.data() };
  log('justificativa.history_direct_ok', { duracaoMs: Math.round(performance.now() - started), data: ctx.data || '' });
  return h;
}

function instalar(tentativa = 0) {
  const original = window.abrirRevisaoJustificativa;
  if (typeof original !== 'function') {
    if (tentativa < 100) setTimeout(() => instalar(tentativa + 1), 50);
    else log('justificativa.live_resolver_sem_modulo', {}, 'error');
    return;
  }
  if (original.__rotinaLiveResolver === true) return;

  const wrapper = async function(ctx = {}) {
    const resolvido = combinarContexto(ctx);
    const base = snapshotAtual();

    if (historicoJaDisponivel(resolvido, base)) {
      log('justificativa.live_resolver_cache_hit', { temHistoryId: Boolean(resolvido.historicoId), data: resolvido.data || '' });
      return original(resolvido);
    }

    if (!resolvido.historicoId) {
      log('justificativa.live_resolver_sem_history_id', { temTaskId: Boolean(resolvido.id), data: resolvido.data || '' }, 'warning');
      return original(resolvido);
    }

    let historicoDireto = null;
    try {
      historicoDireto = await buscarHistoricoDireto(resolvido);
    } catch (error) {
      log('justificativa.history_direct_fallback', {
        motivo: String(error?.message || error).slice(0, 120),
        data: resolvido.data || ''
      }, 'warning');
    }

    if (!historicoDireto) return original(resolvido);

    const snapshotOriginal = window.rotinaAdmCacheSnapshot;
    window.rotinaAdmCacheSnapshot = () => {
      let atual = null;
      try { atual = typeof snapshotOriginal === 'function' ? snapshotOriginal() : null; } catch {}
      const baseSnap = atual || base || {};
      const lista = Array.isArray(baseSnap.historico) ? baseSnap.historico : [];
      return {
        ...baseSnap,
        historico: [...lista.filter(h => String(h.id || '') !== String(historicoDireto.id)), historicoDireto]
      };
    };

    try {
      log('justificativa.live_resolver_injetado', { historicoId: String(historicoDireto.id || '').slice(0, 80), data: resolvido.data || '' });
      return await original(resolvido);
    } finally {
      window.rotinaAdmCacheSnapshot = snapshotOriginal;
    }
  };

  wrapper.__rotinaLiveResolver = true;
  wrapper.__original = original;
  window.abrirRevisaoJustificativa = wrapper;
  log('justificativa.live_resolver_pronto', { versao: VERSION, timeoutMs: SERVER_TIMEOUT_MS });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => instalar(), { once: true });
else instalar();
