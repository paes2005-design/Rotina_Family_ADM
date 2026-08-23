(()=>{
  const LIMIT=500;
  let installed=false;
  function install(tries=0){
    if(installed)return;
    const original=window.rotinaMasterApi;
    if(typeof original!=='function'){
      if(tries<80)setTimeout(()=>install(tries+1),100);
      return;
    }
    window.rotinaMasterApi=async function(path,options={}){
      let next=String(path||'');
      if(next.startsWith('/logs?')&&!/[?&]limit=/.test(next)) next+=`&limit=${LIMIT}`;
      return original(next,options);
    };
    installed=true;
    window.rotinaLog?.('monitoramento.limite_consulta_ampliado',{limite:LIMIT,versao:1});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();