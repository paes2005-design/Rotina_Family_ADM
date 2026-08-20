const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
let groups = [];
let busy = false;

function statusLabel(group) {
  if (group.protegido) return 'MASTER';
  if (group.estado === 'bloqueado') return 'BLOQUEADO';
  if (group.estado === 'liberado') return 'ATIVO';
  if (group.estado === 'teste-expirado') return 'TESTE ENCERRADO';
  if (group.estado === 'teste') return 'TESTE';
  return 'LEGADO';
}

function trialText(group) {
  if (!group.trialAtivo || !group.trialFimEm) return '';
  const end = new Date(group.trialFimEm);
  if (!Number.isFinite(end.getTime())) return '';
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000));
  return group.estado === 'teste-expirado' ? 'Teste expirado' : `${days} dia(s) restantes`;
}

function actionButton(label, action, attrs = '', css = '') {
  return `<button type="button" data-tree-action="${action}" ${attrs} style="border:0;border-radius:8px;padding:7px 9px;font-weight:800;cursor:pointer;${css}">${esc(label)}</button>`;
}

function renderAdmin(admin, group) {
  const isMaster = admin.master === true;
  const principal = admin.principal === true;
  const disabled = admin.desativado === true;
  let actions = '<span style="font-size:11px;color:#6b7280">Protegido</span>';
  if (!isMaster) {
    const toggleLabel = principal
      ? (group.grupoBloqueado ? 'Ativar grupo' : 'Bloquear grupo')
      : (disabled ? 'Ativar admin' : 'Desativar admin');
    actions = `<div style="display:flex;gap:6px;flex-wrap:wrap">${actionButton(toggleLabel,'admin-toggle',`data-uid="${esc(admin.uid)}" data-disabled="${disabled}"`, 'background:#fef3c7;color:#92400e')}${actionButton('Excluir admin','admin-delete',`data-uid="${esc(admin.uid)}" data-email="${esc(admin.email)}"`,'background:#fee2e2;color:#991b1b')}</div>`;
  }
  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><div><strong>${principal ? '👑 ' : '🛡️ '}${esc(admin.email || 'Administrador')}</strong> ${isMaster ? '<span style="font-size:10px;font-weight:800;color:#6d28d9">MASTER</span>' : ''}</div><small>${principal ? 'Administrador principal' : 'Administrador adicional'} · ${disabled ? 'desativado' : 'ativo'}</small><div style="margin-top:7px">${actions}</div></div>`;
}

function renderClient(client) {
  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><div><strong>👤 ${esc(client.nome || 'Cliente')}</strong></div><small>${client.desativado ? 'desativado' : 'ativo'} · ${esc(client.perfilId || '')}</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${actionButton(client.desativado ? 'Ativar cliente' : 'Desativar cliente','client-toggle',`data-profile="${esc(client.id)}" data-disabled="${client.desativado}"`,'background:#fef3c7;color:#92400e')}${actionButton('Excluir cliente','client-delete',`data-profile="${esc(client.id)}" data-name="${esc(client.nome)}"`,'background:#fee2e2;color:#991b1b')}</div></div>`;
}

function renderTree() {
  const target = document.getElementById('masterFamilyTreeBody');
  if (!target) return;
  if (!groups.length) {
    target.innerHTML = '<p style="color:#64748b">Nenhum grupo familiar encontrado.</p>';
    return;
  }
  target.innerHTML = groups.map(group => {
    const trial = trialText(group);
    const groupActions = group.protegido
      ? '<span style="font-size:11px;color:#6d28d9;font-weight:800">Grupo do ADM Master protegido</span>'
      : `<div style="display:flex;gap:6px;flex-wrap:wrap">${group.estado !== 'liberado' ? actionButton('Confirmar / Ativar','confirm-group',`data-group="${esc(group.grupoId)}"`,'background:#dcfce7;color:#166534') : ''}${actionButton(group.grupoBloqueado ? 'Reativar grupo' : 'Bloquear grupo','group-toggle',`data-group="${esc(group.grupoId)}" data-disabled="${group.grupoBloqueado}"`,'background:#fef3c7;color:#92400e')}</div>`;
    return `<section style="border:1px solid #dbe4ee;border-radius:14px;padding:12px;margin:10px 0;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><strong style="font-size:15px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong><div style="font-size:11px;color:#64748b;margin-top:3px">${esc(statusLabel(group))}${trial ? ` · ${esc(trial)}` : ''}</div></div>${groupActions}</div><div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Administradores</strong><div style="display:grid;gap:7px;margin-top:6px">${group.administradores?.map(admin => renderAdmin(admin, group)).join('') || '<small>Nenhum administrador.</small>'}</div></div><div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Clientes / integrantes</strong><div style="display:grid;gap:7px;margin-top:6px">${group.clientes?.map(renderClient).join('') || '<small>Nenhum cliente.</small>'}</div></div></section>`;
  }).join('');
}

async function loadTree() {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  busy = true;
  const target = document.getElementById('masterFamilyTreeBody');
  if (target) target.innerHTML = '<p>Atualizando árvore…</p>';
  try {
    groups = (await window.rotinaMasterApi('/tree')).groups || [];
    renderTree();
  } catch (error) {
    if (target) target.innerHTML = `<div style="color:#b91c1c">${esc(error?.message || error)}</div>`;
  } finally {
    busy = false;
  }
}

function ensurePanel() {
  const master = document.getElementById('adminMaster');
  if (!master || document.getElementById('masterFamilyTree')) return;
  const panel = document.createElement('div');
  panel.id = 'masterFamilyTree';
  panel.style.cssText = 'margin-top:14px;border:1px solid #d8e2ec;border-radius:16px;background:#fff;padding:14px';
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0;color:#173a5e">🌳 Árvore completa das famílias</h3><p style="margin:5px 0;color:#64748b;font-size:12px">Visualize cada grupo, administrador principal, administradores adicionais e clientes. Bloqueios comerciais preservam os dados.</p></div><button id="masterTreeRefresh" type="button" style="border:0;border-radius:9px;background:#173a5e;color:#fff;padding:9px 11px;font-weight:800">Atualizar árvore</button></div><div id="masterFamilyTreeBody"><p>Carregando árvore…</p></div>`;
  master.appendChild(panel);
  panel.querySelector('#masterTreeRefresh').addEventListener('click', loadTree);
  panel.addEventListener('click', handleTreeAction);
  loadTree();
}

async function handleTreeAction(event) {
  const button = event.target.closest('button[data-tree-action]');
  if (!button || busy) return;
  const action = button.dataset.treeAction;
  let path = '';
  let payload = null;
  if (action === 'group-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Bloquear' : 'Reativar'} todo o grupo ${button.dataset.group}?`)) return;
    path = '/groups'; payload = { action: 'set-group-disabled', grupoId: button.dataset.group, disabled };
  } else if (action === 'confirm-group') {
    if (!confirm(`Confirmar o grupo ${button.dataset.group} como ativo após o período de teste?`)) return;
    path = '/groups'; payload = { action: 'confirm-group', grupoId: button.dataset.group };
  } else if (action === 'admin-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Desativar' : 'Ativar'} este administrador? Se for o administrador principal, a ação vale para todo o grupo.`)) return;
    path = '/users'; payload = { action: 'set-disabled', targetUid: button.dataset.uid, disabled };
  } else if (action === 'admin-delete') {
    if (!confirm(`Excluir o login administrativo ${button.dataset.email}? Os dados do grupo serão preservados.`)) return;
    path = '/users'; payload = { action: 'delete-user', targetUid: button.dataset.uid };
  } else if (action === 'client-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Desativar' : 'Ativar'} este cliente?`)) return;
    path = '/profiles'; payload = { action: 'set-profile-disabled', profileId: button.dataset.profile, disabled };
  } else if (action === 'client-delete') {
    if (!confirm(`Excluir o perfil ${button.dataset.name}? O histórico familiar será preservado para auditoria.`)) return;
    path = '/profiles'; payload = { action: 'delete-profile', profileId: button.dataset.profile };
  }
  if (!payload) return;
  busy = true; button.disabled = true;
  try {
    await window.rotinaMasterApi(path, { method: 'POST', body: JSON.stringify(payload) });
    window.rotinaLog?.('master.arvore_alterada', { acao: payload.action, grupoId: payload.grupoId || '' });
    alert('Alteração concluída.');
  } catch (error) {
    alert(error?.message || String(error));
  } finally {
    busy = false;
    await loadTree();
  }
}

window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) setTimeout(ensurePanel, 0);
});

const timer = setInterval(() => {
  if (window.rotinaMasterSession?.master === true) ensurePanel();
  if (document.getElementById('masterFamilyTree')) clearInterval(timer);
}, 300);
setTimeout(() => clearInterval(timer), 15000);
