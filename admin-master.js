import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev/admin-master';
const MASTER_UID_KEY = 'rotinaFamilyMasterConfirmedUid';
let masterSession = null;
let users = [];
let usersLoading = null;
let validationPromise = null;
let authObserverStarted = false;
let authNullTimer = null;
let autoLoadedUid = '';
let lastValidationAt = 0;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

function friendlyMasterError(error) {
  const message = String(error?.message || error || 'Falha desconhecida.');
  if (/INSUFFICIENT_PERMISSION/i.test(message)) return 'A conta de serviço do Worker não possui permissão suficiente no Firebase Authentication.';
  if (/Consulta Firestore recusada \(429\)|Falha HTTP 429/i.test(message)) return 'O Firebase limitou temporariamente as leituras. Aguarde alguns segundos e tente novamente.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Falha de comunicação com o Firebase/Worker.';
  return message;
}

async function masterApi(path, options = {}) {
  if (!getApps().length) throw new Error('Firebase ainda não foi iniciado.');
  let forceRefresh = false;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const currentUser = getAuth(getApp()).currentUser;
    if (!currentUser) throw new Error('Sessão administrativa encerrada.');
    try {
      const token = await currentUser.getIdToken(forceRefresh);
      forceRefresh = false;
      const response = await fetch(`${API_ROOT}${path}`, {
        ...options,
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) }
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body;
      const error = new Error(body.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      if (response.status === 401 && attempt < 3) {
        forceRefresh = true;
        lastError = error;
        await wait(250);
        continue;
      }
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === 3) throw error;
      lastError = error;
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      await wait(retryAfter > 0 ? retryAfter * 1000 : (900 * attempt));
      continue;
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      if (status && ![408, 425, 429, 500, 502, 503, 504].includes(status)) throw error;
      if (attempt === 3) throw error;
      await wait(900 * attempt);
    }
  }
  throw lastError || new Error('Não foi possível sincronizar com o Firebase.');
}
window.rotinaMasterApi = masterApi;

function removeMasterMobileNav() {
  document.querySelector('.mobile-bottom-nav button[data-nav="adminMaster"]')?.remove();
  const nav = document.getElementById('mobileBottomNav');
  if (nav) nav.style.gridTemplateColumns = '';
}

function removeMasterUi({ clearRemembered = false } = {}) {
  document.getElementById('adminMasterTabButton')?.remove();
  document.getElementById('adminMaster')?.remove();
  document.getElementById('appMonitoringPanel')?.remove();
  removeMasterMobileNav();
  masterSession = null;
  window.rotinaMasterSession = { master: false };
  if (clearRemembered) localStorage.removeItem(MASTER_UID_KEY);
}

function ensureMasterMobileNav() {
  if (!window.matchMedia('(max-width: 780px)').matches || masterSession?.master !== true) return;
  const nav = document.getElementById('mobileBottomNav');
  if (!nav) { setTimeout(ensureMasterMobileNav, 250); return; }
  let button = nav.querySelector('button[data-nav="adminMaster"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.nav = 'adminMaster';
    button.innerHTML = '<span class="nav-ico">🔐</span><span class="nav-label">Master</span>';
    button.addEventListener('click', event => {
      window.mudarAba?.('adminMaster', event);
      nav.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
      if (!users.length) loadUsers();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    nav.appendChild(button);
  }
  nav.style.gridTemplateColumns = 'repeat(6,minmax(0,1fr))';
}

function ensureMasterUi() {
  if (masterSession?.master !== true) return;
  const nav = document.querySelector('.tab-nav');
  const main = document.getElementById('sistemaPrincipal');
  if (!nav || !main) { setTimeout(ensureMasterUi, 200); return; }

  if (!document.getElementById('adminMasterTabButton')) {
    const tab = document.createElement('button');
    tab.id = 'adminMasterTabButton';
    tab.className = 'tab-btn';
    tab.textContent = 'ADM Master';
    tab.addEventListener('click', event => {
      window.mudarAba?.('adminMaster', event);
      document.querySelectorAll('.mobile-bottom-nav button').forEach(item => item.classList.toggle('active', item.dataset.nav === 'adminMaster'));
      if (!users.length) loadUsers();
    });
    nav.appendChild(tab);
  }

  if (!document.getElementById('adminMaster')) {
    const section = document.createElement('div');
    section.id = 'adminMaster';
    section.className = 'tab-content';
    section.innerHTML = `
      <style>
        .master-panel{border:1px solid #d8e2ec;border-radius:16px;background:#fff;padding:16px}.master-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.master-head h2{margin:0;color:#173a5e}.master-head p{margin:5px 0;color:#64748b;font-size:13px}.master-sync{font-size:11px;color:#64748b;margin-top:7px}.master-refresh{border:0;border-radius:10px;background:#173a5e;color:#fff;padding:10px 14px;font-weight:800;cursor:pointer}.master-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px;margin-top:14px}.master-table{width:100%;min-width:780px;border-collapse:collapse}.master-table th,.master-table td{padding:10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:12px;vertical-align:middle}.master-table th{background:#f8fafc;color:#475569}.master-actions{display:flex;gap:6px;flex-wrap:wrap}.master-actions button{border:0;border-radius:8px;padding:7px 9px;font-weight:750;cursor:pointer;background:#e8f0f8;color:#173a5e}.master-actions .danger{background:#fee2e2;color:#991b1b}.master-actions .warning{background:#fef3c7;color:#92400e}.master-role{display:inline-block;padding:3px 7px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-weight:800}.master-status-off{color:#b91c1c;font-weight:800}.master-status-on{color:#15803d;font-weight:800}.master-mobile-list{display:none}.master-error{margin-top:14px;padding:12px;border:1px solid #fecaca;border-radius:12px;background:#fff7f7;color:#b91c1c;line-height:1.4}.master-protected{font-size:11px;color:#5b21b6;font-weight:800}
        @media(max-width:780px){#adminMaster{padding:10px!important;overflow:visible!important}#adminMaster .master-panel{padding:12px;border-radius:14px}#adminMaster .master-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px}#adminMaster .master-head h2{font-size:20px}#adminMaster .master-head p{font-size:11px}#adminMaster .master-refresh{padding:9px 10px;font-size:11px}#adminMaster .master-table-wrap{display:none}#adminMaster .master-mobile-list{display:grid;gap:10px;margin-top:12px}#adminMaster .master-user-card{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#fff}#adminMaster .master-user-top{display:flex;justify-content:space-between;gap:8px}#adminMaster .master-user-email{font-size:13px;color:#173a5e;overflow-wrap:anywhere}#adminMaster .master-user-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}#adminMaster .master-user-field{padding:8px;border-radius:10px;background:#f8fafc}#adminMaster .master-user-field small{display:block;color:#64748b;font-size:9px}#adminMaster .master-user-field strong,#adminMaster .master-user-field span{font-size:11px;overflow-wrap:anywhere}#adminMaster .master-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}#adminMaster .master-actions button{width:100%;min-height:38px;font-size:10px}}@media(max-width:390px){#adminMaster .master-head{grid-template-columns:1fr}#adminMaster .master-refresh{width:100%}#adminMaster .master-user-meta{grid-template-columns:1fr}}
      </style>
      <div class="master-panel">
        <div class="master-head"><div><h2>🔐 Administração Master</h2><p>Controle central do aplicativo e dos grupos familiares.</p><div id="masterSyncStatus" class="master-sync">Aguardando sincronização…</div></div><button id="masterRefresh" class="master-refresh" type="button">Atualizar usuários</button></div>
        <div id="masterUsers"><p>Carregando usuários…</p></div>
      </div>`;
    main.appendChild(section);
    section.querySelector('#masterRefresh')?.addEventListener('click', () => loadUsers({ force: true }));
    section.querySelector('#masterUsers')?.addEventListener('click', handleUserAction);
  }
  ensureMasterMobileNav();
}

function actionButtons(user) {
  if (user.papel === 'master') return '<div class="master-protected">🔒 Login Master protegido</div>';
  return `<div class="master-actions"><button data-action="email" data-uid="${escapeHtml(user.uid)}">Editar e-mail</button><button data-action="reset" data-uid="${escapeHtml(user.uid)}">Redefinir senha</button><button class="warning" data-action="toggle" data-disabled="${user.desativado}" data-uid="${escapeHtml(user.uid)}">${user.desativado ? 'Ativar' : 'Desativar'}</button><button class="danger" data-action="delete" data-uid="${escapeHtml(user.uid)}">Retirar usuário</button></div>`;
}

function renderUsers() {
  const target = document.getElementById('masterUsers');
  if (!target) return;
  if (!users.length) { target.innerHTML = '<p>Nenhum administrador cadastrado.</p>'; return; }
  const rows = users.map(user => {
    const isMaster = user.papel === 'master';
    return `<tr><td><strong>${escapeHtml(user.email || 'Sem e-mail')}</strong></td><td>${escapeHtml(user.grupoId || '—')}<br><small>${escapeHtml(user.codigoAdmin || '')}</small></td><td>${isMaster ? '<span class="master-role">MASTER</span>' : 'Administrador'}</td><td class="${user.desativado ? 'master-status-off' : 'master-status-on'}">${user.desativado ? 'Desativado' : 'Ativo'}</td><td>${escapeHtml(formatDate(user.ultimoLoginEm))}</td><td>${isMaster ? 'Protegido' : actionButtons(user)}</td></tr>`;
  }).join('');
  const cards = users.map(user => {
    const isMaster = user.papel === 'master';
    return `<article class="master-user-card"><div class="master-user-top"><strong class="master-user-email">${escapeHtml(user.email || 'Sem e-mail')}</strong>${isMaster ? '<span class="master-role">MASTER</span>' : `<span class="${user.desativado ? 'master-status-off' : 'master-status-on'}">${user.desativado ? 'Desativado' : 'Ativo'}</span>`}</div><div class="master-user-meta"><div class="master-user-field"><small>Família</small><strong>${escapeHtml(user.grupoId || '—')}</strong><br><span>${escapeHtml(user.codigoAdmin || '')}</span></div><div class="master-user-field"><small>Último login</small><span>${escapeHtml(formatDate(user.ultimoLoginEm))}</span></div></div>${actionButtons(user)}</article>`;
  }).join('');
  target.innerHTML = `<div class="master-table-wrap"><table class="master-table"><thead><tr><th>E-mail</th><th>Família</th><th>Perfil</th><th>Status</th><th>Último login</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div><div class="master-mobile-list">${cards}</div>`;
}

async function loadUsers({ force = false } = {}) {
  if (masterSession?.master !== true) return;
  if (usersLoading) return usersLoading;
  if (!force && users.length) { renderUsers(); return users; }
  usersLoading = (async () => {
    const refresh = document.getElementById('masterRefresh');
    const status = document.getElementById('masterSyncStatus');
    if (refresh) { refresh.disabled = true; refresh.textContent = 'Atualizando…'; }
    if (status) status.textContent = 'Sincronizando com Firebase…';
    try {
      users = (await masterApi('/users')).users || [];
      renderUsers();
      if (status) status.textContent = `Firebase atualizado · ${users.length} administrador(es)`;
      window.rotinaLog?.('master.usuarios_atualizados', { total: users.length });
      return users;
    } catch (error) {
      const target = document.getElementById('masterUsers');
      const message = navigator.onLine === false ? 'Sem conexão com a internet.' : 'Não foi possível atualizar os usuários agora.';
      if (status) status.textContent = `${message} A tela Master continuará disponível.`;
      if (target && !users.length) target.innerHTML = `<div class="master-error"><strong>${escapeHtml(message)}</strong><br><small>${escapeHtml(friendlyMasterError(error))}</small><br><button id="masterRetryUsers" type="button" class="master-refresh" style="margin-top:10px">Tentar novamente</button></div>`;
      document.getElementById('masterRetryUsers')?.addEventListener('click', () => loadUsers({ force: true }), { once: true });
      window.rotinaLog?.('master.usuarios_atualizacao_falhou', { online: navigator.onLine !== false, erro: String(error?.message || error).slice(0,120) });
      return users;
    } finally {
      if (refresh) { refresh.disabled = false; refresh.textContent = 'Atualizar usuários'; }
      usersLoading = null;
    }
  })();
  return usersLoading;
}

async function handleUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || usersLoading) return;
  const user = users.find(item => item.uid === button.dataset.uid);
  if (!user) return;
  let payload = null;
  if (button.dataset.action === 'email') {
    const email = prompt('Digite o novo e-mail do administrador:', user.email || '');
    if (!email || email.trim().toLowerCase() === String(user.email || '').toLowerCase()) return;
    payload = { action: 'update-email', targetUid: user.uid, email: email.trim().toLowerCase() };
  } else if (button.dataset.action === 'reset') {
    if (!confirm(`Enviar um link de redefinição de senha para ${user.email}?`)) return;
    payload = { action: 'send-password-reset', targetUid: user.uid };
  } else if (button.dataset.action === 'toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Desativar' : 'Ativar'} o acesso de ${user.email}?`)) return;
    payload = { action: 'set-disabled', targetUid: user.uid, disabled };
  } else if (button.dataset.action === 'delete') {
    if (!confirm(`Retirar definitivamente o login ${user.email}?\n\nOs dados familiares não serão excluídos.`)) return;
    payload = { action: 'delete-user', targetUid: user.uid };
  }
  if (!payload) return;
  button.disabled = true;
  try {
    await masterApi('/users', { method: 'POST', body: JSON.stringify(payload) });
    window.rotinaLog?.('master.usuario_alterado', { acao: payload.action, alvoUid: user.uid });
    alert(payload.action === 'send-password-reset' ? 'Link de redefinição enviado.' : 'Alteração concluída.');
    users = [];
    await loadUsers({ force: true });
  } catch (error) {
    alert(friendlyMasterError(error));
  } finally {
    button.disabled = false;
  }
}

function isExplicitDenial(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '');
  return status === 401 || status === 403 || /Acesso exclusivo do ADM Master|Acesso Master não confirmado|Cadastro administrativo não encontrado/i.test(message);
}

async function validateMaster({ force = false } = {}) {
  if (validationPromise) return validationPromise;
  if (!getApps().length) return false;
  const currentUser = getAuth(getApp()).currentUser;
  if (!currentUser) return false;
  if (!force && Date.now() - lastValidationAt < 5000 && masterSession?.uid === currentUser.uid) return masterSession?.master === true;

  validationPromise = (async () => {
    const remembered = localStorage.getItem(MASTER_UID_KEY) === currentUser.uid;
    if (remembered && masterSession?.master !== true) {
      masterSession = { master: true, uid: currentUser.uid, cached: true, sincronizacaoPendente: true };
      window.rotinaMasterSession = masterSession;
      ensureMasterUi();
      window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: masterSession }));
    }
    try {
      const session = await masterApi('/session');
      if (session?.master !== true) {
        const error = new Error('Acesso Master não confirmado pelo servidor.');
        error.status = 403;
        throw error;
      }
      lastValidationAt = Date.now();
      masterSession = { ...session, master: true, uid: currentUser.uid, sincronizacaoPendente: false };
      window.rotinaMasterSession = masterSession;
      localStorage.setItem(MASTER_UID_KEY, currentUser.uid);
      ensureMasterUi();
      window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: masterSession }));
      if (autoLoadedUid !== currentUser.uid) {
        autoLoadedUid = currentUser.uid;
        setTimeout(() => loadUsers().catch(() => {}), 700);
      }
      return true;
    } catch (error) {
      if (isExplicitDenial(error)) {
        if (localStorage.getItem(MASTER_UID_KEY) === currentUser.uid) localStorage.removeItem(MASTER_UID_KEY);
        removeMasterUi();
        window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: { master: false, motivo: 'nao-autorizado' } }));
        return false;
      }
      if (remembered || masterSession?.master === true) {
        masterSession = { ...(masterSession || {}), master: true, uid: currentUser.uid, sincronizacaoPendente: true };
        window.rotinaMasterSession = masterSession;
        ensureMasterUi();
        const status = document.getElementById('masterSyncStatus');
        if (status) status.textContent = 'Sincronização temporariamente indisponível; acesso Master preservado.';
        window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: masterSession }));
        return true;
      }
      return false;
    }
  })().finally(() => { validationPromise = null; });
  return validationPromise;
}

function scheduleValidation(delay = 100) {
  setTimeout(() => {
    if (getApps().length && getAuth(getApp()).currentUser) validateMaster().catch(() => {});
  }, delay);
}

function startAuthObserver() {
  if (authObserverStarted || !getApps().length) return false;
  authObserverStarted = true;
  onAuthStateChanged(getAuth(getApp()), user => {
    clearTimeout(authNullTimer);
    if (!user) {
      authNullTimer = setTimeout(() => {
        if (getApps().length && !getAuth(getApp()).currentUser) removeMasterUi({ clearRemembered: false });
      }, 1800);
      return;
    }
    scheduleValidation(50);
  });
  return true;
}

window.addEventListener('rotina-admin-session-ready', () => { startAuthObserver(); scheduleValidation(150); });
window.addEventListener('online', () => { if (masterSession?.master === true) validateMaster({ force: true }).then(() => loadUsers({ force: true })).catch(() => {}); });
window.matchMedia('(max-width: 780px)').addEventListener?.('change', event => { if (event.matches) ensureMasterMobileNav(); else removeMasterMobileNav(); });

let bootAttempts = 0;
const bootTimer = setInterval(() => {
  bootAttempts += 1;
  if (getApps().length && startAuthObserver()) {
    if (getAuth(getApp()).currentUser) scheduleValidation(50);
  }
  if (authObserverStarted || bootAttempts > 120) clearInterval(bootTimer);
}, 100);

if (document.readyState !== 'loading') { startAuthObserver(); scheduleValidation(50); }
else window.addEventListener('DOMContentLoaded', () => { startAuthObserver(); scheduleValidation(50); }, { once: true });
