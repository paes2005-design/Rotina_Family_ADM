const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COMMERCIAL_EXEMPT_GROUPS = new Set(['CLI-4071']);

window.rotinaMasterIntegratedTree = true;

let allGroups = [];
let groupsLoading = null;
let openGroupId = '';
let groupDetails = new Map();
let groupLoading = new Map();
let groupVersions = new Map();
let observer = null;
let decorateTimer = null;

function normalizeGroupId(value = '') {
  return String(value || '').trim().toUpperCase();
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isCommercialExemptGroup(groupId = '') {
  return COMMERCIAL_EXEMPT_GROUPS.has(normalizeGroupId(groupId));
}

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

function stateInfo(group = {}) {
  if (isCommercialExemptGroup(group.grupoId)) {
    return { state: 'isento', label: 'ISENTO DO COMERCIAL', color: '#1e3a8a', bg: '#dbeafe' };
  }
  const state = String(group.estado || (group.grupoBloqueado ? 'bloqueado' : 'liberado-legado'));
  const map = {
    bloqueado: ['BLOQUEADO MANUALMENTE', '#991b1b', '#fee2e2'],
    'teste-expirado': ['TESTE DE 15 DIAS EXPIRADO', '#991b1b', '#fee2e2'],
    teste: ['EM TESTE — 15 DIAS', '#92400e', '#fef3c7'],
    confirmado: ['LIBERADO DEFINITIVAMENTE', '#166534', '#dcfce7'],
    'liberado-legado': ['GRUPO LEGADO — AGUARDANDO INÍCIO DO TESTE', '#475569', '#f1f5f9'],
    indisponivel: ['STATUS INDISPONÍVEL', '#991b1b', '#fee2e2']
  };
  const selected = map[state] || map['liberado-legado'];
  return { state, label: selected[0], color: selected[1], bg: selected[2] };
}

function extractGroupId(text = '') {
  return normalizeGroupId(String(text || '').match(/CLI-\d+/i)?.[0] || '');
}

function ownerGroupFor(email = '', groupId = '', uid = '') {
  const wantedEmail = normalizeEmail(email);
  const wantedGroup = normalizeGroupId(groupId);
  const wantedUid = String(uid || '').trim();
  return allGroups.find(group => {
    const sameGroup = !wantedGroup || normalizeGroupId(group.grupoId) === wantedGroup;
    if (!sameGroup) return false;
    const groupUid = String(group.proprietarioUid || '').trim();
    const groupEmail = normalizeEmail(group.proprietarioEmail);
    const sameUid = Boolean(wantedUid && groupUid && groupUid === wantedUid);
    const sameEmail = Boolean(wantedEmail && groupEmail && groupEmail === wantedEmail);
    return sameUid || sameEmail;
  }) || null;
}

function groupRecord(groupId = '') {
  const id = normalizeGroupId(groupId);
  return allGroups.find(group => normalizeGroupId(group.grupoId) === id) || null;
}

function ensureStyles() {
  if (document.getElementById('masterIntegratedTreeStyles')) return;
  const style = document.createElement('style');
  style.id = 'masterIntegratedTreeStyles';
  style.textContent = `
    #adminMaster .master-owner-toggle,#adminMaster .master-group-toggle{border:0;background:transparent;padding:0;color:#173a5e;font:inherit;font-weight:800;cursor:pointer;text-align:left;display:inline-flex;align-items:center;gap:5px;max-width:100%}
    #adminMaster .master-owner-toggle:hover,#adminMaster .master-group-toggle:hover{text-decoration:underline}
    #adminMaster .master-owner-toggle .master-tree-arrow,#adminMaster .master-group-toggle .master-tree-arrow{font-size:10px;color:#64748b}
    #adminMaster .master-principal-badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:999px;background:#eff6ff;color:#1e3a8a;font-size:9px;font-weight:900;vertical-align:middle}
    #adminMaster .master-integrated-tree-row td{padding:0 10px 12px!important;background:#fff}
    #adminMaster .master-integrated-tree-mobile{margin-top:10px}
    #adminMaster .master-tree-shell{border:1px solid #dbe4ee;border-radius:14px;padding:12px;background:#f8fafc;box-shadow:0 4px 14px rgba(15,23,42,.04)}
    #adminMaster .master-tree-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap}
    #adminMaster .master-tree-status{display:inline-block;margin-left:6px;padding:3px 8px;border-radius:999px;font-size:9px;font-weight:900}
    #adminMaster .master-tree-principal{margin-top:12px;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:#eff6ff}
    #adminMaster .master-tree-list{display:grid;gap:7px;margin-top:7px}
    #adminMaster .master-tree-node{padding:9px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}
    #adminMaster .master-tree-branch{margin-left:15px;padding-left:12px;border-left:2px solid #dbe4ee}
    #adminMaster .master-tree-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    #adminMaster .master-tree-actions button{border:0;border-radius:9px;padding:9px 11px;font-weight:800;cursor:pointer}
    #adminMaster .master-tree-actions .block{background:#991b1b;color:#fff}
    #adminMaster .master-tree-actions .release{background:#0f766e;color:#fff}
    #adminMaster .master-tree-actions .confirm{background:#166534;color:#fff}
    #adminMaster .master-tree-actions button:disabled{opacity:.45;cursor:not-allowed}
    #adminMaster .master-tree-loading{padding:12px;border:1px dashed #cbd5e1;border-radius:12px;color:#64748b;background:#f8fafc}
    #adminMaster .master-tree-error{padding:12px;border:1px solid #fecaca;border-radius:12px;color:#991b1b;background:#fff7f7}
    @media(max-width:780px){#adminMaster .master-owner-toggle{font-size:13px;overflow-wrap:anywhere}#adminMaster .master-group-toggle{font-size:11px}#adminMaster .master-tree-actions{display:grid;grid-template-columns:1fr 1fr}#adminMaster .master-tree-actions button{min-height:40px;font-size:10px}#adminMaster .master-tree-actions .confirm{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}

function treeHtml(group) {
  if (!group) return '<div class="master-tree-loading">Carregando grupo…</div>';
  const owner = group.administradorPrincipal || {};
  const admins = (group.administradores || []).filter(admin => !admin.principal && !admin.master);
  const clients = group.clientes || [];
  const info = stateInfo(group);
  const exempt = isCommercialExemptGroup(group.grupoId);
  const trial = !exempt && (group.trialInicioEm || group.trialFimEm)
    ? `<div style="margin-top:6px;font-size:10px;color:#64748b"><strong>Teste comercial:</strong> início ${esc(formatDate(group.trialInicioEm))} · vencimento ${esc(formatDate(group.trialFimEm))}</div>`
    : '';
  const confirmed = !exempt && group.confirmadoEm
    ? `<div style="margin-top:4px;font-size:10px;color:#166534">Confirmado pelo Master em ${esc(formatDate(group.confirmadoEm))}</div>`
    : '';
  const exemptNote = exempt
    ? '<div style="margin-top:8px;padding:8px;border:1px solid #bfdbfe;border-radius:9px;background:#eff6ff;color:#1e3a8a;font-size:10px"><strong>Grupo-base:</strong> este grupo está fora do bloqueio comercial.</div>'
    : '';
  const warning = (group.avisos || []).length
    ? `<div style="margin-top:10px;padding:8px;border:1px solid #fecaca;border-radius:9px;background:#fff7f7;color:#991b1b;font-size:10px">${esc((group.avisos || []).join(' · '))}</div>`
    : '';

  return `
    <section class="master-tree-shell">
      <div class="master-tree-head">
        <div>
          <strong style="font-size:16px;color:#173a5e">🌳 ${esc(group.grupoId)}</strong>
          <span class="master-tree-status" style="background:${info.bg};color:${info.color}">${esc(info.label)}</span>
          ${trial}${confirmed}${exemptNote}
        </div>
      </div>
      <div class="master-tree-principal">
        <strong style="color:#1e3a8a">👑 Administrador principal</strong>
        <div style="font-size:14px;margin-top:4px;overflow-wrap:anywhere">${owner.email ? esc(owner.email) : '<span style="color:#991b1b">Não identificado</span>'}</div>
      </div>
      <div class="master-tree-branch">
        <div style="margin-top:11px"><strong style="font-size:11px;color:#475569">Administradores convidados</strong><div class="master-tree-list">${admins.length ? admins.map(a => `<div class="master-tree-node">🛡️ ${esc(a.email || 'Sem e-mail')}</div>`).join('') : '<small>Nenhum administrador convidado.</small>'}</div></div>
        <div style="margin-top:11px"><strong style="font-size:11px;color:#475569">Integrantes do grupo</strong><div class="master-tree-list">${clients.length ? clients.map(c => `<div class="master-tree-node">👤 <strong>${esc(c.nome || 'Integrante')}</strong>${c.perfilId || c.id ? `<div><small style="color:#64748b">${esc(c.perfilId || c.id || '')}</small></div>` : ''}</div>`).join('') : '<small>Nenhum integrante cadastrado.</small>'}</div></div>
      </div>
      ${warning}
      <div class="master-tree-actions">
        <button class="block" data-master-group-action="block" data-group-id="${esc(group.grupoId)}" ${exempt ? 'disabled' : ''}>Bloquear grupo</button>
        <button class="release" data-master-group-action="release" data-group-id="${esc(group.grupoId)}" ${exempt ? 'disabled' : ''}>Retirar bloqueio</button>
        <button class="confirm" data-master-group-action="confirm" data-group-id="${esc(group.grupoId)}" ${exempt ? 'disabled' : ''}>Confirmar / liberar definitivo</button>
      </div>
    </section>`;
}

function displayHtml(groupId) {
  const id = normalizeGroupId(groupId);
  if (groupLoading.has(id) && !groupDetails.has(id)) return '<div class="master-tree-loading">Carregando integrantes do grupo…</div>';
  const cached = groupDetails.get(id);
  if (cached?.error) return `<div class="master-tree-error"><strong>Não foi possível abrir ${esc(id)}.</strong><br><small>${esc(cached.error)}</small></div>`;
  return treeHtml(cached?.group || null);
}

function refreshDisplays() {
  document.querySelectorAll('#adminMaster [data-master-group-detail]').forEach(box => {
    const groupId = normalizeGroupId(box.dataset.masterGroupDetail || '');
    const open = groupId && groupId === openGroupId;
    box.style.display = open ? 'block' : 'none';
    if (open) {
      const key = `${groupId}:${groupVersions.get(groupId) || 0}:${groupLoading.has(groupId) ? 'loading' : 'ready'}`;
      if (box.dataset.renderKey !== key) {
        box.innerHTML = displayHtml(groupId);
        box.dataset.renderKey = key;
      }
    }
  });
  document.querySelectorAll('#adminMaster [data-master-group-toggle]').forEach(button => {
    const groupId = normalizeGroupId(button.dataset.groupId || '');
    const arrow = button.querySelector('.master-tree-arrow');
    if (arrow) arrow.textContent = groupId === openGroupId ? '▼' : '▶';
    button.setAttribute('aria-expanded', groupId === openGroupId ? 'true' : 'false');
  });
}

function principalButton(email, groupId, kind = 'owner') {
  const icon = kind === 'group' ? '🌳' : '👑';
  const text = kind === 'group' ? groupId : email;
  const cls = kind === 'group' ? 'master-group-toggle' : 'master-owner-toggle';
  return `<button type="button" class="${cls}" data-master-group-toggle="1" data-group-id="${esc(groupId)}" aria-expanded="false">${icon} ${esc(text)} <span class="master-tree-arrow">▶</span></button>`;
}

function decorateDesktop() {
  const rows = [...document.querySelectorAll('#adminMaster .master-table tbody tr')].filter(row => !row.classList.contains('master-integrated-tree-row'));
  for (const row of rows) {
    if (row.dataset.masterTreeDecorated === '1') continue;
    const cells = row.querySelectorAll(':scope > td');
    if (cells.length < 2) continue;
    const email = normalizeEmail(cells[0].querySelector('strong')?.textContent || cells[0].textContent || '');
    const groupId = extractGroupId(cells[1].textContent || '');
    const uid = row.querySelector('button[data-uid]')?.dataset.uid || '';
    const ownerGroup = ownerGroupFor(email, groupId, uid);
    if (!ownerGroup) continue;
    const id = normalizeGroupId(ownerGroup.grupoId);
    row.dataset.masterTreeDecorated = '1';
    const emailStrong = cells[0].querySelector('strong');
    if (emailStrong) emailStrong.innerHTML = `${principalButton(email || ownerGroup.proprietarioEmail, id, 'owner')}<span class="master-principal-badge">PRINCIPAL</span>`;
    const small = cells[1].querySelector('small')?.outerHTML || '';
    cells[1].innerHTML = `${principalButton(ownerGroup.proprietarioEmail, id, 'group')}<br>${small}`;
    const detailRow = document.createElement('tr');
    detailRow.className = 'master-integrated-tree-row';
    detailRow.innerHTML = `<td colspan="6"><div data-master-group-detail="${esc(id)}" style="display:none"></div></td>`;
    row.after(detailRow);
  }
}

function decorateMobile() {
  const cards = [...document.querySelectorAll('#adminMaster .master-mobile-list .master-user-card')];
  for (const card of cards) {
    if (card.dataset.masterTreeDecorated === '1') continue;
    const emailEl = card.querySelector('.master-user-email');
    const fields = card.querySelectorAll('.master-user-field');
    const groupStrong = fields[0]?.querySelector('strong');
    const email = normalizeEmail(emailEl?.textContent || '');
    const groupId = extractGroupId(groupStrong?.textContent || fields[0]?.textContent || '');
    const uid = card.querySelector('button[data-uid]')?.dataset.uid || '';
    const ownerGroup = ownerGroupFor(email, groupId, uid);
    if (!ownerGroup) continue;
    const id = normalizeGroupId(ownerGroup.grupoId);
    card.dataset.masterTreeDecorated = '1';
    if (emailEl) emailEl.innerHTML = `${principalButton(email || ownerGroup.proprietarioEmail, id, 'owner')}<span class="master-principal-badge">PRINCIPAL</span>`;
    if (groupStrong) groupStrong.innerHTML = principalButton(ownerGroup.proprietarioEmail, id, 'group');
    const actions = card.querySelector('.master-actions');
    const detail = document.createElement('div');
    detail.className = 'master-integrated-tree-mobile';
    detail.dataset.masterGroupDetail = id;
    detail.style.display = 'none';
    if (actions) actions.before(detail); else card.appendChild(detail);
  }
}

function decorateRecords() {
  const legacy = document.getElementById('masterFamilyTree');
  if (legacy) legacy.remove();
  if (!document.getElementById('masterUsers') || !allGroups.length) return;
  ensureStyles();
  decorateDesktop();
  decorateMobile();
  refreshDisplays();
}

function scheduleDecorate() {
  clearTimeout(decorateTimer);
  decorateTimer = setTimeout(() => decorateRecords(), 60);
}

async function loadGroups({ force = false } = {}) {
  if (typeof window.rotinaMasterApi !== 'function' || window.rotinaMasterSession?.master !== true) return [];
  if (groupsLoading) return groupsLoading;
  if (!force && allGroups.length) {
    decorateRecords();
    return allGroups;
  }
  groupsLoading = (async () => {
    try {
      const result = await window.rotinaMasterApi('/groups' + (force ? '?refresh=1' : ''));
      allGroups = Array.isArray(result.groups) ? result.groups : [];
      decorateRecords();
      window.dispatchEvent(new CustomEvent('rotina-master-tree-loaded', { detail: { groups: allGroups, integrated: true } }));
      return allGroups;
    } catch (error) {
      console.warn('Não foi possível carregar o índice de grupos no ADM Master.', error);
      return allGroups;
    } finally {
      groupsLoading = null;
    }
  })();
  return groupsLoading;
}

async function loadGroupDetail(groupId) {
  const id = normalizeGroupId(groupId);
  if (!id || typeof window.rotinaMasterApi !== 'function') return null;
  if (groupLoading.has(id)) return groupLoading.get(id);
  const request = (async () => {
    try {
      const result = await window.rotinaMasterApi(`/group?grupoId=${encodeURIComponent(id)}`);
      const group = result.grupo || null;
      groupDetails.set(id, { group, error: '' });
      groupVersions.set(id, (groupVersions.get(id) || 0) + 1);
      return group;
    } catch (error) {
      groupDetails.set(id, { group: null, error: String(error?.message || error) });
      groupVersions.set(id, (groupVersions.get(id) || 0) + 1);
      return null;
    } finally {
      groupLoading.delete(id);
      refreshDisplays();
    }
  })();
  groupLoading.set(id, request);
  groupVersions.set(id, (groupVersions.get(id) || 0) + 1);
  refreshDisplays();
  return request;
}

async function toggleGroup(groupId) {
  const id = normalizeGroupId(groupId);
  if (!id) return;
  if (openGroupId === id) {
    openGroupId = '';
    refreshDisplays();
    return;
  }
  openGroupId = id;
  refreshDisplays();
  if (!groupDetails.has(id)) await loadGroupDetail(id);
}

async function mutateGroup(groupId, action) {
  const id = normalizeGroupId(groupId);
  if (!id || typeof window.rotinaMasterApi !== 'function') return;
  if (isCommercialExemptGroup(id)) {
    alert(`${id} é o grupo-base e está fora do pacote comercial. Nenhuma alteração comercial será feita.`);
    return;
  }
  const detail = groupDetails.get(id)?.group || null;
  const ownerEmail = detail?.administradorPrincipal?.email || groupRecord(id)?.proprietarioEmail || '';
  const ownerText = ownerEmail ? `\nAdministrador principal: ${ownerEmail}` : '';
  let question = '';
  if (action === 'confirm') question = `Confirmar e LIBERAR DEFINITIVAMENTE o grupo ${id}?${ownerText}\n\nO teste de 15 dias deixa de valer para esse grupo.`;
  else if (action === 'block') question = `Bloquear manualmente TODO o grupo ${id}?${ownerText}\n\nO ADM Master continua fora do comercial.`;
  else question = `Retirar o bloqueio manual do grupo ${id}?${ownerText}\n\nSe o teste de 15 dias estiver expirado, ainda será necessário confirmar o grupo para liberar o acesso.`;
  if (!confirm(question)) return;

  try {
    const result = await window.rotinaMasterApi('/groups', {
      method: 'POST',
      body: JSON.stringify(action === 'confirm'
        ? { action: 'confirm-group', grupoId: id }
        : { action: 'set-group-blocked', grupoId: id, disabled: action === 'block' })
    });
    alert(action === 'confirm'
      ? `${id} confirmado e liberado definitivamente.`
      : `${id}: ${action === 'block' ? 'bloqueio manual aplicado' : 'bloqueio manual retirado'}.`);
    groupDetails.delete(id);
    await loadGroups({ force: true });
    await loadGroupDetail(id);
    window.rotinaLog?.('master.comercial_grupo_alterado', { grupoId: id, action, estado: result?.estado || '' });
  } catch (error) {
    alert(error?.message || String(error));
  }
}

function handleIntegratedClick(event) {
  const toggle = event.target.closest('[data-master-group-toggle]');
  if (toggle) {
    event.preventDefault();
    toggleGroup(toggle.dataset.groupId || '');
    return;
  }
  const actionButton = event.target.closest('[data-master-group-action]');
  if (actionButton) {
    event.preventDefault();
    mutateGroup(actionButton.dataset.groupId || '', actionButton.dataset.masterGroupAction || '');
  }
}

function startIntegratedTree() {
  ensureStyles();
  document.getElementById('masterFamilyTree')?.remove();
  document.removeEventListener('click', handleIntegratedClick);
  document.addEventListener('click', handleIntegratedClick);
  if (!observer) {
    observer = new MutationObserver(() => {
      document.getElementById('masterFamilyTree')?.remove();
      scheduleDecorate();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  loadGroups().catch(() => {});
  scheduleDecorate();
}

window.addEventListener('rotina-admin-master-ready', event => {
  if (event.detail?.master === true) startIntegratedTree();
  else {
    openGroupId = '';
    allGroups = [];
    groupDetails.clear();
    groupVersions.clear();
  }
});

window.addEventListener('online', () => {
  if (window.rotinaMasterSession?.master === true) loadGroups({ force: true }).catch(() => {});
});

if (window.rotinaMasterSession?.master === true) startIntegratedTree();
else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => {
  if (window.rotinaMasterSession?.master === true) startIntegratedTree();
}, { once: true });
