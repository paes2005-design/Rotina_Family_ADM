const STORAGE_PREFIX = 'rotinaFamilyAdm.resgatesAvisados.';
const avisadosNaSessao = new Set();
const fila = [];
let unsubscribe = null;
let grupoEmEscuta = '';
let resgateAberto = null;

const esc = (valor = '') => String(valor).replace(/[&<>"']/g, caractere => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[caractere]));

function grupoAtual() {
  const grupo = (document.getElementById('displayCodigoCliente')?.textContent || '').trim();
  return grupo && grupo !== '--' && grupo !== 'CLI-Gen' ? grupo : '';
}

function chaveStorage(grupoId) {
  return `${STORAGE_PREFIX}${grupoId}`;
}

function carregarAvisados(grupoId) {
  try {
    const valor = JSON.parse(localStorage.getItem(chaveStorage(grupoId)) || '[]');
    return new Set(Array.isArray(valor) ? valor : []);
  } catch (_) {
    return new Set();
  }
}

function marcarAvisado(grupoId, id) {
  const vistos = carregarAvisados(grupoId);
  vistos.add(id);
  try {
    localStorage.setItem(chaveStorage(grupoId), JSON.stringify([...vistos].slice(-500)));
  } catch (_) {}
}

function garantirEstilo() {
  if (document.getElementById('reward-redemption-notification-style')) return;
  const style = document.createElement('style');
  style.id = 'reward-redemption-notification-style';
  style.textContent = `
    .resgate-alert-backdrop{position:fixed;inset:0;z-index:30000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:18px}
    .resgate-alert-card{width:min(92vw,460px);background:#fff;border-radius:20px;padding:22px;box-shadow:0 24px 70px rgba(15,23,42,.32);border:1px solid #dbe5ef}
    .resgate-alert-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:#fff2cc;font-size:31px;margin-bottom:12px}
    .resgate-alert-card h2{margin:0;color:#173a5e;font-size:22px}.resgate-alert-card p{color:#475569;line-height:1.5;margin:10px 0}
    .resgate-alert-detail{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;color:#1e293b;font-weight:700}
    .resgate-alert-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:17px}
    .resgate-alert-actions button{border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:10px;padding:10px 13px;font:inherit;font-weight:800;cursor:pointer}
    .resgate-alert-actions .primary{background:#315e8a;border-color:#315e8a;color:#fff}
    .resgate-notification-enable{background:#fff7df!important;border-color:#f2c94c!important;color:#765700!important;margin-right:auto}
    .resgate-tab-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:5px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:900;vertical-align:middle}
    @media(max-width:520px){.resgate-alert-card{padding:18px}.resgate-alert-actions button{flex:1}.resgate-notification-enable{flex-basis:100%!important}}
  `;
  document.head.appendChild(style);
}

function atualizarBadge(total) {
  const botao = [...document.querySelectorAll('.tab-btn')].find(el => /recompensas/i.test(el.textContent || ''));
  if (!botao) return;
  let badge = botao.querySelector('.resgate-tab-badge');
  if (!total) {
    badge?.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'resgate-tab-badge';
    badge.setAttribute('aria-label', `${total} resgate(s) pendente(s)`);
    botao.appendChild(badge);
  }
  badge.textContent = total > 99 ? '99+' : String(total);
}

function abrirRecompensas() {
  const botao = [...document.querySelectorAll('.tab-btn')].find(el => /recompensas/i.test(el.textContent || ''));
  if (botao) botao.click();
  else document.getElementById('recompensas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function mostrarNotificacaoSistema(resgate) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const titulo = 'Novo pedido de resgate';
  const corpo = `${resgate.perfilNome || 'Integrante'} pediu ${resgate.recompensaNome || 'uma recompensa'} (${Number(resgate.pontos) || 0} pts).`;
  try {
    const registro = await navigator.serviceWorker?.ready;
    if (registro?.showNotification) {
      await registro.showNotification(titulo, {
        body: corpo,
        icon: './icon-administrador-192.png',
        badge: './icon-administrador-192.png',
        tag: `resgate-${resgate.id}`,
        renotify: true,
        data: { url: './?abrir=resgates' }
      });
    } else {
      new Notification(titulo, { body: corpo, icon: './icon-administrador-192.png', tag: `resgate-${resgate.id}` });
    }
  } catch (erro) {
    console.warn('Notificação de resgate indisponível:', erro);
  }
}

function concluirAviso(abrir = false) {
  if (!resgateAberto) return;
  marcarAvisado(resgateAberto.grupoId, resgateAberto.id);
  avisadosNaSessao.add(resgateAberto.id);
  document.getElementById('resgateAlertModal')?.remove();
  resgateAberto = null;
  if (abrir) abrirRecompensas();
  queueMicrotask(mostrarProximo);
}

function mostrarProximo() {
  if (resgateAberto || !fila.length) return;
  garantirEstilo();
  resgateAberto = fila.shift();
  const resgate = resgateAberto;
  const modal = document.createElement('div');
  modal.id = 'resgateAlertModal';
  modal.className = 'resgate-alert-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'resgateAlertTitle');
  const permitirNotificacao = typeof window.ativarPushAdmin === 'function' || ('Notification' in window && Notification.permission === 'default');
  modal.innerHTML = `<section class="resgate-alert-card">
    <div class="resgate-alert-icon" aria-hidden="true">🎁</div>
    <h2 id="resgateAlertTitle">Novo pedido de resgate</h2>
    <p>Há um pedido aguardando sua decisão.</p>
    <div class="resgate-alert-detail"><strong>${esc(resgate.perfilNome || 'Integrante')}</strong> quer resgatar <strong>${esc(resgate.recompensaNome || 'uma recompensa')}</strong> por ${Number(resgate.pontos) || 0} pontos.</div>
    <div class="resgate-alert-actions">
      ${permitirNotificacao ? '<button type="button" id="resgateAtivarNotificacao" class="resgate-notification-enable">🔔 Ativar notificações</button>' : ''}
      <button type="button" id="resgateFecharAviso">Fechar</button>
      <button type="button" id="resgateVerPedido" class="primary">Ver pedido</button>
    </div>
  </section>`;
  document.body.appendChild(modal);
  document.getElementById('resgateFecharAviso').onclick = () => concluirAviso(false);
  document.getElementById('resgateVerPedido').onclick = () => concluirAviso(true);
  const ativar = document.getElementById('resgateAtivarNotificacao');
  if (ativar) ativar.onclick = async () => {
    const estado = typeof window.ativarPushAdmin === 'function'
      ? await window.ativarPushAdmin()
      : { optedIn: (await Notification.requestPermission()) === 'granted' };
    if (estado.optedIn) {
      ativar.remove();
      window.rotinaLog?.('push.adm_ativado', { assinatura: Boolean(estado.id) });
      await mostrarNotificacaoSistema(resgate);
    } else {
      ativar.textContent = 'Notificação não autorizada';
      ativar.disabled = true;
      window.rotinaLog?.('push.adm_nao_autorizado', {}, 'warning');
    }
  };
  mostrarNotificacaoSistema(resgate);
}

function processarLista(lista, grupoId) {
  const pendentes = (lista || [])
    .map(item => ({ grupoId, ...item }))
    .filter(resgate => String(resgate.status || 'Pendente').toLowerCase() === 'pendente')
    .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
  atualizarBadge(pendentes.length);
  const vistos = carregarAvisados(grupoId);
  for (const resgate of pendentes) {
    if (vistos.has(resgate.id) || avisadosNaSessao.has(resgate.id) || fila.some(item => item.id === resgate.id) || resgateAberto?.id === resgate.id) continue;
    avisadosNaSessao.add(resgate.id);
    fila.push(resgate);
  }
  mostrarProximo();
}

function iniciarEscuta() {
  const grupoId = grupoAtual();
  if (!grupoId) return;
  grupoEmEscuta = grupoId;
  const lista = window.rotinaAdmCacheSnapshot?.().resgates || [];
  processarLista(lista, grupoId);
}

function instalar() {
  garantirEstilo();
  iniciarEscuta();
  window.addEventListener('rotina-admin-session-ready',()=>setTimeout(iniciarEscuta,100));
  window.addEventListener('rotina-adm-cache-updated',iniciarEscuta);
  if (new URLSearchParams(location.search).get('abrir') === 'resgates') setTimeout(abrirRecompensas, 700);
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', instalar, { once: true });
else instalar();

