import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, browserLocalPersistence, inMemoryPersistence, setPersistence, signInWithEmailAndPassword, signInWithCustomToken, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const VERSION = 'checkpoint-v1';
const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev';
const LOG_ENDPOINT = `${API_ROOT}/app-log`;
const RESTORE_MARKER = 'rotinaFamily.sprint2.loginCheckpoint.loggedOnce';
const GROUP_STORAGE_KEY = 'rotina_admin_push_grupo';
const ROLE_LABELS = {
  adm_familia: 'Administrador principal',
  adm_convidado: 'Administrador convidado',
  master: 'Master'
};

const firebaseConfig = {
  apiKey: 'AIzaSyCP9odEV8TJGOM4lflHk64BbPyXXVjGcYg',
  authDomain: 'sistema-de-metas-diarias.firebaseapp.com',
  projectId: 'sistema-de-metas-diarias',
  storageBucket: 'sistema-de-metas-diarias.firebasestorage.app',
  messagingSenderId: '576624564310',
  appId: '1:576624564310:web:fb2115a0c21659fefb83f7'
};

const mainApp = initializeApp(firebaseConfig, 'rotina-sprint2-login-checkpoint');
const auth = getAuth(mainApp);
await setPersistence(auth, browserLocalPersistence);

const el = id => document.getElementById(id);
const clean = value => String(value || '').trim();
const loginPanel = el('loginPanel');
const sessionPanel = el('sessionPanel');
const loginForm = el('loginForm');
const loginButton = el('loginButton');
const loginMessage = el('loginMessage');
let manualLoginInProgress = false;
let sessionRenderKey = '';
let authCallbackRunning = false;

function browserFamily() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Outro';
}

async function emitLog(evento, { grupoId = '', papel = '', restored = false } = {}, nivel = 'info') {
  if (!grupoId) return;
  const payload = {
    events: [{
      aplicativo: 'adm',
      versaoMonitor: 3,
      evento,
      nivel,
      detalhes: { versaoLogin: VERSION, papel, restaurada: restored },
      grupoId,
      perfilId: '',
      sessaoId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      clienteEm: new Date().toISOString(),
      pagina: 'sprint2-login-checkpoint-v1.html',
      navegador: browserFamily(),
      online: navigator.onLine,
      visibilidade: document.visibilityState,
      instalado: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    }]
  };
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch (_) {}
}

function setMessage(text = '', tone = '') {
  loginMessage.textContent = text;
  loginMessage.className = `message ${tone}`.trim();
}

function setBusy(busy) {
  loginButton.disabled = busy;
  loginButton.textContent = busy ? 'Validando…' : 'Entrar';
}

function readableRole(role) {
  return ROLE_LABELS[role] || role || 'Administrador';
}

function showLogin(message = '') {
  sessionRenderKey = '';
  sessionPanel.classList.remove('active');
  loginPanel.classList.remove('hidden');
  if (message) setMessage(message, 'bad');
}

function showSession({ papel, grupoId, restored }) {
  const role = clean(papel);
  const group = clean(grupoId).toUpperCase();
  const key = `${role}|${group}|${restored}`;
  if (sessionRenderKey === key) return;
  sessionRenderKey = key;

  localStorage.setItem(GROUP_STORAGE_KEY, group);
  localStorage.setItem(RESTORE_MARKER, '1');
  loginPanel.classList.add('hidden');
  sessionPanel.classList.add('active');
  el('sessionRole').textContent = readableRole(role);
  el('sessionGroup').textContent = group || '—';
  el('checkGroup').textContent = `${readableRole(role)} vinculado ao grupo ${group || '—'}.`;

  const persistenceCheck = el('persistenceCheck');
  if (restored) {
    persistenceCheck.classList.remove('pending');
    el('persistenceDot').textContent = '✓';
    el('checkPersistence').textContent = 'Sessão restaurada automaticamente após abrir/recarregar a página.';
    el('sessionLead').textContent = 'Login restaurado. Firebase e sessão administrativa continuam válidos.';
  } else {
    persistenceCheck.classList.add('pending');
    el('persistenceDot').textContent = '!';
    el('checkPersistence').textContent = 'Recarregue a página para validar a restauração automática.';
    el('sessionLead').textContent = 'Login aceito. Agora valide a persistência recarregando a página.';
  }

  emitLog(restored ? 'sprint2.auth_sessao_restaurada' : 'sprint2.auth_login_sucesso', { grupoId: group, papel: role, restored });
}

async function workerSession(idToken) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${API_ROOT}/family-session/admin`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${idToken}`,
        'content-type': 'application/json'
      },
      body: '{}'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      const error = new Error(data.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('A validação da sessão demorou além do limite seguro.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function closeTemp(app, tempAuth) {
  try { await signOut(tempAuth); } catch (_) {}
  try { await deleteApp(app); } catch (_) {}
}

async function performLogin(email, password) {
  const tempApp = initializeApp(firebaseConfig, `rotina-sprint2-login-temp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const tempAuth = getAuth(tempApp);
  await setPersistence(tempAuth, inMemoryPersistence);
  try {
    const credential = await signInWithEmailAndPassword(tempAuth, email, password);
    const idToken = await credential.user.getIdToken(true);
    const session = await workerSession(idToken);
    await signInWithCustomToken(auth, session.token);
    return {
      papel: clean(session.papel),
      grupoId: clean(session.grupoId).toUpperCase()
    };
  } finally {
    await closeTemp(tempApp, tempAuth);
  }
}

async function restoreSession(user) {
  const tokenResult = await user.getIdTokenResult();
  let papel = clean(tokenResult.claims?.papel);
  let grupoId = clean(tokenResult.claims?.grupoId).toUpperCase();

  if (!['adm_familia', 'adm_convidado', 'master'].includes(papel) || !grupoId) {
    const session = await workerSession(await user.getIdToken(true));
    await signInWithCustomToken(auth, session.token);
    papel = clean(session.papel);
    grupoId = clean(session.grupoId).toUpperCase();
  }

  if (!['adm_familia', 'adm_convidado', 'master'].includes(papel) || !grupoId) {
    throw new Error('A conta autenticou, mas não foi reconhecida como administrador válido.');
  }

  return { papel, grupoId };
}

function friendlyError(error) {
  const code = clean(error?.code);
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'E-mail ou senha inválidos.';
  if (code === 'auth/too-many-requests') return 'Muitas tentativas em sequência. Aguarde um pouco e tente novamente.';
  if (code === 'auth/network-request-failed') return 'Falha de rede ao acessar o Firebase.';
  if (Number(error?.status) === 401 || Number(error?.status) === 403) return 'A credencial foi aceita pelo Firebase, mas esta conta não está autorizada no ADM.';
  return clean(error?.message) || 'Não foi possível validar o login.';
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const email = clean(el('loginEmail').value).toLowerCase();
  const password = clean(el('loginSenha').value);
  if (!email || !password) return setMessage('Informe e-mail e senha.', 'bad');

  manualLoginInProgress = true;
  setBusy(true);
  setMessage('Validando Firebase e sessão administrativa…');
  try {
    const session = await performLogin(email, password);
    el('loginSenha').value = '';
    setMessage('');
    showSession({ ...session, restored: false });
  } catch (error) {
    console.warn('Checkpoint de login Sprint 2:', error);
    await signOut(auth).catch(() => {});
    showLogin(friendlyError(error));
  } finally {
    manualLoginInProgress = false;
    setBusy(false);
  }
});

el('togglePassword').addEventListener('click', () => {
  const input = el('loginSenha');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  el('togglePassword').textContent = showing ? 'Mostrar' : 'Ocultar';
});

el('reloadButton').addEventListener('click', () => location.reload());

el('logoutButton').addEventListener('click', async () => {
  const group = clean(el('sessionGroup').textContent).toUpperCase();
  const role = clean(el('sessionRole').textContent);
  await emitLog('sprint2.auth_logout', { grupoId: group, papel: role, restored: false });
  await signOut(auth);
  localStorage.removeItem(GROUP_STORAGE_KEY);
  localStorage.removeItem(RESTORE_MARKER);
  showLogin();
});

onAuthStateChanged(auth, async user => {
  if (authCallbackRunning) return;
  if (!user) {
    if (!manualLoginInProgress) showLogin();
    return;
  }
  if (manualLoginInProgress) return;

  authCallbackRunning = true;
  try {
    const session = await restoreSession(user);
    const restored = localStorage.getItem(RESTORE_MARKER) === '1';
    showSession({ ...session, restored });
  } catch (error) {
    console.warn('Restauração do checkpoint de login:', error);
    await signOut(auth).catch(() => {});
    localStorage.removeItem(GROUP_STORAGE_KEY);
    showLogin(friendlyError(error));
  } finally {
    authCallbackRunning = false;
  }
});