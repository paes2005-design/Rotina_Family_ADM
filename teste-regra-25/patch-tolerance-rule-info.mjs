import fs from 'fs';
const f='monitor-pro.js';
let s=fs.readFileSync(f,'utf8');
const once=(from,to,label)=>{
  const n=s.split(from).length-1;
  if(n!==1)throw new Error(`${label}: expected 1 occurrence, found ${n}`);
  s=s.replace(from,to);
};
once(
  "const escM=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n",
  "const escM=(v='')=>String(v).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\n\nfunction abrirRegraTolerancia(){\n  document.getElementById('monitorToleranceRuleModal')?.remove();\n  const m=document.createElement('div');\n  m.id='monitorToleranceRuleModal';\n  m.style.cssText='position:fixed;inset:0;z-index:21000;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:16px';\n  m.innerHTML=`<div style=\"width:min(92vw,480px);background:#fff;border-radius:20px;padding:20px;box-shadow:0 18px 55px rgba(0,0,0,.25);color:#1f2937\"><h2 style=\"margin:0 0 10px\">⏱️ Regra da tolerância</h2><p style=\"line-height:1.45;margin:0 0 12px\">A tolerância configurada é toda a janela de <strong>100%</strong>. Quando esse saldo chega a <strong>00:00</strong>, a pontuação cai imediatamente para <strong>75%</strong>.</p><div style=\"display:grid;gap:8px\"><div style=\"padding:10px 12px;border-radius:12px;background:#fef9c3\">🟡 <strong>75%</strong> por mais <strong>12,5%</strong> da tolerância original.</div><div style=\"padding:10px 12px;border-radius:12px;background:#ffedd5\">🟠 <strong>50%</strong> por mais <strong>12,5%</strong>.</div><div style=\"padding:10px 12px;border-radius:12px;background:#fee2e2\">🔴 Depois de <strong>25% adicional no total</strong>, a pontuação passa para <strong>0%</strong>.</div></div><p style=\"margin:12px 0 0;line-height:1.45\"><strong>Exemplo:</strong> tolerância de 10 min → 100% até 09:59; 75% de 10:00 a 11:14; 50% de 11:15 a 12:29; 0% em 12:30.</p><p style=\"margin:8px 0 0;color:#64748b;font-size:13px;line-height:1.4\">O saldo é único: atraso no início + atraso no término. Início antecipado não consome tolerância.</p><div style=\"display:flex;justify-content:flex-end;margin-top:14px\"><button type=\"button\" id=\"monitorToleranceRuleClose\" class=\"monitor-filter-btn\">Entendi</button></div></div>`;\n  document.body.appendChild(m);\n  const fechar=()=>m.remove();\n  m.querySelector('#monitorToleranceRuleClose').onclick=fechar;\n  m.addEventListener('click',ev=>{if(ev.target===m)fechar();});\n}\n",
  'insert rule helper'
);
once(
  "<button type=\"button\" id=\"monitorFilterBtn\" class=\"monitor-filter-btn\">⚙️ Filtrar <span id=\"monitorFilterCount\" class=\"monitor-filter-count\">0</span></button>",
  "<div style=\"display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end\"><button type=\"button\" id=\"monitorToleranceRuleBtn\" class=\"monitor-filter-btn\">⏱️ Regra</button><button type=\"button\" id=\"monitorFilterBtn\" class=\"monitor-filter-btn\">⚙️ Filtrar <span id=\"monitorFilterCount\" class=\"monitor-filter-count\">0</span></button></div>",
  'add rule button'
);
once(
  "document.getElementById('monitorFilterBtn').onclick=()=>document.getElementById('monitorFilterPanel').classList.toggle('open');",
  "document.getElementById('monitorToleranceRuleBtn').onclick=abrirRegraTolerancia;\n  document.getElementById('monitorFilterBtn').onclick=()=>document.getElementById('monitorFilterPanel').classList.toggle('open');",
  'wire rule button'
);
fs.writeFileSync(f,s);
console.log('Tolerance rule explanation patch applied.');
