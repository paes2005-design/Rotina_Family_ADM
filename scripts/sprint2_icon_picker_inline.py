from pathlib import Path

p=Path('sprint2-tarefas-realdata-v2.js')
s=p.read_text(encoding='utf-8')

s=s.replace("const VERSION='tarefas-realdata-v2.3-icon-edit';","const VERSION='tarefas-realdata-v2.4-icon-picker';",1)

old="function iconOptions(current){return ICONS.map(i=>`<option value=\"${esc(i)}\" ${i===current?'selected':''}>${esc(i)}</option>`).join('')}\n"
new="""function iconOptions(current){return ICONS.map(i=>`<option value=\"${esc(i)}\" ${i===current?'selected':''}>${esc(i)}</option>`).join('')}
function iconPicker(id,current){return `<label class=\"tv2-icon-picker\" title=\"Trocar ícone\"><span class=\"tv2-icon-face\" aria-hidden=\"true\">${esc(current)}</span><select id=\"${esc(id)}\" aria-label=\"Ícone da tarefa\">${iconOptions(current)}</select><span class=\"tv2-icon-chevron\" aria-hidden=\"true\">⌄</span></label>`}
"""
if old not in s: raise SystemExit('iconOptions não encontrado')
s=s.replace(old,new,1)

old='''<select id="tv2-icon-${esc(r.key)}" aria-label="Ícone da tarefa">${iconOptions(r.icon)}</select>'''
new='''${iconPicker('tv2-icon-'+r.key,r.icon)}'''
if old not in s: raise SystemExit('select desktop não encontrado')
s=s.replace(old,new,1)

old='''<select id="tv2-m-icon-${esc(r.key)}" aria-label="Ícone da tarefa">${iconOptions(r.icon)}</select>'''
new='''${iconPicker('tv2-m-icon-'+r.key,r.icon)}'''
if old not in s: raise SystemExit('select mobile não encontrado')
s=s.replace(old,new,1)

needle='.tv2-editgrid{display:grid;grid-template-columns:52px minmax(150px,1fr);gap:6px;align-items:center}'
replacement=needle+'''.tv2-icon-picker{position:relative;width:46px;height:46px;display:inline-grid;place-items:center;border:1px solid #dcdde7;border-radius:12px;background:#fff;cursor:pointer;overflow:hidden}.tv2-icon-picker:hover{border-color:#bca8ee;background:#fbf9ff}.tv2-icon-picker:focus-within{border-color:#6b35df;box-shadow:0 0 0 3px rgba(107,53,223,.12)}.tv2-icon-face{font-size:24px;line-height:1;pointer-events:none}.tv2-icon-chevron{position:absolute;right:4px;bottom:1px;font-size:10px;line-height:1;color:#6b35df;pointer-events:none}.tv2-icon-picker select{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}'''
if needle not in s: raise SystemExit('CSS editgrid não encontrado')
s=s.replace(needle,replacement,1)

needle="  root?.querySelectorAll('[data-tv2-save]').forEach(b=>b.onclick=()=>save(b.dataset.tv2Save,b.dataset.mobile==='1'));\n"
replacement=needle+"  root?.querySelectorAll('.tv2-icon-picker select').forEach(sel=>sel.onchange=()=>{const face=sel.closest('.tv2-icon-picker')?.querySelector('.tv2-icon-face');if(face)face.textContent=sel.value});\n"
if needle not in s: raise SystemExit('bindRows save não encontrado')
s=s.replace(needle,replacement,1)

p.write_text(s,encoding='utf-8')
print('SPRINT2_ICON_PICKER_INLINE=OK')
