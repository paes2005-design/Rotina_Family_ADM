import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const API_ROOT = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev/admin-master';
let masterSession = null;
let users = [];
let loading = false;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

async function masterApi(path, options = {}) {
  if (!getApps().length || !getAuth(getApp()).currentUser) throw new Error('Sessão administrativa encerrada.');
  const token = await getAuth(getApp()).currentUser.getIdToken(true);
  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Falha HTTP ${response.status}`);
  return body;
}

window.rotinaMasterApi = masterApi;

function removeMasterUi() {
  document.getElementById('adminMasterTabButton')?.remove();
  document.getElementById('adminMaster')?.remove();
  document.getElementById('appMonitoringPanel')?.remove();
  masterSession = null;
  window.rotinaMasterSession = { master: false };
}

function ensureMasterUi() {
  if (document.getElementById('adminMaster')) return;
  const nav = document.querySelector('.tab-nav');
  const main = document.getElementById('sistemaPrincipal');
  if (!nav || !main) return;
  const button = document.createElement('button');
  button.id = 'adminMasterTabButton';
  button.className = 'tab-btn';
  button.textContent = 'ADM Master';
  button.addEventListener('click', event => {
    window.mudarAba?.('adminMaster', event);
    loadUsers();
  });
  nav.appendChild(button);

  const section = document.createElement('div');
  section.id = 'adminMaster';
  section.className = 'tab-content';
  section.innerHTML = `
    <style>
      .master-panel{border:1px solid #d8e2ec;border-radius:16px;background:#fff;padding:16px}
      .master-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .master-head h2{margin:0;color:#173a5e}.master-head p{margin:5px 0;color:#64748b;font-size:13px}
      .master-refresh{border:0;border-radius:10px;background:#173a5e;color:#fff;padding:10px 14px;font-weight:800;cursor:pointer}
      .master-table-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px;margin-top:14px}
      .master-table{width:100%;min-width:780px;border-collapse:collapse}.master-table th,.master-table td{padding:10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:12px;vertical-align:middle}.master-table th{background:#f8fafc;color:#475569}
      .master-actions{display:flex;gap:6px;flex-wrap:wrap}.master-actions button{border:0;border-radius:8px;padding:7px 9px;font-weight:750;cursor:pointer;background:#e8f0f8;color:#173a5e}.master-actions .danger{background:#fee2e2;color:#991b1b}.master-actions .warning{background:#fef3c7;color:#92400e}
      .master-role{display:inline-block;padding:3px 7px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-weight:800}
      .master-status-off{color:#b91c1c;font-weight:800}.master-status-on{color:#15803d;font-weight:800}
    </style>
    <div class="master-panel">
      <div class="master-head"><div><h2>🔐 Administração Master</h2><p>Gerencie somente os logins administrativos. Integrantes, tarefas e histórico familiar não são apagados ao retirar um login.</p></div><button id="masterRefresh" class="master-refresh" type="button">Atualizar usuários</button></div>
      <div id="masterUsers"><p>Carregando usuários…</p></div>
    </div>`;
  main.appendChild(section);
  document.getElementById('masterRefresh').addEventListener('click', loadUsers);
  document.getElementById('masterUsers').addEventListener('click', handleUserAction);
}

function renderUsers() {
  const target = document.getElementById('masterUsers');
  if (!target) return;
  if (!users.length) {
    target.innerHTML = '<p>Nenhum administrador cadastrado.</p>';
    return;
  }
  target.innerHTML = `<div class="master-table-wrap"><table class="master-table"><thead><tr><th>E-mail</th><th>Família</th><th>Perfil</th><th>Status</th><th>Último login</th><th>Ações</th></tr></thead><tbody>${users.map(user => {
    const isMaster = user.papel === 'master';
    return `<tr><td><strong>${escapeHtml(user.email || 'Sem e-mail')}</strong></td><td>${escapeHtml(user.grupoId || '—')}<br><small>${escapeHtml(user.codigoAdmin || '')}</small></td><td>${isMaster ? '<span class="master-role">MASTER</span>' : 'Administrador'}</td><td class="${user.desativado ? 'master-status-off' : 'master-status-on'}">${user.desativado ? 'Desativado' : 'Ativo'}</td><td>${escapeHtml(formatDate(user.ultimoLoginEm))}</td><td>${isMaster ? 'Protegido' : `<div class="master-actions"><button data-action="email" data-uid="${escapeHtml(user.uid)}">Editar e-mail</button><button data-action="reset" data-uid="${escapeHtml(user.uid)}">Redefinir senha</button><button class="warning" data-action="toggle" data-disabled="${user.desativado}" data-uid="${escapeHtml(user.uid)}">${user.desativado ? 'Ativar' : 'Desativar'}</button><button class="danger" data-action="delete" data-uid="${escapeHtml(user.uid)}">Retirar usuário</button></div>`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

async function loadUsers() {
  if (loading || !masterSession) return;
  loading = true;
  try {
    users = (await masterApi('/users')).users || [];
    renderUsers();
  } catch (error) {
    const target = document.getElementById('masterUsers');
    if (target) target.innerHTML = `<p style="color:#b91c1c">${escapeHtml(error.message)}</p>`;
  } finally {
    loading = false;
  }
}

async function handleUserAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button || loading) return;
  const user = users.find(item => item.uid === button.dataset.uid);
  if (!user) return;
  let payload;
  if (button.dataset.action === 'email') {
    const email = prompt('Digite o novo e-mail do administrador:', user.email || '');
    if (!email || email.trim().toLowerCase() === user.email) return;
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
  loading = true;
  button.disabled = true;
  try {
    await masterApi('/users', { method: 'POST', body: JSON.stringify(payload) });
    window.rotinaLog?.('master.usuario_alterado', { acao: payload.action, alvoUid: user.uid });
    alert(payload.action === 'send-password-reset' ? 'Link de redefinição enviado.' : 'Alteração concluída.');
  } catch (error) {
    alert(error.message);
  } finally {
    loading = false;
    await loadUsers();
  }
}

async function checkMaster() {
  if (!getApps().length || !getAuth(getApp()).currentUser) {
    removeMasterUi();
    window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: { master: false } }));
    return;
  }
  try {
    masterSession = await masterApi('/session');
    window.rotinaMasterSession = masterSession;
    ensureMasterUi();
    window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: masterSession }));
  } catch (_) {
    removeMasterUi();
    window.dispatchEvent(new CustomEvent('rotina-admin-master-ready', { detail: { master: false } }));
  }
}

window.addEventListener('rotina-admin-session-ready', checkMaster);
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', checkMaster, { once: true });
else checkMaster();
if (getApps().length) onAuthStateChanged(getAuth(getApp()), user => { if (!user) removeMasterUi(); });
