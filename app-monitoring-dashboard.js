import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const WORKER_MONITOR_URL = 'https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev/monitoramento';
let loading = false;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function currentGroup() {
  const value = String(document.getElementById('displayCodigoCliente')?.textContent || '').trim();
  return value && value !== '--' && value !== 'CLI-Gen' ? value : '';
}

function formatDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toLocaleString('pt-BR') : '—';
}

function detailsText(details = {}) {
  return Object.entries(details).map(([key, value]) => `${key}: ${value}`).join(' · ') || '—';
}

function ensurePanel() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard || document.getElementById('appMonitoringPanel')) return;
  const panel = document.createElement('section');
  panel.id = 'appMonitoringPanel';
  panel.innerHTML = `
    <style>
      .app-monitor-panel{margin-top:24px;padding:16px;border:1px solid #dbe5ef;border-radius:16px;background:#fff}
      .app-monitor-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .app-monitor-head h2{margin:0;color:#173a5e}.app-monitor-head p{margin:4px 0 0;color:#64748b;font-size:12px}
      .app-monitor-refresh{border:0;border-radius:10px;background:#315e8a;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer}
      .app-monitor-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
      .app-monitor-card{padding:12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0}.app-monitor-card small{display:block;color:#64748b}.app-monitor-card strong{display:block;margin-top:5px;color:#1e293b}
      .app-monitor-ok{color:#15803d!important}.app-monitor-bad{color:#b91c1c!important}
      .app-monitor-filters{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.app-monitor-filters select{padding:8px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}
      .app-monitor-note{margin:8px 0 14px;color:#64748b;font-size:12px;line-height:1.45}
      .app-monitor-table-wrap{overflow:auto;max-height:420px;border:1px solid #e2e8f0;border-radius:12px}
      .app-monitor-table{width:100%;border-collapse:collapse;min-width:680px}.app-monitor-table th,.app-monitor-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;font-size:12px;vertical-align:top}.app-monitor-table th{position:sticky;top:0;background:#f8fafc;color:#475569}
      .app-log-error{background:#fff1f2}.app-log-warning{background:#fffbeb}
    </style>
    <div class="app-monitor-panel">
      <div class="app-monitor-head"><div><h2>🩺 Monitoramento e logs</h2><p>Diagnóstico do Cliente, ADM, sincronização, alarmes e notificações.</p></div><button id="appMonitorRefresh" class="app-monitor-refresh" type="button">Atualizar</button></div>
      <div id="appMonitorCards" class="app-monitor-cards"><div class="app-monitor-card"><small>Status</small><strong>Carregando…</strong></div></div>
      <p class="app-monitor-note">No plano gratuito, o OneSignal confirma a entrega ao serviço push do navegador, mas não fornece a confirmação individual de recebimento no aparelho.</p>
      <div class="app-monitor-filters"><select id="appMonitorApp"><option value="">Todos os aplicativos</option><option value="cliente">Cliente</option><option value="adm">ADM</option></select><select id="appMonitorLevel"><option value="">Todos os níveis</option><option value="error">Erros</option><option value="warning">Avisos</option><option value="info">Informações</option></select></div>
      <div id="appMonitorLogs"></div>
    </div>`;
  dashboard.appendChild(panel);
  document.getElementById('appMonitorRefresh').onclick = loadMonitoring;
  document.getElementById('appMonitorApp').onchange = renderCachedLogs;
  document.getElementById('appMonitorLevel').onchange = renderCachedLogs;
}

let cachedLogs = [];

function renderCachedLogs() {
  const target = document.getElementById('appMonitorLogs');
  if (!target) return;
  const app = document.getElementById('appMonitorApp')?.value || '';
  const level = document.getElementById('appMonitorLevel')?.value || '';
  const logs = cachedLogs.filter(item => (!app || item.aplicativo === app) && (!level || item.nivel === level));
  if (!logs.length) {
    target.innerHTML = '<p>Nenhum log encontrado para o filtro selecionado.</p>';
    return;
  }
  target.innerHTML = `<div class="app-monitor-table-wrap"><table class="app-monitor-table"><thead><tr><th>Horário</th><th>App</th><th>Nível</th><th>Evento</th><th>Detalhes</th><th>Estado</th></tr></thead><tbody>${logs.map(item => `<tr class="app-log-${escapeHtml(item.nivel || 'info')}"><td>${escapeHtml(formatDate(item.clienteEm))}</td><td>${escapeHtml(item.aplicativo || '')}</td><td>${escapeHtml(item.nivel || 'info')}</td><td><strong>${escapeHtml(item.evento || '')}</strong></td><td>${escapeHtml(detailsText(item.detalhes))}</td><td>${item.online === false ? 'Offline' : 'Online'} · ${escapeHtml(item.visibilidade || '')}</td></tr>`).join('')}</tbody></table></div>`;
}

async function readLogs(groupId) {
  if (!getApps().length) return [];
  const snapshot = await getDocs(query(collection(getFirestore(getApp()), 'appLogs'), where('grupoId', '==', groupId)));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(b.clienteEm || '').localeCompare(String(a.clienteEm || '')))
    .slice(0, 100);
}

function renderWorkerStatus(monitor = {}) {
  const cards = document.getElementById('appMonitorCards');
  if (!cards) return;
  const run = monitor.lastRun || {};
  const activity = [...(monitor.recentCycles || [])].reverse().find(item => Number(item.processed) > 0) || run;
  const result = Object.entries(activity.states || {}).map(([state, total]) => `${state}: ${total}`).join(' · ') || 'Sem atividade recente';
  const healthy = monitor.status === 'SAUDAVEL';
  cards.innerHTML = `
    <div class="app-monitor-card"><small>Worker Cloudflare</small><strong class="${healthy ? 'app-monitor-ok' : 'app-monitor-bad'}">${escapeHtml(monitor.status || 'SEM DADOS')}</strong></div>
    <div class="app-monitor-card"><small>Último ciclo</small><strong>${escapeHtml(formatDate(monitor.lastRunAt))}</strong></div>
    <div class="app-monitor-card"><small>Última atividade</small><strong>${escapeHtml(formatDate(activity.em))}</strong></div>
    <div class="app-monitor-card"><small>Alarmes processados</small><strong>${Number(activity.alarms) || 0}</strong></div>
    <div class="app-monitor-card"><small>Recompensas processadas</small><strong>${Number(activity.rewards) || 0}</strong></div>
    <div class="app-monitor-card"><small>Auditorias OneSignal</small><strong>${Number(activity.audits) || 0}</strong></div>
    <div class="app-monitor-card"><small>Resultado da atividade</small><strong>${escapeHtml(result)}</strong></div>
    <div class="app-monitor-card"><small>Erros recentes do app</small><strong class="${cachedLogs.some(item => item.nivel === 'error') ? 'app-monitor-bad' : 'app-monitor-ok'}">${cachedLogs.filter(item => item.nivel === 'error').length}</strong></div>`;
}

async function loadMonitoring() {
  if (loading) return;
  ensurePanel();
  const groupId = currentGroup();
  if (!groupId) return;
  loading = true;
  const button = document.getElementById('appMonitorRefresh');
  if (button) button.disabled = true;
  try {
    const [monitorResponse, logs] = await Promise.all([
      fetch(WORKER_MONITOR_URL, { cache: 'no-store' }),
      readLogs(groupId)
    ]);
    if (!monitorResponse.ok) throw new Error(`Monitor HTTP ${monitorResponse.status}`);
    cachedLogs = logs;
    renderWorkerStatus(await monitorResponse.json());
    renderCachedLogs();
    window.rotinaLog?.('monitoramento.atualizado', { totalLogs: logs.length });
  } catch (error) {
    const cards = document.getElementById('appMonitorCards');
    if (cards) cards.innerHTML = `<div class="app-monitor-card"><small>Status</small><strong class="app-monitor-bad">Falha ao consultar monitor</strong></div>`;
    window.rotinaLog?.('monitoramento.erro', { mensagem: error.message }, 'error');
  } finally {
    loading = false;
    if (button) button.disabled = false;
  }
}

function install() {
  ensurePanel();
  window.addEventListener('rotina-admin-session-ready', () => setTimeout(loadMonitoring, 500));
  setInterval(() => {
    if (document.getElementById('dashboard')?.classList.contains('active')) loadMonitoring();
  }, 60_000);
  if (currentGroup()) loadMonitoring();
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', install, { once: true });
else install();
