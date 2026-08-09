const escUI=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Revisão de justificativas/pontos: módulo isolado, sem timer contínuo nem observer próprio.
import('./adm-justification-review.js').catch(e=>console.error('Revisão de justificativa:',e));
// Início antecipado: selo informativo azul e motivo em leitura, sem alterar pontos.
import('./adm-early-start-ui.js').catch(e=>console.error('Início antecipado ADM:',e));

// Interface móvel: no desktop não monta cartões, navegação ou observers.
const MOBILE_QUERY=window.matchMedia('(max-width: 780px)');
let uiIniciada=false;
let observersUI=[];

function iconeTarefa(nome=''){
  const n=String(nome).toLowerCase();
  const regras=[
    [/videogame|video game|jogar game|jogar jogo|game/, '🎮'],[/televis[aã]o|assistir tv|ver tv|tv/, '📺'],[/brincar|brincadeira|brinquedo/, '🧸'],[/celular|smartphone|telefone|mexer no celular|ficar no celular/, '📱'],[/computador|notebook|pc/, '💻'],[/cama|dormir|quarto/, '🛏️'],[/dente|escovar|higiene bucal/, '🪥'],[/banho|chuveiro/, '🚿'],[/leitura|ler|livro/, '📖'],[/mochila|material escolar/, '🎒'],[/estud|dever|lição|licao|prova|escola|ingl[eê]s/, '📚'],[/limp|varrer|arrumar|organizar|faxina/, '🧹'],[/louça|louca|prato|cozinha/, '🍽️'],[/roupa|uniforme|lavar roupa/, '👕'],[/lixo/, '🗑️'],[/pet|cachorro|gato|ração|racao/, '🐾'],[/rem[eé]dio|medica/, '💊'],[/exerc|treino|correr|caminhar|academia/, '🏃'],[/comer|almo|jantar|caf[eé]|lanche|aliment/, '🍴'],[/oração|oracao|rezar/, '🙏']
  ];
  return regras.find(([r])=>r.test(n))?.[1]||'✅';
}
window.iconeTarefaRotina=iconeTarefa;

function statusCard(txt=''){
  const t=String(txt).toLowerCase();
  if(t.includes('100%'))return['ok','100% · No prazo'];
  if(t.includes('75%'))return['partial','75% · atraso leve'];
  if(t.includes('50%'))return['partial','50% · atraso maior'];
  if(t.includes('atrasado')||/(^|[^\d])0%/.test(t))return['late','0% · Atrasado'];
  if(t.includes('prazo'))return['ok','No prazo'];
  if(t.includes('andamento'))return['progress','Em andamento'];
  return['pending',txt.trim()||'Pendente'];
}

function dadosMonitor(){
  const data=document.getElementById('filtroData')?.value||'';
  return [...document.querySelectorAll('#tbodyMonitor tr')]
    .filter(r=>r.children.length>=6&&!r.classList.contains('monitor-hidden'))
    .map(r=>{
      const c=r.children;
      const tarefa=c[1]?.querySelector('strong')?.textContent.trim()||c[1]?.textContent.trim()||'Tarefa';
      const icone=c[1]?.querySelector('.task-icon-cell')?.textContent.trim()||'';
      const horario=c[0]?.querySelector('strong')?.textContent.trim()||c[0]?.textContent.trim().split('|')[0]||'';
      const detalheOriginal=c[0]?.querySelector('div');
      const justificativa=detalheOriginal?.querySelector('.tooltip-justificativa .tooltip-texto')?.textContent.trim()||'';
      const early=c[4]?.querySelector('.early-start-adm-badge');
      let detalhes='';
      if(detalheOriginal){
        const clone=detalheOriginal.cloneNode(true);
        clone.querySelectorAll('.tooltip-justificativa,[title*="Justificativa"]').forEach(x=>x.remove());
        detalhes=(clone.textContent||'').replace(/\s+/g,' ').trim();
      }
      const status=c[4]?.querySelector('.badge')?.textContent.trim()||c[4]?.textContent.trim()||'Pendente';
      return{horario,tarefa,icone,usuario:c[2]?.textContent.trim()||'',dia:c[3]?.textContent.trim()||'',status,pontos:c[5]?.textContent.trim()||'',detalhes,justificativa,data,inicioAntecipado:!!early,motivoInicioAntecipado:early?.dataset.earlyReason||'',antecipacaoMin:early?.dataset.earlyMinutes||'',dataAntecipacao:early?.dataset.date||data};
    });
}

function garantirCardsMonitor(){
  const monitor=document.getElementById('monitor');if(!monitor)return null;
  let cards=document.getElementById('monitorNativeCards');if(cards)return cards;
  cards=document.createElement('div');cards.id='monitorNativeCards';cards.className='monitor-native-cards';
  const tabela=document.querySelector('#monitor .monitor-scroll-pro')||document.querySelector('#monitor .tabela-scroll');
  tabela?.insertAdjacentElement('afterend',cards);
  return cards;
}

function renderCardsMonitor(){
  if(!MOBILE_QUERY.matches)return;
  const cards=garantirCardsMonitor();if(!cards)return;
  const dados=dadosMonitor();
  const novoHtml=!dados.length?'<div class="monitor-native-empty">Nenhuma tarefa para os filtros selecionados.</div>':dados.map(x=>{
    const[cls,label]=statusCard(x.status);
    const flag=x.justificativa?`<button type="button" class="mon-just-flag" aria-label="Abrir justificativa de ${escUI(x.tarefa)}" title="Ver justificativa" data-task-name="${escUI(x.tarefa)}" data-user="${escUI(x.usuario)}" data-day="${escUI(x.dia)}" data-date="${escUI(x.data)}" data-schedule="${escUI(x.horario)}" data-justification="${escUI(x.justificativa)}">🚩</button>`:'';
    const early=x.inicioAntecipado?`<button type="button" class="early-start-adm-badge" title="Ver motivo do início antecipado" data-task-name="${escUI(x.tarefa)}" data-user="${escUI(x.usuario)}" data-date="${escUI(x.dataAntecipacao)}" data-schedule="${escUI(x.horario)}" data-early-reason="${escUI(x.motivoInicioAntecipado)}" data-early-minutes="${escUI(x.antecipacaoMin)}">🔵 Início antecipado</button>`:'';
    return`<article class="mon-app-card"><div class="mon-app-time">${escUI(x.horario.replace(' às ','–'))}</div><div class="mon-app-main"><span class="task-icon-badge" aria-hidden="true">${escUI(x.icone||iconeTarefa(x.tarefa))}</span><div class="mon-app-copy"><strong>${escUI(x.tarefa)}</strong><span>${escUI(x.usuario)}</span></div></div><div class="mon-app-side"><span class="mon-app-status ${cls}">${escUI(label)}</span>${early}<span class="mon-app-points">${escUI(x.pontos)}</span></div><div class="mon-app-meta"><span>${escUI(x.dia)}</span><span class="real-time">${escUI(x.detalhes)}</span>${flag}</div></article>`;
  }).join('');
  if(cards.innerHTML!==novoHtml)cards.innerHTML=novoHtml;
}
window.addEventListener('rotina-early-start-updated',()=>renderCardsMonitor());

function decorarGerenciar(){if(!MOBILE_QUERY.matches)return;document.querySelectorAll('.ger-task-card').forEach(card=>{if(card.querySelector('.task-icon-badge'))return;const nome=card.querySelector('.ger-main strong')?.textContent||'';const icon=document.createElement('span');icon.className='task-icon-badge';icon.setAttribute('aria-hidden','true');icon.textContent=iconeTarefa(nome);card.querySelector('.ger-main')?.before(icon);});}
const navItens=[{id:'cadastro',ico:'👤',label:'Cadastro'},{id:'monitor',ico:'📋',label:'Monitor'},{id:'gerenciar',ico:'🗂️',label:'Gerenciar'},{id:'dashboard',ico:'📊',label:'Dashboard'},{id:'recompensas',ico:'🎁',label:'Prêmios'}];
function clicarAba(nome){const btn=[...document.querySelectorAll('.tab-nav .tab-btn')].find(b=>(b.textContent||'').trim().toLowerCase()===nome.toLowerCase());btn?.click();}
function marcarNav(id){document.querySelectorAll('.mobile-bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===id));}
function montarBottomNav(){if(!MOBILE_QUERY.matches||document.getElementById('mobileBottomNav'))return;const nav=document.createElement('nav');nav.id='mobileBottomNav';nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','Navegação principal');nav.innerHTML=navItens.map(x=>`<button type="button" data-nav="${x.id}"><span class="nav-ico">${x.ico}</span><span class="nav-label">${x.label}</span></button>`).join('');document.body.appendChild(nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>{const id=b.dataset.nav;if(id==='gerenciar'){clicarAba('Cadastro');marcarNav('gerenciar');setTimeout(()=>document.getElementById('gerenciarMobilePro')?.scrollIntoView({behavior:'smooth',block:'start'}),100);return;}clicarAba(id==='recompensas'?'Recompensas':id[0].toUpperCase()+id.slice(1));marcarNav(id);window.scrollTo({top:0,behavior:'smooth'});});marcarNav(document.querySelector('.tab-content.active')?.id||'cadastro');document.querySelectorAll('.tab-content').forEach(el=>{const o=new MutationObserver(()=>{if(el.classList.contains('active')&&!document.querySelector('.mobile-bottom-nav button[data-nav="gerenciar"].active'))marcarNav(el.id);});o.observe(el,{attributes:true,attributeFilter:['class']});observersUI.push(o);});}
function desmontarUI(){observersUI.forEach(o=>o.disconnect());observersUI=[];document.getElementById('mobileBottomNav')?.remove();document.getElementById('monitorNativeCards')?.remove();uiIniciada=false;}
function iniciarUI(){if(!MOBILE_QUERY.matches||uiIniciada)return;uiIniciada=true;montarBottomNav();renderCardsMonitor();decorarGerenciar();const tb=document.getElementById('tbodyMonitor');if(tb){const o=new MutationObserver(()=>renderCardsMonitor());o.observe(tb,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});observersUI.push(o);}const cad=document.getElementById('cadastro');if(cad){const o=new MutationObserver(()=>decorarGerenciar());o.observe(cad,{childList:true,subtree:true});observersUI.push(o);}}
function aplicarModo(){if(MOBILE_QUERY.matches)iniciarUI();else desmontarUI();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicarModo,{once:true});else aplicarModo();
MOBILE_QUERY.addEventListener?.('change',aplicarModo);
