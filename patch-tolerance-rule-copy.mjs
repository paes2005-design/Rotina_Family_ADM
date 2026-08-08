import fs from 'fs';
const patchFile=(file,repls)=>{
  let s=fs.readFileSync(file,'utf8');
  for(const [from,to,label] of repls){
    const n=s.split(from).length-1;
    if(n!==1)throw new Error(`${file} ${label}: expected 1 occurrence, found ${n}`);
    s=s.replace(from,to);
  }
  fs.writeFileSync(file,s);
};

patchFile('index-ADMIN-v8.html',[
  ['Defina a porcentagem dos pontos em cada faixa. Os valores devem ficar em ordem decrescente.','Defina a porcentagem dos pontos em cada faixa. A janela de recuperação após zerar a tolerância é fixa em 25% no total: 12,5% na primeira faixa e 12,5% na segunda.','modal intro'],
  ['Tolerância excedida até +25% (%)','Primeiros +12,5% após zerar (%)','75 label'],
  ['Tolerância excedida até +50% (%)','Próximos +12,5% (%)','50 label'],
  ['Tolerância excedida acima de +50%','Após +25% adicional','zero label'],
  ['<strong>0% fixo</strong> — consumir mais de 50% além do saldo de tolerância zera a pontuação automática.','<strong>0% fixo</strong> — ao completar 25% adicional além da tolerância, a pontuação automática zera.','zero description'],
  ['• Consumo até 100% da tolerância: <strong>${r.dentroLimites}%</strong> dos pontos.<br>','• Enquanto o saldo estiver acima de 00:00: <strong>${r.dentroLimites}%</strong> dos pontos.<br>','100 copy'],
  ['• Consumo acima da tolerância, até +25%: <strong>${r.atrasoLeve}%</strong>.<br>','• Ao chegar a 00:00 e durante os primeiros +12,5%: <strong>${r.atrasoLeve}%</strong>.<br>','75 copy'],
  ['• Consumo acima de +25%, até +50%: <strong>${r.atrasoMaior}%</strong>.<br>','• Nos próximos +12,5% (até +25% adicional no total): <strong>${r.atrasoMaior}%</strong>.<br>','50 copy'],
  ['• Consumo acima de +50% da tolerância: <strong>${r.estourado}%</strong>.<br><small>Exemplo com tolerância de 10 min: até 10 min consumidos = primeira faixa; 11 a 13 = segunda; 14 a 15 = terceira; acima de 15 = 0%. O cálculo usa minutos completos.</small>','• Ao completar +25% adicional: <strong>${r.estourado}%</strong>.<br><small>Exemplo com tolerância de 10 min: 100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; em 12:30 = 0%. As transições usam segundos exatos.</small>','zero copy']
]);

patchFile('.github/workflows/temporary-adm-quality-check.yml',[
  ["assert(html.includes('Tolerância excedida até +25%'),'ADM 75% band label matches current rule');","assert(html.includes('Primeiros +12,5% após zerar'),'ADM 75% band label matches 12.5% recovery rule');",'audit 75 label'],
  ["assert(html.includes('Tolerância excedida até +50%'),'ADM 50% band label matches current rule');","assert(html.includes('Próximos +12,5%'),'ADM 50% band label matches second 12.5% recovery rule');",'audit 50 label'],
  ["assert(html.includes('Tolerância excedida acima de +50%'),'ADM 0% band label matches current rule');","assert(html.includes('Após +25% adicional'),'ADM 0% band label matches 25% total recovery cap');",'audit zero label'],
  ["assert(!html.includes('iniciar ou terminar depois do limite final sempre zera'),'old final-limit wording is gone');","assert(!html.includes('iniciar ou terminar depois do limite final sempre zera'),'old final-limit wording is gone');\n          assert(html.includes('100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; em 12:30 = 0%'),'ADM example explains exact zero boundary');\n          assert(mon.includes('12,5%')&&mon.includes('25% adicional no total'),'Monitor rule modal explains both recovery bands');",'audit exact explanation']
]);
console.log('ADM rule copy aligned with 12.5% + 12.5% recovery bands.');
