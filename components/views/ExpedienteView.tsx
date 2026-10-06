'use client';
import { fieldIcon } from '../forms/fieldIcon';
import { Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, EmptyState } from '../ui/Workspace';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { contractHref, companyHref } from '../app/routes';
import { expHref } from '../expediente/routes';
import type { Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { LEVEL_TXT } from '../../lib/catalog';
import { pct, clamp, fdate, nowStamp, money, moneyM } from '../../lib/format';
import { deptoNames } from '../../lib/geo';
import { saveFile } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { SectionHeader } from '../ui/SectionHeader';
import { notify, requestReason } from '../ui/Feedback';
import { Icon } from '../icons';

import { TabResumen } from '../expediente/TabResumen';
import { TabInformacion } from '../expediente/TabInformacion';
import { TabDocumentos } from '../expediente/TabDocumentos';
import { TabObligaciones } from '../expediente/TabObligaciones';
import { TabEntregables } from '../expediente/TabEntregables';
import { TabEjecucion } from '../expediente/TabEjecucion';
import { TabPagos } from '../expediente/TabPagos';
import { TabGarantias } from '../expediente/TabGarantias';
import { TabActas } from '../expediente/TabActas';
import { TabModificaciones } from '../expediente/TabModificaciones';
import { TabSuspensiones } from '../expediente/TabSuspensiones';
import { TabProrrogas } from '../expediente/TabProrrogas';
import { TabRiesgos } from '../expediente/TabRiesgos';
import { TabIncumplimientos } from '../expediente/TabIncumplimientos';
import { TabSubcontratos } from '../expediente/TabSubcontratos';
import { TabAuditoria } from '../expediente/TabAuditoria';
import { TabTimeline } from '../expediente/TabTimeline';

interface TabDef {
  id: string;
  label: string;
  icon: string;
  countKey?: string;
}

const TABS: TabDef[] = [
  { id: 'resumen', label: 'Resumen', icon: 'gauge' },
  { id: 'info', label: 'Información contractual', icon: 'scroll-text' },
  { id: 'documentos', label: 'Documentos', icon: 'folder', countKey: 'documents' },
  { id: 'obligaciones', label: 'Obligaciones', icon: 'list-check', countKey: 'obligations' },
  { id: 'entregables', label: 'Entregables', icon: 'package', countKey: 'deliverables' },
  { id: 'ejecucion', label: 'Ejecución', icon: 'activity' },
  { id: 'pagos', label: 'Pagos', icon: 'receipt', countKey: 'payments' },
  { id: 'garantias', label: 'Seguros y garantías', icon: 'shield-check', countKey: 'guarantees' },
  { id: 'actas', label: 'Actas', icon: 'file-signature', countKey: 'actas' },
  { id: 'modificaciones', label: 'Modificaciones', icon: 'edit', countKey: 'modifications' },
  { id: 'suspensiones', label: 'Suspensiones', icon: 'circle-pause', countKey: 'suspensiones' },
  { id: 'prorrogas', label: 'Prórrogas', icon: 'calendar-plus', countKey: 'prorrogas' },
  { id: 'riesgos', label: 'Riesgos', icon: 'alert-triangle', countKey: 'risks' },
  { id: 'incumplimientos', label: 'Incumplimientos', icon: 'gavel', countKey: 'breaches' },
  { id: 'subcontratos', label: 'Subcontratos', icon: 'sitemap', countKey: 'subcontracts' },
  { id: 'auditoria', label: 'Auditoría', icon: 'fingerprint', countKey: 'audit' },
  { id: 'timeline', label: 'Línea de tiempo', icon: 'calendar-clock' }
];

/** Estado del contrato → color semántico del badge (files/08). */
const colorEstado = (estado: string) =>
  estado === 'Activo' ? 'ok'
  : estado === 'Suspendido' ? 'warn'
  : estado === 'Vencido' ? 'crit'
  : estado === 'Anulado' ? 'na'
  : 'default';

// Formato compacto sin cortes de palabra en móvil ("mil M" indivisible).
const nb = (s: string) => s.replace('mil M', 'mil\u00A0M');

export const ExpedienteView = ({
  id
}: {
  id: string;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'resumen';
  const activeTab = TABS.some(tab => tab.id === requestedTab) ? requestedTab : 'resumen';
  const setActiveTab = (tab: string) => router.push(contractHref(id, tab), { scroll: false });
  const onBack = () => router.push('/contratos');
  const tabsRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDetailsElement>(null);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 260;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }
  };

  useEffect(() => {
    if (tabsRef.current) {
      const activeEl = tabsRef.current.querySelector<HTMLElement>('.tab.on');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // El menú de acciones se cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!actionsOpen) return;
    actionsRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDoc = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActionsOpen(false);
        actionsRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [actionsOpen]);

  const c = Store.get('contracts', id) as Contract | undefined;
  if (!c) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Contrato no encontrado"
          description="El identificador solicitado no existe en el sistema o el registro fue anulado."
          action={
            <Link className="btn pri" href="/contratos" style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver a Contratos
            </Link>
          }
        />
      </div>
    );
  }

  const m = M(c);
  const company = Store.get('companies', c.companyId);

  // Tab counts
  const getTabCount = (tab: TabDef): number | null => {
    if (!tab.countKey) return null;
    if (tab.countKey === 'suspensiones') {
      return (Store.byContract('modifications', c.id) as any[]).filter(
        (x) => x.tipo === 'Suspensión' || x.tipo === 'Reinicio'
      ).length;
    }
    if (tab.countKey === 'prorrogas') {
      return (Store.byContract('modifications', c.id) as any[]).filter(
        (x) => x.tipo === 'Prórroga'
      ).length;
    }
    if (tab.countKey === 'audit') {
      return (Store.all('audit') as any[]).filter((a) => a.contractId === c.id).length;
    }
    return (Store.byContract as any)(tab.countKey, c.id).length;
  };

  /* ── Acciones del menú del expediente ────────────────────────────────── */

  const handlePrint = () => window.print();

  const handleExportExpediente = () => {
    if (!AuthService.guard('exportar')) return;
    // Descarga el expediente completo (contrato + colecciones hijas) como JSON.
    const colecciones = ['subcontracts', 'obligations', 'deliverables', 'execs', 'payments', 'guarantees', 'actas', 'modifications', 'risks', 'breaches', 'plans', 'documents'];
    const expediente: Record<string, unknown> = { contrato: c };
    for (const col of colecciones) expediente[col] = (Store.byContract as any)(col, c.id);
    saveFile(`expediente-${c.numero}-${nowStamp().slice(0, 10)}.json`, JSON.stringify(expediente, null, 2), 'application/json');
    Audit.log({ contractId: c.id, modulo: 'Expediente', accion: 'Exportación', campo: 'JSON', obs: 'Descarga del expediente completo' });
    notify('Expediente exportado (JSON)');
  };

  const handleAnularContrato = async () => {
    if (!AuthService.guard('anular')) return;
    const mot = await requestReason(`Motivo de anulación del contrato ${c.numero}:`);
    if (!mot) return;
    Store.anular('contracts', c.id, mot);
    notify(`Contrato ${c.numero} anulado`);
    onBack();
  };

  const insurers = (Store.byContract('guarantees', c.id) as any[])
    .map((g) => g.aseguradora)
    .filter(Boolean);
  const uniqueInsurers = Array.from(new Set(insurers));

  const cobertura = deptoNames(c.deptos);
  const razones = m.razones.map((r) => r.t);
  const razonesClave = razones.slice(0, 2);
  const razonesExtras = razones.length - razonesClave.length;

  const handleTabChangeByName = (tabName: string) => {
    const found = TABS.find(
      (t) =>
        t.label.toLowerCase() === tabName.toLowerCase() ||
        t.id.toLowerCase() === tabName.toLowerCase()
    );
    if (found) setActiveTab(found.id);
  };

  return (
    <div className="max-[620px]:pb-20">
      {/* Crumb */}
      <nav className="crumb" aria-label="Ruta de navegación">
        <Link href="/contratos">Contratos</Link> /{' '}
        {company ? (
          <Link href={companyHref(company.id)}>{company.razon}</Link>
        ) : (
          '—'
        )}{' '}
        / Expediente
      </nav>

      {/* Expediente Header */}
      <header className="exp-head" style={{ '--railc': `var(--${m.sem})` } as any}>
        <div className="exp-top">
          <div className="exp-identity">
            <div className="exp-identity-row">
              <h1 className="exp-num">Contrato #{c.numero}</h1>
              <Badge
                text={m.estado}
                color={colorEstado(m.estado)}
              />
              <span className={`semtag ${m.sem}`}>
                <span className={`sem ${m.sem}`} aria-hidden="true" /> {LEVEL_TXT[m.nivel]}
              </span>
            </div>
            <div className="exp-type">{c.tipo}{c.modalidad ? ` · ${c.modalidad}` : ''}</div>
          </div>

          <div className="exp-actions">
            <Link className="btn pri" href={expHref(id, 'validacion')}>
              <Icon name="clipboard-check" /> VALIDAR CONTRATO
            </Link>
            {!c.anulado && (
              <Link className="btn" href={expHref(id, 'editar')}><Icon name="pen" /> Editar</Link>
            )}
            <Link className="btn" href={expHref(id, 'conciliacion')}><Icon name="scale-balanced" /> Conciliación</Link>
            {/* Menú de acciones del expediente */}
            <div ref={actionsRef} className="exp-actions-menu">
              <Button
                className="btn"
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                aria-controls="exp-actions-list"
                onClick={() => setActionsOpen(!actionsOpen)}
              >
                <Icon name="ellipsis" /> Acciones <Icon name="chevron-down" />
              </Button>
              {actionsOpen && (
                <div className="exp-actions-dropdown" id="exp-actions-list" role="menu" aria-label="Acciones del expediente" onKeyDown={(event) => {
                  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
                  event.preventDefault();
                  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'));
                  const index = items.indexOf(document.activeElement as HTMLElement);
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
                  items[next]?.focus();
                }} onBlur={(event) => { if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) setActionsOpen(false); }}>
                  <Button role="menuitem" className="btn sm ghost" onClick={() => { setActionsOpen(false); handlePrint(); }}>
                    <Icon name="print" /> Imprimir expediente
                  </Button>
                  <Button role="menuitem" className="btn sm ghost" onClick={() => { setActionsOpen(false); handleExportExpediente(); }}>
                    <Icon name="file-export" /> Exportar expediente (JSON)
                  </Button>
                  {!c.anulado && (
                    <Button
                      className="btn sm ghost"
                      role="menuitem"
                      onClick={() => {
                        setActionsOpen(false);
                        void handleAnularContrato();
                      }}
                      style={{ color: 'var(--crit-text)' }}
                    >
                      <Icon name="ban" /> Anular contrato…
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="exp-context-preview">
          <span className="exp-context-icon" aria-hidden="true"><Icon name="building" /></span>
          <div className="exp-context-copy" title={`${company?.razon || 'Empresa no registrada'} · ${c.objeto}`}>
            {company ? <Link className="exp-company" href={companyHref(company.id)}>{company.razon}</Link> : <span>Empresa no registrada</span>}
            <span className="exp-context-separator"> · </span>
            <span className="exp-obj" title={c.objeto}>{c.objeto}</span>
          </div>
          <button className="exp-context-toggle" type="button" aria-controls="exp-context-full" onClick={() => {
            if (contextRef.current) {
              contextRef.current.open = true;
              contextRef.current.querySelector<HTMLElement>('summary')?.focus();
            }
          }}>
            Ver contexto <Icon name="chevron-down" />
          </button>
        </div>

        {/* Aviso crítico: contrato anulado (solo consulta) */}
        {c.anulado && (
          <div
            role="alert" className="exp-annulled"
          >
            <Icon name="triangle-exclamation" />
            <span>
              Contrato anulado: el expediente queda en solo consulta y no admite nuevas
              actuaciones.
            </span>
          </div>
        )}

        {/* Cifras clave siempre visibles */}
        <div className="exp-meta exp-key-strip">
          <div>
            <span><Icon name="coins" /> Valor actualizado</span>
            <b className="mono" title={money(m.valorActual)}>{nb(moneyM(m.valorActual))}</b>
          </div>
          <div>
            <span><Icon name="activity" /> Ejecutado</span>
            <b className="mono" title={money(m.ejecutado)}>{nb(moneyM(m.ejecutado))} <span className="exp-value-detail">{pct(m.pctFin, 0)}</span></b>
          </div>
          <div>
            <span><Icon name="money-check-dollar" /> Saldo</span>
            <b className="mono" title={money(m.saldo)} style={{ color: m.saldo < 0 ? 'var(--crit-text)' : 'inherit' }}>
              {nb(moneyM(m.saldo))} <span className="exp-value-detail">{pct(m.pctSaldo, 0)}</span>
            </b>
          </div>
          <div>
            <span><Icon name="calendar-clock" /> Días restantes</span>
            <b className="mono" style={{ color: m.restantes != null && m.restantes <= 5 && (m.activo || m.estado === 'Vencido') ? 'var(--crit-text)' : 'inherit' }}>
              {m.restantes == null ? '—' : m.restantes < 0 ? `Vencido (${m.restantes} d)` : `${m.restantes} d`}
            </b>
          </div>
          <div>
            <span><Icon name="receipt" /> Valor pagado</span>
            <b className="mono" title={money(m.pagado)}>{nb(moneyM(m.pagado))}</b>
          </div>
          <div>
            <span><Icon name="map-pin" /> Cobertura</span>
            <b className="exp-coverage" tabIndex={0} title={`${c.municipio ? `${c.municipio} · ` : ''}${cobertura.join(', ') || '—'}`}>{c.municipio ? `${c.municipio} · ` : ''}{cobertura.join(', ') || '—'}</b>
          </div>
        </div>

        {/* Razón principal del semáforo, siempre visible cuando hay alerta */}
        {m.nivel !== 'ok' && (
          <div className={`reason exp-reason ${m.sem}`}>
            <Icon name={m.sem === 'crit' ? 'alert-circle' : m.sem === 'na' ? 'info' : 'alert-triangle'} />
            <div><b>{LEVEL_TXT[m.nivel]}</b> — {razonesClave.join(' ')}
            {razonesExtras > 0 && (
              <details className="exp-reason-more">
                <summary>
                  +{razonesExtras} factor{razonesExtras > 1 ? 'es' : ''} más
                </summary>
                <span className="small"> · {razones.slice(2).join(' · ')}</span>
              </details>
            )}</div>
          </div>
        )}

        {/* 3 Progress Bars con clamp y badge de exceso */}
        <div className="dual exp-progress">
          <div className="row">
            <span><Icon name="calendar-clock" /> Tiempo transcurrido</span>
            <div className="bar lg" role="progressbar" aria-label="Porcentaje de tiempo transcurrido" aria-valuetext={pct(m.pctTiempo)} aria-valuenow={Math.round(clamp(m.pctTiempo, 0, 100))} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${clamp(m.pctTiempo, 0, 100)}%`, background: m.pctTiempo > 100 || (m.restantes != null && m.restantes <= 5 && m.activo) ? 'var(--crit)' : m.pctTiempo >= 85 ? 'var(--warn)' : 'var(--info)' }}></i>
            </div>
            <b>{pct(m.pctTiempo, 0)}</b>
          </div>
          <div className="row">
            <span><Icon name="coins" /> Ejecución financiera</span>
            <div className="bar lg" role="progressbar" aria-label="Porcentaje de ejecución financiera" aria-valuetext={pct(m.pctFin)} aria-valuenow={Math.round(clamp(m.pctFin, 0, 100))} aria-valuemin={0} aria-valuemax={100}>
              <i
                style={{
                  width: `${clamp(m.pctFin, 0, 100)}%`,
                  background: m.pctFin > 100 ? 'var(--crit)' : 'var(--ok)'
                }}
              ></i>
            </div>
            <div className="exp-progress-value">
              <b>{pct(m.pctFin, 0)}</b>
              {m.pctFin > 100 && (
                <span className="badge b-crit">
                  Excede {Math.round(m.pctFin - 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="row">
            <span><Icon name="gauge" /> Ejecución física</span>
            <div className="bar lg" role="progressbar" aria-label="Porcentaje de ejecución física" aria-valuetext={pct(m.pctFis)} aria-valuenow={Math.round(clamp(m.pctFis, 0, 100))} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${clamp(m.pctFis, 0, 100)}%`, background: m.pctFis > 100 ? 'var(--crit)' : 'var(--info)' }}></i>
            </div>
            <b>{pct(m.pctFis, 0)}</b>
          </div>
        </div>

        {/* Contexto completo plegado */}
        <details className="context-disclosure" id="exp-context-full" ref={contextRef}>
          <summary><Icon name="folder" /> Contexto contractual y metadatos completos <span className="exp-disclosure-chevron" aria-hidden="true"><Icon name="chevron-down" /></span></summary>
          <div className="exp-context-object"><SectionHeader as="h3" icon="scroll-text" title="Objeto contractual" /><p>{c.objeto}</p></div>
          <div className="exp-context-groups">
            <section className="exp-context-group" aria-labelledby="exp-partes-title">
              <SectionHeader as="h3" id="exp-partes-title" icon="users" title="Partes involucradas" />
              <dl className="exp-parties">
                <div><dt>Empresa</dt><dd>{company ? <Link href={companyHref(company.id)}>{company.razon}</Link> : '—'}</dd></div>
                <div><dt>Contratista</dt><dd>{c.contratista}{c.nitContratista && <span className="exp-context-note">NIT {c.nitContratista}</span>}</dd></div>
                <div><dt>Representante legal</dt><dd>{c.repContratista || '—'}</dd></div>
                <div><dt>Responsable</dt><dd>{c.responsable || '—'}</dd></div>
                <div><dt>Supervisor / Interventor</dt><dd>{c.supervisor || '—'}{c.interventor ? ` / ${c.interventor}` : ''}</dd></div>
                <div><dt>Aseguradoras</dt><dd><Link href={contractHref(id, 'garantias')} title="Ver la pestaña de seguros y garantías">{uniqueInsurers.length > 0 ? uniqueInsurers.join(' · ') : <span className="exp-no-policies">Sin pólizas</span>}</Link></dd></div>
              </dl>
            </section>
            <section className="exp-context-group" aria-labelledby="exp-fechas-title">
              <SectionHeader as="h3" id="exp-fechas-title" icon="calendar-clock" title="Fechas y plazos" />
              <dl>
                <div><dt>Firma</dt><dd>{fdate(c.fechaFirma)}</dd></div>
                <div><dt>Inicio</dt><dd>{fdate(c.fechaInicio)}</dd></div>
                <div><dt>Terminación</dt><dd>{fdate(c.fechaFin)}</dd></div>
              </dl>
            </section>
            <section className="exp-context-group" aria-labelledby="exp-cobertura-title">
              <SectionHeader as="h3" id="exp-cobertura-title" icon="map-pin" title="Cobertura territorial" />
              <dl>
                <div><dt>Municipio</dt><dd>{c.municipio || '—'}</dd></div>
                <div><dt>Departamentos de cobertura</dt><dd>{cobertura.join(', ') || '—'}</dd></div>
              </dl>
            </section>
          </div>

          {/* Factores del semáforo completos */}
          {razones.length > 0 && (
            <section className="exp-context-factors" aria-labelledby="exp-factores-title">
              <SectionHeader as="h3" id="exp-factores-title" icon="alert-triangle" title={`Factores evaluados (${razones.length})`} />
              <ul>
                {m.razones.map((r, i) => (
                  <li key={i}><span className={`sem ${r.l}`} aria-hidden="true" /><span>{r.t}</span></li>
                ))}
              </ul>
            </section>
          )}
        </details>
      </header>

      {/* Tabs con navegación horizontal y selector móvil para 17 pestañas */}
      <Surface className="panel exp-tabs-panel">
        <div
          className="section-tabs-toolbar"
        >
          {/* Botón flecha izquierda */}
          <Button
            className="icon-btn section-tabs-arrow"
            onClick={() => scrollTabs('left')}
            title="Desplazar pestañas hacia la izquierda"
            aria-label="Pestañas anteriores"
          >
            <Icon name="chevron-left" />
          </Button>

          {/* Carrusel de pestañas */}
          <div
            ref={tabsRef}
            className="tabs"
            role="tablist"
            aria-label="Secciones del expediente"
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                const target = event.target as HTMLElement;
                target.click();
                return;
              }
              const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const index = TABS.findIndex(t => t.id === activeTab);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
              setActiveTab(TABS[next].id);
              requestAnimationFrame(()=>tabsRef.current?.querySelector<HTMLElement>(`#tab-${TABS[next].id}`)?.focus());
            }}
          >
            {TABS.map((t) => {
              const count = getTabCount(t);
              const isActive = activeTab === t.id;
              return (
                <Link
                  key={t.id}
                  className={`tab ${isActive ? 'on' : ''}`}
                  href={contractHref(id, t.id)}
                  scroll={false}
                  aria-selected={isActive}
                  id={`tab-${t.id}`}
                  aria-controls="expediente-panel"
                  tabIndex={isActive ? 0 : -1}
                  role="tab"
                >
                  <span aria-hidden="true"><Icon name={t.icon} /></span>
                  {t.label}
                  {count != null && <span className="n" aria-label={`${count} registros`}>{count}</span>}
                </Link>
              );
            })}
          </div>

          {/* Botón flecha derecha */}
          <Button
            className="icon-btn section-tabs-arrow"
            onClick={() => scrollTabs('right')}
            title="Desplazar pestañas hacia la derecha"
            aria-label="Siguientes pestañas"
          >
            <Icon name="chevron-right" />
          </Button>

          {/* Selector desplegable de sección (muy útil en tablet y móvil) */}
          <div className="section-tabs-select">
            <Select icon={fieldIcon("activeTab", "Ir a sección del expediente", "")}
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              aria-label="Ir a sección del expediente"
            >
              {TABS.map((t, idx) => (
                <option key={t.id} value={t.id}>
                  {idx + 1}. {t.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Tab Body */}
        <div className="tab-content" id="expediente-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === 'resumen' && <TabResumen cid={id} onTabChange={handleTabChangeByName} />}
          {activeTab === 'info' && <TabInformacion cid={id} />}
          {activeTab === 'documentos' && <TabDocumentos cid={id} />}
          {activeTab === 'obligaciones' && <TabObligaciones cid={id} />}
          {activeTab === 'entregables' && <TabEntregables cid={id} />}
          {activeTab === 'ejecucion' && <TabEjecucion cid={id} />}
          {activeTab === 'pagos' && <TabPagos cid={id} />}
          {activeTab === 'garantias' && <TabGarantias cid={id} />}
          {activeTab === 'actas' && <TabActas cid={id} />}
          {activeTab === 'modificaciones' && <TabModificaciones cid={id} />}
          {activeTab === 'suspensiones' && <TabSuspensiones cid={id} />}
          {activeTab === 'prorrogas' && <TabProrrogas cid={id} />}
          {activeTab === 'riesgos' && <TabRiesgos cid={id} />}
          {activeTab === 'incumplimientos' && <TabIncumplimientos cid={id} />}
          {activeTab === 'subcontratos' && <TabSubcontratos cid={id} />}
          {activeTab === 'auditoria' && <TabAuditoria cid={id} />}
          {activeTab === 'timeline' && (
            <TabTimeline cid={id} onTabChange={handleTabChangeByName} />
          )}
        </div>
      </Surface>
    </div>
  );
};
