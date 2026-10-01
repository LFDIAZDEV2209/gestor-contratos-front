'use client';
import { Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable } from '../ui/Workspace';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { contractHref, companyHref } from '../app/routes';
import type { Contract, VIssue, Document as DocType } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { Validator } from '../../lib/validator';
import { LEVEL_TXT } from '../../lib/catalog';
import { pct, clamp, fdate, nowStamp } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
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
import { ContratoFormModal } from './ContratoFormModal';

interface TabDef {
  id: string;
  label: string;
  countKey?: string;
}

const TABS: TabDef[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'info', label: 'Información contractual' },
  { id: 'documentos', label: 'Documentos', countKey: 'documents' },
  { id: 'obligaciones', label: 'Obligaciones', countKey: 'obligations' },
  { id: 'entregables', label: 'Entregables', countKey: 'deliverables' },
  { id: 'ejecucion', label: 'Ejecución' },
  { id: 'pagos', label: 'Pagos', countKey: 'payments' },
  { id: 'garantias', label: 'Seguros y garantías', countKey: 'guarantees' },
  { id: 'actas', label: 'Actas', countKey: 'actas' },
  { id: 'modificaciones', label: 'Modificaciones', countKey: 'modifications' },
  { id: 'suspensiones', label: 'Suspensiones', countKey: 'suspensiones' },
  { id: 'prorrogas', label: 'Prórrogas', countKey: 'prorrogas' },
  { id: 'riesgos', label: 'Riesgos', countKey: 'risks' },
  { id: 'incumplimientos', label: 'Incumplimientos', countKey: 'breaches' },
  { id: 'subcontratos', label: 'Subcontratos', countKey: 'subcontracts' },
  { id: 'auditoria', label: 'Auditoría', countKey: 'audit' },
  { id: 'timeline', label: 'Línea de Tiempo' }
];

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

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 260;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (tabsRef.current) {
      const activeEl = tabsRef.current.querySelector<HTMLElement>('.tab.on');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const [showValidator, setShowValidator] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [valResult, setValResult] = useState<{ areas: { a: string; ok: boolean }[]; issues: VIssue[] } | null>(null);
  const [recResult, setRecResult] = useState<{ doc: DocType; diffs: number; rows: [string, string, string, boolean][] } | null>(null);

  const c = Store.get('contracts', id) as Contract | undefined;
  if (!c) {
    return (
      <Surface className="panel p-4">
        <p>El contrato no existe.</p>
        <Button className="btn pri" onClick={onBack}>
          Volver a Contratos
        </Button>
      </Surface>
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

  const handleOpenValidator = () => {
    const res = Validator.contract(c);
    setValResult(res);
    Audit.log({
      contractId: c.id,
      modulo: 'Validador',
      accion: 'Validación',
      campo: 'Resultado',
      nuevo: res.issues.length ? `${res.issues.length} inconsistencias` : 'Validado correctamente'
    });
    setShowValidator(true);
  };

  const handleOpenReconcile = () => {
    const res = Validator.reconcile(c);
    setRecResult(res);
    if (res) {
      Audit.log({
        contractId: c.id,
        modulo: 'Conciliación',
        accion: 'Conciliación',
        campo: 'Resultado',
        nuevo: res.diffs ? `${res.diffs} diferencias` : 'Sin diferencias'
      });
    }
    setShowReconcile(true);
  };

  const handleExportValidation = (format: 'xlsx' | 'pdf') => {
    if (!valResult) return;
    const cols = [
      { l: 'Severidad', k: 'sev' },
      { l: 'Área', k: 'area' },
      { l: 'Campo', k: 'campo' },
      { l: 'Valor actual', k: 'actual' },
      { l: 'Valor esperado', k: 'esperado' },
      { l: 'Recomendación', k: 'rec' }
    ];
    exportRows('Validación contrato ' + c.numero, cols, valResult.issues, format);
  };

  const insurers = (Store.byContract('guarantees', c.id) as any[])
    .map((g) => g.aseguradora)
    .filter(Boolean);
  const uniqueInsurers = Array.from(new Set(insurers));

  const deptos = c.departamento ? [c.departamento] : [];
  const primaryReason = m.razones.filter((r) => r.l === m.nivel).map((r) => r.t).join(' ');

  const handleTabChangeByName = (tabName: string) => {
    const found = TABS.find(
      (t) =>
        t.label.toLowerCase() === tabName.toLowerCase() ||
        t.id.toLowerCase() === tabName.toLowerCase()
    );
    if (found) setActiveTab(found.id);
  };

  return (
    <div>
      {/* Crumb */}
      <div className="crumb">
        <Link href="/contratos">Contratos</Link> /{' '}
        {company ? (
          <Link href={companyHref(company.id)}>{company.razon}</Link>
        ) : (
          '—'
        )}{' '}
        / Expediente
      </div>

      {/* Expediente Header */}
      <div className="exp-head" style={{ '--railc': `var(--${m.sem})` } as any}>
        <div className="exp-top">
          <div>
            <div className="exp-num">
              CONTRATO #{c.numero}{' '}
              <Badge
                text={m.estado}
                color={
                  m.estado === 'Activo'
                    ? 'ok'
                    : m.estado === 'Suspendido'
                    ? 'warn'
                    : m.estado === 'Vencido' || m.estado === 'Terminado'
                    ? 'crit'
                    : 'default'
                }
              />
              <div className={`semtag ${m.sem}`}>
                <div className={`sem ${m.sem}`}></div> {LEVEL_TXT[m.nivel]}
              </div>
              <small style={{ marginLeft: '8px', color: 'var(--muted)', fontSize: '13px' }}>
                {c.tipo} {c.modalidad ? `· ${c.modalidad}` : ''}
              </small>
            </div>
            <div className="exp-obj">{c.objeto}</div>
          </div>

          <div className="ph-actions">
            {!c.anulado && (
              <Button className="btn" onClick={() => setShowEditModal(true)}>
                <Icon name="pen" /> Editar
              </Button>
            )}
            <Button className="btn" onClick={handleOpenReconcile}>
              <Icon name="scale-balanced" /> Conciliación
            </Button>
            <Button className="btn pri" onClick={handleOpenValidator}>
              <Icon name="clipboard-check" /> VALIDAR CONTRATO
            </Button>
          </div>
        </div>

        <details className="context-disclosure">
          <summary>Contexto contractual y métricas de ejecución</summary>
        {/* Metadata */}
        <div className="exp-meta">
          <div>
            <span>Empresa</span>
            <b
              className="link"
              onClick={() => company && router.push(companyHref(company.id))}
              style={{ cursor: 'pointer' }}
            >
              {company ? company.razon : '—'}
            </b>
          </div>
          <div>
            <span>Contratista</span>
            <b>
              {c.contratista}{' '}
              {c.nitContratista && <span className="muted small">NIT {c.nitContratista}</span>}
            </b>
          </div>
          <div>
            <span>Responsable</span>
            <b>{c.responsable || '—'}</b>
          </div>
          <div>
            <span>Supervisor / Interventor</span>
            <b>
              {c.supervisor || '—'}
              {c.interventor ? ` / ${c.interventor}` : ''}
            </b>
          </div>
          <div>
            <span>Aseguradoras</span>
            <b
              className="link"
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('garantias')}
            >
              {uniqueInsurers.length > 0 ? (
                uniqueInsurers.join(' · ')
              ) : (
                <span style={{ color: 'var(--crit)' }}>Sin pólizas</span>
              )}
            </b>
          </div>
          <div>
            <span>Ejecución</span>
            <b>
              {(c.municipio ? `${c.municipio} · ` : '') + (deptos.join(', ') || '—')}
            </b>
          </div>
        </div>

        {/* Traffic Light Reason */}
        <div className="reason" style={{ marginTop: '12px' }}>
          <span className={`sem ${m.sem}`} style={{ display: 'inline-block', marginRight: '6px' }}></span>
          <b>{LEVEL_TXT[m.nivel]}</b> — {primaryReason || 'Todos los factores bajo parámetros normales.'}{' '}
          {m.razones.length > 1 && m.nivel !== 'ok' && (
            <span className="muted small">({m.razones.length} factores evaluados)</span>
          )}
        </div>

        {/* 3 Progress Bars con clamp y badge de exceso */}
        <div className="dual" style={{ marginTop: '16px', maxWidth: '780px' }}>
          <div className="row">
            <span>Tiempo transcurrido</span>
            <div className="bar lg">
              <i style={{ width: `${clamp(m.pctTiempo, 0, 100)}%`, background: 'var(--info)' }}></i>
            </div>
            <b>{pct(m.pctTiempo, 0)}</b>
          </div>
          <div className="row">
            <span>Ejecución financiera</span>
            <div className="bar lg">
              <i
                style={{
                  width: `${clamp(m.pctFin, 0, 100)}%`,
                  background: m.pctFin > 100 ? 'var(--crit)' : 'var(--brand)'
                }}
              ></i>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <b>{pct(m.pctFin, 0)}</b>
              {m.pctFin > 100 && (
                <span className="badge b-crit" style={{ fontSize: '10px', padding: '1px 6px' }}>
                  Excede {Math.round(m.pctFin - 100)}%
                </span>
              )}
            </div>
          </div>
          <div className="row">
            <span>Ejecución física</span>
            <div className="bar lg">
              <i style={{ width: `${clamp(m.pctFis, 0, 100)}%`, background: 'var(--brand-3)' }}></i>
            </div>
            <b>{pct(m.pctFis, 0)}</b>
          </div>
        </div>
        </details>
      </div>

      {/* Tabs con navegación horizontal y selector móvil para 17 pestañas */}
      <Surface className="panel" style={{ marginTop: '16px' }}>
        <div
          className="section-tabs-toolbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--line)',
            background: 'var(--surface-2)',
            padding: '4px 8px',
            gap: 6
          }}
        >
          {/* Botón flecha izquierda */}
          <Button
            className="icon-btn"
            onClick={() => scrollTabs('left')}
            title="Desplazar pestañas hacia la izquierda"
            aria-label="Pestañas anteriores"
            style={{ width: 28, height: 28 }}
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
              const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
              if (!keys.includes(event.key)) return;
              event.preventDefault();
              const index = TABS.findIndex(t => t.id === activeTab);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length-1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
              setActiveTab(TABS[next].id);
              requestAnimationFrame(()=>tabsRef.current?.querySelector<HTMLElement>(`#tab-${TABS[next].id}`)?.focus());
            }}
            style={{
              padding: '0 4px',
              overflowX: 'auto',
              flexWrap: 'nowrap',
              borderBottom: 'none',
              flex: 1,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
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
                  style={{
                    whiteSpace: 'nowrap',
                    fontWeight: isActive ? 700 : 500
                  }}
                  aria-selected={isActive}
                  id={`tab-${t.id}`}
                  aria-controls="expediente-panel"
                  tabIndex={isActive ? 0 : -1}
                  role="tab"
                >
                  {t.label}
                  {count != null && <span className="n">{count}</span>}
                </Link>
              );
            })}
          </div>

          {/* Botón flecha derecha */}
          <Button
            className="icon-btn"
            onClick={() => scrollTabs('right')}
            title="Desplazar pestañas hacia la derecha"
            aria-label="Siguientes pestañas"
            style={{ width: 28, height: 28 }}
          >
            <Icon name="chevron-right" />
          </Button>

          {/* Selector desplegable de sección (muy útil en tablet y móvil) */}
          <div style={{ marginLeft: 4, display: 'flex', alignItems: 'center' }}>
            <Select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              aria-label="Ir a sección del expediente"
              style={{
                height: 30,
                fontSize: '11.5px',
                borderRadius: 8,
                padding: '0 8px',
                border: '1px solid var(--border-control)',
                background: '#FFFFFF',
                color: 'var(--ink)'
              }}
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

      {/* Validator Modal */}
      {showValidator && valResult && (
        <Modal
          title="Validador contractual"
          onClose={() => setShowValidator(false)}
          size="lg"
          footer={
            <>
              <Button className="btn" onClick={() => handleExportValidation('xlsx')}>
                <Icon name="file-excel" /> Excel
              </Button>
              <Button className="btn" onClick={() => handleExportValidation('pdf')}>
                <Icon name="file-pdf" /> PDF
              </Button>
              <span className="sp" style={{ flex: 1 }}></span>
              <Button className="btn pri" onClick={() => setShowValidator(false)}>
                Cerrar
              </Button>
            </>
          }
        >
          <div>
            <div
              className={`result-banner ${valResult.issues.length ? 'bad' : 'ok'}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: '6px',
                background: valResult.issues.length ? 'var(--crit-s)' : 'var(--ok-s)',
                color: valResult.issues.length ? 'var(--crit)' : 'var(--ok)',
                fontWeight: 600,
                marginBottom: '16px'
              }}
            >
              <Icon
                name={valResult.issues.length ? 'triangle-exclamation' : 'circle-check'}
              />
              <span>
                {valResult.issues.length
                  ? `Se encontraron ${valResult.issues.length} inconsistencia${
                      valResult.issues.length === 1 ? '' : 's'
                    }`
                  : 'Contrato validado correctamente'}
              </span>
              <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: '13px', color: 'var(--muted)' }}>
                {c.numero} · {nowStamp()}
              </span>
            </div>

            {/* Checklist of areas */}
            <div
              className="check-list mb-4"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '10px',
                background: 'var(--bg-sub)',
                borderRadius: '6px'
              }}
            >
              {valResult.areas.map((a) => (
                <span
                  key={a.a}
                  className={`small ${a.ok ? '' : 'bad'}`}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: a.ok ? 'rgba(78, 154, 143, 0.12)' : 'rgba(208, 84, 63, 0.12)',
                    color: a.ok ? 'var(--ok)' : 'var(--crit)',
                    fontWeight: 600
                  }}
                >
                  {a.ok ? '✓ ' : '✗ '}
                  {a.a}
                </span>
              ))}
            </div>

            {/* Issues list or coherent note */}
            {valResult.issues.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {valResult.issues.map((i, idx) => (
                  <div
                    key={idx}
                    className="issue"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr',
                      gap: '12px',
                      padding: '12px',
                      border: '1px solid var(--line)',
                      borderRadius: '6px'
                    }}
                  >
                    <div>
                      <Badge
                        text={i.sev}
                        color={
                          i.sev === 'crit'
                            ? 'crit'
                            : i.sev === 'risk'
                            ? 'risk'
                            : i.sev === 'warn'
                            ? 'warn'
                            : 'info'
                        }
                      />
                      <div className="small muted" style={{ marginTop: '4px' }}>
                        {i.area}
                      </div>
                    </div>
                    <div>
                      <b>{i.campo}</b>
                      <div
                        className="g mt-2"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, 1fr)',
                          gap: '8px',
                          fontSize: '12px'
                        }}
                      >
                        <div>
                          <span className="muted" style={{ display: 'block' }}>
                            Valor actual
                          </span>
                          <span style={{ color: 'var(--crit)' }}>{i.actual}</span>
                        </div>
                        <div>
                          <span className="muted" style={{ display: 'block' }}>
                            Valor esperado
                          </span>
                          <span style={{ color: 'var(--ok)' }}>{i.esperado}</span>
                        </div>
                        <div>
                          <span className="muted" style={{ display: 'block' }}>
                            Recomendación
                          </span>
                          <span>{i.rec}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Fechas, valores, porcentajes, garantías, obligaciones, pagos, documentos, ejecución,
                modificaciones, subcontratos, riesgos, incumplimientos y liquidación son
                completamente coherentes.
              </p>
            )}
          </div>
        </Modal>
      )}

      {/* Reconciliation Modal */}
      {showReconcile && (
        <Modal
          title={`Conciliación contractual · ${c.numero}`}
          onClose={() => setShowReconcile(false)}
          size="lg"
          footer={
            <>
              {recResult ? (
                <Button
                  className="btn"
                  onClick={() => {
                    setShowReconcile(false);
                    setActiveTab('documentos');
                  }}
                >
                  <Icon name="pen-to-square" /> Editar datos extraídos
                </Button>
              ) : (
                <Button
                  className="btn"
                  onClick={() => {
                    setShowReconcile(false);
                    setActiveTab('documentos');
                  }}
                >
                  <Icon name="upload" /> Cargar contrato en Documentos
                </Button>
              )}
              {!c.anulado && (
                <Button
                  className="btn"
                  onClick={() => {
                    setShowReconcile(false);
                    setShowEditModal(true);
                  }}
                >
                  <Icon name="pen" /> Editar contrato
                </Button>
              )}
              <span className="sp" style={{ flex: 1 }}></span>
              <Button className="btn pri" onClick={() => setShowReconcile(false)}>
                Cerrar
              </Button>
            </>
          }
        >
          <div>
            {!recResult ? (
              <div>
                <div
                  className="result-banner bad"
                  style={{
                    background: 'var(--warn-s)',
                    color: '#7A5C00',
                    padding: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600
                  }}
                >
                  <Icon name="file-circle-question" />
                  <span>
                    No hay un documento de categoría «Contrato» con datos extraídos para conciliar.
                  </span>
                </div>
                <p className="small muted mt-2">
                  Carga el contrato firmado en la pestaña Documentos y registra sus datos clave. En
                  producción, los datos se extraen automáticamente mediante OCR e IA sobre el PDF.
                </p>
              </div>
            ) : (
              <div>
                <div
                  className={`result-banner ${recResult.diffs ? 'bad' : 'ok'}`}
                  style={{
                    background: recResult.diffs ? 'var(--crit-s)' : 'var(--ok-s)',
                    color: recResult.diffs ? 'var(--crit)' : 'var(--ok)',
                    padding: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 600,
                    marginBottom: '10px'
                  }}
                >
                  <Icon
                    name={recResult.diffs ? 'triangle-exclamation' : 'circle-check'}
                  />
                  <span>
                    {recResult.diffs
                      ? `${recResult.diffs} diferencia${recResult.diffs === 1 ? '' : 's'} detectada${
                          recResult.diffs === 1 ? '' : 's'
                        }`
                      : 'La información del sistema coincide completamente con el documento'}
                  </span>
                </div>

                <p className="small muted" style={{ margin: '-4px 0 12px' }}>
                  Documento fuente: <b>{recResult.doc.nombre}</b> (v
                  {recResult.doc.versions?.length || 1})
                </p>

                <TableViewport className="tbl-wrap">
                  <DataTable className="tbl conc">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Documento (contrato)</th>
                        <th>Sistema</th>
                        <th className="nw">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recResult.rows.map((row, idx) => {
                        const [campo, docVal, sysVal, match] = row;
                        return (
                          <tr
                            key={idx}
                            style={{ background: match ? 'transparent' : 'rgba(208, 84, 63, 0.08)' }}
                          >
                            <td className="strong">{campo}</td>
                            <td>{docVal}</td>
                            <td>{sysVal}</td>
                            <td
                              className={`nw ${match ? 'ok' : 'bad'}`}
                              style={{
                                color: match ? 'var(--ok)' : 'var(--crit)',
                                fontWeight: 600
                              }}
                            >
                              {match ? '✓ Coincide' : '⚠️ DIFERENCIA DETECTADA'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                </TableViewport>

                <p className="small muted mt-3">
                  <Icon name="circle-info" /> Los datos del documento provienen de la extracción
                  registrada. Si fueron mal capturados, corrígelos con «Editar datos extraídos»; si
                  el error está en el sistema, edita el contrato.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Edit Contract Modal */}
      {showEditModal && (
        <ContratoFormModal
          contract={c}
          onClose={() => setShowEditModal(false)}
          onSave={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
};
