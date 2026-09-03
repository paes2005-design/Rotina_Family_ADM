from pathlib import Path
import re

p=Path('sprint2-recompensas-realdata-v1.js')
s=p.read_text(encoding='utf-8')
s=s.replace("function rewardActive(r){return r.ativa!==false}","function rewardActive(r){return !r||r.ativa!==false}")
if "function actionLog(" not in s:
    s=s.replace("function toast(msg){if(window.RF_APP?.toast)return window.RF_APP.toast(msg);const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1900)}", "function toast(msg){if(window.RF_APP?.toast)return window.RF_APP.toast(msg);const e=$('toast');if(!e)return;e.textContent=msg;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1900)}\nfunction actionLog(event,details={},level='info'){try{window.techLog?.(`recompensas_v1_${event}`,details,level)}catch(_){}}")
new_save="""async function saveReward(id){
  if(busy||!canWrite()||!await firebaseReady())return;
  const original=id==='new'?null:rewards.find(r=>r.id===id);
  if(id!=='new'&&!guardRecord(original))return toast('Recompensa não pertence ao grupo atual.');
  const name=clean($(`rv1Name-${id}`)?.value),points=Number($(`rv1Points-${id}`)?.value),active=$(`rv1Active-${id}`)?.value==='1';
  if(!name||!Number.isFinite(points)||points<=0)return toast('Informe nome e pontos válidos.');
  busy=true;
  try{
    const g=groupId(),now=new Date().toISOString();actionLog('save_start',{editing:id!=='new'});
    if(id==='new'){
      const ref=await fs.addDoc(fs.collection(db,'recompensas'),{grupoId:g,nome:name,pontos:points,ativa:active,criadoEm:now});
      rewards.push({id:ref.id,grupoId:g,nome:name,pontos:points,ativa:active,criadoEm:now});
    }else{
      await fs.updateDoc(fs.doc(db,'recompensas',id),{nome:name,pontos:points,ativa:active,atualizadoEm:now});
      Object.assign(original,{nome:name,pontos:points,ativa:active,atualizadoEm:now});
    }
    editing='';renderCatalog();
    await window.rotinaSprint2SyncLocal?.('recompensas-salvar');accept();render();
    actionLog('save_success',{editing:id!=='new'});toast('Recompensa salva.');
  }catch(e){console.error('Recompensas V1 salvar:',e);actionLog('save_error',{codigo:clean(e?.code)||'erro'},'error');toast('Não foi possível salvar a recompensa.');}
  finally{busy=false;render()}
}"""
s,n=re.subn(r"async function saveReward\(id\)\{.*?\}\nasync function toggleReward",new_save+"\nasync function toggleReward",s,count=1,flags=re.S)
if n!=1: raise SystemExit('Falha ao substituir saveReward')
if "function rewardActive(r){return !r||r.ativa!==false}" not in s: raise SystemExit('Falha no formulário novo')
p.write_text(s,encoding='utf-8')

h=Path('sprint2-integracao-recompensas-v1.html')
html=h.read_text(encoding='utf-8')
needle='<script src="sprint2-data-store-v1.js"></script>'
insert=needle+'<script src="sprint2-tarefas-realdata-v2.js"></script>'
if 'sprint2-tarefas-realdata-v2.js' not in html:
    html=html.replace(needle,insert)
if 'sprint2-tarefas-realdata-v2.js' not in html: raise SystemExit('Falha ao conectar Tarefas V2')
h.write_text(html,encoding='utf-8')
print('OK: Recompensas corrigida e Tarefas V2 conectada')