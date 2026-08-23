import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const WORKER_MONITOR_URL = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev/monitoramento';
const EXPORT_VERSION = 1;
let loading = false;
let masterEnabled = false;
let cachedLogs = [];
let knownGroups = [];
let selectedGroup = 'SISTEMA';

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function currentGroup() {
  return String(document.getElementById('appMonitorGroup')?.value || selectedGroup || 'SISTEMA').trim() || 'SISTEMA';
}

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

function detailsText(details = {}) {
  return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—';
}

function filteredLogs() {
  const app = document.getElementById('appMonitorApp')?.value || '';
  const level = document.getElementById('appMonitorLevel')?.value || '';
  return cachedLogs.filter(item => (!app || item.aplicativo === app) && (!level || item.nivel === level));
}

function exportFilters() {
  return {
    grupoId: currentGroup(),
    aplicativo: document.getElementById('appMonitorApp')?.value || 'todos',
    nivel: document.getElementById('appMonitorLevel')?.value || 'todos'
  };
}

function safeFilePart(value = '') {
  return String(value || 'SISTEMA').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'SISTEMA';
}

function exportFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `rotina-family-logs-${safeFilePart(currentGroup())}-${stamp}.json`;
}

function buildExportFile() {
  const logs = filteredLogs();
  const payload = {
    formato: 'Rotina Family - Exportacao de logs',
    versaoExportacao: EXPORT_VERSION,
    exportadoEm: new Date().toISOString(),
    filtros: exportFilters(),
    totalCarregado: cachedLogs.length,
    totalExportado: logs.length,
    logs
  };
  const text = JSON.stringify(payload, null, 2);
  return { logs, text, fileName: exportFileName(), blob: new Blob([text], { type: 'application/json;charset=utf-8' }) };
}

function setExportStatus(message = '', tone = 'info') {
  const el = document.getElementById('appMonitorExportStatus');
  if (!el) return;
  el.textContent = message;
  el.style.color = tone === 'error' ? '#b91c1c' : tone === 'ok' ? '#15803d' : '#64748b';
}

function updateExportButtons() {
  const hasLogs = filteredLogs().length > 0;
  for (const id of ['appMonitorSave', 'appMonitorShare']) {
    const button = document.getElementById(id);
    if (button) button.disabled = !hasLogs;
  }
}

function saveLogs({ quiet = false } = {}) {
  const pack = buildExportFile();
  if (!pack.logs.length) {
    setExportStatus('Nenhum log no filtro atual para salvar.', 'error');
    return false;
  }
  const url = URL.createObjectURL(pack.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = pack.fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  if (!quiet) setExportStatus(`Arquivo salvo: ${pack.fileName}`, 'ok');
  window.rotinaLog?.('monitoramento.logs_salvos', { grupoId: currentGroup(), total: pack.logs.length });
  return true;
}

async function shareLogs() {
  const pack = buildExportFile();
  if (!pack.logs.length) {
    setExportStatus('Nenhum log no filtro atual para compartilhar.', 'error');
    return;
  }
  const file = new File([pack.blob], pack.fileName, { type: 'application/json' });
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: `Logs Rotina Family - ${currentGroup()}`,
        text: `Logs do Rotina Family. Grupo: ${currentGroup()}. Registros: ${pack.logs.length}.`,
        files: [file]
      });
      setExportStatus('Logs compartilhados.', 'ok');
      window.rotinaLog?.('monitoramento.logs_compartilhados', { grupoId: currentGroup(), total: pack.logs.length });
      return;
    }
    saveLogs({ quiet: true });
    setExportStatus('Compartilhamento de arquivo indisponível. O log foi salvo para você enviar.', 'ok');
  } catch (error) {
    if (error?.name === 'AbortError') {
      setExportStatus('Compartilhamento cancelado.');
      return;
    }
    console.warn('Falha ao compartilhar logs:', error);
    saveLogs({ quiet: true });
    setExportStatus('Não foi possível abrir o compartilhamento. O log foi salvo no aparelho.', 'ok');
    window.rotinaLog?.('monitoramento.logs_compartilhar_fallback', { grupoId: currentGroup(), erro: String(error?.message || error) }, 'warning');
  }
}

function groupOptions() {
  const ids = [...new Set(knownGroups.map(group => String(group.grupoId || '').trim()).filter(Boolean))].sort();
  return `<option value="SISTEMA">Todos os grupos</option>${ids.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`).join('')}`;
}

function refreshGroupSelect() {
  const select = document.getElementById('appMonitorGroup');
  if (!select) return;
  const keep = selectedGroup || select.value || 'SISTEMA';
  select.innerHTML = groupOptions();
  select.value = [...select.options].some(option => option.value === keep) ? keep : 'SISTEMA';
  selectedGroup = select.value;
}

function ensurePanel() {
  const masterArea = document.getElementById('adminMaster');
  if (!masterArea || document.getElementById('appMonitoringPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'appMonitoringPanel';
  panel.innerHTML = `
    <style>
      .app-monitor-panel{margin-top:24px;padding:16px;border:1px solid #dbe5ef;border-radius:16px;background:#fff}.app-monitor-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.app-monitor-head h2{margin:0;color:#173a5e}.app-monitor-head p{margin:4px 0 0;color:#64748b;font-size:12px}.app-monitor-actions{display:flex;gap:8px;flex-wrap:wrap}.app-monitor-refresh,.app-monitor-export{border:0;border-radius:10px;background:#315e8a;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer}.app-monitor-export{background:#475569}.app-monitor-export.share{background:#15803d}.app-monitor-refresh:disabled,.app-monitor-export:disabled{opacity:.45;cursor:not-allowed}.app-monitor-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.app-monitor-card{padding:12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}.app-monitor-card small{display:block;color:#64748b}.app-monitor-card strong{display:block;margin-top:5px;color:#1e293b}.app-monitor-ok{color:#15803d!important}.app-monitor-bad{color:#b91c1c!important}.app-monitor-warn{color:#b45309!important}.app-monitor-filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.app-monitor-filters select{padding:8px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;max-width:100%}.app-monitor-note{margin:8px 0 14px;color:#64748b;font-size:12px;line-height:1.45}.app-monitor-export-status{min-height:18px;margin:-5px 0 10px;font-size:12px;font-weight:700}.app-monitor-table-wrap{overflow:auto;max-height:420px;border:1px solid #e2e8f0;border-radius:12px}.app-monitor-table{width:100%;border-collapse:collapse;min-width:680px}.app-monitor-table th,.app-monitor-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;font-size:12px;vertical-align:top}.app-monitor-table th{position:sticky;top:0;background:#f8fafc;color:#475569}.app-log-error{background:#fff1f2}.app-log-warning{background:#fffbeb}@media(max-width:780px){.app-monitor-head{align-items:stretch}.app-monitor-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.app-monitor-refresh{grid-column:1/-1}.app-monitor-export{width:100%;padding:11px 8px}.app-monitor-filters{display:grid;grid-template-columns:1fr}.app-monitor-filters select{width:100%}}
    </style>
    <div class="app-monitor-panel">
      <div class="app-monitor-head"><div><h2>🩺 Monitoramento e logs</h2><p>Logs e saúde do Worker são consultas independentes.</p></div><div class="app-monitor-actions"><button id="appMonitorRefresh" class="app-monitor-refresh" type="button">Carregar logs</button><button id="appMonitorSave" class="app-monitor-export" type="button" disabled>💾 Salvar logs</button><button id="appMonitorShare" class="app-monitor-export share" type="button" disabled>📤 Compartilhar logs</button></div></div>
      <div id="appMonitorCards" class="app-monitor-cards"><div class="app-monitor-card"><small>Status</small><strong>Pronto para consulta</strong></div></div>
      <p class="app-monitor-note">Carregue os logs, escolha o grupo e os filtros. Salvar/Compartilhar exporta exatamente os registros do filtro atual em um arquivo JSON.</p>
      <div class="app-monitor-filters">
        <select id="appMonitorGroup">${groupOptions()}</select>
        <select id="appMonitorApp"><option value="">Todos os aplicativos</option><option value="cliente">Cliente</option><option value="adm">ADM</option><option value="master">Master</option></select>
        <select id="appMonitorLevel"><option value="">Todos os níveis</option><option value="error">Erros</option><option value="warning">Avisos</option><option value="info">Informações</option></select>
      </div>
      <div id="appMonitorExportStatus" class="app-monitor-export-status" aria-live="polite"></div>
      <div id="appMonitorLogs"><p style="color:#64748b">Nenhum log consultado nesta sessão.</p></div>
    </div>`;
  masterArea.appendChild(panel);
  document.getElementById('appMonitorRefresh').onclick = loadMonitoring;
  document.getElementById('appMonitorSave').onclick = () => saveLogs();
  document.getElementById('appMonitorShare').onclick = () => shareLogs();
  document.getElementById('appMonitorGroup').onchange = event => { selectedGroup = event.target.value || 'SISTEMA'; cachedLogs = []; setExportStatus(''); renderCachedLogs(); };
  document.getElementById('appMonitorApp').onchange = () => { setExportStatus(''); renderCachedLogs(); };
  document.getElementById('appMonitorLevel').onchange = () => { setExportStatus(''); renderCachedLogs(); };
  refreshGroupSelect();
  updateExportButtons();
}

function renderCachedLogs() {
  const target = document.getElementById('appMonitorLogs');
  if (!target) return;
  const logs = filteredLogs();
  updateExportButtons();
  if (!logs.length) {
    target.innerHTML = '<p>Nenhum log encontrado para o filtro selecionado.</p>';
    return;
  }
  target.innerHTML = `<div class="app-monitor-table-wrap"><table class="app-monitor-table"><thead><tr><th>Horário</th><th>Grupo</th><th>App</th><th>Nível</th><th>Evento</th><th>Detalhes</th></tr></thead><tbody>${logs.map(item => `<tr class="app-log-${escapeHtml(item.nivel || 'info')}"><td>${escapeHtml(formatDate(item.clienteEm))}</td><td>${escapeHtml(item.grupoId || '—')}</td><td>${escapeHtml(item.aplicativo || '')}</td><td>${escapeHtml(item.nivel || 'info')}</td><td><strong>${escapeHtml(item.evento || '')}</strong></td><td>${escapeHtml(detailsText(item.detalhes))}</td></tr>`).join('')}</tbody></table></div>`;
}

async function readLogs(groupId) {
  if (!masterEnabled || !getApps().length || !getAuth(getApp()).currentUser || !window.rotinaMasterApi) return [];
  return (await window.rotinaMasterApi(`/logs?grupoId=${encodeURIComponent(groupId || 'SISTEMA')}`)).logs || [];
}

function renderStatus({ monitor = null, monitorError = null, logsError = null } = {}) {
  const cards = document.getElementById('appMonitorCards');
  if (!cards) return;
  const healthy = monitor?.status === 'SAUDAVEL';
  const workerLabel = monitor ? (monitor.status || 'SEM DADOS') : (monitorError ? 'STATUS INDISPONÍVEL' : 'SEM DADOS');
  const logLabel = logsError ? 'FALHA NA LEITURA' : `${cachedLogs.length}`;
  cards.innerHTML = `<div class="app-monitor-card"><small>Worker Cloudflare</small><strong class="${healthy ? 'app-monitor-ok' : monitorError ? 'app-monitor-warn' : 'app-monitor-bad'}">${escapeHtml(workerLabel)}</strong></div><div class="app-monitor-card"><small>Último ciclo</small><strong>${escapeHtml(formatDate(monitor?.lastRunAt))}</strong></div><div class="app-monitor-card"><small>Logs carregados</small><strong class="${logsError ? 'app-monitor-bad' : 'app-monitor-ok'}">${escapeHtml(logLabel)}</strong></div><div class="app-monitor-card"><small>Escopo</small><strong>${escapeHtml(currentGroup() === 'SISTEMA' ? 'Todos os grupos' : currentGroup())}</strong></div>`;
}

async function loadMonitoring() {
  if (loading || !masterEnabled) return;
  ensurePanel();
  const groupId = currentGroup();
  loading = true;
  setExportStatus('');
  const button = document.getElementById('appMonitorRefresh');
  if (button) { button.disabled = true; button.textContent = 'Carregando…'; }

  let monitor = null;
  let monitorError = null;
  let logsError = null;
  try {
    const [monitorResult, logsResult] = await Promise.allSettled([
      fetch(WORKER_MONITOR_URL, { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error(`Monitor HTTP ${response.status}`);
        return response.json();
      }),
      readLogs(groupId)
    ]);

    if (monitorResult.status === 'fulfilled') monitor = monitorResult.value;
    else monitorError = monitorResult.reason;

    if (logsResult.status === 'fulfilled') {
      cachedLogs = logsResult.value || [];
      renderCachedLogs();
      if (cachedLogs.length) setExportStatus(`${cachedLogs.length} logs disponíveis. Você já pode salvar ou compartilhar.`, 'ok');
    } else {
      cachedLogs = [];
      updateExportButtons();
      logsError = logsResult.reason;
      const target = document.getElementById('appMonitorLogs');
      if (target) target.innerHTML = `<div style="padding:10px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7;color:#b91c1c"><strong>Não foi possível ler os logs.</strong><br><small>${escapeHtml(logsError?.message || logsError)}</small></div>`;
    }

    renderStatus({ monitor, monitorError, logsError });
    window.rotinaLog?.('monitoramento.atualizado', { totalLogs: cachedLogs.length, grupoId, monitorOk: !monitorError, logsOk: !logsError });
  } finally {
    loading = false;
    if (button) { button.disabled = false; button.textContent = 'Carregar logs'; }
  }
}

function applyMasterSession(session) {
  masterEnabled = session?.master === true;
  if (!masterEnabled) {
    document.getElementById('appMonitoringPanel')?.remove();
    return;
  }
  ensurePanel();
}

function install() {
  window.addEventListener('rotina-admin-master-ready', event => applyMasterSession(event.detail));
  window.addEventListener('rotina-master-tree-loaded', event => {
    knownGroups = Array.isArray(event.detail?.groups) ? event.detail.groups : [];
    refreshGroupSelect();
  });
  window.addEventListener('rotina-master-log-group', event => {
    selectedGroup = String(event.detail?.grupoId || 'SISTEMA').trim() || 'SISTEMA';
    ensurePanel();
    refreshGroupSelect();
    loadMonitoring().catch(() => {});
  });
  if (window.rotinaMasterSession) applyMasterSession(window.rotinaMasterSession);
}

window.rotinaSalvarLogsMaster = saveLogs;
window.rotinaCompartilharLogsMaster = shareLogs;

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', install, { once: true });
else install();
