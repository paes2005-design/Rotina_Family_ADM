import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const WORKER_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const COMMERCIAL_EXEMPT_GROUPS = new Set(['CLI-4071']);
let stopGroupWatch = null;
let blockedByCommercial = false;
let trialStartedFor = '';

function normalizeGroupId(value = '') {
  return String(value || '').trim().toUpperCase();
}

function isCommercialExemptGroup(groupId = '') {
  return COMMERCIAL_EXEMPT_GROUPS.has(normalizeGroupId(groupId));
}

function db() {
  if (!getApps().length) throw new Error('Firebase ainda não foi iniciado.');
  return getFirestore(getApp());
}

function commercialState(config = {}, now = Date.now()) {
  if (config.grupoBloqueado === true) return 'bloqueado';
  if (config.grupoConfirmado === true) return 'confirmado';
  if (Number(config.trialVersao || 0) === 2 && config.trialAtivo === true) {
    const expires = Date.parse(String(config.trialFimEm || ''));
    if (Number.isFinite(expires) && now >= expires) return 'teste-expirado';
    return 'teste';
  }
  return 'liberado-legado';
}

function blockedState(state) {
  return state === 'bloqueado' || state === 'teste-expirado';
}

function blockMessage(state) {
  if (state === 'teste-expirado') return 'O período de teste de 15 dias desta família terminou. Aguarde a liberação do ADM Master.';
  return 'Este grupo familiar está temporariamente desativado. Entre em contato para regularizar o acesso.';
}

function installLoginGuard() {
  const original = window.realizarLogin;
  if (typeof original !== 'function' || original.__commercialGroupGuard) return false;
  const wrapped = async (...args) => original(...args);
  wrapped.__commercialGroupGuard = true;
  window.realizarLogin = wrapped;
  return true;
}

function waitForMasterResolution(timeoutMs = 5000) {
  if (window.rotinaMasterSession?.master === true) return Promise.resolve(true);
  return new Promise(resolve => {
    let done = false;
    const finish = value => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      window.removeEventListener('rotina-admin-master-ready', onReady);
      resolve(value === true);
    };
    const onReady = event => {
      if (event.detail?.master === true) finish(true);
      else if (event.detail?.motivo === 'nao-autorizado') finish(false);
    };
    window.addEventListener('rotina-admin-master-ready', onReady);
    const timer = setTimeout(() => finish(window.rotinaMasterSession?.master === true), timeoutMs);
  });
}

function showCommercialBlock(state) {
  blockedByCommercial = true;
  document.getElementById('sistemaPrincipal')?.style.setProperty('display', 'none');
  document.getElementById('telaAcesso')?.style.setProperty('display', 'block');
  if (!document.getElementById('commercialBlockNotice')) {
    const box = document.createElement('div');
    box.id = 'commercialBlockNotice';
    box.style.cssText = 'margin:12px auto;max-width:520px;padding:12px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;color:#991b1b;font-weight:700';
    document.getElementById('telaAcesso')?.prepend(box);
  }
  const box = document.getElementById('commercialBlockNotice');
  if (box) box.textContent = blockMessage(state);
}

function clearCommercialBlock() {
  if (!blockedByCommercial) return;
  blockedByCommercial = false;
  document.getElementById('commercialBlockNotice')?.remove();
  if (getApps().length && getAuth(getApp()).currentUser && window.rotinaMasterSession?.master !== true) {
    document.getElementById('telaAcesso')?.style.setProperty('display', 'none');
    document.getElementById('sistemaPrincipal')?.style.setProperty('display', 'block');
  }
}

async function ensureTrial(groupId) {
  const group = normalizeGroupId(groupId);
  if (!group || isCommercialExemptGroup(group) || trialStartedFor === group || window.rotinaMasterSession?.master === true || !getApps().length) return;
  const user = getAuth(getApp()).currentUser;
  if (!user) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch(`${WORKER_ROOT}/commercial/trial`, {
      method: 'POST',
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ grupoId: group })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    trialStartedFor = group;
    window.rotinaLog?.('comercial.teste_verificado', { grupoId: group, estado: body.estado || '' });
  } catch (error) {
    // Não derruba uma sessão válida por indisponibilidade de rede/Worker.
    console.warn('Não foi possível inicializar/verificar o teste comercial agora.', error);
  }
}

async function enforceGroup(groupId) {
  const group = normalizeGroupId(groupId);
  if (!group || isCommercialExemptGroup(group) || window.rotinaMasterSession?.master === true) return true;
  try {
    const snap = await getDoc(doc(db(), 'configGrupos', group));
    const state = commercialState(snap.exists() ? snap.data() : {});
    if (blockedState(state)) {
      showCommercialBlock(state);
      return false;
    }
    clearCommercialBlock();
  } catch (error) {
    // Em 429/rede, preserva a sessão válida. O comercial nunca derruba o Master.
    console.warn('Validação comercial do grupo indisponível; acesso preservado.', error);
  }
  return true;
}

function watchGroup(groupId) {
  stopGroupWatch?.();
  stopGroupWatch = null;
  const group = normalizeGroupId(groupId);
  if (!group || isCommercialExemptGroup(group) || window.rotinaMasterSession?.master === true) return;
  stopGroupWatch = onSnapshot(
    doc(db(), 'configGrupos', group),
    snap => {
      const state = commercialState(snap.exists() ? snap.data() : {});
      if (blockedState(state)) showCommercialBlock(state);
      else clearCommercialBlock();
    },
    error => console.warn('Listener comercial do grupo indisponível; sessão preservada.', error)
  );
}

async function enforceCurrentSession(event) {
  const detail = event.detail || {};
  if (detail.master === true || window.rotinaMasterSession?.master === true) return;
  const groupId = normalizeGroupId(detail.grupoId || '');
  if (!groupId) return;
  if (isCommercialExemptGroup(groupId)) {
    stopGroupWatch?.();
    stopGroupWatch = null;
    clearCommercialBlock();
    return;
  }
  const isMaster = await waitForMasterResolution();
  if (isMaster || window.rotinaMasterSession?.master === true) return;
  await ensureTrial(groupId);
  if (await enforceGroup(groupId)) watchGroup(groupId);
  else watchGroup(groupId);
}

window.addEventListener('rotina-admin-session-ready', enforceCurrentSession);
window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) {
    stopGroupWatch?.();
    stopGroupWatch = null;
    trialStartedFor = '';
    blockedByCommercial = false;
    document.getElementById('commercialBlockNotice')?.remove();
  }
});

function installHooks() {
  installLoginGuard();
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', installHooks, { once: true });
else installHooks();
setTimeout(installHooks, 300);
setTimeout(installHooks, 1000);
