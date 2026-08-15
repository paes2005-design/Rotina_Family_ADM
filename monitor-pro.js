const MONITOR_LABELS=['Horário','Tarefa','Integrante','Dia','Status','Pontos'];
const estadoMonitor={usuarios:new Set(),tarefas:new Set(),status:new Set(),data:'',periodo:'dia'};
let monitorPreparado=false;
let atualizarMonitorOriginal=null;

if(!document.querySelector('link[data-manage-pro]')){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href='./manage-pro.css';
  link.dataset.managePro='1';
  document.head.appendChild(link);
}
import('./manage-pro.js').catch(e=>console.error('Gerenciamento responsivo:',e));
import('./rewards-admin-ui-v2.js').catch(e=>console.error('Recompensas administrativas:',e));

const escM=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function abrirRegraTolerancia(){
  document.getElementById('monitorToleranceRuleModal')?.remove();
  const m=document.createElement('div');
  m.id='monitorToleranceRuleModal';
  m.style.cssText='position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px';
  m.innerHTML=`<div style="width:min(92vw,480px);background:#fff;border-radius:20px;padding:20px;box-shadow:0 18px 55px rgba(0,0,0,.25);color:#1f2937"><h2 style="margin:0 0 10px">⏱️ Regra da tolerância</h2><p style="line-height:1.45;margin:0 0 12px">A tolerância configurada é toda a janela de <strong>100%</strong>. Quando esse saldo chega a <strong>00:00</strong>, a pontuação cai imediatamente para <strong>75%</strong>.</p><div style="display:grid;gap:8px"><div style="padding:10px 12px;border-radius:12px;background:#fef9c3">🟡 <strong>75%</strong> por mais <strong>12,5%</strong> da tolerância original.</div><div style="padding:10px 12px;border-radius:12px;background:#ffedd5">🟠 <strong>50%</strong> por mais <strong>12,5%</strong>.</div><div style="padding:10px 12px;border-radius:12px;background:#fee2e2">🔴 Depois de <strong>25% adicional no total</strong>, a pontuação passa para <strong>0%</strong>.</div></div><p style="margin:12px 0 0;line-height:1.45"><strong>Exemplo:</strong> tolerância de 10 min → 100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; 0% em 12:30.</p><p style="margin:8px 0 0;color:#64748b;font-size:13px;line-height:1.4">O saldo é único: atraso no início + atraso no término. Início antecipado não consome tolerância.</p><div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" id="monitorToleranceRuleClose" class="monitor-filter-btn">Entendi</button></div></div>`;
  document.body.appendChild(m);
  const fechar=()=>m.remove();
  m.querySelector('#monitorToleranceRuleClose').onclick=fechar;
  m.addEventListener('click',ev=>{if(ev.target===m)fechar();});
}
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const dataLocal=v=>{const [a,m,d]=String(v||hojeISO()).split('-').map(Number);return new Date(a,m-1,d,12,0,0,0)};
const isoLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function faixaPeriodo(data,periodo=estadoMonitor.periodo){
  const ref=dataLocal(data),ini=new Date(ref),fim=new Date(ref);
  if(periodo==='semana'){ini.setDate(ini.getDate()-ini.getDay());fim.setTime(ini.getTime());fim.setDate(fim.getDate()+6);}
  if(periodo==='mes'){ini.setDate(1);fim.setFullYear(ref.getFullYear(),ref.getMonth()+1,0);}
  if(periodo==='ano'){ini.setFullYear(ref.getFullYear(),0,1);fim.setFullYear(ref.getFullYear(),11,31);}
  return {ini,fim};
}
function legendaPeriodo(data=estadoMonitor.data||hojeISO(),periodo=estadoMonitor.periodo){
  const {ini,fim}=faixaPeriodo(data,periodo);
  if(periodo==='dia')return ini.toLocaleDateString('pt-BR');
  if(periodo==='mes')return ini.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  if(periodo==='ano')return String(ini.getFullYear());
  return `${ini.toLocaleDateString('pt-BR')} a ${fim.toLocaleDateString('pt-BR')}`;
}
function moverPeriodo(data,direcao){
  const d=dataLocal(data),p=estadoMonitor.periodo;
  if(p==='ano')d.setFullYear(d.getFullYear()+direcao);
  else if(p==='mes')d.setMonth(d.getMonth()+direcao);
  else d.setDate(d.getDate()+(p==='semana'?7:1)*direcao);
  return isoLocal(d);
}
function atualizarNavegacaoPeriodo(){
  const label=document.getElementById('monitorPeriodReference');if(label)label.textContent=legendaPeriodo();
  const atual=document.querySelector('#monitorPeriodNavPro [data-current]');if(atual)atual.textContent=estadoMonitor.periodo==='dia'?'Hoje':'Período atual';
}

function normalizarStatus(texto=''){
  if(texto.includes('Atrasado')) return 'Atrasado';
  if(texto.includes('Prazo')) return 'No Prazo';
  if(texto.toLowerCase().includes('andamento')) return 'Em andamento';
  return 'Pendente';
}

function valoresMarcados(containerId){
  return new Set([...document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`)].map(x=>x.value));
}

function renderChecklist(id,valores,selecionados){
  const el=document.getElementById(id); if(!el)return;
  if(!valores.length){el.innerHTML='<div style="padding:7px;color:#94a3b8;font-size:12px">Sem opções</div>';return;}
  el.innerHTML=valores.map(v=>`<label class="monitor-check"><input type="checkbox" value="${escM(v)}" ${selecionados.has(v)?'checked':''}> <span>${escM(v)}</span></label>`).join('');
}

function obterUsuariosDisponiveis(){
  const select=document.getElementById('filtroIntegrante');
  return select?[...select.options].filter(o=>o.value).map(o=>({id:o.value,nome:o.textContent.trim()})):[];
}

function obterDadosDasLinhas(){
  return [...document.querySelectorAll('#tbodyMonitor tr')].filter(r=>r.children.length>=6).map(r=>({
    row:r,
    tarefa:r.children[1]?.querySelector('strong')?.textContent.trim()||r.children[1]?.textContent.trim()||'',
    usuario:r.children[2]?.textContent.trim()||'',
    status:normalizarStatus(r.children[4]?.textContent.trim()||'')
  }));
}

function decorarTabela(){
  const tabela=document.querySelector('#monitor table');
  const scroll=tabela?.closest('.tabela-scroll');
  if(tabela)tabela.classList.add('monitor-table-pro');
  if(scroll)scroll.classList.add('monitor-scroll-pro');
  [...document.querySelectorAll('#tbodyMonitor tr')].forEach(row=>{
    [...row.children].forEach((td,i)=>td.dataset.label=MONITOR_LABELS[i]||'');
  });
}

function atualizarOpcoesFiltro(){
  const usuarios=obterUsuariosDisponiveis().map(x=>x.nome);
  renderChecklist('monitorUsuarios',usuarios,estadoMonitor.usuarios);
  const dados=obterDadosDasLinhas();
  const tarefas=[...new Set(dados.map(x=>x.tarefa).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  renderChecklist('monitorTarefas',tarefas,estadoMonitor.tarefas);
  renderChecklist('monitorStatus',['Pendente','Em andamento','No Prazo','Atrasado'],estadoMonitor.status);
}

function aplicarFiltroNasLinhas(){
  const dados=obterDadosDasLinhas();
  let visiveis=0;
  dados.forEach(({row,tarefa,usuario,status})=>{
    const okUsuario=!estadoMonitor.usuarios.size||estadoMonitor.usuarios.has(usuario);
    const okTarefa=!estadoMonitor.tarefas.size||estadoMonitor.tarefas.has(tarefa);
    const okStatus=!estadoMonitor.status.size||estadoMonitor.status.has(status);
    const ok=okUsuario&&okTarefa&&okStatus;
    row.classList.toggle('monitor-hidden',!ok); if(ok)visiveis++;
  });
  let vazio=document.getElementById('monitorVazioFiltro');
  if(!vazio){vazio=document.createElement('div');vazio.id='monitorVazioFiltro';vazio.className='monitor-empty-filter';vazio.style.display='none';vazio.textContent='Nenhuma tarefa corresponde aos filtros selecionados.';document.querySelector('#monitor .tabela-scroll')?.after(vazio);}
  vazio.style.display=dados.length&&visiveis===0?'block':'none';
  atualizarResumo();
}

function contarFiltros(){
  let n=estadoMonitor.usuarios.size+estadoMonitor.tarefas.size+estadoMonitor.status.size;
  if(estadoMonitor.data&&estadoMonitor.data!==hojeISO())n++;
  return n;
}

function atualizarResumo(){
  const count=document.getElementById('monitorFilterCount');
  const summary=document.getElementById('monitorFilterSummary');
  const n=contarFiltros();
  if(count){count.textContent=n;count.classList.toggle('show',n>0);}
  if(!summary)return;
  const partes=[];
  try{partes.push(legendaPeriodo());}catch{}
  if(estadoMonitor.usuarios.size)partes.push(`${estadoMonitor.usuarios.size} usuário(s)`);
  if(estadoMonitor.tarefas.size)partes.push(`${estadoMonitor.tarefas.size} tarefa(s)`);
  if(estadoMonitor.status.size)partes.push(`${estadoMonitor.status.size} status`);
  summary.textContent=partes.join(' • ');
  atualizarNavegacaoPeriodo();
}

function renderDepoisDoMonitor({repopular=true}={}){
  requestAnimationFrame(()=>{
    decorarTabela();
    if(repopular)atualizarOpcoesFiltro();
    aplicarFiltroNasLinhas();
  });
}

function executarMonitorBase(){
  const userSelect=document.getElementById('filtroIntegrante');
  const usuarios=obterUsuariosDisponiveis();
  if(userSelect){
    if(estadoMonitor.usuarios.size===1){const nome=[...estadoMonitor.usuarios][0];userSelect.value=usuarios.find(u=>u.nome===nome)?.id||'';}
    else userSelect.value='';
  }
  const dataInput=document.getElementById('filtroData'); if(dataInput)dataInput.value=estadoMonitor.data||hojeISO();
  const monitorData=document.getElementById('monitorData');if(monitorData)monitorData.value=estadoMonitor.data||hojeISO();
  atualizarMonitorOriginal?.();
  renderDepoisDoMonitor();
  atualizarResumo();
}

function aplicarFiltros(){
  estadoMonitor.data=document.getElementById('monitorData')?.value||hojeISO();
  estadoMonitor.usuarios=valoresMarcados('monitorUsuarios');
  estadoMonitor.tarefas=valoresMarcados('monitorTarefas');
  estadoMonitor.status=valoresMarcados('monitorStatus');
  executarMonitorBase();
  document.getElementById('monitorFilterPanel')?.classList.remove('open');
}

function limparFiltros(){
  estadoMonitor.data=hojeISO();estadoMonitor.usuarios.clear();estadoMonitor.tarefas.clear();estadoMonitor.status.clear();
  const d=document.getElementById('monitorData');if(d)d.value=estadoMonitor.data;
  ['monitorUsuarios','monitorTarefas','monitorStatus'].forEach(id=>document.querySelectorAll(`#${id} input`).forEach(x=>x.checked=false));
  executarMonitorBase();
}

function montarFiltroCompacto(){
  const monitor=document.getElementById('monitor'); if(!monitor||monitorPreparado)return;
  const oldData=document.getElementById('filtroData');
  const oldContainer=oldData?.closest('div[style*="display: flex"]'); if(oldContainer)oldContainer.classList.add('monitor-old-filters');
  const nota=oldContainer?.nextElementSibling;if(nota&&nota.tagName==='P')nota.classList.add('monitor-old-filters');
  estadoMonitor.data=oldData?.value||hojeISO();
  const anchor=oldContainer||monitor.querySelector('h2');
  const bloco=document.createElement('div');
  bloco.innerHTML=`
    <div id="monitorPeriodTabs" class="monitor-period-tabs" role="group" aria-label="Período do monitor">
      <button type="button" class="active" data-monitor-periodo="dia">Dia</button>
      <button type="button" data-monitor-periodo="semana">Semana</button>
      <button type="button" data-monitor-periodo="mes">Mês</button>
      <button type="button" data-monitor-periodo="ano">Ano</button>
    </div>
    <div id="monitorPeriodNavPro" class="monitor-period-nav">
      <button type="button" data-move="-1" aria-label="Período anterior">‹ Anterior</button>
      <button type="button" data-current="1">Hoje</button>
      <button type="button" data-move="1" aria-label="Próximo período">Próximo ›</button>
      <strong id="monitorPeriodReference">${escM(legendaPeriodo())}</strong>
    </div>
    <div class="monitor-pro-toolbar">
      <div class="monitor-pro-title"><span>📋</span><span id="monitorFilterSummary" class="monitor-filter-summary">${escM(new Date((estadoMonitor.data||hojeISO())+'T12:00:00').toLocaleDateString('pt-BR'))}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" id="monitorToleranceRuleBtn" class="monitor-filter-btn">⏱️ Regra</button><button type="button" id="monitorFilterBtn" class="monitor-filter-btn">⚙️ Filtrar <span id="monitorFilterCount" class="monitor-filter-count">0</span></button></div>
    </div>
    <div id="monitorFilterPanel" class="monitor-filter-panel">
      <div class="monitor-filter-grid">
        <div class="monitor-filter-group"><label>Data</label><input id="monitorData" type="date" value="${escM(estadoMonitor.data||hojeISO())}"></div>
        <div class="monitor-filter-group"><label>Usuários <small style="font-weight:500;color:#94a3b8">(pode marcar vários)</small></label><div id="monitorUsuarios" class="monitor-check-list"></div></div>
        <div class="monitor-filter-group"><label>Tarefas <small style="font-weight:500;color:#94a3b8">(pode marcar várias)</small></label><div id="monitorTarefas" class="monitor-check-list"></div></div>
        <div class="monitor-filter-group"><label>Status <small style="font-weight:500;color:#94a3b8">(pode marcar vários)</small></label><div id="monitorStatus" class="monitor-check-list"></div></div>
      </div>
      <div class="monitor-filter-actions"><button type="button" class="monitor-filter-clear" id="monitorLimpar">Limpar</button><button type="button" class="monitor-filter-apply" id="monitorAplicar">Aplicar filtros</button></div>
    </div>
    <p class="monitor-mobile-hint">No celular, as tarefas são mostradas em cartões para facilitar a leitura.</p>`;
  anchor.after(bloco);
  document.getElementById('monitorToleranceRuleBtn').onclick=abrirRegraTolerancia;
  document.getElementById('monitorFilterBtn').onclick=()=>document.getElementById('monitorFilterPanel').classList.toggle('open');
  document.getElementById('monitorAplicar').onclick=aplicarFiltros;
  document.getElementById('monitorLimpar').onclick=limparFiltros;
  document.querySelectorAll('#monitorPeriodTabs [data-monitor-periodo]').forEach(btn=>btn.addEventListener('click',()=>{
    estadoMonitor.periodo=btn.dataset.monitorPeriodo||'dia';
    document.querySelectorAll('#monitorPeriodTabs [data-monitor-periodo]').forEach(x=>x.classList.toggle('active',x===btn));
    executarMonitorBase();
    window.dispatchEvent(new CustomEvent('rotina-monitor-period-change',{detail:{periodo:estadoMonitor.periodo,data:estadoMonitor.data}}));
  }));
  document.querySelectorAll('#monitorPeriodNavPro [data-move]').forEach(btn=>btn.addEventListener('click',()=>{
    estadoMonitor.data=moverPeriodo(estadoMonitor.data||hojeISO(),Number(btn.dataset.move));executarMonitorBase();
  }));
  document.querySelector('#monitorPeriodNavPro [data-current]').addEventListener('click',()=>{estadoMonitor.data=hojeISO();executarMonitorBase();});
  document.getElementById('monitorData').addEventListener('change',()=>{
    estadoMonitor.data=document.getElementById('monitorData').value||hojeISO();
    const u=valoresMarcados('monitorUsuarios'),s=valoresMarcados('monitorStatus');
    estadoMonitor.usuarios=u;estadoMonitor.status=s;estadoMonitor.tarefas.clear();
    executarMonitorBase();
    document.getElementById('monitorFilterPanel').classList.add('open');
  });
  atualizarOpcoesFiltro(); decorarTabela(); atualizarResumo();
  monitorPreparado=true;
}

function iniciarMonitorPro(){
  if(typeof window.atualizarMonitor!=='function'){setTimeout(iniciarMonitorPro,150);return;}
  if(atualizarMonitorOriginal)return;
  atualizarMonitorOriginal=window.atualizarMonitor;
  window.atualizarMonitor=function(){atualizarMonitorOriginal();renderDepoisDoMonitor();};
  montarFiltroCompacto();
  renderDepoisDoMonitor();
  const select=document.getElementById('filtroIntegrante');
  if(select)new MutationObserver(()=>{if(monitorPreparado)atualizarOpcoesFiltro();}).observe(select,{childList:true});
  window.rotinaMonitorPeriodoAtual=()=>estadoMonitor.periodo;
  window.addEventListener('rotina-monitor-history-rendered',()=>renderDepoisDoMonitor({repopular:true}));
}

if(document.readyState==='loading') window.addEventListener('DOMContentLoaded',iniciarMonitorPro);
else iniciarMonitorPro();
