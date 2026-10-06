import { chromium } from 'playwright';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true});
const results=[];
fs.mkdirSync('.playwright-mcp/qa',{recursive:true});
try {
 const context=await browser.newContext({locale:'es-CO'});
 await context.addInitScript(()=>localStorage.setItem('ss_auth_v1','1'));
 const page=await context.newPage();
 for(const tab of ['ejecucion','resumen','pagos','garantias','documentos']) {
  for(const width of [1920,1440,1024,390]) {
   await page.setViewportSize({width,height:width===390?844:1000});
   const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
   await page.goto(`http://localhost:3000/contrato/CT-01?tab=${tab}`,{waitUntil:'networkidle'});
   const pane=page.locator('.ws-tab-pane, .tab-resumen-container').first();
   await pane.locator('.ws-section-h').first().waitFor();
   await page.evaluate(()=>document.fonts.ready);
   const evidence=await pane.evaluate(pane=>{
    const headers=Array.from(pane.querySelectorAll('.ws-section-h')).map(header=>{
     const rect=header.getBoundingClientRect(),style=getComputedStyle(header),title=header.querySelector('.ws-section-t');
     const parent=header.parentElement,pr=parent.getBoundingClientRect();
     const panelHeader=header.classList.contains('dt-panel-title');
     return {title:title.textContent.trim(),icon:!!header.querySelector('.ws-section-ic svg'),level:title.tagName,background:style.backgroundImage,color:getComputedStyle(title).color,overflow:header.scrollWidth-header.clientWidth,flush:!panelHeader||Math.abs(rect.left-pr.left-parseFloat(getComputedStyle(parent).borderLeftWidth))<2&&Math.abs(rect.right-pr.right+parseFloat(getComputedStyle(parent).borderRightWidth))<2&&Math.abs(rect.top-pr.top-parseFloat(getComputedStyle(parent).borderTopWidth))<2,panelHeader};
    });
    const thColors=[...new Set(Array.from(pane.querySelectorAll('.tbl th')).map(th=>getComputedStyle(th).backgroundColor))];
    const content=document.querySelector('.content');
    return {headers,thColors,legacyHeaders:pane.querySelectorAll('.panel-h h3,.panel-h h4').length,documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,contentOverflow:content.scrollWidth-content.clientWidth};
   });
   const pass=evidence.headers.length>0&&evidence.headers.every(h=>h.icon&&['H3','H4'].includes(h.level)&&h.background!=='none'&&h.color==='rgb(255, 255, 255)'&&h.overflow<=0&&h.flush)&&evidence.thColors.every(color=>{const rgb=color.match(/\d+/g)?.map(Number);return rgb&&Math.min(...rgb.slice(0,3))>=210&&Math.max(...rgb.slice(0,3))-Math.min(...rgb.slice(0,3))<25;})&&!evidence.legacyHeaders&&evidence.documentOverflow<=0&&evidence.contentOverflow<=0&&!errors.length;
   await page.screenshot({path:`.playwright-mcp/qa/dt-titulos-${tab}-${width}.png`,fullPage:true});
   const headers=pane.locator('.ws-section-h');
   for(let i=0;i<await headers.count();i++)await headers.nth(i).screenshot({path:`.playwright-mcp/qa/dt-titulos-${tab}-${width}-banda-${i+1}.png`});
   page.off('pageerror',onError);
   results.push({tab,width,...evidence,errors,pass});
   fs.writeFileSync('scratch/reports/codex-dt-titulos-results.json',JSON.stringify(results,null,2));
   console.log(`${pass?'PASS':'FAIL'} ${tab} ${width}: ${evidence.headers.length} bandas, th ${evidence.thColors.join(', ')}, overflow ${evidence.documentOverflow}/${evidence.contentOverflow}`);
  }
 }
}finally{await browser.close();}
if(results.some(r=>!r.pass))process.exitCode=1;
console.log(`${results.filter(r=>r.pass).length}/${results.length} casos correctos`);
