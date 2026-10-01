# Seven Save — Auditoría estática de accesibilidad y branding · Ola 2

Fecha: 2026-10-01 (America/Bogota). Encargo: `p7b.txt`. Repositorio: `C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-front`. HEAD observado: `f6543d0`, con cambios concurrentes de otros agentes.

## Alcance y método

Lectura y búsqueda literal, complementadas con análisis del JSX mediante el parser TypeScript instalado, de los **41 archivos TSX** directamente bajo `components/views/` (24) y `components/expediente/` (17). Se inspeccionaron **478 button/Button**, **337 input/select/textarea y sus wrappers** y los **2 div/span con onClick**. Se leyeron `Controls.tsx`, `button.tsx` y `Workspace.tsx` para comprobar propagación de props y asociación automática de etiquetas, sin modificarlos.

Búsqueda adicional de `var(--faint)` en `app/` y `components/` para detectar herencia CSS, y búsqueda de branding en todo el repositorio incluyendo archivos ocultos/ignorados, excepto `node_modules/`, `.next/`, `.git/` y `*.tsbuildinfo`. Las ubicaciones corresponden al estado leído; los 41 archivos mantuvieron el mismo hash durante la comprobación final de esta auditoría. Los agentes pueden cambiarlos después.

Auditoría **estática**, no certificación completa de accesibilidad: no se simularon lectores de pantalla ni se midió contraste renderizado. No se ejecutaron build ni pruebas con escrituras en el proyecto. **Única escritura de esta tarea: este reporte. Sin fixes ni commits.**

Severidad: **P1/Alta**, control activo sin etiqueta asociada; **P2/Media**, lectura/contraste o control informativo deshabilitado; **Informativa**, coincidencia técnica o regla sin consumidor demostrado. No se encontraron P0.

## 1. Botones de solo icono sin nombre accesible

**0 hallazgos** en los 41 archivos revisados. Se contemplaron tanto `<button>` como `<Button>`; los botones con texto visible o dinámico no se contaron como icon-only. Se aceptaron `aria-label`, `aria-labelledby` y `title` no vacíos. El wrapper `Button` propaga las propiedades y usa `title` como fallback de `aria-label`.

## 2. Controles sin etiqueta asociada

**23 hallazgos: 22 input/select y 1 textarea adicional relacionado; 21 P1 y 2 P2.** Un placeholder o una opción seleccionada no sustituyen una etiqueta asociada y persistente. Algunos navegadores pueden usar el placeholder como nombre de respaldo; los hallazgos no presuponen que todos estos controles queden completamente mudos en cada lector de pantalla.

- **A01 · P1 · Alta** — `components/views/ActasView.tsx:280` — Buscar actas; fix propuesto: Añadir aria-label="Buscar actas por número, descripción o contrato" o etiqueta asociada.
- **A02 · P1 · Alta** — `components/views/ActasView.tsx:287` — Filtro de contrato sin etiqueta; Field no contiene label; fix propuesto: Añadir <label>Contrato</label> como hijo directo de Field o aria-label="Filtrar actas por contrato".
- **A03 · P1 · Alta** — `components/views/AlertasView.tsx:609` — Textarea de resolución con label hermano sin asociación; fix propuesto: Usar Field con label y Textarea directos, o id/htmlFor para “Gestión realizada / soporte de resolución”.
- **A04 · P1 · Alta** — `components/views/ConfiguracionView.tsx:578` — Nuevo valor de catálogo identificado solo por placeholder; fix propuesto: Añadir aria-label dinámico “Nuevo valor para [nombre del catálogo]” o label asociado.
- **A05 · P1 · Alta** — `components/views/ContratosView.tsx:260` — Buscador de contratos identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar contratos por número, contratista, objeto o NIT".
- **A06 · P1 · Alta** — `components/views/DocumentosView.tsx:360` — Buscador de documentos identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar documentos por nombre, archivo o contrato".
- **A07 · P1 · Alta** — `components/views/DocumentosView.tsx:367` — Filtro de contrato sin label dentro de Field; fix propuesto: Añadir label directo “Contrato” a Field o aria-label="Filtrar documentos por contrato".
- **A08 · P1 · Alta** — `components/views/DocumentosView.tsx:381` — Filtro de categoría sin label dentro de Field; fix propuesto: Añadir label directo “Categoría” a Field o aria-label="Filtrar documentos por categoría".
- **A09 · P1 · Alta** — `components/views/GarantiasView.tsx:318` — Buscador de pólizas identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar garantías por póliza, tomador o contrato".
- **A10 · P1 · Alta** — `components/views/GarantiasView.tsx:325` — Filtro de aseguradora sin label dentro de Field; fix propuesto: Añadir label directo “Aseguradora” a Field o aria-label="Filtrar garantías por aseguradora".
- **A11 · P1 · Alta** — `components/views/GarantiasView.tsx:339` — Filtro de tipo sin label dentro de Field; fix propuesto: Añadir label directo “Tipo de garantía” a Field o aria-label="Filtrar garantías por tipo".
- **A12 · P1 · Alta** — `components/views/IncumplimientosView.tsx:480` — Buscador de incumplimientos identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar incumplimientos por descripción, tipo, contrato o responsable".
- **A13 · P2 · Media** — `components/views/ModificacionesView.tsx:700` — Valor actual deshabilitado con label no asociado dentro de fragmento; fix propuesto: Cambiar el div inmediato por Field con label/control directos, o asociar id/htmlFor.
- **A14 · P1 · Alta** — `components/views/ModificacionesView.tsx:709` — Nuevo valor total resultante sin asociación con su label dentro de fragmento; fix propuesto: Cambiar el div inmediato por Field o asociar id/htmlFor; FormGrid no recorre fragmentos.
- **A15 · P2 · Media** — `components/views/ModificacionesView.tsx:723` — Fecha fin actual deshabilitada con label no asociado dentro de fragmento; fix propuesto: Cambiar el div inmediato por Field con label/control directos, o asociar id/htmlFor.
- **A16 · P1 · Alta** — `components/views/ModificacionesView.tsx:732` — Nueva fecha de terminación sin asociación con su label dentro de fragmento; fix propuesto: Cambiar el div inmediato por Field o asociar id/htmlFor; FormGrid no recorre fragmentos.
- **A17 · P1 · Alta** — `components/views/ObligacionesView.tsx:742` — Comentario de obligación identificado solo por placeholder; fix propuesto: Añadir aria-label="Nuevo comentario de la obligación" o label asociado.
- **A18 · P1 · Alta** — `components/views/RiesgosView.tsx:488` — Buscador de riesgos identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar riesgos por descripción, categoría o contrato".
- **A19 · P1 · Alta** — `components/expediente/TabAuditoria.tsx:106` — Buscador de auditoría del expediente identificado solo por placeholder; fix propuesto: Añadir aria-label="Buscar en la auditoría del contrato".
- **A20 · P1 · Alta** — `components/expediente/TabAuditoria.tsx:114` — Selector de usuario sin etiqueta; fix propuesto: Añadir aria-label="Filtrar auditoría por usuario" o label asociado.
- **A21 · P1 · Alta** — `components/expediente/TabAuditoria.tsx:129` — Selector de módulo sin etiqueta; fix propuesto: Añadir aria-label="Filtrar auditoría por módulo" o label asociado.
- **A22 · P1 · Alta** — `components/expediente/TabObligaciones.tsx:416` — Nuevo ítem de checklist identificado solo por placeholder; fix propuesto: Añadir aria-label="Nuevo ítem de verificación de la obligación".
- **A23 · P1 · Alta** — `components/expediente/TabObligaciones.tsx:455` — Nueva observación identificada solo por placeholder; fix propuesto: Añadir aria-label="Nueva observación de la obligación".

### Exclusiones verificadas para evitar falsos positivos

- `Field` conecta los hijos directos `label` y control con un id generado; no se reportaron esos casos.
- `FormGrid` transforma un div hijo directo con label en Field; también funciona para un div devuelto directamente por una condición. Por ello, `GarantiasView.tsx:652` y `ModificacionesView.tsx:745,757` no son hallazgos.
- `FormGrid` no recorre el interior de fragmentos React: los cuatro controles de `ModificacionesView.tsx:700,709,723,732` sí quedan sin asociación.
- Se aceptaron etiquetas envolventes y referencias explícitas `htmlFor/id` o `aria-labelledby`; no se contaron inputs ocultos.

## 3. Texto informativo con var(--faint)

**0 usos inline directos** en views/expediente; **4 reglas CSS activas con texto informativo** y **1 regla latente** localizadas al ampliar la lectura al CSS compartido. Que el registro esté anulado no convierte sus datos en decoración.

- **C01 · P2 · Media** — `app/globals.css:1334` — `.tbl tr.void td` aplica faint a datos de registros anulados en `components/views/ActasView.tsx:370`, `components/views/DocumentosView.tsx:459` y `components/expediente/TabActas.tsx:161`; fix propuesto: usar un token de texto legible y mantener el estado “Anulada” mediante badge/indicador, sin atenuar la información.
- **C02 · P2 · Media** — `app/globals.css:2665` — placeholder de login en faint, consumido por `app/login/page.tsx:109,142`; fix propuesto: usar un token de texto con contraste verificado y conservar las etiquetas visibles.
- **C03 · P2 · Media** — `app/globals.css:2688` — “Acceso rápido (demo)” usa faint mediante `.login-demo-h > span:first-child`, en `app/login/page.tsx:199`; fix propuesto: cambiar a token de texto secundario legible y verificar contraste en el fondo real.
- **C04 · P2 · Media** — `app/globals.css:2700` — versión y proveedor del footer usan faint, en `app/login/page.tsx:228`; fix propuesto: aplicar token de texto secundario legible y reservar faint al separador decorativo.
- **C05 · Informativa/latente** — `app/globals.css:1530` — `.f .hint` define faint para ayuda textual, sin consumidor actual de clase hint localizado en app/components; fix propuesto: corregir la regla antes de reutilizarla para instrucciones informativas.

La regla `app/globals.css:2663` colorea SVG de login, no texto; no se presenta como hallazgo de esta categoría. La declaración de `--faint` en `app/globals.css:47` ya indica “SOLO decorativo”. No se modificó ninguna regla.

## 4. Div/span clicables sin rol/teclado

**0 hallazgos** en views/expediente. Las dos coincidencias están cubiertas:

- `components/views/DocumentosView.tsx:497`: span de historial con `role="button"`, `tabIndex={0}` y activación Enter/Espacio.
- `components/expediente/TabTimeline.tsx:195`: div con rol y tabIndex condicionales al callback, además de activación Enter/Espacio; sin callback no realiza navegación.

No se extrapola este resultado a otros elementos, componentes compartidos o interacciones que no sean el patrón solicitado.

## 5. Residuos de branding

Comando reproducible: `rg -n --hidden --no-ignore -g '!node_modules/**' -g '!.next/**' -g '!.git/**' -g '!*.tsbuildinfo' 'Nexo|Gestor Integral|Gestor de Contratos' .`

**0 residuos de marca visibles al usuario confirmados** con ese patrón; las coincidencias actuales son rutas físicas. No se propone renombrarlas porque rompería las referencias. El antiguo título de exportación “Contratos Nexo” ya no aparece.

- **B01 · Informativa** — `PLAN-IMPLEMENTACION.md:7,8,9` — “Nexo” pertenece a rutas absolutas de las fuentes; fix propuesto: ninguno de branding, conservar las rutas reales.
- **B02 · Informativa** — `scripts/qa-contact-sheets.ps1:5` — “Nexo” pertenece a la ruta de capturas; fix propuesto: ninguno de branding, conservar la ruta real.
- **B03 · Informativa** — `scratch/qa/qa2-results.json`, líneas 8, 13, 18, 23, 35, 40, 45, 50, 62, 67, 72, 77, 89, 94, 99, 104, 116, 121, 126, 131, 143, 148, 153, 158, 170, 175, 180, 185, 197, 202, 207, 214, 226, 231, 236, 241, 253, 258, 263, 268, 280, 291, 302, 313, 328, 339, 350, 361, 380, 392, 403, 414, 432, 443, 454, 465, 483, 494, 507, 518, 536, 548, 559, 571, 589, 601, 613, 624, 642, 654, 665, 676, 694, 705, 719, 731, 749, 760, 771, 782, 800, 811, 823, 834, 852, 857, 862, 867, 879, 884, 889, 894, 906, 913, 918, 925, 937, 944, 955, 962 — 100 coincidencias de “Nexo” en rutas de capturas; fix propuesto: ninguno de branding, conservar las referencias del artefacto QA.

No hay coincidencias de “Gestor Integral” ni “Gestor de Contratos” en el barrido. Los archivos ajenos permanecen intactos.

## Entrega al coordinador

Priorizar los **21 controles activos P1** y resolver los **2 controles informativos P2** junto con las **4 reglas de texto faint activas**. El inventario no incluye propuestas fuera de los cinco patrones solicitados. Aplicar cambios únicamente desde los agentes propietarios; repetir la auditoría después de integrar sus correcciones.

**Estado: reporte entregado; sin modificaciones de producto y a la espera del coordinador.**

