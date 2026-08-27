import { initializeApp, getApps, getApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, signOut, deleteUser, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const VERSION = 7;
const MAX_RESTORE_RETRIES = 1;
let installed = false;
let promotingUid = '';
let promotedUid = '';
let retryRunning = false;
let retryAttempts = 0;

const clean = value => String(value || '').trim();

function mainApp() {
  if (!getApps().length) throw new Error('Firebase ainda não foi iniciado.');
  return getApp();
}

function mainAuth() {
  return getAuth(mainApp());
}

async function temporaryAuth(purpose) {
  const name = `rotina-secure-${purpose}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const app = initializeApp(mainApp().options, name);
  return { app, auth: getAuth(app) };
}

async function closeTemporary(session) {
  try { await signOut(session.auth); } catch (_) {}
  try { await deleteApp(session.app); } catch (_) {}
}

async function workerSession(path, idToken, body = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), 9000);
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.token) {
      const error = new Error(result.error || `Falha HTTP ${response.status}`);
      error.status = response.status; throw error;
    }
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A restauração da sessão demorou além do limite seguro.');
    throw error;
  } finally { clearTimeout(timeout); }
}

function publishRole(session = {}, reason = '') {
  window.__rotinaAdminRole = clean(session.papel);
  window.__rotinaAdminGroupId = clean(session.grupoId).toUpperCase();
  window.__rotinaAdminAuthBridgeDisabled = false;
  window.dispatchEvent(new CustomEvent('rotina-adm-role-ready', {
    detail: { papel: window.__rotinaAdminRole, grupoId: window.__rotinaAdminGroupId, version: VERSION, reason }
  }));
}

async function installPromotedSession(session, reason) {
  const auth = mainAuth();
  promotedUid = auth.currentUser?.uid || promotedUid;
  window.__rotinaAdmPromotionInProgress = true;
  try {
    // signInWithCustomToken já substitui a credencial atual. Não fazemos signOut antes,
    // pois a transição vazio->usuário alimentava o loop do guard de inicialização.
    const credential = await signInWithCustomToken(auth, session.token);
    promotedUid = credential.user.uid;
    publishRole(session, reason);
    window.rotinaLog?.('auth.adm_sessao_promovida', { papel: session.papel, grupoId: session.grupoId || '', motivo: reason, authVersion: VERSION });
    return credential.user;
  } catch (error) {
    promotedUid = '';
    throw error;
  } finally {
    window.__rotinaAdmPromotionInProgress = false;
  }
}

async function secureLogin() {
  const email = clean(document.getElementById('loginEmail')?.value).toLowerCase();
  const senha = clean(document.getElementById('loginSenha')?.value);
  if (!email || !senha) return alert('Informe e-mail e senha.');

  const temp = await temporaryAuth('login');
  try {
    const credential = await signInWithEmailAndPassword(temp.auth, email, senha);
    const idToken = await credential.user.getIdToken(true);
    const session = await workerSession('/family-session/admin', idToken);
    promotedUid = credential.user.uid;
    retryAttempts = 0;
    await installPromotedSession(session, 'login-seguro');
  } catch (error) {
    console.warn('Login administrativo seguro:', error);
    alert(error.message || 'Acesso negado.');
  } finally {
    await closeTemporary(temp);
  }
}

async function secureRegister() {
  const email = clean(document.getElementById('novoAdminEmail')?.value).toLowerCase();
  const senha = clean(document.getElementById('novoAdminSenha')?.value);
  const codigoConvite = clean(document.getElementById('novoAdminConvite')?.value).toUpperCase();
  if (!email || senha.length < 6) return alert('Informe e-mail e uma senha com pelo menos 6 caracteres.');

  const temp = await temporaryAuth('register');
  let credential = null;
  let serverCommitted = false;
  try {
    credential = await createUserWithEmailAndPassword(temp.auth, email, senha);
    const idToken = await credential.user.getIdToken(true);
    const session = await workerSession('/family-session/admin-register', idToken, { codigoConvite });
    serverCommitted = true;
    promotedUid = credential.user.uid;
    retryAttempts = 0;
    await installPromotedSession(session, 'cadastro-seguro');
    document.getElementById('novoAdminEmail').value = '';
    document.getElementById('novoAdminSenha').value = '';
    document.getElementById('novoAdminConvite').value = '';
    alert(`Administrador cadastrado!\nCódigo Admin: ${session.codigoAdmin}\nCódigo Cliente: ${session.codigoCliente}`);
  } catch (error) {
    if (credential?.user && !serverCommitted) await deleteUser(credential.user).catch(() => {});
    console.warn('Cadastro administrativo seguro:', error);
    alert(serverCommitted
      ? 'O cadastro foi concluído, mas não foi possível abrir a sessão agora. Entre novamente com o e-mail e a senha cadastrados.'
      : (error.message || 'Não foi possível cadastrar o administrador.'));
  } finally {
    await closeTemporary(temp);
  }
}

async function retryCurrentSession(reason = 'startup-retry') {
  if (retryRunning) return false;
  const auth = mainAuth();
  const user = auth.currentUser;
  if (!user) return false;
  if (retryAttempts >= MAX_RESTORE_RETRIES) {
    window.rotinaLog?.('auth.adm_retry_limite', { tentativas: retryAttempts, authVersion: VERSION }, 'warning');
    return false;
  }

  retryRunning = true;
  retryAttempts += 1;
  try {
    window.rotinaLog?.('auth.adm_retry_inicio', { tentativa: retryAttempts, motivo: reason, authVersion: VERSION });
    const session = await workerSession('/family-session/admin', await user.getIdToken(true));
    promotedUid = '';
    await installPromotedSession(session, `${reason}-${retryAttempts}`);
    window.rotinaLog?.('auth.adm_retry_sessao_reinstalada', { tentativa: retryAttempts, authVersion: VERSION });
    return true;
  } catch (error) {
    console.warn('Retry da sessão administrativa falhou:', error);
    window.rotinaLog?.('auth.adm_retry_erro', {
      tentativa: retryAttempts,
      mensagem: clean(error?.message || error),
      authVersion: VERSION
    }, 'error');
    return false;
  } finally {
    retryRunning = false;
  }
}

async function promoteExisting(user) {
  if (!user || promotingUid === user.uid || promotedUid === user.uid) return;
  promotingUid = user.uid;
  try {
    const idTokenResult = await user.getIdTokenResult();
    const knownRole = String(idTokenResult.claims?.papel || '');
    const knownGroup = clean(idTokenResult.claims?.grupoId).toUpperCase();
    if (['adm_familia', 'adm_convidado', 'master'].includes(knownRole)) {
      promotedUid = user.uid;
      publishRole({ papel: knownRole, grupoId: knownGroup }, 'claims-existentes');
      return;
    }
    const session = await workerSession('/family-session/admin', await user.getIdToken(true));
    promotedUid = user.uid;
    await installPromotedSession(session, 'restauracao-segura');
  } catch (error) {
    console.warn('Não foi possível promover a sessão administrativa atual:', error);
    window.rotinaLog?.('auth.adm_promocao_erro', {
      mensagem: clean(error?.message || error),
      authVersion: VERSION
    }, 'error');
  } finally {
    promotingUid = '';
  }
}

function install() {
  if (installed) return;
  if (!getApps().length || typeof window.realizarLogin !== 'function' || typeof window.cadastrarNovoAdministrador !== 'function') {
    setTimeout(install, 100);
    return;
  }
  installed = true;
  window.__rotinaLoginAdminLegado = window.realizarLogin;
  window.__rotinaCadastroAdminLegado = window.cadastrarNovoAdministrador;
  window.realizarLogin = secureLogin;
  window.cadastrarNovoAdministrador = secureRegister;
  window.rotinaForcarRestauracaoAdm = () => retryCurrentSession('manual');
  window.__rotinaAdminAuthVersion = VERSION;
  window.__rotinaAdminAuthBridgeDisabled = false;

  window.addEventListener('rotina-adm-auth-retry-requested', event => {
    retryCurrentSession(event?.detail?.reason || 'startup-retry').catch(() => {});
  });
  window.addEventListener('rotina-admin-session-ready', () => {
    retryAttempts = 0;
    window.__rotinaAdmSessionReady = true;
  });

  onAuthStateChanged(mainAuth(), user => promoteExisting(user));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
setTimeout(install, 250);
