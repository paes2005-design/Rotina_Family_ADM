(()=>{
  'use strict';
  const INFO=Object.freeze({
    app:'ADM',
    appVersion:'2.0.0',
    build:'20260915.6',
    htmlVersion:'index-ADMIN-v9',
    rulesModuleVersion:'6',
    expectedServiceWorkerVersion:'110'
  });
  window.ROTINA_BUILD_INFO=INFO;
  const emit=(event,details={})=>{try{window.rotinaLog?.(event,{...INFO,...details});}catch{}};
  const VERSION_TEXT_RE=/Rotina\s+Family\s+ADM[\s\S]{0,120}Vers(?:ão|ao)[\s\S]{0,80}Build/i;
  const textOf=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  function versionNodes(host){
    return [...host.querySelectorAll('div,p,small,span,footer')].filter(node=>{
      if(node.id==='rotinaBuildFooter')return true;
      const text=textOf(node);
      if(!text||text.length>220||!VERSION_TEXT_RE.test(text))return false;
      return ![...node.children].some(child=>VERSION_TEXT_RE.test(textOf(child)));
    });
  }
  function footer(){
    document.getElementById('rotinaBuildBadge')?.remove();
    const host=document.getElementById('mainScroll')||document.querySelector('.main')||document.body;
    let nodes=versionNodes(host);
    let el=document.getElementById('rotinaBuildFooter')||nodes[0]||null;
    if(!el){el=document.createElement('div');host.appendChild(el);}
    el.id='rotinaBuildFooter';
    el.classList.remove('version');
    el.classList.add('rotina-build-footer');
    el.removeAttribute('type');
    el.textContent=`Rotina Family ADM · Versão ${INFO.appVersion} · Build ${INFO.build}`;
    el.title=`HTML ${INFO.htmlVersion} · Regras v${INFO.rulesModuleVersion} · Service Worker esperado v${INFO.expectedServiceWorkerVersion}`;
    el.style.cssText='position:static;inset:auto;display:block;width:100%;margin:28px 0 8px;padding:0;text-align:center;background:transparent;border:0;border-radius:0;box-shadow:none;color:#9aa0ad;font:500 11px/1.4 system-ui;opacity:1;pointer-events:none;';
    if(el.parentElement!==host)host.appendChild(el);
    nodes=versionNodes(host);
    for(const node of nodes){if(node!==el)node.remove();}
  }
  function watchLateLegacyFooter(){
    const host=document.getElementById('mainScroll')||document.querySelector('.main');
    if(!host||host.__rotinaBuildFooterObserver)return;
    const observer=new MutationObserver(mutations=>{
      let possible=false;
      for(const mutation of mutations){
        for(const node of mutation.addedNodes){
          if(node.nodeType!==1)continue;
          const text=textOf(node);
          if((text&&text.length<800&&/Rotina\s+Family\s+ADM/i.test(text)&&/Build/i.test(text))||node.id==='rotinaBuildBadge'||node.classList?.contains('version')){possible=true;break;}
        }
        if(possible)break;
      }
      if(possible)queueMicrotask(footer);
    });
    observer.observe(host,{childList:true,subtree:true});
    host.__rotinaBuildFooterObserver=observer;
  }
  async function checkSw(){
    try{
      if(!('serviceWorker' in navigator)){emit('build.sw_indisponivel');return;}
      const reg=await navigator.serviceWorker.ready;
      const worker=navigator.serviceWorker.controller||reg.active;
      if(!worker){emit('build.sw_sem_controlador');return;}
      const token=Math.random().toString(36).slice(2);
      const listener=e=>{
        if(e.data?.type!=='ROTINA_BUILD_INFO'||e.data?.token!==token)return;
        navigator.serviceWorker.removeEventListener('message',listener);
        window.ROTINA_SW_VERSION=String(e.data.swVersion||'');
        emit('build.runtime',{
          serviceWorkerVersion:window.ROTINA_SW_VERSION,
          serviceWorkerCache:e.data.cacheName||'',
          serviceWorkerBuild:e.data.build||'',
          swMatchesExpected:String(e.data.swVersion)===INFO.expectedServiceWorkerVersion
        });
      };
      navigator.serviceWorker.addEventListener('message',listener);
      worker.postMessage({type:'ROTINA_GET_BUILD_INFO',token});
      setTimeout(()=>{navigator.serviceWorker.removeEventListener('message',listener);if(!window.ROTINA_SW_VERSION)emit('build.sw_sem_resposta');},1800);
    }catch(e){emit('build.sw_erro',{mensagem:String(e?.message||e)});}
  }
  const boot=()=>{
    footer();
    watchLateLegacyFooter();
    setTimeout(footer,700);
    setTimeout(footer,1800);
    emit('build.html_carregado',{href:location.href,userAgent:navigator.userAgent});
    setTimeout(checkSw,150);
    setTimeout(()=>emit('build.regra_modulo_esperado',{rulesModuleVersion:INFO.rulesModuleVersion}),400);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
