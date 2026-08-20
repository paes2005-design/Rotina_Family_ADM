const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy = false;
let currentGroup = null;

function renderGroup(group) {
  const target = document.getElementById('masterFamilyTreeBody');
  if (!target) return;
  if (!group) {
    target.innerHTML = '<p style="color:#64748b">Nenhum grupo consultado.</p>';
    return;
  }
  const owner = group.administradorPrincipal;
  const admins = (group.administradores || []).filter(admin => !admin.principal);
  const clients = group.clientes || [];
  const blocked = group.grupoBloqueado === true;

  target.innerHTML = `
    <section style="border:1px solid #dbe4ee;border-radius:14px;padding:12px;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <strong style="font-size:17px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong>
          <div style="font-size:11px;color:${blocked ? '#991b1b' : '#166534'};font-weight:800;margin-top:3px">${blocked ? 'GRUPO BLOQUEADO' : 'GRUPO ATIVO'}</div>
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff">
        <strong style="color:#1e3a8a">👑 Administrador principal</strong>
        <div style="font-size:15px;margin-top:4px">${owner?.email ? esc(owner.email) : '<span style="color:#991b1b">Não identificado</span>'}</div>
      </div>
      <div style="margin-top:12px"><strong style="font-size:12px;color:#475569">Administradores convidados</strong><div style="display:grid;gap:7px;margin-top:6px">${admins.length ? admins.map(a => `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">🛡️ ${esc(a.email || 'Sem e-mail')}${a.master ? ' <small style="color:#6d28d9;font-weight:800">MASTER — fora do comercial</small>' : ''}</div>`).join('') : '<small>Nenhum administrador convidado.</small>'}</div></div>
      <div style="margin-top:12px"><strong style="font-size:12px;color:#475569">Clientes / integrantes</strong><div style="display:grid;gap:7px;margin-top:6px">${clients.length ? clients.map(c => `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">👤 <strong>${esc(c.nome || 'Integrante')}</strong><div><small style="color:#64748b">${esc(c.perfilId || c.id || '')}</small></div></div>`).join('') : '<small>Nenhum cliente.</small>'}</div></div>
    </section>`;
}

async function consultGroup() {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  const input = document.getElementById('masterCommercialGroupId');
  const groupId = String(input?.value || '').trim().toUpperCase();
  if (!groupId) return alert('Informe o código do grupo, por exemplo CLI-6148.');
  busy = true;
  const target = document.getElementById('masterFamilyTreeBody');
  const button = document.getElementById('masterConsultGroup');
  if (target) target.innerHTML = '<p>Consultando apenas este grupo…</p>';
  if (button) { button.disabled = true; button.textContent = 'Consultando…'; }
  try {
    const result = await window.rotinaMasterApi(`/group?grupoId=${encodeURIComponent(groupId)}`);
    currentGroup = result.grupo || null;
    renderGroup(currentGroup);
  } catch (error) {
    currentGroup = null;
    if (target) target.innerHTML = `<div style="color:#b91c1c;padding:10px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7"><strong>Não foi possível consultar ${esc(groupId)}.</strong><br><small>${esc(error?.message || error)}</small></div>`;
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = 'Consultar grupo'; }
  }
}

async function mutateGroup(disabled) {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  const groupId = String(document.getElementById('masterCommercialGroupId')?.value || '').trim().toUpperCase();
  if (!groupId) return alert('Informe o código do grupo.');
  const ownerEmail = currentGroup?.grupoId === groupId ? currentGroup?.administradorPrincipal?.email : '';
  const ownerText = ownerEmail ? `\nAdministrador principal: ${ownerEmail}` : '\nAdministrador principal ainda não consultado.';
  if (!confirm(`${disabled ? 'Bloquear' : 'Liberar'} TODO o grupo ${groupId}?${ownerText}\n\nO ADM Master fica fora do comercial.`)) return;
  busy = true;
  try {
    const result = await window.rotinaMasterApi('/groups', {
      method: 'POST',
      body: JSON.stringify({ action: 'set-group-blocked', grupoId: groupId, disabled: disabled === true })
    });
    alert(result?.message || `${groupId}: ${disabled ? 'bloqueio solicitado' : 'liberação solicitada'}.`);
    await consultGroup();
  } catch (error) {
    alert(error?.message || String(error));
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
  panel.innerHTML = `
    <div style="border:1px solid #fde68a;background:#fffbeb;border-radius:12px;padding:12px;margin-bottom:14px">
      <h3 style="margin:0 0 5px;color:#78350f">🔒 Grupo comercial</h3>
      <p style="margin:0 0 9px;color:#92400e;font-size:12px">Consulte pelo código da família. O responsável comercial é somente o administrador principal (proprietário), nunca o convidado.</p>
      <input id="masterCommercialGroupId" placeholder="Ex.: CLI-6148" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d6d3d1;border-radius:9px;margin-bottom:8px;text-transform:uppercase">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="masterConsultGroup" type="button" style="border:0;border-radius:9px;background:#173a5e;color:#fff;padding:9px 12px;font-weight:800">Consultar grupo</button>
        <button id="masterBlockGroup" type="button" style="border:0;border-radius:9px;background:#991b1b;color:#fff;padding:9px 12px;font-weight:800">Bloquear grupo</button>
        <button id="masterReleaseGroup" type="button" style="border:0;border-radius:9px;background:#166534;color:#fff;padding:9px 12px;font-weight:800">Liberar grupo</button>
      </div>
    </div>
    <div><h3 style="margin:0;color:#173a5e">🌳 Integrantes do grupo</h3><p style="margin:5px 0 10px;color:#64748b;font-size:12px">Mostra somente o grupo consultado, o proprietário, convidados e clientes.</p></div>
    <div id="masterFamilyTreeBody"><p style="color:#64748b">Informe um grupo acima e toque em “Consultar grupo”.</p></div>`;
  master.appendChild(panel);
  panel.querySelector('#masterConsultGroup')?.addEventListener('click', consultGroup);
  panel.querySelector('#masterBlockGroup')?.addEventListener('click', () => mutateGroup(true));
  panel.querySelector('#masterReleaseGroup')?.addEventListener('click', () => mutateGroup(false));
}

window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) queueMicrotask(ensurePanel);
});
if (window.rotinaMasterSession?.master === true) queueMicrotask(ensurePanel);
