import {getApps,getApp} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {getFirestore,collection,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const pad=n=>String(n).padStart(2,'0');
const hojeISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
let tarefas=[];
let historico=[];
let grupoAtivo='';
let unsubTarefas=null;
let unsubHistorico=null;
let observerTabela=null;
let aplicando=false;

function grupo(){return (document.getElementById('displayCodigoCliente')?.textContent||'').trim();}
function dataSelecionada(){return document.getElementById('filtroData')?.value||hojeISO();}
function horarioLinha(row){
  const txt=row.children?.[0]?.querySelector('strong')?.textContent||'';
  const m=String(txt).match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
  return m?{inicio:m[1],fim:m[2]}:{inicio:'',fim:''};
}
function dadosLinha(row){
  const c=row.children||[];
  const h=horarioLinha(row);
  return {row,tarefa:c[1]?.querySelector('strong')?.textContent.trim()||'',usuario:c[2]?.textContent.trim()||'',dia:c[3]?.textContent.trim()||'',inicio:h.inicio,fim:h.fim};
}
function combina(x,d){
  const nome=x.nome||x.nomeTarefa||'';
  return (!d.tarefa||nome===d.tarefa)&&(!d.usuario||x.perfilNome===d.usuario)&&(!d.dia||x.diaSemana===d.dia)&&(!d.inicio||x.horaSugeridaInicio===d.inicio)&&(!d.fim||x.horaSugeridaFim===d.fim);
}
function ocorrenciaPara(d,data){
  const h=historico.find(x=>x.data===data&&x.inicioAntecipado===true&&combina(x,d));
  if(h)return h;
  if(data===hojeISO())return tarefas.find(x=>x.inicioAntecipado===true&&x.dataExecucao===data&&combina(x,d))||null;
  return null;
}
function garantirEstilo(){
  if(document.getElementById('admEarlyStartStyle'))return;
  const s=document.createElement('style');s.id='admEarlyStartStyle';
  s.textContent=`.early-start-adm-badge{display:inline-flex;align-items:center;gap:4px;margin:5px 0 0 6px;padding:4px 8px;border:1px solid #93c5fd;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:800;line-height:1.15;cursor:pointer;white-space:normal}.early-start-adm-badge:hover{background:#bfdbfe}.early-start-adm-badge:focus-visible{outline:3px solid rgba(37,99,235,.28);outline-offset:2px}#admEarlyStartModal{display:none;position:fixed;inset:0;z-index:31000;background:rgba(15,23,42,.62);align-items:center;justify-content:center;padding:16px;box-sizing:border-box}.adm-early-card{position:relative;width:min(500px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;padding:20px;box-shadow:0 24px 70px rgba(15,23,42,.28);box-sizing:border-box}.adm-early-close{position:absolute;right:14px;top:12px;border:0;background:#eff6ff;width:34px;height:34px;border-radius:50%;font-size:22px;color:#1d4ed8;cursor:pointer}.adm-early-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.08em;font-weight:800;color:#1d4ed8}.adm-early-card h2{margin:5px 42px 12px 0;color:#1e293b}.adm-early-summary{font-size:13px;color:#64748b;line-height:1.5}.adm-early-reason{margin-top:14px;padding:14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:13px}.adm-early-reason small{display:block;font-weight:800;color:#1d4ed8;text-transform:uppercase;font-size:10px;margin-bottom:6px}.adm-early-reason p{margin:0;color:#334155;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.adm-early-note{margin-top:12px;color:#64748b;font-size:12px;line-height:1.45}@media(max-width:480px){.adm-early-card{padding:18px 15px;border-radius:18px}.early-start-adm-badge{margin-left:0}}`;
  document.head.appendChild(s);
}
function garantirModal(){
  let m=document.getElementById('admEarlyStartModal');if(m)return m;
  m=document.createElement('div');m.id='admEarlyStartModal';
  m.innerHTML=`<div class="adm-early-card" role="dialog" aria-modal="true" aria-labelledby="admEarlyTitulo"><button type="button" class="adm-early-close" aria-label="Fechar">×</button><div class="adm-early-kicker">🔵 Início antecipado</div><h2 id="admEarlyTitulo">Início antecipado</h2><div id="admEarlyResumo" class="adm-early-summary"></div><div class="adm-early-reason"><small>Motivo informado</small><p id="admEarlyMotivo"></p></div><div class="adm-early-note">Esta informação é apenas educativa e de acompanhamento. O início antecipado não reduz pontos nem consome tolerância.</div></div>`;
  document.body.appendChild(m);
  const fechar=()=>{m.style.display='none';};
  m.querySelector('.adm-early-close').onclick=fechar;
  m.addEventListener('click',e=>{if(e.target===m)fechar();});
  return m;
}
function abrirBotao(b){
  const m=garantirModal();
  m.querySelector('#admEarlyTitulo').textContent=b.dataset.taskName||'Início antecipado';
  const minutos=Number(b.dataset.earlyMinutes)||0;
  const partes=[b.dataset.user||'',b.dataset.date?b.dataset.date.split('-').reverse().join('/'):'' ,b.dataset.schedule||''].filter(Boolean);
  m.querySelector('#admEarlyResumo').textContent=`${partes.join(' · ')}${minutos?` · ${minutos} min antes`:''}`;
  m.querySelector('#admEarlyMotivo').textContent=b.dataset.earlyReason||'Motivo não informado.';
  m.style.display='flex';
}
function criarBadge(o,d,data){
  const b=document.createElement('button');
  b.type='button';b.className='early-start-adm-badge';b.textContent='🔵 Início antecipado';b.title='Ver motivo do início antecipado';
  b.dataset.taskName=d.tarefa||o.nomeTarefa||o.nome||'';
  b.dataset.user=d.usuario||o.perfilNome||'';
  b.dataset.date=data;
  b.dataset.schedule=[o.horaSugeridaInicio||d.inicio,o.horaSugeridaFim||d.fim].filter(Boolean).join('–');
  b.dataset.earlyReason=o.motivoInicioAntecipado||'';
  b.dataset.earlyMinutes=String(Number(o.antecipacaoMin)||0);
  return b;
}
function aplicar(){
  if(aplicando)return;aplicando=true;
  try{
    garantirEscutas();
    const data=dataSelecionada();
    const rows=[...document.querySelectorAll('#tbodyMonitor tr')].filter(r=>r.children.length>=6);
    let mudou=false;
    rows.forEach(row=>{
      const d=dadosLinha(row),o=ocorrenciaPara(d,data),cell=row.children[4];
      const atual=cell?.querySelector('.early-start-adm-badge');
      if(!o){if(atual){atual.remove();mudou=true;}return;}
      const novo=criarBadge(o,d,data);
      if(atual){
        const igual=atual.dataset.earlyReason===novo.dataset.earlyReason&&atual.dataset.date===novo.dataset.date&&atual.dataset.earlyMinutes===novo.dataset.earlyMinutes;
        if(!igual){atual.replaceWith(novo);mudou=true;}
      }else{cell?.appendChild(novo);mudou=true;}
    });
    if(mudou)window.dispatchEvent(new CustomEvent('rotina-early-start-updated'));
  }finally{aplicando=false;}
}
function garantirEscutas(){
  const g=grupo();if(!g||g==='--'||g==='CLI-Gen'||g===grupoAtivo)return;
  const banco=getApps().length?getFirestore(getApp()):null;if(!banco)return;
  unsubTarefas?.();unsubHistorico?.();grupoAtivo=g;
  unsubTarefas=onSnapshot(query(collection(banco,'tarefas'),where('grupoId','==',g)),s=>{tarefas=s.docs.map(d=>({id:d.id,...d.data()}));aplicar();},e=>console.warn('Início antecipado ADM/tarefas:',e));
  unsubHistorico=onSnapshot(query(collection(banco,'historico'),where('grupoId','==',g)),s=>{historico=s.docs.map(d=>({id:d.id,...d.data()}));aplicar();},e=>console.warn('Início antecipado ADM/histórico:',e));
}
function iniciar(){
  garantirEstilo();garantirModal();
  document.addEventListener('click',e=>{const b=e.target.closest?.('.early-start-adm-badge');if(b){e.preventDefault();abrirBotao(b);}});
  document.getElementById('filtroData')?.addEventListener('change',()=>queueMicrotask(aplicar));
  const tb=document.getElementById('tbodyMonitor');
  if(tb&&!observerTabela){observerTabela=new MutationObserver(aplicar);observerTabela.observe(tb,{childList:true,subtree:false});}
  aplicar();
}
window.aplicarInicioAntecipadoADM=aplicar;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
