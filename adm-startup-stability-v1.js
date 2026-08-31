import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import './runtime-build-info.js?v=20260831.2';
import './adm-justification-review.js?v=9';
import './adm-monitor-history-fix.js?v=4';
import './mobile-app-ui.js';

const VERSION = 12;
let flowStartedAt = performance.now();
const flowElapsed = () => Math.max(0, Math.round(performance.now() - flowStartedAt));
let authenticated = false;
let sessionReady = false;
let blankSince = 0;
let authGeneration = 0;

const log = (event, details = {}, level = 'info') => {
  try { window.rotinaLog?.(event, { ...details, startupStabilityVersion: VERSION }, level); } catch {}
};

async function atualizarServiceWorkerCedo() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js?v=79', { updateViaCache: 'none' });
    await reg.update().catch(() => {});
    log('startup.adm_sw_atualizacao_solicitada', { alvo: '79' });
  } catch (error) {
    log('startup.adm_sw_atualizacao_falhou', { mensagem: String(error?.message || error).slice(0, 140) }, 'warning');
  }
}

function shield() {
  let el = document.getElementById('admStartupShield');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'admStartupShield';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="adm-startup-card"><div class="adm-startup-spinner"></div><strong id="admStartupText">Carregando painel...</strong><small>Rotina Family ADM</small></div>';
  document.body.prepend(el);
  return el;
}

function show(text = 'Carregando painel...') {
  if (sessionReady && authenticated) { hide(); return; }
  const el = shield();
  const label = el.querySelector('#admStartupText');
  if (label) label.textContent = text;
  el.style.display = 'grid';
}

function hide() {
  const el = document.getElementById('admStartupShield');
  if (el) el.style.display = 'none';
}

function visible(el) {
  if (!el) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
}

function showLogin() {
  flowStartedAt = performance.now();
  sessionReady = false;
  authenticated = false;
  const access = document.getElementById('telaAcesso');
  const main = document.getElementById('sistemaPrincipal');
  if (main) main.style.display = 'none';
  if (access) access.style.display = 'block';
  hide();
}

function ensureSomethingVisible(reason = 'check') {
  const access = document.getElementById('telaAcesso');
  const main = document.getElementById('sistemaPrincipal');
  const accessVisible = visible(access);
  const mainVisible = visible(main);

  if (sessionReady && authenticated) {
    if (!mainVisible && main) {
      main.style.display = 'block';
      if (access) access.style.display = 'none';
      log('startup.adm_painel_restaurado_pos_sessao', { motivo: reason }, 'warning');
    }
    blankSince = 0;
    hide();
    return;
  }

  if (accessVisible || mainVisible) {
    blankSince = 0;
    if (mainVisible && authenticated) hide();
    if (accessVisible && !authenticated) hide();
    return;
  }

  if (!blankSince) blankSince = performance.now();
  show(authenticated ? 'Restaurando seu painel...' : 'Preparando acesso...');
  log('startup.adm_tela_protegida', { motivo: reason, autenticado: authenticated, sessaoPronta: sessionReady }, 'info');
}

function markSessionReady(event) {
  sessionReady = true;
  authenticated = true;
  const elapsed = flowElapsed();
  log('startup.adm_sessao_pronta', { ms: elapsed, grupoId: String(event?.detail?.grupoId || '').slice(0, 32) });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const main = document.getElementById('sistemaPrincipal');
    if (main) main.style.display = 'block';
    const access = document.getElementById('telaAcesso');
    if (access) access.style.display = 'none';
    hide();
  }));
}

function scheduleRecovery(auth, generation) {
  setTimeout(() => {
    if (generation !== authGeneration || sessionReady || !auth.currentUser) return;
    const main = document.getElementById('sistemaPrincipal');
    if (visible(main)) {
      hide();
      log('startup.adm_restauracao_pendente_interface_ativa', { ms: flowElapsed() }, 'info');
      return;
    }
    log('startup.adm_restauracao_lenta', { ms: flowElapsed() }, 'warning');
  }, 6500);

  setTimeout(() => {
    if (generation !== authGeneration || sessionReady || !auth.currentUser) return;
    const main = document.getElementById('sistemaPrincipal');
    if (visible(main)) { hide(); return; }
    log('startup.adm_restauracao_muito_lenta', { ms: flowElapsed() }, 'warning');
    show('Restaurando seu painel...');
  }, 14000);
}

function installAuthWatch(attempt = 0) {
  if (!getApps().length) {
    if (attempt < 120) setTimeout(() => installAuthWatch(attempt + 1), 100);
    else showLogin();
    return;
  }
  const auth = getAuth(getApp());
  onAuthStateChanged(auth, user => {
    authGeneration += 1;
    const generation = authGeneration;
    authenticated = !!user;
    if (user) flowStartedAt = performance.now();
    log('startup.adm_auth_resolvido', { autenticado: authenticated, ms: flowElapsed() });
    if (user) {
      if (!sessionReady && !visible(document.getElementById('sistemaPrincipal'))) show('Restaurando seu painel...');
      scheduleRecovery(auth, generation);
      setTimeout(() => ensureSomethingVisible('auth-com-usuario'), 400);
    } else {
      showLogin();
    }
  });
}

function boot() {
  shield();
  void atualizarServiceWorkerCedo();
  window.addEventListener('rotina-admin-session-ready', markSessionReady);
  window.addEventListener('error', event => {
    log('startup.adm_erro_javascript', { mensagem: String(event.message || 'erro').slice(0, 150), arquivo: String(event.filename || '').split('/').pop() || '' }, 'error');
    ensureSomethingVisible('erro-javascript');
  });
  window.addEventListener('unhandledrejection', event => {
    log('startup.adm_promessa_rejeitada', { mensagem: String(event.reason?.message || event.reason || 'erro').slice(0, 150) }, 'error');
    ensureSomethingVisible('promessa-rejeitada');
  });

  const observer = new MutationObserver(() => ensureSomethingVisible('mutacao-dom'));
  for (const id of ['telaAcesso', 'sistemaPrincipal']) {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  installAuthWatch();
  setTimeout(() => ensureSomethingVisible('boot-250ms'), 250);
  setTimeout(() => {
    if (!sessionReady && !authenticated && !visible(document.getElementById('sistemaPrincipal')) && !visible(document.getElementById('telaAcesso'))) showLogin();
  }, 4000);
  log('startup.adm_guard_pronto', { versao: VERSION });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
