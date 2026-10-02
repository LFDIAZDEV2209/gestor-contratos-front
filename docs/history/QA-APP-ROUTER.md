# App Router real — implementación y evidencia

Fecha: 2026-10-01. Base visual preservada: `dc52171`. Next instalado: **16.3.3**.

## Implementación

- Shell persistente en `app/(app)/layout.tsx`; `AppShell` recibe `children`, sin estado de vista, dispatcher ni escucha de hashes. La inicialización del Store ocurre solo en el cliente antes de mostrar vistas dependientes de localStorage.
- `/` redirige a `/dashboard`. Se implementaron **21 páginas del NAV y 3 fichas dinámicas**. El árbol concreto del spec contiene 21 entradas, aunque su texto menciona 20.
- Rutas del NAV: dashboard, gerencia, agenda, calendario, empresas, contratos, subcontratos, obligaciones, ejecucion, pagos, garantias, aseguradoras, documentos, actas, modificaciones, alertas, riesgos, incumplimientos, auditoria, reportes y configuracion.
- Fichas: `/contrato/[id]`, `/empresas/[id]`, `/obligaciones/[id]`. Las tres llaman `notFound()` para registros inexistentes después de inicializar el Store.
- Navegación declarativa con `Link`; acciones programáticas con `useRouter`. Las funciones de `components/app/routes.ts` solo construyen URLs: no son otro router ni mantienen estado.
- Contratos: filtros canónicos `q`, `estado`, `empresa`, `nivel`, `depto`, `region`, `vista` en searchParams; cambios con `router.replace(..., { scroll: false })`. Se conservan los predicados de filtrado existentes.
- Expediente: `?tab=` es la fuente de verdad. Las 17 pestañas usan enlaces reales y `router.push` en navegación programática. Una pestaña desconocida muestra Resumen.
- Boundaries del grupo y expediente con `{ error, retry }`; `global-error.tsx` incluye html/body propios. 404 raíz y por ficha; skeletons con shimmer continuo y reduced-motion; `template.tsx` reutiliza la animación de entrada existente.
- Auditoría usa el permiso `auditar`; Configuración requiere `ADMINISTRADOR`. El cambio de usuario vuelve a evaluar el gate sin recargar. `forbidden.tsx` comparte la UI de 403; no se activó autenticación experimental.
- Metadata estática en layouts de segmento (Server Components). `useSearchParams` queda bajo Suspense. Las páginas de datos son Client Components, según la fase localStorage del spec; no se tratan params/searchParams de servidor como objetos síncronos.
- La ficha de obligación reutiliza sus handlers y formulario. Un adaptador de lectura presenta el checklist demo `t/done` como `texto/listo`, sin escribir en el Store durante la lectura.

## Documentación consultada antes de implementar

Documentación **local instalada**, no supuestos de versiones anteriores:

- `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`
- `03-layouts-and-pages.md`, `04-linking-and-navigating.md`, `05-server-and-client-components.md` de la misma carpeta.
- `01-app/03-api-reference/03-file-conventions/error.md`, `not-found.md`, `loading.md`, `forbidden.md`.

La skill experimental `vercel-react-view-transitions` no estaba disponible. Se escogió la alternativa `template.tsx` expresamente permitida en el spec. Las skills de migración, App Router y prácticas React orientaron la separación shell/páginas, Suspense y preservación del Store cliente; webapp-testing guió las comprobaciones Playwright.

## Verificación ejecutada

| Comprobación | Resultado |
|---|---|
| `npx tsc --noEmit` después del build | PASS, cero errores |
| `pnpm build` | PASS; TypeScript también validado por Next |
| `node scripts/verify-app-router.cjs` | PASS: URLs/encoding, retry, privacidad del error, gate, adaptador inmutable, rutas y metadata |
| `git diff dc52171 --exit-code -- lib` | PASS, ningún cambio |
| Clic en cada entrada del NAV | PASS, 21 × 2 tamaños |
| Persistencia del shell durante esos clics | PASS, mismo nodo sidebar; no recargas completas |
| URL y `aria-current` de cada entrada | PASS, coinciden y no tienen hash |
| 17 pestañas CT-01 por clic | PASS, 17 × 2 tamaños; URL y `aria-selected` coinciden |
| Apertura directa `/contrato/CT-01?tab=pagos` | PASS |
| Apertura directa `/contratos?estado=Activo&depto=08` | PASS, cuatro contratos y controles concordantes |
| Escritura del filtro de texto | PASS, URL actualizada sin aumentar `history.length` |
| Limpiar filtros | PASS, `/contratos` sin parámetros y diez contratos |
| Buscador global → CT-01 | PASS, Link real, resultado abre la ficha y limpia el buscador |
| EMP-01 y OB-01 por URL directa | PASS; checklist de OB-01 presenta sus tres textos |
| CT-999, EMP-999, OB-999 | PASS, not-found específico dentro del shell |
| URL global desconocida | PASS, 404 global con enlace de regreso |
| Consulta → Auditoría y Configuración | PASS, UI de acceso restringido |
| Restaurar administrador | PASS, vista autorizada sin recarga; usuario original restaurado |
| Overflow horizontal de documento | Ninguno en los recorridos medidos; las tablas conservan scroll interno |
| Consola de la navegación final al dashboard | Cero errores y cero warnings |
| HTML inicial de ficha | Contiene `workspace-skeleton` y bloques `skeleton-metric`; no es un lienzo vacío |

No se reinició el servidor de localhost:3000. No se modificó `lib/`, no se restauraron datos demo ni se ejecutaron operaciones de negocio durante estas pruebas. El cambio temporal de perfil se restauró a Laura Méndez.

## Capturas e inspección visual

Destino solicitado:

`C:\Users\Luis\AppData\Local\Temp\opencode\qa-rediseño\routes\`

- **94 capturas canónicas**: 47 casos en 1440×900 y 390×844; dimensiones verificadas. Una captura exploratoria adicional del expediente también queda disponible.
- 42 del NAV, 34 del expediente, 4 de fichas válidas de empresa/obligación, 8 de estados not-found, 4 de permisos y 2 de contratos filtrados.
- 47 hojas `*-sheet.png`, abiertas e inspeccionadas como imágenes. `manifest.json` conserva los resultados de URL, estado activo, overflow y shell persistente.
- Sidebar oscuro degradado, topbar, fuentes, cifras, cards y espaciados de las vistas se conservaron. No se cambiaron sus tokens ni CSS visual para migrar rutas. Las adiciones CSS se limitan a skeletons y nuevos estados de ruta.
- La inspección detectó inicialmente textos vacíos en la nueva ficha OB-01 y falta de padding en su encabezado. Se corrigieron en la capa compartida de presentación y se recapturó la ficha en ambos tamaños.
- Las capturas son de viewport: no equivalen a una auditoría de todos los contenidos fuera de pantalla ni de todos los formularios de negocio.

## Pendientes y límites explícitos

1. **Historial atrás/adelante: no certificado.** `browser_navigate_back` fue rechazado con `requires approval, policy never`. No se intentó sortearlo con otra herramienta. La comprobación completa de volver de Pagos a la pestaña anterior y avanzar otra vez queda pendiente.
2. **Interacción con selects nativos: no certificada.** `browser_select_option` también requiere aprobación. Sí se verificaron los valores recibidos por enlaces profundos, las pestañas mediante Link, la escritura del filtro de texto y la limpieza; no se da por ejecutado un cambio de opción nativa.
3. **Retry: contrato unitario aprobado, recuperación real pendiente.** El botón invoca `retry()` exactamente una vez y no expone el mensaje de error. No se provocó un fallo artificial en la aplicación ni se certifica una recuperación integral del boundary Next en navegador.
4. **Loading:** existen las convenciones y el HTML inicial contiene el skeleton. No se capturó una transición con red ralentizada; la navegación local rápida puede resolver sin mostrar el fallback. No se añadieron demoras artificiales.
5. **404 de fichas localStorage:** el cliente llama al boundary nativo y Next agrega noindex, pero el servidor no puede saber si un ID existe en el almacenamiento del navegador. No se promete HTTP 404 para esas respuestas ya enviadas/streamed; la validación HTTP de registros requiere datos accesibles al servidor en otra fase.
6. **403:** es un gate de interfaz sobre la simulación de roles existente, no autorización de backend ni respuesta HTTP 403. No introduce garantías de seguridad ajenas al modelo actual.

La implementación y el build están listos; la aceptación de QA no se declara al 100% mientras esas pruebas interactivas y de recuperación sigan pendientes.

## Capas y reversibilidad

- `d4a1dfb`: shell, rutas, filtros, pestañas y boundaries.
- `c667523`: enlaces profundos, buscador y presentación de la ficha de obligación.
- Commit `test(routes)`: contratos unitarios reproducibles sin navegador ni escrituras de negocio.
- Commit final `docs(routes)`: este informe de cobertura y límites.

Si fuese necesario revertir, aplicar `git revert` a las capas de esta migración en orden inverso, revisando previamente cambios posteriores. No ejecutar reset destructivo. Como no cambió el formato persistido durante la lectura ni `lib/`, no hay migración de datos que deshacer. La retirada del router hash es intencional: los favoritos antiguos con hash deben actualizarse a las URLs reales.
