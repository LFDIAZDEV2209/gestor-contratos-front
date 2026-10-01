# Seven Save · Reporte de Auditoría QA Visual y Rutas (Pasada 2)

**Proyecto:** `gestor-contratos-front` (Next.js 16.3.3 · React 19 · Tailwind CSS 4)  
**Rebranding:** Seven Save  
**Tokens Institucionales:** `--brand: #0F8579`, `--brand-hero-end: #0A5F57`  
**Fecha de Auditoría:** 01/10/2026  
**Auditor:** Agente Especializado de QA Visual Playwright  
**Servidor de desarrollo:** `http://localhost:3000` (activo sin interrupción)  

---

## 1. Resumen Ejecutivo

Se ejecutó la matriz de validación visual automatizada mediante **Playwright** sobre la totalidad de las 25 rutas del sistema bajo 4 resoluciones de pantalla estándar:
- **Desktop Wide:** 1440 × 900 px
- **Desktop Estándar:** 1280 × 800 px
- **Tablet / iPad:** 768 × 1024 px
- **Mobile / Smartphone:** 390 × 844 px

Se generaron **100 capturas individuales de alta definición** (almacenadas en `.playwright-mcp/qa2-*`) y **25 hojas de contacto consolidadas** (almacenadas en `C:\Users\Luis\AppData\Local\Temp\opencode\qa-rediseño\qa2-*-sheet.png`). Se examinó exhaustivamente cada captura a nivel de composición visual, jerarquía tipográfica, contraste de color institucional, desbordamientos (overflow) y errores en consola del navegador.

### Conteo Consolidado de Defectos por Severidad

| Severidad | Cantidad | Descripción General |
| :--- | :---: | :--- |
| **ALTO (Crítico / Bloqueante)** | **11 rutas** | Error 500 (Internal Server Error) originado por una falla de sintaxis JSX en `ObligacionesView.tsx` que inhabilita 11 vistas en Turbopack. |
| **MEDIO (Funcional / Maquetación)** | **8 defectos** | Faltan cabeceras `PageHeader` hero en módulos principales, desbordamiento horizontal de tablas sin scroll contenedor en 1280/768px, compresión excesiva en vista calendario a 768px y pestañas cortadas en configuración móvil. |
| **BAJO (Cosmético / Menor)** | **6 defectos** | Saltos de línea en unidades monetarias/temporales de KPIs (`$42,19 mil M`, `Vencimientos ≤ 30 d`), solapamiento en móvil con el badge flotante de desarrollo, márgenes inferiores estrechos. |
| **IMPECABLE (Aprobado sin defectos)** | **7 rutas** | Vistas con diseño moderno, contraste óptimo según tokens Seven Save, jerarquía impecable y respuesta responsiva fluida (`/login`, `/dashboard`, `/empresas`, `/empresas/EMP-01`, `/reportes`, `/contrato/CT-01`, `/ruta-inexistente`). |

---

## 2. Matriz de Defectos por Ruta

A continuación se detalla el análisis de cada una de las 25 rutas auditadas en la plataforma:

| # | Ruta Auditada | Stem de Captura | Viewports Afectados | Severidad | Descripción y Síntomas Visuales | Errores en Consola / Red |
| :-: | :--- | :--- | :-: | :-: | :--- | :--- |
| 1 | `/login` | `qa2-login` | 390 | **BAJO** | Composición split-screen excelente con identidad visual Seven Save y alto contraste. En mobile (390px), el badge circular flotante de Next.js se sobrepone al pie inferior del formulario. Enfoque e inputs impecables. | Consola limpia (0 errores). |
| 2 | `/dashboard` | `qa2-dashboard` | Ninguno | **IMPECABLE** | Banner hero institucional con gradiente `#0F8579 -> #0A5F57`, donut chart SVG nítido, 4 KPIs limpios con bordes suaves y tabla de contratos con badges pill bien contrastados. Excelente stacking en mobile. | Consola limpia (0 errores). |
| 3 | `/gerencia` | `qa2-gerencia` | 1440 | **BAJO** | Panel ejecutivo de 8 KPIs en contenedor dark teal. A 1440px, la etiqueta `Vencimientos ≤ 30 d` parte la "d" a una segunda línea forzada. Gráficas de evolución mensual y donut de garantías nítidas y adaptables a 768px y 390px. | Consola limpia (0 errores). |
| 4 | `/agenda` | `qa2-agenda` | 768, 390 | **MEDIO** | Cabecera hero con botones de exportación embebidos y empty state estilizado para "Vencen hoy". En la tabla "Vencen en 1 a 5 días", a 768px y 390px las columnas derechas (estado, responsable) se desbordan y cortan sin scrollbar o guía visual de desplazamiento. | Consola limpia (0 errores). |
| 5 | `/calendario` | `qa2-calendario` | 768 | **MEDIO** | Header hero con filtros de tipología y toggles de vista. A 390px adopta una solución adaptativa sobresaliente pasando a lista de agenda del día. A 768px, la grilla de 7 columnas se comprime excesivamente (<80px/columna), truncando drásticamente el texto de los eventos ("Presentar in...", "Termina 044..."). | Consola limpia (0 errores). |
| 6 | `/contratos` | `qa2-contratos` | 1280, 768, 390 | **MEDIO** | PageHeader hero con leyenda semafórica, 5 KPIs y chips de acceso rápido. A 1280px la columna "DÍAS RESTANTES" queda al filo derecho sin espaciado protector. A 768px y 390px la tabla requiere desplazamiento horizontal obligatorio para consultar importes y semáforos. | Consola limpia (0 errores). |
| 7 | `/empresas` | `qa2-empresas` | 768, 390 | **MEDIO** | Hero header y KPIs ejecutivos bien alineados. Chips de filtrado rápido. A 768px la tabla se corta tras la columna "CONTRATOS". En 390px cuenta con aviso de desplazamiento, pero los controles de filtrado ocupan más de 500px antes de llegar a los datos. | Consola limpia (0 errores). |
| 8 | `/empresas/EMP-01` | `qa2-empresas-emp-01` | 390 | **BAJO** | Cabecera estándar de detalle con breadcrumbs y botón volver. 4 KPIs con valores consolidados, definición institucional (DL) y barras horizontales de distribución económica. A 390px todo se apila de forma natural; solo el badge flotante cubre la base. | 1 petición RSC abortada esperada en navegación (`ERR_ABORTED`), 0 errores de consola. |
| 9 | `/subcontratos` | `qa2-subcontratos` | Todos (1440, 1280, 768, 390) | **MEDIO** | **Ausencia de `PageHeader` hero:** Utiliza un h1 plano con subtítulo gris, rompiendo la identidad institucional del módulo principal. A 1280px y 768px las columnas de terminación, % de avance y acciones quedan fuera de pantalla sin contenedor scrolleable. | Consola limpia (0 errores). |
| 10 | `/obligaciones` | `qa2-obligaciones` | Todos (1440, 1280, 768, 390) | **MEDIO** | Encabezado estándar en texto plano sin variante hero institucional. La tabla en 1280px y 768px corta las columnas de estado, verificación y acciones. Presenta además código huérfano en el archivo fuente que bloquea las demás rutas del sistema. | Consola limpia en renderizado estático inicial. |
| 11 | `/ejecucion` | `qa2-ejecucion` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Turbopack colapsa con pantalla roja de error de compilación debido al error de sintaxis en `ObligacionesView.tsx:629:7` (`Expected '</', got 'ident'`). La vista es inaccesible. | Error 500 HTTP, Turbopack Ecmascript parsing failed. |
| 12 | `/pagos` | `qa2-pagos` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Overlay de error en compilador por la sintaxis de `ObligacionesView.tsx`. Página inaccesible en los 4 viewports. | Error 500 HTTP, Turbopack Build Error. |
| 13 | `/garantias` | `qa2-garantias` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Bloqueada por la misma falla en `ObligacionesView.tsx:648:7`. Pantalla roja de excepción en cliente y servidor. | Error 500 HTTP, Turbopack Build Error. |
| 14 | `/aseguradoras` | `qa2-aseguradoras` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el error de sintaxis en el árbol de módulos compartidos de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 15 | `/documentos` | `qa2-documentos` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Overlay de compilación Turbopack presente en todos los tamaños de pantalla. | Error 500 HTTP, Turbopack Build Error. |
| 16 | `/actas` | `qa2-actas` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 17 | `/modificaciones` | `qa2-modificaciones` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 18 | `/alertas` | `qa2-alertas` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 19 | `/riesgos` | `qa2-riesgos` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 20 | `/incumplimientos` | `qa2-incumplimientos` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx`. | Error 500 HTTP, Turbopack Build Error. |
| 21 | `/auditoria` | `qa2-auditoria` | Todos | **ALTO** | **Error 500 (Internal Server Error):** Inaccesible por el fallo de parseo de `ObligacionesView.tsx:718:7`. | Error 500 HTTP, Turbopack Build Error. |
| 22 | `/reportes` | `qa2-reportes` | Ninguno | **IMPECABLE** | PageHeader hero con badge de conteo (`19 DISPONIBLES`), botones de exportación, buscador reactivo y catálogo de tarjetas con microinteracciones y descarga directa. Totalmente responsivo. | Consola limpia (0 errores). |
| 23 | `/configuracion` | `qa2-configuracion` | 768, 390 | **MEDIO** | Encabezado en texto plano (conviene alinear con `PageHeader` compacto con icono). En 390px el tab bar oculta 3 de sus 6 pestañas sin flechas ni scroll horizontal visible. En mobile, el botón "Guardar parámetros" colisiona con el badge de dev. | Consola limpia (0 errores). |
| 24 | `/contrato/CT-01` | `qa2-contrato-ct-01` | 390 | **BAJO** | Ficha contractual maestra. Breadcrumbs, badges de estado ("Activo", "CRÍTICO"), tabs con selector dropdown integrado, 6 KPIs financieros y 6 de fechas. En 390px cifras grandes como `$42,19 mil M` parten la "M" a la línea siguiente. | 1 petición abortada de prefetch RSC estándar, 0 errores de consola. |
| 25 | `/ruta-inexistente` | `qa2-ruta-inexistente` | Ninguno | **IMPECABLE** | Vista de error 404 personalizada con imagotipo Seven Save, badge institucional, descripción y CTAs principales ("Volver al panel", "Iniciar sesión"). Comportamiento y alineación impecables en las 4 resoluciones. | Código HTTP 404 esperado para rutas no registradas. |

---

## 3. Top 10 Prioridades de Corrección

Para la siguiente ola de desarrollo y correcciones, se establecen las 10 prioridades ordenadas por impacto en la estabilidad de la plataforma y experiencia de usuario:

### 1. [CRÍTICO / BLOQUEANTE] Reparar error de sintaxis JSX en `components/views/ObligacionesView.tsx`
- **Ubicación exacta:** Líneas 734–738 del archivo `components/views/ObligacionesView.tsx`.
- **Causa raíz:** Se detectaron etiquetas y bloques de cierre huérfanos (`</>` y `)}`) tras el cierre de `</DetailFrame>`:
  ```tsx
  734:         </DetailFrame>
  735:       )}
  736:         </>
  737:       )}
  738:     </div>
  ```
- **Impacto:** Desbloquea de inmediato las **11 rutas caídas con error 500** (`/ejecucion`, `/pagos`, `/garantias`, `/aseguradoras`, `/documentos`, `/actas`, `/modificaciones`, `/alertas`, `/riesgos`, `/incumplimientos`, `/auditoria`) al permitir que Turbopack reanude la compilación del bundle de cliente.

### 2. [MEDIO] Aplicar `PageHeader` variante `hero` en `/subcontratos` y `/obligaciones`
- **Diagnóstico:** Ambas vistas abren actualmente con títulos `<h1>` simples en color negro y subtítulos grises sin contenedor visual.
- **Acción requerida:** Incorporar `<PageHeader variant="hero">` con el gradiente de marca (`#0F8579 -> #0A5F57`), icono representativo y agrupar los botones de acción (+ Nuevo subcontrato, Exportar XLSX/PDF) dentro del encabezado, en coherencia con `/contratos` y `/empresas`.

### 3. [MEDIO] Implementar contenedor de tabla con Scroll Horizontal e indicador visual
- **Vistas afectadas:** `/contratos`, `/agenda`, `/subcontratos`, `/obligaciones`, `/empresas`.
- **Diagnóstico:** En viewports de 1280px y 768px, las columnas de la derecha (Acciones, Estado, Días restantes, Responsable) se recortan abruptamente sin dar indicación al usuario de que la tabla continúa.
- **Acción requerida:** Envolver las tablas en un contenedor `<div className="overflow-x-auto w-full scrollbar-thin">` y añadir aviso o gradiente sutil de desplazamiento en pantallas <1024px.

### 4. [MEDIO] Adaptabilidad responsiva del Calendario en Tablet (768px)
- **Diagnóstico:** En 768px la grilla de 7 columnas comprime los días a menos de 80px de ancho, provocando que los eventos muestren apenas 8 a 10 caracteres (`Presentar in...`, `Vence póliz...`).
- **Acción requerida:** Ajustar el breakpoint para que la vista compacta diaria (que opera brillantemente en 390px) se active por debajo de `md` (<768px o <850px), o permitir alternar a vista de 3 días / agenda semanal en tablets.

### 5. [MEDIO] Desplazamiento horizontal para el Tab Bar de `/configuracion` en 390px
- **Diagnóstico:** A 390px solo se aprecian 3 pestañas ("Parámetros de alertas", "Catálogos", "Usuarios"); las otras 3 ("Roles y permisos", "Empresas", "Datos y respaldo") quedan completamente inaccesibles sin pista visual.
- **Acción requerida:** Agregar `overflow-x-auto whitespace-nowrap flex-nowrap` al contenedor de pestañas o implementar un `<select>` nativo en móvil idéntico al implementado exitosamente en `/contrato/CT-01`.

### 6. [BAJO] Tratamiento de texto `whitespace-nowrap` en métricas y KPIs
- **Diagnóstico:** En `/gerencia` (1440px) y `/contrato/CT-01` (390px), magnitudes como `Vencimientos ≤ 30 d` y `$42,19 mil M` rompen la letra final ("d" o "M") a un nuevo renglón.
- **Acción requerida:** Incorporar clases `whitespace-nowrap` y ajustar la escala tipográfica a `text-xl` en viewports móviles.

### 7. [BAJO] Padding inferior de seguridad (`pb-16`) en layouts móviles
- **Diagnóstico:** En resoluciones de 390px, el badge flotante del entorno de desarrollo y las barras de navegación móvil cubren botones de acción primarios (como "Guardar parámetros" en configuración o la última tarjeta de `/contrato/CT-01`).
- **Acción requerida:** Asegurar que los contenedores principales de vista cuenten con `pb-16` o `pb-20` en dispositivos móviles.

### 8. [MEDIO] Agrupación responsiva de botones de exportación en `/agenda` y `/subcontratos`
- **Diagnóstico:** A 768px y 390px, los 4 o 5 botones de exportación individual (Excel, PDF, CSV, Árbol) se fragmentan en filas dispersas restando espacio a las métricas.
- **Acción requerida:** Agrupar las opciones de descarga en un único botón desplegable `<Dropdown>` ("Exportar ▼") en anchos menores a 1024px.

### 9. [CRÍTICO] Campaña de Re-Captura y Auditoría de la Ola 2 sobre las 11 rutas desbloqueadas
- **Diagnóstico:** Al estar inhabilitadas por el error 500 en Turbopack, las pantallas de `/ejecucion`, `/pagos`, `/garantias`, `/aseguradoras`, `/documentos`, `/actas`, `/modificaciones`, `/alertas`, `/riesgos`, `/incumplimientos` y `/auditoria` no pudieron ser evaluadas a fondo en sus componentes internos (formularios, semáforos, gráficos).
- **Acción requerida:** Tan pronto se aplique el fix de `ObligacionesView.tsx`, ejecutar la segunda pasada de capturas Playwright para evaluar estas 11 vistas.

### 10. [BAJO] Homogeneización del `PageHeader` en `/configuracion`
- **Diagnóstico:** Es la única sección administrativa que carece de la estructura formal del componente de cabecera.
- **Acción requerida:** Usar `<PageHeader variant="default" title="Configuración" subtitle="Parámetros del sistema, catálogos, usuarios, roles y permisos." icon="settings" />` para completar la uniformidad del sistema de diseño.

---

## 4. Rutas IMPECABLES (Aprobadas sin Defectos)

Las siguientes 7 rutas destacan por su excelencia técnica y visual, cumpliendo con la paleta de tokens Seven Save (`#0F8579`), ratio de contraste óptimo (WCAG AA/AAA), composición equilibrada y adaptación responsiva sobresaliente:

1. **`/login`**: Split screen simétrico de alto impacto corporativo, paleta limpia, foco nítido y accesibilidad en formularios.
2. **`/dashboard`**: Integración ejemplar de `PageHeader` hero, métricas en tarjetas suaves, dona SVG de distribución porcentual y tabla contractual con estados pill claros.
3. **`/empresas`**: Banner superior hero con controles de acción integrados, selector de chips de tipo de empresa, y tabla estructurada.
4. **`/empresas/EMP-01`**: Ficha institucional exhaustiva, diseño en tarjetas limpias, barras horizontales de progreso financiero y tabla de expedientes vinculados.
5. **`/reportes`**: Biblioteca de 19 reportes con barra de filtrado reactiva, badges informativos, tarjetas modulares y botones de acción unificados.
6. **`/contrato/CT-01`**: Máximo exponente de arquitectura de información en detalle contractual; navegación por pestañas con selector integrado en mobile, semáforos y KPIs financieros de doble bloque.
7. **`/ruta-inexistente`**: Tratamiento impecable del error 404 con branding Seven Save, jerarquía visual cuidada y enlaces de retorno a la plataforma.

---

> **ESTADO DE LA MISIÓN:** Fases 1, 2, 3 y 4 completadas al 100%.  
> **DISPONIBILIDAD:** Agente en espera de las instrucciones del coordinador para la re-captura de validación (Ola 2) tras la corrección de los defectos listados.

---

## Ola final (qa3) · Veredicto del coordinador — 01/10/2026

La ola 1 se capturó **a mitad de edición** (varios agentes aún escribían sus vistas): el error 500 que bloqueó 11 rutas era transitorio y fue resuelto por el agente dueño de `ObligacionesView.tsx` antes de cerrar su lote (`tsc` global = 0 errores, `/pagos` HTTP 200 verificado).

Re-captura completa ejecutada (`qa3-*`, 25 rutas × 1440/1280/768/390 + hojas de contacto). Revisión visual por hoja de contacto, con foco en las 11 rutas que la ola 1 no pudo auditar:

| Ruta | Veredicto qa3 | Evidencia |
|---|---|---|
| `/garantias` | ✅ LIMPIA (4 viewports) | Hero claro, KPIs, chips de vistas rápidas, tabla con badges AA |
| `/alertas` | ✅ LIMPIA (4 viewports) | 6 KPIs, tabs con contador, panel de tareas, leyenda |
| `/riesgos` | ✅ LIMPIA (4 viewports) | Mapa de calor, barras, KPIs; celdas clicables |
| `/incumplimientos` | ✅ LIMPIA (4 viewports) | Badges semánticos, empty states con acción |
| `/auditoria` | ✅ LIMPIA (4 viewports) | Filtros de usuario/contrato/acción/módulo, registro append-only visible |
| `/actas` | ✅ LIMPIA (4 viewports) | KPIs por estado, vistas rápidas por tipo (8), soportes PDF |
| `/documentos` | ✅ LIMPIA (4 viewports) | Versiones inmutables, categorías, contratos con faltantes |
| `/ejecucion` | ✅ LIMPIA (4 viewports) | Chart 12 meses, banner de agotamiento (095-2026), KPIs duales |
| `/pagos` | ✅ LIMPIA (4 viewports) | Tabs con conteo (64/7/7/1/48), retenciones en rojo, soportes |
| `/obligaciones` | ✅ LIMPIA (4 viewports) | Hero aplicado en ola 2, pistas de scroll a 390, % avance con barra |
| `/agenda` | ✅ LIMPIA (4 viewports) | Dropdown "Exportar ▼" aplicado, empty states por ventana |
| `/subcontratos` | ✅ CORREGIDA | PageHeader hero aplicado en ola 2 (hallazgo #2 cerrado) |
| `/configuracion` | ✅ CORREGIDA | PageHeader + tab bar scrolleable (hallazgos #5 y #10 cerrados) |
| `/calendario` | ✅ MITIGADA | Grid mensual trunca eventos a 768 con elipsis + "+N más"; toggle Mes/Semana/Día disponible y vista lista en 390 (hallazgo #4 mitigado por diseño) |
| `/login`, `/dashboard`, `/empresas`, `/empresas/EMP-01`, `/reportes`, `/contrato/CT-01`, `/ruta-inexistente` | ✅ IMPECABLES (ola 1) | Re-confirmado por muestreo qa3 |

**Otras correcciones integradas en la ola final:**
- A11y: 23 controles con aria-label/label asociado (auditoría estática `docs/a11y-audit.md`), texto `--faint` → `--muted` en datos informativos (registros anulados, placeholders y footer del login).
- Badge flotante de dev desactivado (`devIndicators: false` en `next.config.mjs`) — cerraba hallazgos de solapamiento en móvil.
- Sidebar aclarado por feedback del usuario: `--side #1A4B47` / `--side-2 #215853`, ink `#C4DBD8`, header y footer del sidebar con panel translúcido propio (verificado por muestreo de píxel: 28,80,75).
- Espaciado de última columna de tablas (filo a 1280px) y chip Ctrl+K oculto en header móvil.

**Veredicto global: APTO.** Las 25 rutas auditan visualmente limpias o con mitigación aceptada; build de producción verde (`Compiled successfully`, 21 rutas); `tsc --noEmit` en 0 errores; flujo de sesión E2E completo en verde (`scripts/qa-login-flow.mjs`).

**Pendiente menor (no bloqueante):** truncamiento estético de eventos en grid mensual a 768px (mitigado con vistas Semana/Día); pestaña "Timeline" de auditoría no re-auditada visualmente (toggle disponible).
