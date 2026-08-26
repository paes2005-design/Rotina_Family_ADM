import { initializeApp, getApps, getApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, signOut, deleteUser, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const VERSION = 5;
let installed = false;
let promotingUid = '';
let promotedUid = '';

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
  const response = await fetch(`${API_ROOT}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.token) {
    const error = new Error(result.error || `Falha HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}

async function installPromotedSession(session, reason) {
  const auth = mainAuth();
  promotedUid = auth.currentUser?.uid || promotedUid;
  try {
    // Força uma transição real de estado sem recarregar a página. Isso faz o
    // listener principal do ADM reconstruir a interface já com authRoles salvo.
    if (auth.currentUser) await signOut(auth);
    const credential = await signInWithCustomToken(auth, session.token);
    promotedUid = credential.user.uid;
    window.__rotinaAdminRole = session.papel;
    window.__rotinaAdminAuthBridgeDisabled = false;
    window.rotinaLog?.('auth.adm_sessao_promovida', {
      papel: session.papel,
      grupoId: session.grupoId || '',
      motivo: reason,
      authVersion: VERSION
    });
    window.dispatchEvent(new CustomEvent('rotina-adm-role-ready', {
      detail: { papel: session.papel, grupoId: session.grupoId || '', version: VERSION }
    }));
    return credential.user;
  } catch (error) {
    promotedUid = '';
    throw error;
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

async function promoteExisting(user) {
  if (!user || promotingUid === user.uid || promotedUid === user.uid) return;
  promotingUid = user.uid;
  try {
    const idTokenResult = await user.getIdTokenResult();
    const knownRole = String(idTokenResult.claims?.papel || '');
    if (['adm_familia', 'adm_convidado', 'master'].includes(knownRole)) {
      promotedUid = user.uid;
      window.__rotinaAdminRole = knownRole;
      window.__rotinaAdminAuthBridgeDisabled = false;
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
  window.__rotinaAdminAuthVersion = VERSION;
  window.__rotinaAdminAuthBridgeDisabled = false;
  onAuthStateChanged(mainAuth(), user => promoteExisting(user));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
setTimeout(install, 250);
