const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let groups = [];
let busy = false;
let loaded = false;

function statusLabel(group) {
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
  const commercialBlocked = admin.bloqueadoComercialIndividual === true;
  const loginDisabled = admin.loginDesativado === true;

  let actions = '';
  if (isMaster) {
    actions = '<span style="font-size:11px;color:#6d28d9;font-weight:800">🔒 Master fora do comercial</span>';
  } else if (principal) {
    actions = '<span style="font-size:11px;color:#64748b">O administrador principal acompanha o bloqueio da família.</span>';
  } else {
    actions = `<div style="display:flex;gap:6px;flex-wrap:wrap">${actionButton(
      commercialBlocked ? 'Liberar admin' : 'Bloquear admin',
      'admin-commercial-toggle',
      `data-uid="${esc(admin.uid)}" data-disabled="${commercialBlocked}"`,
      'background:#fef3c7;color:#92400e'
    )}${actionButton('Excluir login','admin-delete',`data-uid="${esc(admin.uid)}" data-email="${esc(admin.email)}"`,'background:#fee2e2;color:#991b1b')}</div>`;
  }

  const states = [];
  states.push(principal ? 'administrador principal' : 'administrador adicional');
  states.push(commercialBlocked ? 'bloqueio comercial' : 'comercial liberado');
  if (loginDisabled) states.push('login desativado');
  if (isMaster) states.push('MASTER');

  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><div><strong>${principal ? '👑 ' : '🛡️ '}${esc(admin.email || 'Administrador')}</strong> ${isMaster ? '<span style="font-size:10px;font-weight:800;color:#6d28d9">MASTER</span>' : ''}</div><small>${esc(states.join(' · '))}</small><div style="margin-top:7px">${actions}</div></div>`;
}

function renderClient(client) {
  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><div><strong>👤 ${esc(client.nome || 'Cliente')}</strong></div><small>${client.desativado ? 'bloqueado individualmente' : 'ativo'} · ${esc(client.perfilId || '')}</small><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">${actionButton(client.desativado ? 'Liberar cliente' : 'Bloquear cliente','client-toggle',`data-profile="${esc(client.id)}" data-disabled="${client.desativado}"`,'background:#fef3c7;color:#92400e')}${actionButton('Excluir cliente','client-delete',`data-profile="${esc(client.id)}" data-name="${esc(client.nome)}"`,'background:#fee2e2;color:#991b1b')}</div></div>`;
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
    const note = group.contemMasterLegado
      ? '<div style="margin-top:5px;font-size:10px;color:#6d28d9;font-weight:700">🔐 Existe vínculo legado do Master neste CLI, mas o Master não participa do bloqueio comercial.</div>'
      : '';
    const groupActions = `<div style="display:flex;gap:6px;flex-wrap:wrap">${
      group.estado !== 'liberado' ? actionButton('Confirmar / Ativar','confirm-group',`data-group="${esc(group.grupoId)}"`,'background:#dcfce7;color:#166534') : ''
    }${actionButton(group.grupoBloqueado ? 'Liberar família' : 'Bloquear família','group-toggle',`data-group="${esc(group.grupoId)}" data-disabled="${group.grupoBloqueado}"`,'background:#fef3c7;color:#92400e')}${actionButton('Ver logs','group-logs',`data-group="${esc(group.grupoId)}"`,'background:#dbeafe;color:#1e3a8a')}</div>`;

    return `<section style="border:1px solid #dbe4ee;border-radius:14px;padding:12px;margin:10px 0;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><strong style="font-size:15px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong><div style="font-size:11px;color:#64748b;margin-top:3px">${esc(statusLabel(group))}${trial ? ` · ${esc(trial)}` : ''}</div>${note}</div>${groupActions}</div><div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Administradores</strong><div style="display:grid;gap:7px;margin-top:6px">${group.administradores?.map(admin => renderAdmin(admin, group)).join('') || '<small>Nenhum administrador.</small>'}</div></div><div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Clientes / integrantes</strong><div style="display:grid;gap:7px;margin-top:6px">${group.clientes?.map(renderClient).join('') || '<small>Nenhum cliente.</small>'}</div></div></section>`;
  }).join('');
}

async function loadTree({ force = false } = {}) {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  if (loaded && !force) return;
  busy = true;
  const target = document.getElementById('masterFamilyTreeBody');
  const button = document.getElementById('masterTreeRefresh');
  if (target) target.innerHTML = '<p>Consultando a árvore no Firebase…</p>';
  if (button) { button.disabled = true; button.textContent = 'Carregando…'; }
  try {
    groups = (await window.rotinaMasterApi('/tree')).groups || [];
    loaded = true;
    renderTree();
    window.dispatchEvent(new CustomEvent('rotina-master-tree-loaded', { detail: { groups } }));
  } catch (error) {
    if (target) target.innerHTML = `<div style="color:#b91c1c;padding:10px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7"><strong>Não foi possível carregar a árvore.</strong><br><small>${esc(error?.message || error)}</small></div>`;
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = loaded ? 'Atualizar árvore' : 'Carregar árvore'; }
  }
}

function ensurePanel() {
  const master = document.getElementById('adminMaster');
  if (!master || document.getElementById('masterFamilyTree')) return;
  const panel = document.createElement('div');
  panel.id = 'masterFamilyTree';
  panel.style.cssText = 'margin-top:14px;border:1px solid #d8e2ec;border-radius:16px;background:#fff;padding:14px';
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0;color:#173a5e">🌳 Árvore comercial das famílias</h3><p style="margin:5px 0;color:#64748b;font-size:12px">A árvore nunca é carregada no login. Toque no botão somente quando precisar administrar famílias.</p></div><button id="masterTreeRefresh" type="button" style="border:0;border-radius:9px;background:#173a5e;color:#fff;padding:9px 11px;font-weight:800">Carregar árvore</button></div><div id="masterFamilyTreeBody"><p style="color:#64748b">Pronta para consulta manual.</p></div>`;
  master.appendChild(panel);
  panel.querySelector('#masterTreeRefresh')?.addEventListener('click', () => loadTree({ force: true }));
  panel.addEventListener('click', handleTreeAction);
}

async function handleTreeAction(event) {
  const button = event.target.closest('button[data-tree-action]');
  if (!button || busy) return;
  const action = button.dataset.treeAction;
  let path = '';
  let payload = null;

  if (action === 'group-logs') {
    window.dispatchEvent(new CustomEvent('rotina-master-log-group', { detail: { grupoId: button.dataset.group || '' } }));
    document.getElementById('appMonitoringPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (action === 'group-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    const text = disabled
      ? `Bloquear toda a família ${button.dataset.group}?\n\nO Master continuará funcionando e nenhuma conta será desativada no Firebase Authentication.`
      : `Liberar a família ${button.dataset.group}?`;
    if (!confirm(text)) return;
    path = '/groups';
    payload = { action: 'set-group-blocked', grupoId: button.dataset.group, disabled };
  } else if (action === 'confirm-group') {
    if (!confirm(`Confirmar o grupo ${button.dataset.group} como ativo?`)) return;
    path = '/groups';
    payload = { action: 'confirm-group', grupoId: button.dataset.group };
  } else if (action === 'admin-commercial-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Bloquear' : 'Liberar'} apenas este administrador adicional?`)) return;
    path = '/admin-access';
    payload = { action: 'set-admin-commercial-block', targetUid: button.dataset.uid, disabled };
  } else if (action === 'admin-delete') {
    if (!confirm(`Excluir definitivamente o login administrativo ${button.dataset.email}?`)) return;
    path = '/users';
    payload = { action: 'delete-user', targetUid: button.dataset.uid };
  } else if (action === 'client-toggle') {
    const disabled = button.dataset.disabled !== 'true';
    if (!confirm(`${disabled ? 'Bloquear' : 'Liberar'} apenas este cliente?`)) return;
    path = '/profiles';
    payload = { action: 'set-profile-disabled', profileId: button.dataset.profile, disabled };
  } else if (action === 'client-delete') {
    if (!confirm(`Excluir o perfil ${button.dataset.name}?`)) return;
    path = '/profiles';
    payload = { action: 'delete-profile', profileId: button.dataset.profile };
  }

  if (!payload) return;
  busy = true;
  button.disabled = true;
  try {
    await window.rotinaMasterApi(path, { method: 'POST', body: JSON.stringify(payload) });
    window.rotinaLog?.('master.arvore_alterada', { acao: payload.action, grupoId: payload.grupoId || '' });
    alert('Alteração concluída.');
    loaded = false;
    await loadTree({ force: true });
  } catch (error) {
    alert(error?.message || String(error));
  } finally {
    busy = false;
    button.disabled = false;
  }
}

window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) queueMicrotask(ensurePanel);
});

if (window.rotinaMasterSession?.master === true) queueMicrotask(ensurePanel);
