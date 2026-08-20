import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';

function db() {
  if (!getApps().length) throw new Error('Firebase ainda não foi iniciado.');
  return getFirestore(getApp());
}

function groupState(config = {}) {
  if (config.grupoBloqueado === true) return 'bloqueado';
  if (config.grupoConfirmado === true) return 'liberado';
  if (config.trialAtivo === true) {
    const end = new Date(config.trialFimEm || '');
    if (Number.isFinite(end.getTime()) && end.getTime() <= Date.now()) return 'teste-expirado';
    return 'teste';
  }
  return 'legado';
}

function blockMessage(state, individual = false) {
  if (individual) return 'Este administrador foi bloqueado individualmente pelo ADM Master.';
  if (state === 'teste-expirado') return 'Sua versão teste de 15 dias terminou. Entre em contato para ativar o grupo familiar.';
  return 'Este grupo familiar está temporariamente desativado. Entre em contato para regularizar o acesso.';
}

async function administratorByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const snap = await getDocs(query(collection(db(), 'administradores'), where('email', '==', normalized)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function administratorByUid(uid) {
  const value = String(uid || '').trim();
  if (!value) return null;
  const snap = await getDocs(query(collection(db(), 'administradores'), where('uid', '==', value)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function initializeTrialForOwner(email) {
  if (window.rotinaMasterSession?.master === true) return;
  const admin = await administratorByEmail(email);
  if (!admin || String(admin.tipoAcesso || '') !== 'proprietario') return;
  const user = getAuth(getApp()).currentUser;
  if (!user || String(user.email || '').trim().toLowerCase() !== String(email || '').trim().toLowerCase()) return;
  const token = await user.getIdToken(true);
  const response = await fetch(`${API_ROOT}/commercial/trial`, {
    method: 'POST',
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: '{}'
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Falha HTTP ${response.status}`);
  window.rotinaLog?.('comercial.teste_iniciado', { grupoId: body.grupoId || '', dias: 15 });
}

// A tela de login nunca é interceptada pelo comercial. Primeiro o Firebase autentica e
// o backend decide se é Master. Só depois uma sessão comum é validada comercialmente.
function installLoginGuard() {
  const original = window.realizarLogin;
  if (typeof original !== 'function' || original.__commercialGuardSafe) return false;
  const wrapped = async (...args) => original(...args);
  wrapped.__commercialGuardSafe = true;
  window.realizarLogin = wrapped;
  return true;
}

function installRegistrationTrial() {
  const original = window.cadastrarNovoAdministrador;
  if (typeof original !== 'function' || original.__commercialTrialSafe) return false;
  const wrapped = async (...args) => {
    const email = String(document.getElementById('novoAdminEmail')?.value || '').trim().toLowerCase();
    const invite = String(document.getElementById('novoAdminConvite')?.value || '').trim();
    const result = await original(...args);
    if (!invite && email && window.rotinaMasterSession?.master !== true) {
      try { await initializeTrialForOwner(email); }
      catch (error) { console.warn('Falha ao iniciar versão teste; cadastro preservado.', error); }
    }
    return result;
  };
  wrapped.__commercialTrialSafe = true;
  window.cadastrarNovoAdministrador = wrapped;
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

function showCommercialBlock(text) {
  document.getElementById('sistemaPrincipal')?.style.setProperty('display', 'none');
  document.getElementById('telaAcesso')?.style.setProperty('display', 'block');
  if (!document.getElementById('commercialBlockNotice')) {
    const box = document.createElement('div');
    box.id = 'commercialBlockNotice';
    box.style.cssText = 'margin:12px auto;max-width:520px;padding:12px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;color:#991b1b;font-weight:700';
    document.getElementById('telaAcesso')?.prepend(box);
  }
  const box = document.getElementById('commercialBlockNotice');
  if (box) box.textContent = text;
}

async function enforceCurrentSession(event) {
  const detail = event.detail || {};
  if (detail.master === true || window.rotinaMasterSession?.master === true) return;
  const groupId = String(detail.grupoId || '').trim();
  if (!groupId) return;

  try {
    const isMaster = await waitForMasterResolution();
    if (isMaster || window.rotinaMasterSession?.master === true) return;

    const user = getAuth(getApp()).currentUser;
    if (!user) return;

    // Primeiro o bloqueio individual do administrador comum.
    let admin = null;
    try { admin = await administratorByUid(user.uid); }
    catch (error) { console.warn('Validação individual indisponível; acesso preservado.', error); }
    if (admin?.bloqueadoComercialIndividual === true) {
      showCommercialBlock(blockMessage('', true));
      return;
    }

    // Depois o estado da família. Se o Firestore estiver indisponível/429, o comercial
    // falha aberto: não derruba uma sessão válida e nunca interfere com o Master.
    const snap = await getDoc(doc(db(), 'configGrupos', groupId));
    const state = groupState(snap.exists() ? snap.data() : {});
    if (!['bloqueado', 'teste-expirado'].includes(state)) return;
    showCommercialBlock(blockMessage(state));
  } catch (error) {
    console.warn('Validação comercial indisponível; acesso preservado.', error);
  }
}

window.addEventListener('rotina-admin-session-ready', enforceCurrentSession);
window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) document.getElementById('commercialBlockNotice')?.remove();
});

function installHooks() {
  installLoginGuard();
  installRegistrationTrial();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', installHooks, { once: true });
} else {
  installHooks();
}
setTimeout(installHooks, 300);
setTimeout(installHooks, 1000);
