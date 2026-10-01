# BRIEF DE IMPLEMENTACIÓN — Portar el prototipo HTML a la plataforma Next.js

> Ejecutor: agente (agy) · Objetivo: **replicar 1:1 o mejorar** el prototipo `gestor-contratos.html` dentro de `gestor-contratos-front`.

## 0. Fuentes (leer antes de escribir código)

1. **`C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos (1).html`** — prototipo completo (4.329 líneas). Contiene TODO: el CSS del sistema de diseño en `<style>`, los datos demo, los motores (`M(c)`, `Semaforo`, `ControlScore`, `Alerts`, `Validator`, `cupoStats`, `mapData`), las 23 vistas `VIEWS`, las 17 pestañas `EXPV`, el esquema declarativo `ENT`, y el SVG del mapa `CO_GEO`. Es la referencia de comportamiento y de píxeles.
2. **`C:\Users\Luis\Documents\Nexo\Repos\files\*.md`** — documentación: `02` modelo de datos, `03` API, `04` módulos, `05` reglas de negocio (fórmulas exactas), `06` seguros/cupos, `07` mapa, `08` roles/permisos, `11` datos demo, `12` plan de pruebas.
3. **`C:\Users\Luis\Documents\Nexo\Repos\PROMPT_INICIAL.md`** — plan de conexión de módulos y fases.

Regla de oro: **cuando la documentación y el HTML difieran en un detalle, gana el HTML** (es el comportamiento validado). Cuando falte detalle, aplica `files/05`.

## 1. Producto a construir

SPA de gestión contractual para FYA TECH SAS, en `gestor-contratos-front` (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4). Fase 0: 100% cliente, datos en `localStorage`, login simulado por selector de usuario.

### 1.1 Diseño visual — OBLIGATORIO igual al HTML

- Copiar el bloque `<style>` del HTML (líneas ~36–475) a `app/globals.css` adaptando solo:
  - Fuente: usar `next/font/google` con **IBM Plex Sans** (400/500/600/700) en `app/layout.tsx` en vez del `<link>` de Google Fonts.
  - Iconos: Font Awesome se reemplaza por **lucide-react** con un mapa equivalente (definir `components/icons.tsx` con un helper `Icon({name})` que resuelva los nombres `fa-*` del NAV a componentes lucide; p.ej. `fa-chart-pie→PieChart`, `fa-briefcase→Briefcase`, `fa-file-contract→FileSignature`, `fa-shield-halved→ShieldHalf`, `fa-umbrella→Umbrella`, `fa-folder-tree→FolderTree`, `fa-file-signature→FileSignature`, `fa-code-compare→GitCompare`, `fa-gavel→Gavel`, `fa-fingerprint→Fingerprint`, `fa-hourglass-half→Hourglass`, `fa-money-check-dollar→Wallet`, `fa-sitemap→Network`, `fa-list-check→ListChecks`, `fa-chart-line→TrendingUp`, `fa-fire→Flame`, `fa-gear→Settings`, `fa-bell→Bell`, `fa-calendar-days→CalendarDays`, `fa-building→Building2`, `fa-file-export→FileOutput`).
  - `color-scheme` y `env(safe-area-inset)` se conservan.
- Todo lo demás (tokens, layout, sidebar, tablas, kpis, paneles, modales, badges, barras, tooltips, dropdowns) debe verse **igual** al HTML. Abre el HTML en el navegador si necesitas comparar.
- Usar la marca lateral **7S**; el nombre canónico del producto es **Seven Save — FYA TECH SAS** (así va en `layout.tsx` con `lang="es"` y metadata correcta — corregir el mojibake actual del layout).

### 1.2 Estructura de archivos

```
gestor-contratos-front/
  app/layout.tsx            (lang es, IBM Plex Sans, metadata es-CO)
  app/page.tsx              (shell 'use client': sidebar + header + router de vistas)
  app/globals.css           (puerto del CSS del prototipo + base tailwind)
  lib/types.ts              (tipos de las 19 colecciones según files/02)
  lib/catalog.ts            (catálogos por defecto, estados, roles, matriz perms, umbrales)
  lib/store.ts              (Store: init/persist/all/get/byContract/insert/update/reset; LS adapter 'gic_store_v2'; Audit append-only con Object.freeze y diff por campo)
  lib/demo.ts               (seed de datos demo del HTML: 5 empresas, 10 contratos, 23 pólizas, 5 cupos, 64 execs, 64 pagos, 19 obligaciones, 13 entregables, 42 documentos, 18 actas, 4 modificaciones, 10 riesgos, 4 incumplimientos, 3 planes, 6 subcontratos, 8 usuarios, 18 auditorías — fechas RELATIVAS con addDays(hoy, n) como el HTML)
  lib/format.ts             (money, moneyM, pct, num, fdate, iso, addDays, diffDays, monthKey, esc)
  lib/metrics.ts            (M(c) con caché, Semaforo, ControlScore, cupoStats, portfolio, mapData, riskLevel, effOblig, CLOSED_STATES)
  lib/alerts.ts             (Alerts.compute con claves estables, gestión desde alertState, NotificationService simulado)
  lib/validator.ts          (Validator.draft/contract/reconcile — 13 áreas exactas de files/05)
  lib/export.ts             (exportRows: xlsx via SheetJS, pdf via jsPDF+AutoTable, csv, print)
  lib/geo.ts                (DEPTOS 33 departamentos con nombre+región; CO_GEO paths extraídos del HTML)
  components/app/*          (Sidebar, Header con buscador global+campana+selector usuario, Router)
  components/ui/*           (Table con orden/paginación/rail semáforo/menú contextual, Chart wrapper, Modal apilable, confirmBox, promptBox, Badge, Kpi, PBar, EmptyState, Tabs, FormField)
  components/views/*.tsx    (una por vista, ver 1.4)
  components/expediente/*   (las 17 pestañas del expediente)
  components/mapa/MapaColombia.tsx  (SVG coroplético con tooltip + panel lateral detalle)
```

### 1.3 Arquitectura de la SPA

- Router interno en estado de React: `{ view, params }` con las mismas claves del HTML (`dashboard`, `gerencia`, `agenda`, `calendario`, `empresas`, `empresa`, `contratos`, `contrato`, `subcontratos`, `obligaciones`, `ejecucion`, `pagos`, `garantias`, `aseguradoras`, `documentos`, `actas`, `modificaciones`, `alertas`, `riesgos`, `incumplimientos`, `auditoria`, `reportes`, `configuracion`). Sincronizar `location.hash` (`#contrato/CT-01`).
- Store en `localStorage` con **hydratación segura para SSR** (inicializar datos demo solo en cliente; nada de acceso a `window` en primer render de servidor — toda la app es `'use client'`).
- Guard de permisos: función `guard(permiso)` con la matriz `files/08`; deshabilitar botones y mostrar aviso si no hay permiso. ADMINISTRADOR siempre full.
- Nunca borrar registros: anular con motivo + auditoría.
- Atajos: `Ctrl/Cmd+K` buscador global (mismas 7 fuentes del HTML: contratos, empresas, subcontratos, pólizas, pagos, actas, obligaciones), `Escape` cierra modales/menús.
- Los valores monetarios son enteros COP; fechas ISO `YYYY-MM-DD`.

### 1.4 Vistas a implementar (paridad funcional exacta con el HTML)

**General**
1. `dashboard`: panel «Qué debo hacer hoy» (9 frentes priorizados enlazados), semáforo (doughnut con clic→contratos filtrado), **14 KPIs**, mapa de Colombia (métricas contratos/pólizas/clientes × cantidad/valor; filtros aseguradora/estado/empresa; tooltip + panel detalle por departamento con ranking de regiones y top 8; extráelo del HTML), tarjetas «Contratos próximos a vencer» con acciones (ver, prórroga, terminación, alertar, obligaciones), 6 gráficas (estado, empresa, vencimientos buckets, valor vs ejecutado log, ejecución mensual 12m con pagado, riesgos por nivel stacked, obligaciones doughnut).
2. `gerencia`: franja ejecutiva de 8 métricas (incluye índice de riesgo/100), evolución mensual acumulada, estado de garantías, valor por empresa, contratos que requieren decisión, exportable.
3. `agenda`: 5 ventanas con KPIs y tablas con rail de semáforo, botones prórroga/alertar, exportable.
4. `calendario`: mes/semana/día con 9 tipos de eventos (inicio, terminación, garantías, obligaciones, entregables, pagos, actas, auditoría), leyenda ocultable, clic abre expediente en pestaña.

**Contratación**
5. `empresas`: tabla CRUD + ficha de empresa con indicadores, gráfica valor por contrato, árbol empresa→contrato→subcontratos, y menú contextual.
6. `contratos`: tabla maestra con rail de semáforo y hasta 22 columnas; TODOS los filtros de files/04 (incluye casillas); acciones por fila + menú contextual (ver, editar, validar, conciliar, modificación, prórroga, pago, documento, alertar, anular).
7. Formulario contrato 4 pestañas (A general, B fechas con cálculo de terminación por días, C económica con IVA 19% por doble clic y resumen en vivo, D alcance) con validaciones en vivo (`Validator.draft`) y bloqueo por severidad alta.
8. Expediente 17 pestañas (`EXPV` del HTML): resumen (gráficas + índice de control + alertas + factores semáforo + eventos + pendientes + pagos), información contractual, documentos (versiones), obligaciones (matriz % general), entregables (**Gantt** con línea de hoy), ejecución (aviso agotamiento + 4 gráficas), pagos, seguros y garantías (tarjeta por aseguradora + cobertura de cumplimiento), actas, modificaciones, suspensiones, prórrogas, riesgos (mapa de calor), incumplimientos, subcontratos (árbol), auditoría, **timeline** con eventos que abren pestaña.
9. `subcontratos` global: indicadores + árbol contractual completo.
10. `obligaciones` global: vistas rápidas + ficha de obligación con checklist, evidencias, comentarios y verificación (permiso aprobar).
11. `ejecucion`: consolidado, % financiera vs física, próximos a agotar, registros mensuales.
12. `pagos`: cuentas/facturas con bruto/IVA/retenciones/neto, estados, aprobación y soporte; vistas rápidas.
13. `garantias`: todas las pólizas con vistas rápidas (vencen 30, vencidas, por cupo, individuales) + formulario de póliza con lógica de cupo (cupo solo de la misma aseguradora vigente; excedente/fecha ⇒ advertencia aceptable «Registrar de todas formas»).
14. `aseguradoras`: indicadores, tarjeta por aseguradora con barras de uso de cupos, gráficas valor asegurado (cupo vs individual) y utilización de cupos (naranja ≥85%, rojo >100%), tabla de cupos CRUD, matriz contratos × aseguradoras.
15. `documentos`: repositorio global con filtros, versiones, anulación conservando historial.
16. `actas`: 8 tipos con conteo.
17. `modificaciones`: 10 tipos, efecto automático sobre el contrato (tabla de files/05 §7), no editables, aviso de revisar pólizas.

**Control**
18. `alertas`: pestañas por nivel (crítica/riesgo/próxima/informativa) + filtro estado; acciones leer/resolver (nota)/delegar/crear tarea/reabrir; panel de tareas.
19. `riesgos`: indicadores, mapa de calor 5×5 con celdas clicables, por categoría, tabla completa.
20. `incumplimientos`: tabla + planes de mejoramiento con avance.
21. `auditoria`: filtros (usuario, contrato, rango, acción, módulo, campo), vista tabla y **timeline** con frases legibles; solo permiso auditar.
22. `reportes`: los 19 reportes de files/04 con vista previa y exportación xlsx/pdf/impresión.

**Sistema**
23. `configuracion`: pestañas Parámetros de alertas, Catálogos (11), Usuarios (CRUD, inactivar), Roles y permisos (matriz editable), Empresas (atajo), Datos y respaldo (tamaño, descarga JSON, restablecer demo). Solo lectura si no es ADMINISTRADOR.

### 1.5 Motores (fórmulas exactas de files/05, ya codificadas en el HTML)

Portar tal cual: `M(c)`, semáforo con 18 factores y casos especiales (anulado/sin datos ⇒ «Sin información»; liquidado ⇒ Normal), estado efectivo y temporal, proyección de agotamiento, 16 tipos de alerta con claves estables y gestión persistente, validador de 13 áreas, conciliación (8 campos con criterios), ControlScore ponderado, cupoStats, mapData. Verifica con los datos demo que: CT-01 ⇒ Crítico (vence en 5 días), CT-03 ⇒ Vencido, CT-08 ⇒ Normal (liquidado), CT-09 ⇒ ejecución >100%.

### 1.6 Exportaciones

Paquetes npm: `xlsx`, `jspdf`, `jspdf-autotable`. Portar `exportRows` (xlsx/pdf/csv/print) y conectar a: tablas, reportes, gerencia, agenda, seguro, matriz. El HTML usa SheetJS 0.18.5 / jsPDF 2.5.1 — usa versiones npm equivalentes.

### 1.7 Gráficas

Usar **react-chartjs-2 + chart.js** (misma librería que el prototipo) para reproducir exactamente las gráficas con los mismos colores (`#0B6E68`, `#C9DCDA`, `#2F6FA3`, semáforo `#1E8E4E/#C99A06/#D0691A/#BE3A2E/#98A4A8`). Un wrapper `Chart` que destruya/actualice la instancia al desmontar.

## 2. Hitos (commit por hito)

| # | Entregable | Verificación |
|---|---|---|
| H1 | `lib/*` (types, catalog, store, format, demo, metrics, alerts, validator, geo) + shell (sidebar+header+router) + dashboard básico | `pnpm build` verde |
| H2 | Empresas, Contratos (tabla+filtros+form 4 pestañas), ficha empresa | build verde + datos demo visibles |
| H3 | Expediente 17 pestañas + todos los motores operando en cabecera | build verde + CT-01 crítico correcto |
| H4 | Gerencia, agenda, calendario, subcontratos, obligaciones, ejecución, pagos | build verde |
| H5 | Garantías, aseguradoras/cupos, documentos, actas, modificaciones | build verde |
| H6 | Alertas, riesgos, incumplimientos, auditoría, reportes (19), configuración | build verde |
| H7 | Exportaciones, atajos, context menus, mapa completo, guards de permisos, responsive | `pnpm build` + smoke test navegando vistas clave |

## 3. Reglas de calidad

- TypeScript strict, cero `any` (los datos demo tipados con las entidades de `lib/types.ts`).
- Comentarios de código en **español**.
- Accesibilidad: foco visible, `aria-label` en iconos botones, tablas con `<th scope>`, navegación por teclado en menús.
- Componentes pequeños y compuestos; nada de gigantescos blobs JSX: si una vista supera ~350 líneas, subdividir.
- Errores nunca silenciosos: `try/catch` en render de vista con panel de error como el HTML.
- No introducir bibliotecas de UI ajenas (mantener el CSS del prototipo); lucide-react y las librerías listadas son las únicas dependencias nuevas permitidas (además de `chart.js`, `react-chartjs-2`, `xlsx`, `jspdf`, `jspdf-autotable`).
- Al terminar cada hito: `pnpm build` debe pasar antes de commit.

## 4. Criterio de aceptación final

1. `pnpm build` en `gestor-contratos-front` sin errores.
2. `pnpm dev` y recorrer: dashboard (mapa+kpis+semáforo) → contratos → expediente CT-01 (17 pestañas) → validar contrato → conciliación → alertas → reportes → configuración.
3. Cambiar de usuario (selector) y comprobar que los botones se deshabilitan según el rol.
4. Anular un registro pidiendo motivo y verificar que aparece en auditoría.
5. Exportar un reporte a xlsx y pdf.
