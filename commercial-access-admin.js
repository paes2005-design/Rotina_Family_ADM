import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

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

function blockMessage(state) {
  if (state === 'teste-expirado') return 'Sua versão teste de 15 dias terminou. Entre em contato para ativar o grupo familiar.';
  return 'Este grupo familiar está temporariamente desativado. Entre em contato para regularizar o acesso.';
}

async function administratorByEmail(email) {
  const snap = await getDocs(query(collection(db(), 'administradores'), where('email', '==', String(email || '').trim().toLowerCase())));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function accessForAdministrator(admin) {
  const groupId = String(admin?.codigoCliente || admin?.grupoId || '').trim();
  if (!groupId) return { state: 'legado', allowed: true, groupId: '' };
  const snap = await getDoc(doc(db(), 'configGrupos', groupId));
  const state = groupState(snap.exists() ? snap.data() : {});
  return { state, allowed: !['bloqueado', 'teste-expirado'].includes(state), groupId };
}

async function initializeTrialForOwner(email) {
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

function installLoginGuard() {
  const original = window.realizarLogin;
  if (typeof original !== 'function' || original.__commercialGuard) return false;
  const wrapped = async (...args) => {
    const email = String(document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
    try {
      const admin = email ? await administratorByEmail(email) : null;
      if (admin) {
        const access = await accessForAdministrator(admin);
        if (!access.allowed) {
          alert(blockMessage(access.state));
          window.rotinaLog?.('comercial.login_bloqueado', { grupoId: access.groupId, estado: access.state });
          return;
        }
      }
    } catch (error) {
      console.warn('Não foi possível pré-validar o acesso comercial.', error);
    }
    return original(...args);
  };
  wrapped.__commercialGuard = true;
  window.realizarLogin = wrapped;
  return true;
}

function installRegistrationTrial() {
  const original = window.cadastrarNovoAdministrador;
  if (typeof original !== 'function' || original.__commercialTrial) return false;
  const wrapped = async (...args) => {
    const email = String(document.getElementById('novoAdminEmail')?.value || '').trim().toLowerCase();
    const invite = String(document.getElementById('novoAdminConvite')?.value || '').trim();
    const result = await original(...args);
    if (!invite && email) {
      try { await initializeTrialForOwner(email); }
      catch (error) { console.error('Falha ao iniciar versão teste do grupo.', error); }
    }
    return result;
  };
  wrapped.__commercialTrial = true;
  window.cadastrarNovoAdministrador = wrapped;
  return true;
}

async function enforceCurrentSession(event) {
  const groupId = String(event.detail?.grupoId || '').trim();
  if (!groupId || window.rotinaMasterSession?.master === true) return;
  try {
    const snap = await getDoc(doc(db(), 'configGrupos', groupId));
    const state = groupState(snap.exists() ? snap.data() : {});
    if (!['bloqueado', 'teste-expirado'].includes(state)) return;
    document.getElementById('sistemaPrincipal')?.style.setProperty('display', 'none');
    document.getElementById('telaAcesso')?.style.setProperty('display', 'block');
    await signOut(getAuth(getApp())).catch(() => {});
    alert(blockMessage(state));
  } catch (error) {
    console.warn('Falha na validação comercial da sessão.', error);
  }
}

window.addEventListener('rotina-admin-session-ready', enforceCurrentSession);

let attempts = 0;
const timer = setInterval(() => {
  attempts += 1;
  const loginReady = installLoginGuard();
  const registerReady = installRegistrationTrial();
  if ((loginReady || window.realizarLogin?.__commercialGuard) && (registerReady || window.cadastrarNovoAdministrador?.__commercialTrial)) clearInterval(timer);
  if (attempts > 40) clearInterval(timer);
}, 100);
