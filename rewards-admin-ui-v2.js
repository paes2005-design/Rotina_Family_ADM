import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const escR=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dbR=()=>getApps().length?getFirestore(getApp()):null;
let catalogoObserver=null;
let renderCatalogoEmCurso=false;

function grupoAtual(){
  return (document.getElementById('displayCodigoCliente')?.innerText||'').trim();
}

async function recompensasDoGrupo(){
  const db=dbR(),grupoId=grupoAtual();
  if(!db||!grupoId||grupoId==='--'||grupoId==='CLI-Gen') return [];
  const snap=await getDocs(query(collection(db,'recompensas'),where('grupoId','==',grupoId)));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}

function garantirEstilo(){
  if(document.getElementById('rewards-admin-v2-style'))return;
  const s=document.createElement('style');s.id='rewards-admin-v2-style';s.textContent=`
    .reward-report-toolbar{margin-top:24px;padding:14px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}
    .reward-report-toolbar .period-tabs{margin-bottom:12px}
    .reward-report-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
    .reward-report-title h3{margin:0}.reward-report-title p{margin:4px 0 0;color:#64748b;font-size:12px}
    .reward-period-legend{margin:10px 0 0;padding:9px 11px;border-radius:10px;background:#eef5fb;color:#315e8a;font-size:12px;font-weight:800;text-transform:capitalize}
    .reward-edit-modal{position:fixed;inset:0;z-index:22000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px}
    .reward-edit-card{width:min(92vw,430px);background:#fff;border-radius:18px;padding:20px;box-shadow:0 20px 60px rgba(15,23,42,.28)}
    .reward-edit-card h2{margin:0 0 14px;color:#1e293b}.reward-edit-card label{display:block;margin:10px 0 5px;font-weight:800;color:#475569}
    .reward-edit-card input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #cbd5e1;border-radius:10px;font:inherit}
    .reward-edit-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap}
    .reward-edit-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer}
    .reward-edit-actions .save{background:#315e8a;color:#fff;border-color:#315e8a}
    .reward-admin-v2-actions{margin-top:9px;display:flex;gap:7px;flex-wrap:wrap}
    @media(max-width:620px){.reward-report-toolbar{padding:12px}.reward-report-toolbar .period-tabs{display:flex;flex-wrap:wrap}.reward-report-toolbar .period-tab{flex:1;min-width:82px}}
  `;document.head.appendChild(s);
}

function sincronizarLegenda(){
  const origem=document.getElementById('rewardPeriodoRef');
  const destino=document.getElementById('rewardReportLegend');
  if(destino)destino.textContent=origem?.textContent?.trim()?`Período consultado: ${origem.textContent.trim()}`:'Período consultado: —';
}

function reorganizarRelatorio(){
  const root=document.getElementById('recompensas');
  const data=document.getElementById('recompensaDataRef');
  const perfil=document.getElementById('recompensaPerfil');
  const resumo=document.getElementById('rewardResumo');
  const historico=document.getElementById('listaResgatesAdmin');
  if(!root||!data||!perfil||!resumo||!historico)return false;
  if(document.getElementById('rewardReportToolbar')){sincronizarLegenda();return true;}
  const tabs=root.querySelector('[data-rp]')?.closest('.period-tabs');
  const grid=data.closest('div[style*="grid-template-columns"]');
  if(!tabs||!grid)return false;
  const toolbar=document.createElement('section');toolbar.id='rewardReportToolbar';toolbar.className='reward-report-toolbar';
  toolbar.innerHTML='<div class="reward-report-title"><div><h3>Histórico de Resgates</h3><p>Consulte dia, semana ou mês e navegue por períodos anteriores.</p></div></div><div id="rewardReportLegend" class="reward-period-legend">Período consultado: —</div>';
  grid.parentNode.insertBefore(toolbar,grid);
  toolbar.querySelector('.reward-report-title').appendChild(tabs);
  toolbar.appendChild(grid);
  toolbar.appendChild(resumo);
  const h3=[...root.children].find(x=>x.tagName==='H3'&&x.textContent.trim()==='Histórico de Resgates');
  if(h3)h3.remove();
  toolbar.appendChild(historico);
  sincronizarLegenda();
  return true;
}

function fecharEditor(){document.getElementById('rewardEditModal')?.remove();}

window.editarRecompensaAdmin=async function(id){
  const lista=await recompensasDoGrupo();
  const r=lista.find(x=>x.id===id);if(!r)return alert('Recompensa não encontrada.');
  fecharEditor();
  const modal=document.createElement('div');modal.id='rewardEditModal';modal.className='reward-edit-modal';
  modal.innerHTML=`<div class="reward-edit-card"><h2>Editar recompensa</h2><label for="rewardEditName">Nome</label><input id="rewardEditName" value="${escR(r.nome||'')}"><label for="rewardEditPoints">Custo em pontos</label><input id="rewardEditPoints" inputmode="numeric" value="${Number(r.pontos)||0}"><div class="reward-edit-actions"><button type="button" id="rewardEditCancel">Cancelar</button><button type="button" id="rewardEditSave" class="save">Salvar alterações</button></div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)fecharEditor();});
  document.getElementById('rewardEditCancel').onclick=fecharEditor;
  document.getElementById('rewardEditSave').onclick=async()=>{
    const nome=document.getElementById('rewardEditName').value.trim();
    const pontos=Number(String(document.getElementById('rewardEditPoints').value).replace(',','.'));
    if(!nome)return alert('Informe o nome da recompensa.');
    if(!Number.isFinite(pontos)||pontos<0)return alert('Informe um custo em pontos válido.');
    const db=dbR();if(!db)return alert('Banco de dados ainda não está disponível.');
    try{await updateDoc(doc(db,'recompensas',id),{nome,pontos,atualizadoEm:new Date().toISOString()});fecharEditor();await renderCatalogoV2();}
    catch(e){console.error('Edição da recompensa:',e);alert('Não foi possível editar a recompensa.');}
  };
};

async function renderCatalogoV2(){
  const el=document.getElementById('listaRecompensasAdmin');if(!el||renderCatalogoEmCurso)return;
  renderCatalogoEmCurso=true;
  try{
    const lista=(await recompensasDoGrupo()).sort((a,b)=>(a.nome||'').localeCompare(b.nome||''));
    el.innerHTML=lista.map(r=>{const ativa=r.ativa!==false;return `<div class="recompensa-item reward-admin-v2-item"><strong>${escR(r.nome)}</strong> — ${Number(r.pontos)||0} pts <span class="reward-catalog-status ${ativa?'on':'off'}">${ativa?'ATIVA':'DESATIVADA'}</span><div class="reward-admin-v2-actions"><button class="reward-toggle" onclick="editarRecompensaAdmin('${r.id}')">Editar</button><button class="reward-toggle" onclick="alternarRecompensa('${r.id}',${ativa})">${ativa?'Desativar':'Ativar'}</button><button class="reward-toggle" onclick="excluirRecompensa('${r.id}')">Excluir</button></div></div>`}).join('')||'<p>Nenhuma recompensa.</p>';
  }catch(e){console.error('Catálogo de recompensas v2:',e);el.innerHTML='<p>Não foi possível carregar o catálogo.</p>';}
  finally{renderCatalogoEmCurso=false;}
}

function garantirCatalogoV2(){
  const el=document.getElementById('listaRecompensasAdmin');
  if(!el)return;
  const temItens=el.querySelector('.recompensa-item');
  const estaV2=el.querySelector('.reward-admin-v2-item');
  if(temItens&&!estaV2)renderCatalogoV2();
}

function observarCatalogo(){
  const el=document.getElementById('listaRecompensasAdmin');
  if(!el||catalogoObserver)return;
  catalogoObserver=new MutationObserver(()=>queueMicrotask(garantirCatalogoV2));
  catalogoObserver.observe(el,{childList:true});
}

function instalar(){
  garantirEstilo();
  if(typeof window.renderizarRecompensasAdmin!=='function'||typeof window.renderizarResgatesAdmin!=='function'){setTimeout(instalar,120);return;}
  if(window.__rewardAdminV2)return;
  window.__rewardAdminV2=true;
  const resgatesOriginal=window.renderizarResgatesAdmin;
  window.renderizarResgatesAdmin=async function(){await resgatesOriginal();reorganizarRelatorio();sincronizarLegenda();};
  window.renderizarRecompensasAdmin=renderCatalogoV2;
  reorganizarRelatorio();
  observarCatalogo();
  renderCatalogoV2();
  window.renderizarResgatesAdmin();
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>setTimeout(instalar,0));
else setTimeout(instalar,0);
