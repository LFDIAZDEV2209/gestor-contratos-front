// Migración de presentación por AST. Emite parches; nunca escribe fuentes.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const output = [];
for (const folder of ['views','expediente','mapa']) {
  for (const file of fs.readdirSync('components/'+folder).filter(f=>f.endsWith('.tsx'))) {
    const name = 'components/'+folder+'/'+file;
    if (process.argv[2] && !name.includes(process.argv[2])) continue;
    const original = fs.readFileSync(name,'utf8');
    const source = ts.createSourceFile(name,original,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    const edits = [], imports = new Set();
    const edit = (start,end,text)=>edits.push({start,end,text});
    const visit = node => {
      if (ts.isJsxElement(node)) {
        const opening=node.openingElement, tag=opening.tagName.getText(source);
        const attr=opening.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==='className');
        const cls=attr?.initializer && ts.isStringLiteral(attr.initializer)?attr.initializer.text:'';
        let target='';
        if(tag==='button') target='Button';
        if(tag==='table' && cls.split(' ').includes('tbl')) target='DataTable';
        if(tag==='div') {
          if(/^(ph|page-h)(\s|$)/.test(cls)) target='PageHeader';
          else if(/^panel(\s|$)/.test(cls)) target='Surface';
          else if(/^kpi-card(\s|$)/.test(cls)) target='MetricCard';
          else if(/^tbl-wrap(\s|$)/.test(cls)) target='TableViewport';
          else if(/^form-grid(\s|$)/.test(cls)||/^grid g-[12](\s|$)/.test(cls)) target='FormGrid';
          else if(/^f(\s|$)/.test(cls)) target='Field';
        }
        if(target) {
          edit(opening.tagName.getStart(source),opening.tagName.end,target);
          edit(node.closingElement.tagName.getStart(source),node.closingElement.tagName.end,target);
          imports.add(target);
          if(target==='PageHeader') {
            const headings=[];
            const find=n=>{if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(source)==='h2')headings.push(n);ts.forEachChild(n,find)};
            ts.forEachChild(node,find);
            for(const h of headings){edit(h.openingElement.tagName.getStart(source),h.openingElement.tagName.end,'h1');edit(h.closingElement.tagName.getStart(source),h.closingElement.tagName.end,'h1');}
          }
        }
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
    let updated=original;
    for(const e of edits.sort((a,b)=>b.start-a.start))updated=updated.slice(0,e.start)+e.text+updated.slice(e.end);
    const lines=[];
    if(imports.delete('Button'))lines.push("import { Button } from '../ui/button';");
    if(imports.size)lines.push(`import { ${[...imports].join(', ')} } from '../ui/Workspace';`);
    updated=updated.replace(/(['"]use client['"];?)/,'$1\n'+lines.join('\n'));
    if(updated!==original) output.push({name,original,updated});
  }
}
process.stdout.write(JSON.stringify(output));
