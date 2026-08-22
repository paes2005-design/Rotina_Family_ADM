const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COMMERCIAL_EXEMPT_GROUPS = new Set(['CLI-4071']);
let busy = false;
let currentGroup = null;
let allGroups = [];

function normalizeGroupId(value = '') {
  return String(value || '').trim().toUpperCase();
}

function isCommercialExemptGroup(groupId = '') {
  return COMMERCIAL_EXEMPT_GROUPS.has(normalizeGroupId(groupId));
}

function selectedGroupRecord() {
  const id = String(document.getElementById('masterCommercialGroupSelect')?.value || '').trim();
  return allGroups.find(group => group.grupoId === id) || null;
}

function stateInfo(group = {}) {
  if (isCommercialExemptGroup(group.grupoId)) return { state: 'isento', label: 'ISENTO DO COMERCIAL', color: '#1e3a8a', bg: '#dbeafe' };
  const state = String(group.estado || (group.grupoBloqueado ? 'bloqueado' : 'liberado-legado'));
  const map = {
    bloqueado: ['BLOQUEADO MANUALMENTE', '#991b1b', '#fee2e2'],
    'teste-expirado': ['TESTE DE 15 DIAS EXPIRADO', '#991b1b', '#fee2e2'],
    teste: ['EM TESTE — 15 DIAS', '#92400e', '#fef3c7'],
    confirmado: ['LIBERADO DEFINITIVAMENTE', '#166534', '#dcfce7'],
    'liberado-legado': ['GRUPO LEGADO — AGUARDANDO INÍCIO DO TESTE', '#475569', '#f1f5f9'],
    indisponivel: ['STATUS INDISPONÍVEL', '#991b1b', '#fee2e2']
  };
  return { state, label: (map[state] || map['liberado-legado'])[0], color: (map[state] || map['liberado-legado'])[1], bg: (map[state] || map['liberado-legado'])[2] };
}

function updateCommercialActions(groupId = '') {
  const exempt = isCommercialExemptGroup(groupId);
  for (const id of ['masterBlockGroup', 'masterReleaseGroup', 'masterConfirmGroup']) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = exempt;
    button.style.opacity = exempt ? '.45' : '1';
    button.style.cursor = exempt ? 'not-allowed' : 'pointer';
    button.title = exempt ? 'CLI-4071 é grupo-base e está fora do pacote comercial.' : '';
  }
}

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

function renderGroup(group) {
  const target = document.getElementById('masterFamilyTreeBody');
  if (!target) return;
  if (!group) {
    target.innerHTML = '<p style="color:#64748b">Escolha um grupo familiar acima.</p>';
    updateCommercialActions('');
    return;
  }
  const owner = group.administradorPrincipal;
  const admins = (group.administradores || []).filter(admin => !admin.principal && !admin.master);
  const clients = group.clientes || [];
  const info = stateInfo(group);
  const exempt = isCommercialExemptGroup(group.grupoId);
  const trial = !exempt && (group.trialInicioEm || group.trialFimEm)
    ? `<div style="margin-top:8px;font-size:11px;color:#64748b"><strong>Teste comercial:</strong> início ${esc(formatDate(group.trialInicioEm))} · vencimento ${esc(formatDate(group.trialFimEm))}</div>`
    : '';
  const exemptNote = exempt
    ? '<div style="margin-top:8px;padding:9px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff;color:#1e3a8a;font-size:11px"><strong>Grupo-base:</strong> o CLI-4071 não participa de teste de 15 dias nem de bloqueio comercial.</div>'
    : '';
  const warning = (group.avisos || []).length
    ? `<div style="margin-top:10px;padding:9px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7;color:#991b1b;font-size:11px">${esc((group.avisos || []).join(' · '))}</div>`
    : '';

  target.innerHTML = `
    <section style="border:1px solid #dbe4ee;border-radius:14px;padding:12px;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
        <div>
          <strong style="font-size:17px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong>
          <div style="display:inline-block;margin-left:6px;padding:3px 8px;border-radius:999px;background:${info.bg};color:${info.color};font-size:10px;font-weight:900">${esc(info.label)}</div>
          ${trial}
          ${exemptNote}
          ${!exempt && group.confirmadoEm ? `<div style="margin-top:4px;font-size:11px;color:#166534">Confirmado pelo Master em ${esc(formatDate(group.confirmadoEm))}</div>` : ''}
        </div>
      </div>
      <div style="margin-top:12px;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff">
        <strong style="color:#1e3a8a">👑 Administrador principal</strong>
        <div style="font-size:15px;margin-top:4px">${owner?.email ? esc(owner.email) : '<span style="color:#991b1b">Não identificado</span>'}</div>
      </div>
      <div style="margin-top:12px"><strong style="font-size:12px;color:#475569">Administradores convidados</strong><div style="display:grid;gap:7px;margin-top:6px">${admins.length ? admins.map(a => `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">🛡️ ${esc(a.email || 'Sem e-mail')}</div>`).join('') : '<small>Nenhum administrador convidado.</small>'}</div></div>
      <div style="margin-top:12px"><strong style="font-size:12px;color:#475569">Clientes / integrantes</strong><div style="display:grid;gap:7px;margin-top:6px">${clients.length ? clients.map(c => `<div style="padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">👤 <strong>${esc(c.nome || 'Integrante')}</strong><div><small style="color:#64748b">${esc(c.perfilId || c.id || '')}</small></div></div>`).join('') : '<small>Nenhum cliente.</small>'}</div></div>
      ${warning}
    </section>`;
  updateCommercialActions(group.grupoId);
}

function renderGroupOptions() {
  const select = document.getElementById('masterCommercialGroupSelect');
  if (!select) return;
  const search = String(document.getElementById('masterCommercialGroupSearch')?.value || '').trim().toLowerCase();
  const keep = select.value;
  const filtered = allGroups.filter(group => !search || String(group.grupoId || '').toLowerCase().includes(search) || String(group.proprietarioEmail || '').toLowerCase().includes(search));
  select.innerHTML = '<option value="">Escolha um grupo familiar</option>' + filtered.map(group => `<option value="${esc(group.grupoId)}">${esc(group.grupoId)} — ${esc(group.proprietarioEmail || 'proprietário sem e-mail')}${isCommercialExemptGroup(group.grupoId) ? ' — ISENTO' : ''}</option>`).join('');
  if (filtered.some(group => group.grupoId === keep)) select.value = keep;
  updateCommercialActions(select.value);
}

async function loadGroups({ force = false } = {}) {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  const status = document.getElementById('masterCommercialGroupsStatus');
  busy = true;
  if (status) status.textContent = 'Carregando grupos familiares…';
  try {
    const result = await window.rotinaMasterApi('/groups' + (force ? '?refresh=1' : ''));
    allGroups = Array.isArray(result.groups) ? result.groups : [];
    renderGroupOptions();
    if (status) status.textContent = `${allGroups.length} grupo(s) encontrado(s).${result.aviso ? ' ' + result.aviso : ''}`;
    window.dispatchEvent(new CustomEvent('rotina-master-tree-loaded', { detail: { groups: allGroups } }));
  } catch (error) {
    if (status) status.textContent = `Não foi possível carregar os grupos: ${error?.message || error}`;
  } finally {
    busy = false;
  }
}

async function consultGroup() {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  const selected = selectedGroupRecord();
  const groupId = normalizeGroupId(selected?.grupoId || document.getElementById('masterCommercialGroupSelect')?.value || '');
  if (!groupId) return alert('Escolha um grupo familiar.');
  updateCommercialActions(groupId);
  busy = true;
  const target = document.getElementById('masterFamilyTreeBody');
  const button = document.getElementById('masterConsultGroup');
  if (target) target.innerHTML = '<p>Consultando somente este grupo…</p>';
  if (button) { button.disabled = true; button.textContent = 'Abrindo…'; }
  try {
    const ownerEmail = selected?.proprietarioEmail || '';
    const result = await window.rotinaMasterApi(`/group?grupoId=${encodeURIComponent(groupId)}&ownerEmail=${encodeURIComponent(ownerEmail)}`);
    currentGroup = result.grupo || null;
    renderGroup(currentGroup);
  } catch (error) {
    currentGroup = null;
    if (target) target.innerHTML = `<div style="color:#b91c1c;padding:10px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7"><strong>Não foi possível consultar ${esc(groupId)}.</strong><br><small>${esc(error?.message || error)}</small></div>`;
  } finally {
    busy = false;
    if (button) { button.disabled = false; button.textContent = 'Abrir grupo'; }
  }
}

async function mutateGroup(action, disabled = false) {
  if (busy || typeof window.rotinaMasterApi !== 'function') return;
  const groupId = normalizeGroupId(document.getElementById('masterCommercialGroupSelect')?.value || '');
  if (!groupId) return alert('Escolha um grupo familiar.');
  if (isCommercialExemptGroup(groupId)) return alert(`${groupId} é o grupo-base e está fora do pacote comercial. Nenhuma alteração comercial será feita.`);
  const selected = selectedGroupRecord();
  const ownerEmail = currentGroup?.grupoId === groupId ? currentGroup?.administradorPrincipal?.email : selected?.proprietarioEmail || '';
  const ownerText = ownerEmail ? `\nAdministrador principal: ${ownerEmail}` : '';
  let question = '';
  if (action === 'confirm-group') question = `Confirmar e LIBERAR DEFINITIVAMENTE o grupo ${groupId}?${ownerText}\n\nO teste de 15 dias deixa de valer para esse grupo.`;
  else if (disabled) question = `Bloquear manualmente TODO o grupo ${groupId}?${ownerText}\n\nO ADM Master continua fora do comercial.`;
  else question = `Retirar o bloqueio manual do grupo ${groupId}?${ownerText}\n\nSe o teste de 15 dias estiver expirado, ainda será necessário confirmar o grupo para liberar o acesso.`;
  if (!confirm(question)) return;

  busy = true;
  try {
    const result = await window.rotinaMasterApi('/groups', {
      method: 'POST',
      body: JSON.stringify(action === 'confirm-group'
        ? { action, grupoId: groupId }
        : { action: 'set-group-blocked', grupoId: groupId, disabled: disabled === true })
    });
    alert(action === 'confirm-group'
      ? `${groupId} confirmado e liberado definitivamente.`
      : `${groupId}: ${disabled ? 'bloqueio manual aplicado' : 'bloqueio manual retirado'}.`);
    await loadGroups({ force: true });
    const select = document.getElementById('masterCommercialGroupSelect');
    if (select) select.value = groupId;
    await consultGroup();
    window.rotinaLog?.('master.comercial_grupo_alterado', { grupoId: groupId, action, estado: result?.estado || '' });
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
      <h3 style="margin:0 0 5px;color:#78350f">🔒 Grupos e controle comercial</h3>
      <p style="margin:0 0 9px;color:#92400e;font-size:12px">Cada família é controlada pelo CLI. O proprietário é o administrador principal. O ADM Master nunca participa do bloqueio comercial. O CLI-4071 é o grupo-base e permanece isento.</p>
      <input id="masterCommercialGroupSearch" placeholder="Pesquisar por CLI ou e-mail do proprietário" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d6d3d1;border-radius:9px;margin-bottom:7px">
      <select id="masterCommercialGroupSelect" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #d6d3d1;border-radius:9px;margin-bottom:8px;background:#fff"><option value="">Carregando grupos…</option></select>
      <div id="masterCommercialGroupsStatus" style="font-size:11px;color:#64748b;margin-bottom:8px">Aguardando grupos.</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        <button id="masterRefreshGroups" type="button" style="border:0;border-radius:9px;background:#475569;color:#fff;padding:9px 11px;font-weight:800">Atualizar grupos</button>
        <button id="masterConsultGroup" type="button" style="border:0;border-radius:9px;background:#173a5e;color:#fff;padding:9px 11px;font-weight:800">Abrir grupo</button>
        <button id="masterBlockGroup" type="button" style="border:0;border-radius:9px;background:#991b1b;color:#fff;padding:9px 11px;font-weight:800">Bloquear grupo</button>
        <button id="masterReleaseGroup" type="button" style="border:0;border-radius:9px;background:#0f766e;color:#fff;padding:9px 11px;font-weight:800">Retirar bloqueio manual</button>
        <button id="masterConfirmGroup" type="button" style="border:0;border-radius:9px;background:#166534;color:#fff;padding:9px 11px;font-weight:800">Confirmar / liberar definitivo</button>
      </div>
      <p style="margin:9px 0 0;color:#64748b;font-size:10px">Teste: 15 dias contados do cadastro original do grupo. Sem confirmação, o acesso expira. “Retirar bloqueio manual” não confirma um teste expirado; use “Confirmar / liberar definitivo”.</p>
    </div>
    <div><h3 style="margin:0;color:#173a5e">🌳 Integrantes do grupo</h3><p style="margin:5px 0 10px;color:#64748b;font-size:12px">A consulta detalhada é feita somente para o grupo selecionado.</p></div>
    <div id="masterFamilyTreeBody"><p style="color:#64748b">Escolha um grupo acima.</p></div>`;
  master.appendChild(panel);
  panel.querySelector('#masterCommercialGroupSearch')?.addEventListener('input', renderGroupOptions);
  panel.querySelector('#masterCommercialGroupSelect')?.addEventListener('change', () => {
    updateCommercialActions(document.getElementById('masterCommercialGroupSelect')?.value || '');
    if (selectedGroupRecord()) consultGroup();
  });
  panel.querySelector('#masterRefreshGroups')?.addEventListener('click', () => loadGroups({ force: true }));
  panel.querySelector('#masterConsultGroup')?.addEventListener('click', consultGroup);
  panel.querySelector('#masterBlockGroup')?.addEventListener('click', () => mutateGroup('set-group-blocked', true));
  panel.querySelector('#masterReleaseGroup')?.addEventListener('click', () => mutateGroup('set-group-blocked', false));
  panel.querySelector('#masterConfirmGroup')?.addEventListener('click', () => mutateGroup('confirm-group'));
  loadGroups().catch(() => {});
}

window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) queueMicrotask(ensurePanel);
});
if (window.rotinaMasterSession?.master === true) queueMicrotask(ensurePanel);
