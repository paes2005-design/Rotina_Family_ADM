import fs from 'fs';
const file='index-ADMIN-v8.html';
let s=fs.readFileSync(file,'utf8');
const once=(from,to,label)=>{
  const n=s.split(from).length-1;
  if(n!==1)throw new Error(`${label}: expected 1 occurrence, found ${n}`);
  s=s.replace(from,to);
};
once('Defina a porcentagem dos pontos em cada faixa. Os valores devem ficar em ordem decrescente.','Defina a porcentagem dos pontos em cada faixa. A janela de recuperação após zerar a tolerância é fixa em 25% no total: 12,5% na primeira faixa e 12,5% na segunda.','modal intro');
once('Tolerância excedida até +25% (%)','Primeiros +12,5% após zerar (%)','75 label');
once('Tolerância excedida até +50% (%)','Próximos +12,5% (%)','50 label');
once('Tolerância excedida acima de +50%','Após +25% adicional','zero label');
once('<strong>0% fixo</strong> — consumir mais de 50% além do saldo de tolerância zera a pontuação automática.','<strong>0% fixo</strong> — ao completar 25% adicional além da tolerância, a pontuação automática zera.','zero description');
once('• Consumo até 100% da tolerância: <strong>${r.dentroLimites}%</strong> dos pontos.<br>','• Enquanto o saldo estiver acima de 00:00: <strong>${r.dentroLimites}%</strong> dos pontos.<br>','100 copy');
once('• Consumo acima da tolerância, até +25%: <strong>${r.atrasoLeve}%</strong>.<br>','• Ao chegar a 00:00 e durante os primeiros +12,5%: <strong>${r.atrasoLeve}%</strong>.<br>','75 copy');
once('• Consumo acima de +25%, até +50%: <strong>${r.atrasoMaior}%</strong>.<br>','• Nos próximos +12,5% (até +25% adicional no total): <strong>${r.atrasoMaior}%</strong>.<br>','50 copy');
once('• Consumo acima de +50% da tolerância: <strong>${r.estourado}%</strong>.<br><small>Exemplo com tolerância de 10 min: até 10 min consumidos = primeira faixa; 11 a 13 = segunda; 14 a 15 = terceira; acima de 15 = 0%. O cálculo usa minutos completos.</small>','• Ao completar +25% adicional: <strong>${r.estourado}%</strong>.<br><small>Exemplo com tolerância de 10 min: 100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; em 12:30 = 0%. As transições usam segundos exatos.</small>','zero copy');
fs.writeFileSync(file,s);
console.log('ADM rule copy aligned with 12.5% + 12.5% recovery bands.');
