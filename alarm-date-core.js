const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const pad=valor=>String(valor).padStart(2,'0');

export function normalizarDia(valor){
  const procurado=String(valor||'').trim().replace(/-feira$/i,'').toLocaleLowerCase('pt-BR');
  return DIAS.find(dia=>dia.toLocaleLowerCase('pt-BR')===procurado)||'';
}

export function dataLocal(data){
  return `${data.getFullYear()}-${pad(data.getMonth()+1)}-${pad(data.getDate())}`;
}

export function inicioSemana(data=new Date()){
  const inicio=new Date(data);
  inicio.setHours(0,0,0,0);
  inicio.setDate(inicio.getDate()+(inicio.getDay()===0?-6:1-inicio.getDay()));
  return inicio;
}

export function semanaInicioISO(data=new Date()){
  return dataLocal(inicioSemana(data));
}

export function dataDaSemana(diaSemana,referencia=new Date()){
  const indice=DIAS.indexOf(normalizarDia(diaSemana));
  if(indice<0)return '';
  const data=inicioSemana(referencia);
  data.setDate(data.getDate()+(indice===0?6:indice-1));
  return dataLocal(data);
}

function horario(valor){
  const match=String(valor||'').match(/^(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const hora=Number(match[1]),minuto=Number(match[2]);
  return hora>=0&&hora<=23&&minuto>=0&&minuto<=59?{hora,minuto}:null;
}

function dataHorario(dataISO,valor){
  const h=horario(valor);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)||!h)return null;
  const [ano,mes,dia]=dataISO.split('-').map(Number);
  return new Date(ano,mes-1,dia,h.hora,h.minuto,0,0);
}

function isoLocal(data){
  return data?`${dataLocal(data)}T${pad(data.getHours())}:${pad(data.getMinutes())}:00`:'';
}

export function agendaDaTarefa(tarefa,referencia=new Date()){
  const dataAgendada=/^\d{4}-\d{2}-\d{2}$/.test(tarefa?.dataAgendada||'')?tarefa.dataAgendada:dataDaSemana(tarefa?.diaSemana,referencia);
  const inicio=dataHorario(dataAgendada,tarefa?.horaSugeridaInicio),fim=dataHorario(dataAgendada,tarefa?.horaSugeridaFim);
  if(inicio&&fim&&fim<=inicio)fim.setDate(fim.getDate()+1);
  const base=dataAgendada?new Date(`${dataAgendada}T12:00:00`):null;
  return {dataAgendada,semanaInicio:base?semanaInicioISO(base):'',inicioEm:isoLocal(inicio),fimEm:isoLocal(fim)};
}
