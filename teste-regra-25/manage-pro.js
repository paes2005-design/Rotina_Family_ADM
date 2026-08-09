if(!document.querySelector('link[data-mobile-app-ui]')){
  const link=document.createElement('link');
  link.rel='stylesheet';link.href='./mobile-app-ui.css';link.dataset.mobileAppUi='1';document.head.appendChild(link);
}
import('./mobile-app-ui.js').catch(e=>console.error('Interface móvel:',e));

const GER_DIAS=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const GER_ROTULOS={Segunda:'Seg',Terça:'Ter',Quarta:'Qua',Quinta:'Qui',Sexta:'Sex',Sábado:'Sáb',Domingo:'Dom'};
let gerDiaAtual='Segunda';
let gerPreparado=false;
let renderOriginal=null;

const escG=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function obterLinhaTarefas(){
  return [...document.querySelectorAll('#tbodyExclusao tr')].filter(r=>r.children.length>=4).map(row=>{
    const editar=row.querySelector('button[onclick*="preencherEdicaoTarefa"]');
    const excluir=row.querySelector('button[onclick*="excluirTarefa"]');
    const pegarId=(el,fn)=>{
      const txt=el?.getAttribute('onclick')||'';
      const m=txt.match(new RegExp(fn+"\\(['\\\"]([^'\\\"]+)"));
      return m?.[1]||'';
    };
    const horario=row.children[0]?.textContent.trim()||'';
    const celTarefa=row.children[1];
    const tarefa=celTarefa?.querySelector('strong')?.textContent.trim()||celTarefa?.textContent.trim()||'';
    const icone=celTarefa?.querySelector('.task-icon-cell')?.textContent.trim()||'✅';
    const usuario=row.children[2]?.textContent.trim()||'';
    return {row,horario,tarefa,icone,usuario,id:pegarId(editar,'preencherEdicaoTarefa')||pegarId(excluir,'excluirTarefa')};
  });
}

function copiarUsuarios(){
  const origem=document.getElementById('filtroExclusaoIntegrante');
  const destino=document.getElementById('gerFiltroUsuario');
  if(!origem||!destino)return;
  const atual=destino.value;
  destino.innerHTML=[...origem.options].map(o=>`<option value="${escG(o.value)}">${escG(o.textContent)}</option>`).join('');
  if([...destino.options].some(o=>o.value===atual))destino.value=atual;
  else destino.value=origem.value||'';
}

function sincronizarContadores(){
  const cont=document.getElementById('gerQtdDia');
  const linhas=obterLinhaTarefas();
  if(cont)cont.textContent=`${linhas.length} ${linhas.length===1?'tarefa':'tarefas'}`;
}

function renderCardsGerenciar(){
  const cards=document.getElementById('gerCardsTarefas'); if(!cards)return;
  const linhas=obterLinhaTarefas();
  sincronizarContadores();
  if(!linhas.length){
    cards.innerHTML=`<div class="ger-empty"><span>🗓️</span><strong>Nenhuma tarefa neste dia</strong><small>Cadastre uma nova tarefa ou escolha outro dia.</small></div>`;
    return;
  }
  cards.innerHTML=linhas.map(x=>`
    <article class="ger-task-card">
      <div class="ger-time">${escG(x.horario.replace(' às ','–'))}</div>
      <span class="task-icon-badge" aria-hidden="true">${escG(x.icone||'✅')}</span>
      <div class="ger-main">
        <strong>${escG(x.tarefa)}</strong>
        <span>${escG(x.usuario)}</span>
      </div>
      <button class="ger-more" type="button" aria-label="Ações" data-ger-id="${escG(x.id)}">⋮</button>
      <div class="ger-card-actions" data-ger-actions="${escG(x.id)}">
        <button type="button" class="ger-edit" data-ger-edit="${escG(x.id)}">✏️ Editar</button>
        <button type="button" class="ger-delete" data-ger-delete="${escG(x.id)}">🗑️ Excluir</button>
      </div>
    </article>`).join('');
  cards.querySelectorAll('[data-ger-id]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.gerId;
    cards.querySelectorAll('.ger-card-actions').forEach(a=>a.classList.toggle('open',a.dataset.gerActions===id&&!a.classList.contains('open')));
  });
  cards.querySelectorAll('[data-ger-edit]').forEach(b=>b.onclick=()=>window.preencherEdicaoTarefa?.(b.dataset.gerEdit));
  cards.querySelectorAll('[data-ger-delete]').forEach(b=>b.onclick=()=>window.excluirTarefa?.(b.dataset.gerDelete));
}

function executarRender(){
  const diaSelect=document.getElementById('filtroExclusaoDia');
  const usrOrigem=document.getElementById('filtroExclusaoIntegrante');
  const usrNovo=document.getElementById('gerFiltroUsuario');
  if(diaSelect)diaSelect.value=gerDiaAtual;
  if(usrOrigem&&usrNovo)usrOrigem.value=usrNovo.value;
  renderOriginal?.();
  requestAnimationFrame(()=>{copiarUsuarios();renderCardsGerenciar();});
}

function montarGerenciarPro(){
  const cadastro=document.getElementById('cadastro');
  const tbody=document.getElementById('tbodyExclusao');
  if(!cadastro||!tbody||gerPreparado)return;
  const box=tbody.closest('div[style*="border-left"]')||tbody.closest('.tabela-scroll')?.parentElement;
  if(!box)return;
  box.classList.add('gerenciar-box-original');

  const hoje=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][new Date().getDay()];
  gerDiaAtual=GER_DIAS.includes(hoje)?hoje:'Segunda';

  const pro=document.createElement('section');
  pro.id='gerenciarMobilePro';
  pro.className='gerenciar-mobile-pro';
  pro.innerHTML=`
    <div class="ger-head">
      <div>
        <span class="ger-eyebrow">Visualização semanal</span>
        <h3>Gerenciar tarefas cadastradas</h3>
        <p>Escolha um dia e toque em uma tarefa para editar ou excluir.</p>
      </div>
      <button type="button" id="gerFiltroBtn" class="ger-filter-btn">⚙️ Filtrar</button>
    </div>
    <div id="gerFiltroPanel" class="ger-filter-panel">
      <label>Usuário
        <select id="gerFiltroUsuario"><option value="">Todos os integrantes</option></select>
      </label>
      <button type="button" id="gerLimparFiltro">Limpar filtro</button>
    </div>
    <div class="ger-day-strip" id="gerDayStrip">
      ${GER_DIAS.map(d=>`<button type="button" data-ger-dia="${escG(d)}">${GER_ROTULOS[d]}</button>`).join('')}
    </div>
    <div class="ger-day-heading">
      <strong id="gerDiaTitulo">${escG(gerDiaAtual)}-feira</strong>
      <span id="gerQtdDia">0 tarefas</span>
    </div>
    <div id="gerCardsTarefas" class="ger-cards"></div>`;
  box.insertAdjacentElement('afterend',pro);

  const painel=document.getElementById('gerFiltroPanel');
  document.getElementById('gerFiltroBtn').onclick=()=>painel.classList.toggle('open');
  document.getElementById('gerFiltroUsuario').onchange=()=>executarRender();
  document.getElementById('gerLimparFiltro').onclick=()=>{
    const novo=document.getElementById('gerFiltroUsuario');
    if(novo)novo.value='';
    executarRender();
    painel.classList.remove('open');
  };
  pro.querySelectorAll('[data-ger-dia]').forEach(btn=>btn.onclick=()=>{
    gerDiaAtual=btn.dataset.gerDia;
    pro.querySelectorAll('[data-ger-dia]').forEach(b=>b.classList.toggle('active',b===btn));
    const titulo=document.getElementById('gerDiaTitulo');
    if(titulo)titulo.textContent=gerDiaAtual==='Sábado'||gerDiaAtual==='Domingo'?gerDiaAtual:`${gerDiaAtual}-feira`;
    executarRender();
  });
  const ativo=pro.querySelector(`[data-ger-dia="${CSS.escape(gerDiaAtual)}"]`);
  if(ativo)ativo.classList.add('active');
  copiarUsuarios();
  gerPreparado=true;
  executarRender();

  const origem=document.getElementById('filtroExclusaoIntegrante');
  if(origem)new MutationObserver(()=>copiarUsuarios()).observe(origem,{childList:true});
}

function iniciarGerenciarPro(){
  if(typeof window.renderizarTabelaExclusao!=='function'){setTimeout(iniciarGerenciarPro,150);return;}
  if(renderOriginal)return;
  renderOriginal=window.renderizarTabelaExclusao;
  window.renderizarTabelaExclusao=function(){
    renderOriginal();
    requestAnimationFrame(()=>{
      if(gerPreparado)renderCardsGerenciar();
    });
  };
  montarGerenciarPro();
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',iniciarGerenciarPro);
else iniciarGerenciarPro();
