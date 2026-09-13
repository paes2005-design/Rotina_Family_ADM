from pathlib import Path


task = Path("sprint2-tarefas-realdata-v2.js")
text = task.read_text(encoding="utf-8")

old_version = "const VERSION='tarefas-realdata-v4.3-delete';"
if old_version not in text and "const VERSION='tarefas-realdata-v4.4-edit-days';" not in text:
    raise SystemExit("unexpected task editor version")
text = text.replace(old_version, "const VERSION='tarefas-realdata-v4.4-edit-days';", 1)


def replace_between(src, start_marker, end_marker, replacement):
    start = src.index(start_marker)
    end = src.index(end_marker, start)
    return src[:start] + replacement + src[end:]


new_save = """async function saveSelected(r,v){
  const days=sortDays(v.days);
  if(!days.length){toast('Selecione pelo menos um dia da tarefa.');return false}

  const existingDays=days.filter(d=>r.days.includes(d));
  const newDays=days.filter(d=>!r.days.includes(d));
  const hasFieldChanges=!!editor.touched?.size;
  if(!hasFieldChanges&&!newDays.length){toast('Nenhuma alteração foi feita.');return false}
  if(!validate(v,days))return false;

  const docs=selectedDocs(r,existingDays);
  const ignore=r.docs.map(d=>d.id);

  if(hasFieldChanges){
    for(const d of docs){
      const base=cfg(d);
      const start=touched('start')?v.start:base.start;
      const end=touched('end')?v.end:base.end;
      const active=touched('active')?v.active:base.active;
      if(active){
        const c=conflict({pid:r.pid,days:[clean(d.diaSemana)],start,end,ignore});
        if(c){toast(`Conflito real em ${clean(d.diaSemana)} com “${clean(c.nome)}”.`);return false}
      }
    }
  }

  for(const day of newDays){
    if(v.active){
      const c=conflict({pid:r.pid,days:[day],start:v.start,end:v.end,ignore});
      if(c){toast(`Conflito real em ${day} com “${clean(c.nome)}”.`);return false}
    }
  }

  const g=groupId(),now=new Date().toISOString(),tg=tgFor(r.docs),b=fs.writeBatch(db);
  const alarmNeedsUpdate=['name','start','end','active','alarm'].some(touched);

  if(hasFieldChanges){
    for(const d of docs){
      b.update(fs.doc(db,'tarefas',d.id),selectedPatch(tg,v,now));

      if(alarmNeedsUpdate){
        const base=cfg(d);
        const name=touched('name')?v.name:base.name;
        const start=touched('start')?v.start:base.start;
        const end=touched('end')?v.end:base.end;
        const active=touched('active')?v.active:base.active;
        const preservedMode=alarmMode(alarmFor(d));
        const requestedMode=touched('alarm')?v.alarm:preservedMode;
        const mode=active?requestedMode:'off';

        b.set(
          fs.doc(db,'despertadores',alarmId(g,r.pid,d.id)),
          alarmData({
            g,pid:r.pid,participant:r.participant,taskId:d.id,tg,
            name,day:clean(d.diaSemana),start,end,mode,now
          }),
          {merge:true}
        );
      }
    }
  }

  for(const day of newDays){
    const ref=fs.doc(fs.collection(db,'tarefas'));
    b.set(ref,createPayload({g,pid:r.pid,participant:r.participant,tg,day,v}));
    b.set(
      fs.doc(db,'despertadores',alarmId(g,r.pid,ref.id)),
      alarmData({
        g,pid:r.pid,participant:r.participant,taskId:ref.id,tg,
        name:v.name,day,start:v.start,end:v.end,mode:v.active?v.alarm:'off',now
      }),
      {merge:true}
    );
  }

  await b.commit();
  log('edit_selected_success',{
    diasExistentes:existingDays,
    diasAdicionados:newDays,
    docsAtualizados:hasFieldChanges?docs.length:0,
    docsAdicionados:newDays.length,
    campos:[...editor.touched],
    ativa:touched('active')?v.active:null
  });

  const partes=[];
  if(hasFieldChanges&&docs.length)partes.push(`${docs.length} dia${docs.length===1?'':'s'} atualizado${docs.length===1?'':'s'}`);
  if(newDays.length)partes.push(`${newDays.length} dia${newDays.length===1?'':'s'} adicionado${newDays.length===1?'':'s'}`);
  toast(partes.length?`${partes.join(' e ')}.`:'Alterações salvas.');
  return true;
}
"""
text = replace_between(text, "async function saveSelected(r,v){", "\nfunction setBusyUI(state){", new_save)

new_toggle = """function toggleDraftDay(day){
  if(!editor||!DAYS.includes(day))return;
  const set=new Set(editor.draft.days);
  set.has(day)?set.delete(day):set.add(day);
  editor.draft.days=sortDays([...set]);
  render();
}
"""
text = replace_between(text, "function toggleDraftDay(day){", "\nfunction updateDraft(field,value){", new_toggle)

new_daybuttons = """function dayButtons(days){
  return DAYS.map(d=>`<button type=\"button\" class=\"tv4-day ${days.includes(d)?'on':''}\" data-action=\"toggle-day\" data-day=\"${d}\">${d.slice(0,3)}</button>`).join('');
}
"""
text = replace_between(text, "function dayButtons(", "\nfunction statusField(r,d){", new_daybuttons)

new_application = """function applicationBox(r,d){
  if(!r)return`<div class=\"tv4-box\"><label>Aplicação</label><b>${esc(participantFilter==='all'?'Todos os participantes':pname(participantFilter))}</b></div>`;
  return`<div class=\"tv4-box\"><label>Aplicar alterações nos dias</label><div class=\"tv4-days\">${dayButtons(d.days)}</div><small class=\"tv4-muted\">Os dias atuais vêm selecionados. Marque outros dias para adicioná-los à tarefa. Desmarcar um dia existente apenas evita aplicar alterações nele.</small></div>`;
}
"""
text = replace_between(text, "function applicationBox(r,d){", "\nfunction detailRow(r,d){", new_application)

task.write_text(text, encoding="utf-8")

index = Path("index-ADMIN-v9.html")
html = index.read_text(encoding="utf-8")
old_task_tag = "sprint2-tarefas-realdata-v2.js?v=20260909-mobile-timepicker-v45"
if old_task_tag not in html and "sprint2-tarefas-realdata-v2.js?v=20260913-edit-days-v46" not in html:
    raise SystemExit("task script tag not found")
html = html.replace(old_task_tag, "sprint2-tarefas-realdata-v2.js?v=20260913-edit-days-v46", 1)
html = html.replace("version:'20260905.12'", "version:'20260913.3'", 1)
html = html.replace("register('./sw.js?v=20260905.12'", "register('./sw.js?v=20260913.3'", 1)
index.write_text(html, encoding="utf-8")

sw = Path("sw.js")
swt = sw.read_text(encoding="utf-8")
swt = swt.replace("const CACHE_NAME='rotina-family-adm-v103-production-20260913.2';", "const CACHE_NAME='rotina-family-adm-v104-production-20260913.3';", 1)
swt = swt.replace("const ROTINA_SW_VERSION='103';", "const ROTINA_SW_VERSION='104';", 1)
swt = swt.replace("const ROTINA_BUILD_ID='20260913.2';", "const ROTINA_BUILD_ID='20260913.3';", 1)
swt = swt.replace("./sprint2-tarefas-realdata-v2.js?v=20260905-delete-v43", "./sprint2-tarefas-realdata-v2.js?v=20260913-edit-days-v46", 1)
sw.write_text(swt, encoding="utf-8")
