import { initializeApp, getApps, getApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithCustomToken, signOut, deleteUser, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const VERSION = 3;
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

function reloadAfterPromotion(reason = 'promocao') {
  try {
    window.rotinaLog?.('auth.adm_recarregando_apos_promocao', { motivo: reason, authVersion: VERSION });
    sessionStorage.setItem('rotina.adm.role-promoted', String(Date.now()));
  } catch (_) {}
  setTimeout(() => location.reload(), 60);
}

async function secureLogin() {
  const email = clean(document.getElementById('loginEmail')?.value).toLowerCase();
  const senha = clean(document.getElementById('loginSenha')?.value);
  if (!email || !senha) return alert('Informe e-mail e senha.');
  const temp = await temporaryAuth('login');
  let reload = false;
  try {
    const credential = await signInWithEmailAndPassword(temp.auth, email, senha);
    const idToken = await credential.user.getIdToken(true);
    const session = await workerSession('/family-session/admin', idToken);
    promotedUid = credential.user.uid;
    await signInWithCustomToken(mainAuth(), session.token);
    window.__rotinaAdminRole = session.papel;
    window.rotinaLog?.('auth.adm_sessao_criada', { papel: session.papel, grupoId: session.grupoId || '', authVersion: VERSION });
    reload = true;
  } catch (error) {
    console.warn('Login administrativo seguro:', error);
    alert(error.message || 'Acesso negado.');
  } finally {
    await closeTemporary(temp);
  }
  if (reload) reloadAfterPromotion('login-seguro');
}

async function secureRegister() {
  const email = clean(document.getElementById('novoAdminEmail')?.value).toLowerCase();
  const senha = clean(document.getElementById('novoAdminSenha')?.value);
  const codigoConvite = clean(document.getElementById('novoAdminConvite')?.value).toUpperCase();
  if (!email || senha.length < 6) return alert('Informe e-mail e uma senha com pelo menos 6 caracteres.');
  const temp = await temporaryAuth('register');
  let credential = null;
  let serverCommitted = false;
  let reload = false;
  try {
    credential = await createUserWithEmailAndPassword(temp.auth, email, senha);
    const idToken = await credential.user.getIdToken(true);
    const session = await workerSession('/family-session/admin-register', idToken, { codigoConvite });
    serverCommitted = true;
    promotedUid = credential.user.uid;
    await signInWithCustomToken(mainAuth(), session.token);
    window.__rotinaAdminRole = session.papel;
    alert(`Administrador cadastrado!\nCódigo Admin: ${session.codigoAdmin}\nCódigo Cliente: ${session.codigoCliente}`);
    window.rotinaLog?.('auth.adm_cadastrado_seguro', { papel: session.papel, grupoId: session.grupoId || '', authVersion: VERSION });
    reload = true;
  } catch (error) {
    if (credential?.user && !serverCommitted) await deleteUser(credential.user).catch(() => {});
    console.warn('Cadastro administrativo seguro:', error);
    alert(serverCommitted
      ? 'O cadastro foi concluído, mas não foi possível abrir a sessão agora. Entre novamente com o e-mail e a senha cadastrados.'
      : (error.message || 'Não foi possível cadastrar o administrador.'));
  } finally {
    await closeTemporary(temp);
  }
  if (reload) reloadAfterPromotion('cadastro-seguro');
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
      try { sessionStorage.removeItem('rotina.adm.role-promoted'); } catch (_) {}
      return;
    }
    const session = await workerSession('/family-session/admin', await user.getIdToken(true));
    promotedUid = user.uid;
    window.__rotinaAdminRole = session.papel;
    await signInWithCustomToken(mainAuth(), session.token);
    reloadAfterPromotion('restauracao-promovida');
  } catch (error) {
    console.warn('Não foi possível promover a sessão administrativa atual:', error);
    window.rotinaLog?.('auth.adm_promocao_erro', { mensagem: clean(error?.message || error), authVersion: VERSION }, 'error');
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
  onAuthStateChanged(mainAuth(), user => promoteExisting(user));
  window.__rotinaAdminAuthVersion = VERSION;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
else install();
setTimeout(install, 250);
