(()=>{
  const VERSION=2;
  const MODAL_ID='admReviewJustModal';
  const STYLE_ID='admJustificationCloseFixStyle';
  const INSTALLED_KEY='__rotinaJustificationCloseFixInstalled';

  if(Number(window[INSTALLED_KEY]||0)>=VERSION)return;
  window[INSTALLED_KEY]=VERSION;

  const logClose=(evento,detalhes={},nivel='info')=>{
    try{window.rotinaLog?.(evento,{...detalhes,closeFixVersion:VERSION},nivel);}catch{}
  };

  function modalAtual(){return document.getElementById(MODAL_ID);}
  function modalVisivel(m=modalAtual()){
    if(!m)return false;
    const s=getComputedStyle(m);
    return s.display!=='none'&&s.visibility!=='hidden';
  }
  function reforcarControleFechar(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`#${MODAL_ID} .adm-review-close{z-index:40!important;width:48px!important;height:48px!important;min-width:48px!important;min-height:48px!important;display:grid!important;place-items:center!important;touch-action:manipulation!important;pointer-events:auto!important;-webkit-tap-highlight-color:transparent}#${MODAL_ID}{touch-action:manipulation!important;overscroll-behavior:contain}`;
    document.head.appendChild(s);
  }
  function fecharForcado(origem='desconhecida'){
    const m=modalAtual();
    if(!m)return false;
    const estavaVisivel=modalVisivel(m);
    m.style.display='none';
    m.setAttribute('aria-hidden','true');
    logClose('justificativa.fechar_ok',{origem,estavaVisivel});
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
    e.stopPropagation();
    if(typeof e.stopImmediatePropagation==='function')e.stopImmediatePropagation();
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
    e.stopPropagation();
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
  logClose('justificativa.close_fix_pronto',{versao:VERSION});
})();
