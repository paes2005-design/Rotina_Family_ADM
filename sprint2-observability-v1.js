(function(){
'use strict';
const VERSION='sprint2-observability-v1';
const ENDPOINT='https://rotina-family-onesignal-scheduler.rotina-family-onesignal-scheduler.workers.dev/app-log';
const SESSION='sprint2-real-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const BUFFER=[];
const clean=v=>String(v??'').trim();
function groupId(){const text=clean(document.getElementById('topGroup')?.textContent).replace(/^Grupo\s+/i,'').toUpperCase();return text&&text!=='CARREGANDO GRUPO…'&&text!=='CARREGANDO GRUPO...' ? text : 'SPRINT2-PREVIEW'}
function page(){return location.pathname.split('/').filter(Boolean).pop()||'sprint2'}
function safe(details={}){const out={};for(const[k,v]of Object.entries(details||{})){if(/senha|password|email|token|secret|pin|nome|name/i.test(k)||typeof v==='object')continue;out[String(k).slice(0,40)]=typeof v==='number'||typeof v==='boolean'?v:String(v).replace(/\s+/g,' ').slice(0,120)}return out}
function log(event,details={},level='info'){
  const ev=clean(event||'event').replace(/[^a-zA-Z0-9_.:-]/g,'_').slice(0,90);
  const lvl=['info','warning','error'].includes(level)?level:'info';
  const item={aplicativo:'adm',versaoMonitor:5,evento:'operacao.sprint2_real.'+ev,nivel:lvl,detalhes:{operacao:ev,resultado:lvl==='error'?'erro':'ok',telemetria:VERSION,...safe(details)},grupoId:groupId(),perfilId:'',sessaoId:SESSION,clienteEm:new Date().toISOString(),pagina:page(),navegador:'browser',online:navigator.onLine,visibilidade:document.visibilityState,instalado:false};
  BUFFER.push(item);if(BUFFER.length>200)BUFFER.shift();
  if(navigator.onLine)fetch(ENDPOINT,{method:'POST',keepalive:true,headers:{'content-type':'application/json'},body:JSON.stringify({events:[item]})}).catch(()=>{});
  return item;
}
window.techLog=log;
window.rotinaSprint2TechLog=log;
window.__RF_SPRINT2_LOG=BUFFER;
})();