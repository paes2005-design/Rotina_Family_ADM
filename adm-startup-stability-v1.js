import { getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const VERSION = 1;
const startedAt = performance.now();
let authenticated = false;
let sessionReady = false;
let blankSince = 0;

const log = (event, details = {}, level = 'info') => {
  try { window.rotinaLog?.(event, { ...details, startupStabilityVersion: VERSION }, level); } catch {}
};

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

function ensureSomethingVisible(reason = 'check') {
  const access = document.getElementById('telaAcesso');
  const main = document.getElementById('sistemaPrincipal');
  const accessVisible = visible(access);
  const mainVisible = visible(main);

  if (accessVisible || mainVisible) {
    blankSince = 0;
    if (mainVisible && (sessionReady || authenticated)) hide();
    if (accessVisible && !authenticated) hide();
    return;
  }

  if (!blankSince) blankSince = performance.now();
  show(authenticated ? 'Abrindo seu painel...' : 'Preparando acesso...');
  log('startup.adm_tela_protegida', { motivo: reason, autenticado: authenticated, sessaoPronta: sessionReady }, 'warning');
}

function markSessionReady(event) {
  sessionReady = true;
  const elapsed = Math.round(performance.now() - startedAt);
  log('startup.adm_sessao_pronta', { ms: elapsed, grupoId: String(event?.detail?.grupoId || '').slice(0, 32) });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const main = document.getElementById('sistemaPrincipal');
    if (main) main.style.display = 'block';
    const access = document.getElementById('telaAcesso');
    if (access) access.style.display = 'none';
    hide();
  }));
}

function installAuthWatch(attempt = 0) {
  if (!getApps().length) {
    if (attempt < 80) setTimeout(() => installAuthWatch(attempt + 1), 100);
    return;
  }
  onAuthStateChanged(getAuth(getApp()), user => {
    authenticated = !!user;
    log('startup.adm_auth_resolvido', { autenticado: authenticated, ms: Math.round(performance.now() - startedAt) });
    if (user) {
      if (!sessionReady) show('Abrindo seu painel...');
      setTimeout(() => ensureSomethingVisible('auth-com-usuario'), 80);
    } else {
      sessionReady = false;
      const access = document.getElementById('telaAcesso');
      const main = document.getElementById('sistemaPrincipal');
      if (main) main.style.display = 'none';
      if (access) access.style.display = 'block';
      hide();
    }
  });
}

function boot() {
  shield();
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
    if (authenticated && !sessionReady && !visible(document.getElementById('sistemaPrincipal'))) {
      show('Carregando os dados da família...');
      log('startup.adm_lento_3s', { ms: Math.round(performance.now() - startedAt) }, 'warning');
    }
  }, 3000);
  setTimeout(() => {
    if (authenticated && !visible(document.getElementById('sistemaPrincipal'))) {
      show('Ainda carregando. Sua sessão continua ativa...');
      log('startup.adm_lento_8s', { ms: Math.round(performance.now() - startedAt) }, 'warning');
    }
  }, 8000);
  log('startup.adm_guard_pronto', { versao: VERSION });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
