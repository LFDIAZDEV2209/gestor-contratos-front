// Transformación mecánica: conserva atributos, handlers y datos. Ejecutar una vez.
const fs=require('fs'), ts=require('typescript');
const dirs=['components/views','components/expediente','components/app','components/mapa'];
for(const dir of dirs)for(const file of fs.readdirSync(dir).filter(n=>n.endsWith('.tsx'))){
 const path=dir+'/'+file, original=fs.readFileSync(path,'utf8');let text=original.replace(/\btext-muted\b(?!-foreground)/g,'text-muted-foreground');
 const source=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX), edits=[], imports=new Set();
 const visit=node=>{
  if(ts.isJsxOpeningElement(node)||ts.isJsxClosingElement(node)||ts.isJsxSelfClosingElement(node)){
   const name=node.tagName.getText(source), replacement={input:'Input',select:'Select',textarea:'Textarea'}[name];
   if(replacement){imports.add(replacement);edits.push({start:node.tagName.getStart(source),end:node.tagName.end,value:replacement});}
  }ts.forEachChild(node,visit);
 };visit(source);
 for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end);
 if(imports.size)text=text.replace("'use client';","'use client';\nimport { "+[...imports].join(', ')+" } from '../ui/Controls';");
 if(text!==original){fs.writeFileSync(path,text);console.log(path);}
}
