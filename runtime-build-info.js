(()=>{
  'use strict';
  const INFO=Object.freeze({
    app:'ADM',
    appVersion:'2.0.0',
    build:'20260915.7',
    htmlVersion:'index-ADMIN-v9',
    rulesModuleVersion:'6',
    expectedServiceWorkerVersion:'111'
  });
  window.ROTINA_BUILD_INFO=INFO;
  const emit=(event,details={})=>{try{window.rotinaLog?.(event,{...INFO,...details});}catch{}};
  const VERSION_TEXT_RE=/Rotina\s+Family\s+ADM[\s\S]{0,160}Vers(?:ão|ao)[\s\S]{0,100}Build/i;
  const textOf=node=>String(node?.textContent||'').replace(/\s+/g,' ').trim();
  function versionNodes(){
    const root=document.body||document.documentElement;
    return [...root.querySelectorAll('div,p,small,span,footer')].filter(node=>{
      if(node.id==='rotinaBuildBadge')return true;
      const text=textOf(node);
      if(!text||text.length>240||!VERSION_TEXT_RE.test(text))return false;
      return ![...node.children].some(child=>VERSION_TEXT_RE.test(textOf(child)));
    });
  }
  function syncFooter(){
    document.querySelectorAll('#rotinaBuildBadge').forEach(node=>node.remove());
    let nodes=versionNodes().filter(node=>node.id!=='rotinaBuildBadge');
    let el=nodes.find(node=>node.id!=='rotinaBuildFooter')||nodes.find(node=>node.id==='rotinaBuildFooter')||null;
    if(!el){
      el=document.createElement('div');
      const host=document.querySelector('.app')||document.getElementById('mainScroll')||document.body;
      host.appendChild(el);
    }
    for(const node of nodes){if(node!==el&&node.id==='rotinaBuildFooter')node.removeAttribute('id');}
    el.id='rotinaBuildFooter';
    el.classList.remove('version');
    el.classList.add('rotina-build-footer');
    el.setAttribute('data-version-footer','current');
    el.removeAttribute('type');
    const expected=`Rotina Family ADM · Versão ${INFO.appVersion} · Build ${INFO.build}`;
    if(textOf(el)!==expected)el.textContent=expected;
    el.title=`HTML ${INFO.htmlVersion} · Regras v${INFO.rulesModuleVersion} · Service Worker esperado v${INFO.expectedServiceWorkerVersion}`;
    el.style.cssText='position:static;inset:auto;display:block;width:100%;margin:28px 0 8px;padding:0;text-align:center;background:transparent;border:0;border-radius:0;box-shadow:none;color:#9aa0ad;font:500 11px/1.4 system-ui;opacity:1;pointer-events:none;';
    nodes=versionNodes().filter(node=>node.id!=='rotinaBuildBadge');
    let removed=0;
    for(const node of nodes){if(node!==el){node.remove();removed++;}}
    if(removed)emit('build.footer_duplicado_removido',{removidos:removed});
  }
  function watchFooter(){
    if(!document.body||document.body.__rotinaBuildFooterObserver)return;
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      queueMicrotask(()=>{queued=false;syncFooter();});
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    document.body.__rotinaBuildFooterObserver=observer;
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
    syncFooter();
    watchFooter();
    setTimeout(syncFooter,400);
    setTimeout(syncFooter,1200);
    setTimeout(syncFooter,2500);
    emit('build.html_carregado',{href:location.href,userAgent:navigator.userAgent});
    setTimeout(checkSw,150);
    setTimeout(()=>emit('build.regra_modulo_esperado',{rulesModuleVersion:INFO.rulesModuleVersion}),400);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
