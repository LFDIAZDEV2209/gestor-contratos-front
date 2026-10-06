# UI PASS BRIEF — Seven Save (refinamiento profesional frontend)

> Documento maestro de coordinación para TODOS los agentes que trabajan esta pasada.
> Léelo completo antes de escribir una sola línea de código.

## 0. Contexto del producto

- **App**: Seven Save — FYA TECH SAS. Plataforma de gestión de contratos de aseguradora
  (Next.js 16 App Router, React 19, TS strict, Tailwind v4, CSS de diseño hand-rolled en `app/globals.css`).
- **Identidad**: "Institucional de precisión". NO rediseño arbitrario: refinamiento.
  - Brand: `--brand #062F58` (azul profundo) · `--brand-3 #5CA6B2` (teal) · `--brand-gradient`.
  - Fuentes: IBM Plex Sans / IBM Plex Mono (tabular-nums para números).
  - Tema claro institucional, superficies `#FFFFFF` sobre `--bg #F3F6FA`, radios 8/12/16px.
  - Estados: ok/warn/risk/crit/na/info con pares text/bg AA (NO inventar otros colores).
- **Modo Impeccable**: surface = **Operate** (dashboard/admin). Escaneabilidad, densidad correcta
  y consistencia por encima de expresión. Densidad tipo SaaS moderno (Linear/Stripe/Attio),
  NO cockpit aplastado.

## 1. Fuente de verdad del design system

- `app/globals.css` — TODOS los tokens y clases de componentes (~2700 líneas).
  Mapea los bloques antes de editar. Usa ediciones quirúrgicas (find/replace exacto),
  **nunca reescribas el archivo completo**, no reordenes bloques, respeta los comentarios de sección.
- Componentes canónicos en `components/ui/*`:
  - `Kpi.tsx` (clases `.kpi.kpi-v2`, `.kpis` grid) — stat cards.
  - `Workspace.tsx` — `PageHeader`, `Surface`, `DataTable`, `TableViewport`, `Field`, `FormGrid`, `EmptyState`, skeletons.
  - `Badge.tsx`, `button.tsx`, `Controls.tsx`, `PBar.tsx`, `Feedback.tsx`, `RouteStates.tsx`, `Modal.tsx`, `Presentation` (`presentation.ts`).
  - `icons.tsx` — helper `Icon name="..."` sobre lucide-react (usar SIEMPRE este helper; no hand-roll SVG).
- Vistas en `components/views/*.tsx`, pestañas del expediente en `components/expediente/Tab*.tsx`,
  formularios en `components/forms/*` y `components/expediente/forms/*`.

## 2. Objetivos de la pasada (P0 → P3)

### P0 — Expediente / detalle de contrato (`ExpedienteView.tsx`)
- Header compacto: identidad (número, empresa, estado, riesgo, tipo/modalidad) + cifras clave
  (valor actualizado, ejecutado, saldo, días restantes, valor pagado, cobertura) + alerta semáforo
  + 3 barras (tiempo, financiera, física) en un bloque denso y escaneable.
- Jerarquía de acciones: 1 primaria (`VALIDAR CONTRATO`), secundaria(s) visibles (Editar,
  Conciliación), resto al overflow `Acciones` (imprimir, exportar, anular).
- Iconografía con intención en todo el header. Badges legibles. Sin filas de datos huérfanas.

### P1 — Tabs del expediente (17 tabs)
- Tab bar moderna: iconos por tab, contadores en badge compacto, estado activo evidente,
  sticky top cuando el contenido es largo, responsive (overflow scroll + select), sin cortes raros.
- CONTENIDO interno de cada `Tab*.tsx`: más densidad, secciones con subheader + icono,
  tablas/tab-cards coherentes, estados vacíos bonitos. Sin perder funcionalidad ni rutas.
- Los ids de tab y los hrefs (`contractHref`) NO cambian.

### P1 — DataTables globales (TODAS las vistas)
- Objetivo: eliminar scroll horizontal en desktop (1920/1440/1366) SIEMPRE que no sacrifique
  información crítica. Estrategias: prioridad de columnas, ocultar secundarias por breakpoint
  (`col-hide-*`), truncado + tooltip (`title`), anchos min/max inteligentes, menú de acciones
  compacto (dropdown), sticky de acciones solo si aporta, wrapping controlado.
- Si una tabla real necesita >N columnas (ej. contratos con 22), crear solución UX superior
  (columnas de prioridad + visibilidad) sin inventar datos.
- No reducir tipografía global. Mantener legibilidad.

### P2 — Dashboard (`DashboardView.tsx`)
- Reestructurar con secciones claras: usar componente `SectionHeader` (título + icono +
  descripción corta opcional + acción derecha opcional) para cada grupo:
  «Panorama general» (KPIs), «Qué debo hacer hoy», «Semáforo + mapa», «Tendencias» (gráficas),
  «Contratos próximos a vencer», «Vencimientos». Agrupación semántica, espaciado consistente
  (escala 24/32), jerarquía primario/secundario. NO llenar de cards ni bordes: usar whitespace,
  dividers sutiles, y headers de sección.

### P2 — StatCards globales (`.kpi`)
- Compactar: menos padding vertical, número protagonista (~20-22px), label 10.5-11px,
  icon tile 28-32px, badge/delta inline junto al label. Altura objetivo ≤ 92px.
- Variante `brand` (inversa) y variantes semánticas se mantienen. Grid `.kpis` más denso
  (min 168px, gap 12, margin-bottom reducido). Unificar entre todas las vistas (ya es
  componente central: tocar CSS + Kpi.tsx beneficia a 20 vistas).

### P1/P2 — Formularios (creación/edición en todos los módulos)
- Crear componente `components/ui/FormSection.tsx`: sección con subheader (icono + título +
  descripción opcional), grid responsive y optional accent de izquierda en color de marca MUY sutil.
- Estados focus/hover/error profesionales, required claro (asterisco o marca consistente),
  ayuda solo donde aporte, actions bar primaria/secundaria diferenciadas, sticky footer cuando el form sea largo.
- Aplicar a: ContratoForm, EmpresaForm, formularios del expediente (via `ExpedienteFormShell`),
  Pólizas/Garantías, Pagos, Obligaciones, Entregables, Riesgos, Incumplimientos, Usuarios, Cupos.

## 3. MATRIZ DE PROPIEDAD DE ARCHIVOS (evitar colisiones)

| Agente | Puede editar (exclusivo) | NO tocar |
|---|---|---|
| codex-ds (DS+KPI) | `globals.css` bloques `.kpi*`, `.kpis`, `.kpi-group-title`, `.badge*`; `components/ui/Kpi.tsx`; añadir bloque nuevo al FINAL de globals.css con comentario `/* === UI PASS: <agente> === */` si falta algo puntual | cualquier `.view*.tsx`, `Expediente*`, `DashboardView` |
| agy-expediente | `components/views/ExpedienteView.tsx`; bloques CSS `.exp-*`, `.reason`, `.dual`, `.tab*`, `.section-tabs-*`, `.context-disclosure`; `components/expediente/Tab*.tsx` | `globals.css` resto de bloques, `Kpi.tsx`, `Table/Workspace` |
| codex-dt (DataTables) | `components/ui/Table.tsx`, `Workspace.tsx` (DataTable/TableViewport), bloques CSS `.tbl*`; vistas de módulos NO-expediente | `Expediente*`, `DashboardView.tsx`, `.kpi*` |
| agy-dashboard | `components/ui/SectionHeader.tsx` (nuevo), `DashboardView.tsx`, bloques CSS `.ws-section*` nuevos (append con marca) | `Expediente*`, `.kpi*`, `.tbl*`, `Kpi.tsx` |
| codex-forms | `components/ui/FormSection.tsx` (nuevo), `components/forms/*`, `components/expediente/forms/*`, bloques CSS `.f`, `.field*`, `.form-grid*`, `.form-foot` | vistas de listado, `ExpedienteView` |
| qa-vision | NADA de código de producción: solo `scripts/qa-*`, screenshots en `.playwright-mcp/qa/` | todo lo demás |

**Regla de oro de coherencia**: si necesitas modificar un bloque CSS que NO es tuyo, escríbelo
como nota en tu reporte final; el orquestador lo coordina. Nunca edits fuera de tu matriz.

## 4. Reglas inmutables

1. NO cambiar lógica de negocio ni firmas de props que rompan llamadas existentes.
2. NO cambiar rutas (`contractHref`, tabs ids, hrefs) ni funcionalidades.
3. NO inventar datos ni sustituir información real por mockups.
4. NO añadir dependencias nuevas (excepción: ninguna esperada; pregunta al orquestador).
5. Accesibilidad AA: contraste, focus-visible, aria en tabs/progressbars/dropdowns, keyboard.
6. `prefers-reduced-motion`: animaciones sutiles solo con transiciones CSS (~150-240ms) del sistema
   (`--t-fast/--t-med`, `--ease`); sin loops infinitos.
7. Español (es-CO) en TODOS los textos/copy. Sin emojis.
8. Iconos: SOLO vía `components/icons.tsx` (`Icon name`). Verifica que el name exista; si no,
   añádelo al mapa de icons.tsx (allowed para todos) siguiendo el patrón lucide existente.
9. Tipografías: nunca por debajo de 10px; tablas legibles (label 11px ok).
10. Editar SIEMPRE con operaciones quirúrgicas (find/replace), nunca reescritura completa de
    globals.css ni de vistas existentes salvo indicación explícita del brief propio.

## 5. QA (protocolo común)

- Dev server YA corre en `http://localhost:3000` (no reiniciarlo; si murió, avisar al orquestador).
- Bypass de login para Playwright: `window.localStorage.setItem('ss_auth_v1','1')` en init script.
- Viewports de validación: 1920, 1440, 1366, 1024 (+ 390 móvil en vistas críticas).
- Scripts de referencia: `scripts/qa-runner.mjs`, `scripts/qa-capture.mjs` (apóyate en ellos).
- Buscar: overflow horizontal, texto cortado, badges deformados, contraste, layouts rotos,
  botones desalineados, tabs problemáticas. Screenshots en `.playwright-mcp/qa/<prefix>-<vista>.png`.
- Reportar hallazgos como lista actionable con ruta archivo:línea.

## 6. Entregable de cada agente

Al terminar, reporta (al orquestador, no al usuario):
1. Archivos modificados (ruta + resumen del cambio).
2. Componentes nuevos/expuestos y su API.
3. Hallazgos UX de la vista que trabajaste y cómo los resolviste.
4. Lo que quedó pendiente / fuera de tu matriz.
5. Resultado de `npx tsc --noEmit` (o el typecheck disponible) y cómo lo verificaste.
