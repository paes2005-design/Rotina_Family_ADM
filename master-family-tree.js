const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
let groups = [];
let busy = false;
let loaded = false;

function actionButton(label, action, attrs = '', css = '') {
  return `<button type="button" data-tree-action="${action}" ${attrs} style="border:0;border-radius:8px;padding:8px 10px;font-weight:800;cursor:pointer;${css}">${esc(label)}</button>`;
}

function renderAdmin(admin) {
  const label = admin.principal ? '👑 Administrador principal' : '🛡️ Administrador';
  const master = admin.master ? ' · MASTER (fora do comercial)' : '';
  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><strong>${label}</strong><div>${esc(admin.email || 'Sem e-mail')}</div><small style="color:#64748b">${esc(master.replace(/^ · /,''))}</small></div>`;
}

function renderClient(client) {
  return `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><strong>👤 ${esc(client.nome || 'Cliente')}</strong><div><small style="color:#64748b">${esc(client.perfilId || client.id || '')}</small></div></div>`;
}

function renderTree() {
  const target = document.getElementById('masterFamilyTreeBody');
  if (!target) return;
  if (!groups.length) {
    target.innerHTML = '<p style="color:#64748b">Nenhum grupo familiar encontrado.</p>';
    return;
  }

  target.innerHTML = groups.map(group => {
    const blocked = group.grupoBloqueado === true;
    return `<section style="border:1px solid #dbe4ee;border-radius:14px;padding:12px;margin:10px 0;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <div><strong style="font-size:15px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong><div style="font-size:11px;color:${blocked ? '#991b1b' : '#166534'};font-weight:800;margin-top:3px">${blocked ? 'GRUPO BLOQUEADO' : 'GRUPO ATIVO'}</div></div>
        <div>${actionButton(blocked ? 'Liberar grupo' : 'Bloquear grupo','group-toggle',`data-group="${esc(group.grupoId)}" data-disabled="${blocked}"`,blocked?'background:#dcfce7;color:#166534':'background:#fee2e2;color:#991b1b')}</div>
      </div>
      <div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Administradores</strong><div style="display:grid;gap:7px;margin-top:6px">${group.administradores?.map(renderAdmin).join('') || '<small>Nenhum administrador.</small>'}</div></div>
      <div style="margin-top:10px"><strong style="font-size:12px;color:#475569">Clientes / integrantes</strong><div style="display:grid;gap:7px;margin-top:6px">${group.clientes?.map(renderClient).join('') || '<small>Nenhum cliente.</small>'}</div></div>
    </section>`;
  }).join('');
}

async function mutateGroup(groupId, disabled) {
  const group = String(groupId || '').trim().toUpperCase();
  if (!group) throw new Error('Informe o código do grupo.');
  return window.rotinaMasterApi('/groups', {
    method: 'POST',
    body: JSON.stringify({ action: 'set-group-blocked', grupoId: group, disabled: disabled === true })
  });
}

async function directGroupAction(disabled) {
  if (busy) return;
  const input = document.getElementById('masterCommercialGroupId');
  const group = String(input?.value || '').trim().toUpperCase();
  if (!group) return alert('Informe o código do grupo, por exemplo CLI-6148.');
  const verb = disabled ? 'bloquear' : 'liberar';
  if (!confirm(`Deseja ${verb} TODO o grupo ${group}?\n\nA regra será aplicada pelo código da família. O ADM Master fica fora do comercial.`)) return;
  busy = true;
  try {
    const result = await mutateGroup(group, disabled);
    alert(result?.message || `${group}: ${disabled ? 'bloqueio solicitado' : 'liberação solicitada'}.`);
    loaded = false;
  } catch (error) {
    alert(error?.message || String(error));
  } finally {
    busy = false;
  }
}

async function loadTree({ force = false } = {}) {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  if (loaded && !force) return;
  busy = true;
  const target = document.getElementById('masterFamilyTreeBody');
  const button = document.getElementById('masterTreeRefresh');
  if (target) target.innerHTML = '<p>Consultando grupos e integrantes…</p>';
  if (button) { button.disabled = true; button.textContent = 'Carregando…'; }
  try {
    groups = (await window.rotinaMasterApi('/tree')).groups || [];
    loaded = true;
    renderTree();
  } catch (error) {
    if (target) target.innerHTML = `<div style="color:#b91c1c;padding:10px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7"><strong>Não foi possível carregar a árvore.</strong><br><small>${esc(error?.message || error)}</small><br><small>O bloqueio direto por código continua disponível acima.</small></div>`;
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
  panel.innerHTML = `
    <div style="border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:12px;margin-bottom:14px">
      <h3 style="margin:0 0 5px;color:#78350f">🔒 Bloqueio comercial por grupo</h3>
      <p style="margin:0 0 9px;color:#92400e;font-size:12px">Digite o código da família. Esta ação não depende da árvore e não desativa contas no Firebase Authentication.</p>
      <input id="masterCommercialGroupId" placeholder="Ex.: CLI-6148" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d6d3d1;border-radius:9px;margin-bottom:8px;text-transform:uppercase">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="masterBlockGroup" type="button" style="border:0;border-radius:9px;background:#991b1b;color:#fff;padding:9px 12px;font-weight:800">Bloquear grupo</button>
        <button id="masterReleaseGroup" type="button" style="border:0;border-radius:9px;background:#166534;color:#fff;padding:9px 12px;font-weight:800">Liberar grupo</button>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><h3 style="margin:0;color:#173a5e">🌳 Integrantes por grupo</h3><p style="margin:5px 0;color:#64748b;font-size:12px">A árvore é apenas consulta visual. Não participa da decisão de bloqueio.</p></div><button id="masterTreeRefresh" type="button" style="border:0;border-radius:9px;background:#173a5e;color:#fff;padding:9px 11px;font-weight:800">Carregar árvore</button></div>
    <div id="masterFamilyTreeBody"><p style="color:#64748b">Pronta para consulta manual.</p></div>`;
  master.appendChild(panel);
  panel.querySelector('#masterBlockGroup')?.addEventListener('click', () => directGroupAction(true));
  panel.querySelector('#masterReleaseGroup')?.addEventListener('click', () => directGroupAction(false));
  panel.querySelector('#masterTreeRefresh')?.addEventListener('click', () => loadTree({ force: true }));
  panel.addEventListener('click', handleTreeAction);
}

async function handleTreeAction(event) {
  const button = event.target.closest('button[data-tree-action="group-toggle"]');
  if (!button || busy) return;
  const group = button.dataset.group || '';
  const disabled = button.dataset.disabled !== 'true';
  if (!confirm(`${disabled ? 'Bloquear' : 'Liberar'} TODO o grupo ${group}?`)) return;
  busy = true;
  button.disabled = true;
  try {
    const result = await mutateGroup(group, disabled);
    alert(result?.message || 'Alteração concluída.');
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
