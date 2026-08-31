const MODAL_ID='admReviewJustModal';
const STYLE_ID='admJustificationCloseFixStyle';

const logClose=(evento,detalhes={},nivel='info')=>{
  try{window.rotinaLog?.(evento,{...detalhes,closeFixVersion:1},nivel);}catch{}
};

function modalAtual(){return document.getElementById(MODAL_ID);}
function modalVisivel(m=modalAtual()){
  if(!m)return false;
  return getComputedStyle(m).display!=='none';
}
function reforcarControleFechar(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`#${MODAL_ID} .adm-review-close{z-index:20!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;display:grid!important;place-items:center!important;touch-action:manipulation!important;pointer-events:auto!important;-webkit-tap-highlight-color:transparent}#${MODAL_ID}{touch-action:manipulation}`;
  document.head.appendChild(s);
}
function fecharForcado(origem='desconhecida'){
  const m=modalAtual();
  if(!m||!modalVisivel(m))return false;
  m.style.display='none';
  m.setAttribute('aria-hidden','true');
  logClose('justificativa.fechar_ok',{origem});
  return true;
}
function tratarFechamento(e,tipo){
  const alvo=e.target;
  const botao=alvo?.closest?.('.adm-review-close');
  const fundo=alvo?.id===MODAL_ID;
  if(!botao&&!fundo)return;
  const m=modalAtual();
  if(!m||!modalVisivel(m))return;
  e.preventDefault();
  e.stopImmediatePropagation();
  const origem=botao?`x-${tipo}`:`fundo-${tipo}`;
  logClose('justificativa.fechar_tentativa',{origem});
  fecharForcado(origem);
}

reforcarControleFechar();
document.addEventListener('pointerdown',e=>tratarFechamento(e,'pointerdown'),true);
document.addEventListener('click',e=>tratarFechamento(e,'click'),true);
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||!modalVisivel())return;
  e.preventDefault();
  logClose('justificativa.fechar_tentativa',{origem:'escape'});
  fecharForcado('escape');
},true);

const observer=new MutationObserver(()=>{
  reforcarControleFechar();
  const m=modalAtual();
  if(m&&modalVisivel(m)&&m.getAttribute('aria-hidden')==='true')m.removeAttribute('aria-hidden');
});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});

window.rotinaFecharJustificativa=()=>fecharForcado('api');
