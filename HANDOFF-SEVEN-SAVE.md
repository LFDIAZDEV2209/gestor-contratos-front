# HANDOFF · Seven Save — Estado del proyecto y relanzamiento de agentes

> Última actualización: **2026-10-01** · Coordinador: agente OpenCode (`w2:p1`, Herdr workspace `w2`)
> Documento maestro para retomar el trabajo **sin reconstruir contexto**. Léelo completo antes de despachar agentes.

---

## 1. Qué es Seven Save

- Plataforma web de **gestión integral de contratos** (ex "Gestor Integral de Contratos / Nexo").
- Repo: `C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-front` — **Next.js 16 App Router + React 19 + Tailwind 4 + TypeScript**, sin backend (fase 0: datos demo en `localStorage`, store en `lib/store.ts`, semilla en `lib/demo.ts`).
- Fuente de verdad funcional: `PROMPT_INICIAL.md` (raíz de Repos) y `files/01–12`.
- Identidad: marca **7S**, palabra "Seven Save", empresa FYA TECH SAS.
- **Login real de demo** en `/login` (guard global + logout; contraseña demo: cualquier texto de 6+ caracteres; usuarios demo con chips de acceso rápido).

## 2. Decisiones de diseño vigentes (NO revertir)

| Token | Valor | Nota |
|---|---|---|
| `--brand` | `#0F8579` | Aclarado en la 2ª pasada (antes `#0B6E68`). Contraste AA 4.5:1 con blanco. |
| `--brand-2` | `#0C6A60` | |
| `--brand-3` | `#17A08F` | Solo acentos decorativos. |
| Hero PageHeader | `135deg brand → brand-2 → #0A5F57` | Termina en `#0A5F57` (antes `#063F3B`, muy oscuro). |
| Sidebar | `--side #1A4B47`, `--side-2 #215853`, ink `#C4DBD8` | Aclarado 2 veces por feedback del usuario: el sidebar ya NO es casi negro. Header y footer del sidebar tienen panel blanco translúcido propio. |
| `--faint` | solo decorativo | QA a11y: texto informativo usa `--muted` (fix `C01–C04` aplicado). |

- PageHeader: `<PageHeader className="ph">` (import de `components/ui/Workspace.tsx`); `variant="hero"` solo para la vista principal de cada módulo.
- `next.config.mjs`: `devIndicators: false` (el badge flotante tapaba CTAs en móvil).
- Estándar de tablas: `.tbl` dentro de `TableViewport` con clase `tbl-wrap` (scroll horizontal + aviso ≤620px + padding last-child 24px).

## 3. Estado al cierre del día 01/10/2026

- ✅ Renombrado a Seven Save en: metadata raíz + 22 layouts de ruta, sidebar (marca 7S), `global-error`, 404 (not-found con identidad + CTAs), `lib/export.ts` (PDF/Excel), `package.json` (`seven-save-front`), iconos SVG/PNG (monograma 7S teal), `PLAN-IMPLEMENTACION.md`. Grep de residuos: 0 visibles (solo rutas físicas internas y eventos internos `nexo:*` en `Feedback.tsx`, invisibles al usuario).
- ✅ Login completo con guard, logout, móvil verificado. Flujo E2E en `scripts/qa-login-flow.mjs` — 5 pasos, todos verdes.
- ✅ 24 vistas + expediente (17 pestañas) pulidos por la flota: PageHeaders, empty states reales, skeletons, micro-interacciones, contraste AA, responsive 1440/768/390.
- ✅ 23 controles a11y corregidos (labels/aria-label) según auditoría `docs/prompts-fleet/a11y-audit.md` — ver `C:\Users\Luis\AppData\Local\Temp\opencode\fleet\a11y-audit.md` si sigue existiendo; copia recomendada a `docs/`.
- ✅ `npx tsc --noEmit`: **0 errores** (verificado por codex tras cada ola).
- ✅ `.gitignore` profesional (node_modules, .next, logs, scratch/, .playwright-mcp/, .env, tsbuildinfo, editor/OS).
- ✅ **Ola final qa3 cerrada**: 100 capturas nuevas + revisión visual de coordinador (el agente QA quedó sin credenciales a media revisión y el coordinador la completó) → veredicto **APTO** en `QA-UX-REPORT.md` § "Ola final (qa3)".
- ✅ **Build de producción verde**: `pnpm build` → `Compiled successfully`, 21 rutas generadas (incl. `/login`, `/contrato/[id]`, `/empresas/[id]`, `/obligaciones/[id]`); log en `build-final.log` (ignorado por git).

## 4. Pipelines QA con Playwright (replicables)

```bash
cd C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-front

# Captura 1 ruta × viewports (bypass de sesión incluido; imprime JSON con errores de consola)
node scripts/qa-capture.mjs --url /dashboard --out scratch/qa/dash --sizes 1440,768,390 [--full]

# Matriz completa 25 rutas × 4 viewports → .playwright-mcp/qa2-*/qa3-* (la escribió el agente QA)
node scripts/qa-runner.mjs

# E2E del flujo de sesión (guard, login inválido, login válido, logout, móvil)
node scripts/qa-login-flow.mjs scratch/qa/flow

# Hojas de contacto (agrupa stem-{1440,1280,768,390}.png de .playwright-mcp en sheets de 4)
powershell -File scripts/qa-contact-sheets.ps1 -Round qa3
```

- Playwright 1.63 instalado como devDependency + Chromium headless shell 153 instalado.
- Capturas históricas: `qa2-*` (ola 1) y `qa3-*` (ola final) en `gestor-contratos-front\.playwright-mcp\` (ignoradas por git).
- Reporte de auditoría: `QA-UX-REPORT.md` (raíz del repo) — incluye matriz de las 25 rutas y top 10 prioridades de la ola 1; añadir la sección de la ola final.

## 5. Cómo relanzar la flota mañana (Herdr)

1. Verificar `HERDR_ENV=1` (si no, el CLI de herdr no controla nada).
2. Levantar el dev server (SIEMPRE en background, nunca en primer plano):
   ```powershell
   $conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
   if ($conn) { $conn.OwningProcess | Select-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force } ; Start-Sleep 2 }
   Start-Process cmd -ArgumentList '/c','pnpm dev > dev-server.log 2>&1' -WindowStyle Hidden -WorkingDirectory "C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-front"
   # polling: Get-NetTCPConnection -LocalPort 3000
   ```
3. Crear panes y arrancar agentes OpenCode:
   ```powershell
   herdr pane split --current --direction right --cwd "C:\Users\Luis\Documents\Nexo\Repos\gestor-contratos-front" --no-focus
   # → toma el pane_id del JSON de respuesta
   herdr agent start <nombre> --kind opencode --pane <pane_id>
   herdr agent prompt <nombre> "Lee COMPLETO el archivo <ruta-del-prompt> y ejecutalo completo."
   ```
   - **Truco crítico**: pasar el prompt como *referencia a archivo* (PowerShell 5.1 parte los strings multilínea). Los prompts de la flota están en `docs/prompts-fleet/*.txt` (25 archivos: lotes por pane, olas 2/2.5/final).
   - Si un agente queda `blocked` por saturación de imágenes en su contexto (error "Too many images 33 > 30"): limpiar con `herdr pane run <pane> /clear` + `herdr agent send-keys <pane> enter`, y re-prompt pidiendo **revisar ≤3 PNG por tanda**.
   - Estados de Herdr van con lag en agentes `agy` (Antigravity): verificar con `herdr agent read <pane> --source recent-unwrapped` antes de asumir que terminó.
4. Organización probada hoy (mapear igual):

| Pane | Lote | Archivos |
|---|---|---|
| coordinador (tú) | fundamentos compartidos | `globals.css`, `app/layout.tsx`, `login/*`, `components/app/*`, `lib/store.ts` |
| QA Playwright | matriz + reporte | `scripts/qa-*`, `QA-UX-REPORT.md` (solo reporta, no edita vistas) |
| codex | verificador + a11y + branding | auditorías y fixes mínimos con tsc |
| lote GEN | Dashboard, Gerencia, Calendario | `DashboardView`, `GerenciaView`, `CalendarioView` |
| lote CTB-A | Empresas + detalle + Subcontratos | `EmpresasView`, `EmpresaView`, `SubcontratosView` |
| lote CTB-B | Obligaciones, Ejecución, Pagos, Modificaciones | idem ×4 |
| lote SEG | Garantías, Aseguradoras, Documentos, Actas | idem ×4 |
| lote CTRL | Alertas, Riesgos, Incumplimientos, Auditoría | idem ×4 |
| lote SYS | Reportes, Configuración | idem ×2 |
| EXP-A | Expediente shell + pestañas 1–9 | `ExpedienteView` + Tab{Resumen,Informacion,Obligaciones,Garantias,Pagos,Actas,Documentos,Timeline,Auditoria} |
| EXP-B | Expediente pestañas 10–17 | Tab{Ejecucion,Entregables,Subcontratos,Modificaciones,Prorrogas,Suspensiones,Incumplimientos,Riesgos} |

## 6. Reglas de oro de la flota (pégalas en cada prompt nuevo)

- PROHIBIDO tocar: `app/globals.css`, `app/layout.tsx`, `app/login/*`, `components/app/*`, `lib/*`, `components/ui/*` y archivos de OTROS agentes (propiedad de archivos = cero conflictos).
- NO commits ni builds: los hace el coordinador/codex al cierre.
- Primitivos: solo los de `components/ui/Workspace.tsx` (`PageHeader`, `EmptyState`, `Surface`, `Field`, `TableViewport`, `DataTable`, `FormGrid`, `MetricCard`). Nuevo primitivo → reportar, no crear.
- QA visual obligatoria: capturas con `scripts/qa-capture.mjs` + ABRIR los PNG y corregir lo que se ve roto (no basta leer código).
- Textos y comentarios en español.

## 7. Tareas abiertas para mañana

1. **Commit único coordinado** (los agentes no commitearon por regla): revisar `git status`, agrupar en 1–2 commits limpios (`feat(ux): segunda pasada Seven Save` + `chore: qa tooling`).
2. Menor (no bloqueante): truncamiento estético de eventos en el grid mensual del calendario a 768px (mitigado con vistas Semana/Día; a 390 ya hay lista de agenda).
3. Si el usuario pide más rondas: replicar el ciclo (lotes → QA captura → fixes → re-captura → build). El dev server quedó corriendo en :3000 al cierre del día.
4. Opcional: `pnpm-lock.yaml` menciones "GC" son hashes (falsos positivos, no tocar).

## 8. Contacto de los artefactos hoy

- Prompts de flota: `docs/prompts-fleet/` (copia de `C:\Users\Luis\AppData\Local\Temp\opencode\fleet\`).
- Reportes: `QA-UX-REPORT.md` (raíz), `a11y-audit.md` (en temp, copiar a `docs/` si no está).
- Capturas: `.playwright-mcp/qa2-*` (100), `qa3-*` (100), `scratch/qa/*` (ad-hoc).
- Plan y pruebas funcionales: `PLAN-IMPLEMENTACION.md`, `files/12-PLAN-DE-PRUEBAS.md`.
