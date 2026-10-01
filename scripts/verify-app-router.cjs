/* Pruebas de contratos de presentación; sin navegador, red ni escrituras en Store. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, URLSearchParams, require: name => name in mocks ? mocks[name] : require(name) }, { filename: file });
  return module.exports;
}
function flatten(element) {
  if (element == null || typeof element !== 'object') return [];
  if (Array.isArray(element)) return element.flatMap(flatten);
  return [element, ...flatten(element.props?.children)];
}
const routes = load('components/app/routes.ts');
assert.equal(routes.contractHref('CT-01', 'pagos'), '/contrato/CT-01?tab=pagos');
assert.equal(routes.contractHref('a/b'), '/contrato/a%2Fb');
assert.equal(routes.companyHref('EMP-01'), '/empresas/EMP-01');
assert.equal(routes.obligationHref('OB-01'), '/obligaciones/OB-01');
assert.equal(routes.viewHref('contracts', 'depto:08'), '/contratos?depto=08');
assert.equal(routes.viewHref('contracts', 'activos'), '/contratos?estado=Activo');
assert.equal(routes.viewHref('dash'), '/dashboard');

const states = load('components/ui/RouteStates.tsx', {
  'next/link': 'Link', './Workspace': { Surface: 'Surface' }, './button': { Button: 'Button' }, '../icons': { Icon: 'Icon' },
});
let retries = 0;
const errorTree = states.RouteError({ error: Object.assign(new Error('dato privado'), { digest: 'ref-123' }), retry: () => retries++ });
const retryButton = flatten(errorTree).find(node => node.type === 'Button');
assert.equal(typeof retryButton.props.onClick, 'function');
retryButton.props.onClick();
assert.equal(retries, 1, 'Reintentar delega en retry(), no en reset ni reload');
assert.equal(JSON.stringify(errorTree).includes('dato privado'), false);
assert.equal(JSON.stringify(errorTree).includes('ref-123'), true);

let user = { estado: 'Activo', rol: 'ADMINISTRADOR' };
const gate = load('components/app/PermissionGate.tsx', {
  '@/lib/store': { AuthService: { currentUser: () => user, can: () => user.rol === 'ADMINISTRADOR' } },
  './SessionContext': { useSessionRevision() {} }, '../ui/RouteStates': { ForbiddenState: 'ForbiddenState' },
});
assert.equal(gate.PermissionGate({ roles: ['ADMINISTRADOR'], children: 'permitido' }), 'permitido');
user = { estado: 'Activo', rol: 'CONSULTA' };
assert.equal(gate.PermissionGate({ roles: ['ADMINISTRADOR'], children: 'privado' }).type, 'ForbiddenState');
assert.equal(gate.PermissionGate({ permission: 'auditar', children: 'privado' }).type, 'ForbiddenState');
user = { estado: 'Inactivo', rol: 'ADMINISTRADOR' };
assert.equal(gate.PermissionGate({ children: 'privado' }).type, 'ForbiddenState');

const { obligationPresentation } = load('components/ui/presentation.ts');
const original = { id: 'OB-01', checklist: [{ t: 'Verificar soporte', done: true }] };
const before = JSON.stringify(original);
const projected = obligationPresentation(original);
assert.equal(projected.checklist[0].texto, 'Verificar soporte');
assert.equal(projected.checklist[0].listo, true);
assert.equal(JSON.stringify(original), before, 'El adaptador no muta el dato de negocio');

const staticRoutes = ['dashboard','gerencia','agenda','calendario','empresas','contratos','subcontratos','obligaciones','ejecucion','pagos','garantias','aseguradoras','documentos','actas','modificaciones','alertas','riesgos','incumplimientos','auditoria','reportes','configuracion'];
for (const route of staticRoutes) {
  assert.ok(fs.existsSync(path.join(root, 'app/(app)', route, 'page.tsx')), route);
  assert.ok(fs.readFileSync(path.join(root, 'app/(app)', route, 'layout.tsx'), 'utf8').includes('metadata'), route + ' metadata');
}
for (const route of ['contrato', 'empresas', 'obligaciones']) {
  const page = fs.readFileSync(path.join(root, 'app/(app)', route, '[id]/page.tsx'), 'utf8');
  assert.ok(page.includes('notFound()'), route + ' notFound');
}
console.log('PASS: destinos, encoding, retry, privacidad del error, permisos, adaptador inmutable, 21 rutas estáticas y 3 fichas.');
console.log('Alcance: contratos unitarios; no sustituye pruebas de historial ni recuperación real de un boundary de Next.');
