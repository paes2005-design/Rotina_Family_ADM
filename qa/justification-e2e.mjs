import { chromium } from 'playwright';

const targets=(process.env.QA_URLS||'http://127.0.0.1:4173/qa/justification-mobile-harness.html').split(',').map(x=>x.trim()).filter(Boolean);

for(const url of targets){
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const consoleErrors=[];
  const expectedQaFirestore=/Firestore \(10\.8\.0\): Could not reach Cloud Firestore backend|permission-denied.*rotina-family-qa/i;
  page.on('console',msg=>{if(msg.type()==='error'&&!expectedQaFirestore.test(msg.text()))consoleErrors.push(msg.text());});
  page.on('pageerror',err=>consoleErrors.push(`PAGEERROR: ${err.message}`));

  await page.goto(url,{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__qaReady===true,{timeout:30000});
  await page.waitForSelector('#monitorNativeCards .mon-just-flag',{state:'visible',timeout:15000});

  const flag=page.locator('#monitorNativeCards .mon-just-flag').first();
  const box=await flag.boundingBox();
  if(!box||box.width<20||box.height<20)throw new Error(`Bandeira mobile sem área clicável em ${url}`);

  await flag.tap();
  await page.waitForSelector('#admReviewJustModal',{state:'visible',timeout:10000});
  const display=await page.locator('#admReviewJustModal').evaluate(el=>getComputedStyle(el).display);
  const title=(await page.locator('#admReviewTitulo').textContent()||'').trim();
  const text=(await page.locator('#admReviewTexto').textContent()||'').trim();
  const msg=(await page.locator('#admReviewMsg').textContent()||'').trim();
  const state=await page.evaluate(()=>({logs:window.__qaLogs||[],reader:window.__qaReaderContext||null}));
  const logs=state.logs;

  if(display!=='flex')throw new Error(`Modal não ficou visível em ${url}: display=${display}`);
  if(title!=='Arrumar o quarto')throw new Error(`Título incorreto em ${url}: ${title}`);
  if(text!=='O ônibus atrasou.')throw new Error(`Justificativa incorreta em ${url}: ${text}`);
  if(/não encontrei|não foi possível|inválida|indisponível/i.test(msg))throw new Error(`Mensagem de erro em ${url}: ${msg}`);
  if(!state.reader||state.reader.historicoId!=='hist-qa-1')throw new Error(`Resolvedor direto não recebeu historyId em ${url}`);
  if(!logs.some(x=>x.evento==='justificativa.history_id_capturado'&&x.detalhes?.temHistoryId===true))throw new Error(`Captura do historyId ausente em ${url}`);
  if(!logs.some(x=>x.evento==='justificativa.history_direct_ok'))throw new Error(`Leitura direta da ocorrência ausente em ${url}`);
  if(!logs.some(x=>x.evento==='justificativa.live_resolver_injetado'))throw new Error(`Injeção do histórico direto ausente em ${url}`);
  if(!logs.some(x=>x.evento==='startup.adm_justificativa_clique'))throw new Error(`Log de clique ausente em ${url}`);
  if(!logs.some(x=>x.evento==='startup.adm_justificativa_ok'))throw new Error(`Log de abertura OK ausente em ${url}`);
  if(consoleErrors.length)throw new Error(`Erros de console em ${url}: ${consoleErrors.join(' | ')}`);

  console.log(JSON.stringify({target:url,result:'PASS_CACHE_MISS_DIRECT_HISTORY',historyId:state.reader.historicoId,display,title,text,logs:logs.map(x=>x.evento)},null,2));
  await browser.close();
}
