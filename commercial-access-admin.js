import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, getDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let stopGroupWatch = null;

function db() {
  if (!getApps().length) throw new Error('Firebase ainda não foi iniciado.');
  return getFirestore(getApp());
}

function isGroupBlocked(config = {}) {
  return config.grupoBloqueado === true;
}

function blockMessage() {
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

function showCommercialBlock() {
  document.getElementById('sistemaPrincipal')?.style.setProperty('display', 'none');
  document.getElementById('telaAcesso')?.style.setProperty('display', 'block');
  if (!document.getElementById('commercialBlockNotice')) {
    const box = document.createElement('div');
    box.id = 'commercialBlockNotice';
    box.style.cssText = 'margin:12px auto;max-width:520px;padding:12px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;color:#991b1b;font-weight:700';
    document.getElementById('telaAcesso')?.prepend(box);
  }
  const box = document.getElementById('commercialBlockNotice');
  if (box) box.textContent = blockMessage();
}

async function enforceGroup(groupId) {
  const group = String(groupId || '').trim();
  if (!group || window.rotinaMasterSession?.master === true) return true;
  try {
    const snap = await getDoc(doc(db(), 'configGrupos', group));
    if (isGroupBlocked(snap.exists() ? snap.data() : {})) {
      showCommercialBlock();
      return false;
    }
  } catch (error) {
    // Em 429/rede, preserva a sessão válida. O comercial nunca derruba o Master.
    console.warn('Validação comercial do grupo indisponível; acesso preservado.', error);
  }
  return true;
}

function watchGroup(groupId) {
  stopGroupWatch?.();
  stopGroupWatch = null;
  const group = String(groupId || '').trim();
  if (!group || window.rotinaMasterSession?.master === true) return;
  stopGroupWatch = onSnapshot(
    doc(db(), 'configGrupos', group),
    snap => {
      if (isGroupBlocked(snap.exists() ? snap.data() : {})) showCommercialBlock();
    },
    error => console.warn('Listener comercial do grupo indisponível; sessão preservada.', error)
  );
}

async function enforceCurrentSession(event) {
  const detail = event.detail || {};
  if (detail.master === true || window.rotinaMasterSession?.master === true) return;
  const groupId = String(detail.grupoId || '').trim();
  if (!groupId) return;
  const isMaster = await waitForMasterResolution();
  if (isMaster || window.rotinaMasterSession?.master === true) return;
  if (await enforceGroup(groupId)) watchGroup(groupId);
}

window.addEventListener('rotina-admin-session-ready', enforceCurrentSession);
window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) {
    stopGroupWatch?.();
    stopGroupWatch = null;
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
