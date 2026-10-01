const fs = require('fs');
const ts = require('typescript');
const files = ['components/views', 'components/expediente'].flatMap(dir=>fs.readdirSync(dir).filter(n=>n.endsWith('.tsx')).map(n=>dir+'/'+n));
const output=[];
for(const name of files){
 if(process.argv[2] && !name.includes(process.argv[2])) continue;
 const original=fs.readFileSync(name,'utf8');const source=ts.createSourceFile(name,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];const imports=new Set();const asyncNodes=new Set();
 function visit(node){
  if(ts.isCallExpression(node)){
   const expression=node.expression.getText(source);const helper={'alert':'notify','window.alert':'notify','confirm':'confirmAction','window.confirm':'confirmAction','prompt':'requestReason','window.prompt':'requestReason'}[expression];
   if(helper){imports.add(helper);edits.push({start:node.expression.getStart(source),end:node.expression.end,text:(helper==='notify'?'':'await ')+helper});
    if(helper!=='notify'){let parent=node.parent;while(parent&&!ts.isArrowFunction(parent)&&!ts.isFunctionExpression(parent)&&!ts.isFunctionDeclaration(parent))parent=parent.parent;if(parent&&!parent.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))asyncNodes.add(parent);}
   }
  }
  ts.forEachChild(node,visit);
 }visit(source);
 for(const node of asyncNodes)edits.push({start:node.getStart(source),end:node.getStart(source),text:'async '});
 if(edits.length){let updated=original;for(const e of edits.sort((a,b)=>b.start-a.start))updated=updated.slice(0,e.start)+e.text+updated.slice(e.end);updated=updated.replace("'use client';","'use client';\nimport { "+[...imports].join(', ')+" } from '../ui/Feedback';");output.push({name,original,updated});}
}
console.log(JSON.stringify(output));
