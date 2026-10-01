'use client';
import { PBar } from '../ui/PBar';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState, WorkspaceSkeleton } from '../ui/Workspace';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { obligationHref, contractHref } from '../app/routes';
import { DetailFrame } from '../ui/DetailFrame';
import { obligationPresentation } from '../ui/presentation';
import type { Obligation, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, sum, todayIso } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

// Acciones sobre la tabla que mutan Store: marcan el refresco de la vista
const HOVER_LIFT = {
  onMouseEnter: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = 'var(--shadow-2)';
    e.currentTarget.style.position = 'relative';
    e.currentTarget.style.zIndex = '2';
  },
  onMouseLeave: (e: React.MouseEvent<HTMLTableRowElement>) => {
    e.currentTarget.style.transform = 'none';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.zIndex = 'auto';
  }
};

export const ObligacionesView = ({
  onSelectContract,
  detailId
}: {
  onSelectContract: (cid: string, tab?: string) => void;
  detailId?: string;
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'vencidas' | 'cumplidas'>('todas');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  // Paginación real sobre el listado filtrado
  const [page, setPage] = useState(1);
  const pageSize = 12;
  // Guardia de hidratación: el store vive en localStorage; mientras tanto, skeleton
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [selectedObl, setSelectedObl] = useState<Obligation | null>(() => {
    const obligation = detailId ? Store.get('obligations', detailId) : null;
    return obligation ? obligationPresentation(obligation) : null;
  });
  const closeDetail = () => detailId ? router.push('/obligaciones') : setSelectedObl(null);
  const [newComment, setNewComment] = useState('');

  // Lectura tolerante a fallos del almacenamiento local (manejo de error)
  let loadError: string | null = null;
  const readAll = (kind: 'obligations' | 'contracts'): any[] => {
    try {
      return Store.all(kind) as any[];
    } catch {
      loadError = 'No fue posible leer los datos del expediente. Verifica el almacenamiento del navegador.';
      return [];
    }
  };

  const allObligations = (readAll('obligations') as Obligation[]).slice();
  const allContracts = (readAll('contracts') as Contract[]).filter((c) => !c.anulado);

  const total = allObligations.length;
  const cumplidas = allObligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = allObligations.filter((o) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  }).length;
  // Pendientes reales: ni cumplidas ni vencidas (coincide con la pestaña "Pendientes")
  const pendientes = total - cumplidas - vencidas;
  const avgCumpl = total
    ? sum(allObligations, (o) => Number(o.cumplimiento || 0)) / total
    : 0;
  // Tipos derivados de los datos reales, no de una lista fija
  const tipos = Array.from(new Set(allObligations.map((o) => o.tipo).filter(Boolean)));

  const filtered = allObligations.filter((o) => {
    const eff = effOblig(o);
    if (activeTab === 'pendientes' && (o.estado === 'Cumplida' || eff === 'Vencida')) return false;
    if (activeTab === 'vencidas' && eff !== 'Vencida' && eff !== 'Incumplida') return false;
    if (activeTab === 'cumplidas' && o.estado !== 'Cumplida') return false;

    if (filterTipo && o.tipo !== filterTipo) return false;
    if (filterContract && o.contractId !== filterContract) return false;
    if (q) {
      const matchDesc = o.descripcion.toLowerCase().includes(q.toLowerCase());
      const c = Store.get('contracts', o.contractId);
      const matchContr = c?.numero.toLowerCase().includes(q.toLowerCase()) || false;
      if (!matchDesc && !matchContr) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasActiveFilters = Boolean(q || filterTipo || filterContract || activeTab !== 'todas');

  const handleVerify = (ob: Obligation) => {
    if (!AuthService.guard('aprobar')) return;
    const u = AuthService.currentUser();
    Store.update('obligations', ob.id, {
      estado: 'Cumplida',
      cumplimiento: 100,
      verificadoPor: u.nombre,
      verificadoFecha: todayIso()
    });

    Audit.log({
      contractId: ob.contractId,
      modulo: 'Obligaciones',
      accion: 'Aprobación',
      campo: 'Verificación de obligación ' + ob.id,
      anterior: ob.estado,
      nuevo: 'Cumplida (100%)'
    });

    if (selectedObl && selectedObl.id === ob.id) {
      setSelectedObl({
        ...selectedObl,
        estado: 'Cumplida',
        cumplimiento: 100,
        verificadoPor: u.nombre,
        verificadoFecha: todayIso()
      });
    }
    setPage(1);
  };

  // Crea de verdad el checklist estándar en el Store (reemplaza el seed demo)
  const handleCreateChecklist = () => {
    if (!selectedObl) return;
    if (!AuthService.guard('editar')) return;
    const base = [
      { id: `${selectedObl.id}-chk-1`, texto: 'Revisión y verificación técnica del entregable', listo: false },
      { id: `${selectedObl.id}-chk-2`, texto: 'Aporte de soportes documentales y actas', listo: false },
      { id: `${selectedObl.id}-chk-3`, texto: 'Visto bueno del supervisor técnico', listo: false }
    ];
    Store.update('obligations', selectedObl.id, { checklist: base });
    Audit.log({
      contractId: selectedObl.contractId,
      modulo: 'Obligaciones',
      accion: 'Edición',
      campo: 'Checklist de obligación ' + selectedObl.id,
      nuevo: 'Checklist estándar creado (3 ítems)'
    });
    setSelectedObl({ ...selectedObl, checklist: base });
  };

  const handleAddComment = () => {
    if (!selectedObl || !newComment.trim()) return;
    const u = AuthService.currentUser();
    const commentItem = {
      id: 'c_' + Date.now(),
      usuario: u.nombre,
      fecha: todayIso(),
      texto: newComment.trim()
    };
    const currentList = selectedObl.comentarios || [];
    const updated = [...currentList, commentItem];
    Store.update('obligations', selectedObl.id, { comentarios: updated });
    setSelectedObl({ ...selectedObl, comentarios: updated });
    setNewComment('');
  };

  const handleToggleChecklist = (checkId: string) => {
    if (!selectedObl) return;
    const list = selectedObl.checklist || [];
    const updated = list.map((item) =>
      item.id === checkId ? { ...item, listo: !item.listo } : item
    );
    const completedCount = updated.filter((i) => i.listo).length;
    const autoCumpl = updated.length
      ? Math.round((completedCount / updated.length) * 100)
      : (Number(selectedObl.cumplimiento) || 0);

    Store.update('obligations', selectedObl.id, {
      checklist: updated,
      cumplimiento: autoCumpl,
      estado: autoCumpl === 100 ? 'Cumplida' : autoCumpl > 0 ? 'En proceso' : 'Pendiente'
    });

    setSelectedObl({
      ...selectedObl,
      checklist: updated,
      cumplimiento: autoCumpl,
      estado: autoCumpl === 100 ? 'Cumplida' : autoCumpl > 0 ? 'En proceso' : 'Pendiente'
    });
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      {
        l: 'Contrato',
        k: 'contractId',
        r: (o: any) => {
          const c = Store.get('contracts', o.contractId);
          return c ? c.numero : o.contractId;
        }
      },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Vencimiento', k: 'fechaLimite', r: (o: any) => fdate(o.fechaLimite) },
      { l: 'Periodicidad', k: 'periodicidad' },
      { l: '% Cumplimiento', k: 'cumplimiento', r: (o: any) => pct(o.cumplimiento || 0) },
      { l: 'Estado Efectivo', k: 'estado', r: (o: any) => effOblig(o) },
      { l: 'Verificado Por', k: 'verificadoPor' }
    ];
    exportRows('Matriz Global de Obligaciones', cols, filtered, format);
  };

  return (
    <div className="anim-fade-rise">
      {!mounted ? (
        <WorkspaceSkeleton />
      ) : loadError ? (
        <div className="feedback-notice" role="alert">
          <Icon name="triangle-exclamation" />
          <div>
            <b>Error al cargar obligaciones.</b> {loadError}
          </div>
        </div>
      ) : (
        <>
      {!detailId && <>
      {/* Page Header (variante hero con gradiente de marca) */}
      <PageHeader variant="hero" className="ph">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--r)',
                background: 'rgba(255, 255, 255, 0.16)',
                color: 'var(--surface)',
                display: 'grid',
                placeItems: 'center',
                backdropFilter: 'blur(8px)',
                flexShrink: 0
              }}
            >
              <Icon name="list-check" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Obligaciones contractuales
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 'var(--r-pill)',
                    background: 'rgba(255, 255, 255, 0.18)',
                    color: 'var(--surface)'
                  }}
                >
                  {filtered.length} {filtered.length === 1 ? 'obligación' : 'obligaciones'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Supervisión, checklist de evidencias y verificación de cumplimiento del portafolio
              </p>
            </div>
          </div>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* KPI Cards: Kpi v2 con icono, tono semántico y clic que activa su vista */}
      <div className="kpis mb">
        <Kpi
          label="Total Obligaciones"
          value={total}
          icon="list-check"
          color="brand"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            setActiveTab('todas');
            setPage(1);
          }}
        />
        <Kpi
          label="Cumplimiento Promedio"
          value={pct(avgCumpl, 0)}
          icon="chart-line"
          color={avgCumpl >= 80 ? 'ok' : 'warn'}
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Pendientes"
          value={pendientes}
          icon="hourglass-half"
          color={pendientes > 0 ? 'warn' : 'ok'}
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setActiveTab('pendientes');
            setPage(1);
          }}
        />
        <Kpi
          label="Vencidas / En riesgo"
          value={vencidas}
          icon="alert-circle"
          color={vencidas > 0 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-4 click"
          onClick={() => {
            setActiveTab('vencidas');
            setPage(1);
          }}
        />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Quick Views Tabs con icono */}
        <div className="tabs" style={{ padding: '0 12px' }}>
          <Button
            className={`tab ${activeTab === 'todas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'todas'}
            onClick={() => {
              setActiveTab('todas');
              setPage(1);
            }}
          >
            <Icon name="list-check" size={12} /> Todas ({total})
          </Button>
          <Button
            className={`tab ${activeTab === 'pendientes' ? 'on' : ''}`}
            aria-pressed={activeTab === 'pendientes'}
            onClick={() => {
              setActiveTab('pendientes');
              setPage(1);
            }}
          >
            <Icon name="hourglass-half" size={12} /> Pendientes / En proceso ({pendientes})
          </Button>
          <Button
            className={`tab ${activeTab === 'vencidas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'vencidas'}
            onClick={() => {
              setActiveTab('vencidas');
              setPage(1);
            }}
          >
            <Icon name="alert-circle" size={12} /> Vencidas ({vencidas})
          </Button>
          <Button
            className={`tab ${activeTab === 'cumplidas' ? 'on' : ''}`}
            aria-pressed={activeTab === 'cumplidas'}
            onClick={() => {
              setActiveTab('cumplidas');
              setPage(1);
            }}
          >
            <Icon name="check-circle" size={12} /> Cumplidas ({cumplidas})
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              aria-label="Buscar obligaciones"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por descripción u objeto..."
            />
          </div>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterContract}
              aria-label="Filtrar por contrato"
              onChange={(e) => {
                setFilterContract(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los contratos —</option>
              {allContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
          </Field>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterTipo}
              aria-label="Filtrar por tipo de obligación"
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">— Todos los tipos —</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Table */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Contrato</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Responsable</th>
                <th className="nw">Vencimiento</th>
                <th className="nw" style={{ minWidth: '120px' }}>
                  % Avance
                </th>
                <th className="nw">Estado</th>
                <th>Verificado</th>
                <th className="nw">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o, idx) => {
                const c = Store.get('contracts', o.contractId);
                const eff = effOblig(o);
                const vencidaEff = eff === 'Vencida' || eff === 'Incumplida';
                return (
                  <tr
                    key={o.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${idx * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    {...HOVER_LIFT}
                  >
                    <td className="nw">
                      {c ? (
                        <Link
                          className="link font-bold"
                          href={contractHref(c.id, 'obligaciones')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className="badge b-info">{o.tipo}</span>
                    </td>
                    <td
                      className="clip"
                      style={{ maxWidth: '280px', cursor: 'pointer' }}
                      title={o.descripcion}
                      onClick={() => setSelectedObl(o)}
                    >
                      <b>{o.descripcion}</b>
                    </td>
                    <td>{o.responsable}</td>
                    <td className="nw">
                      {vencidaEff ? (
                        <span className="badge b-crit" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          <Icon name="triangle-exclamation" size={11} /> {fdate(o.fechaLimite)}
                        </span>
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink-2)' }}>
                          {fdate(o.fechaLimite)}
                        </span>
                      )}
                    </td>
                    <td className="nw">
                      <PBar value={o.cumplimiento || 0} color={eff === 'Cumplida' ? 'var(--ok)' : vencidaEff ? 'var(--crit)' : 'var(--brand)'} />
                    </td>
                    <td className="nw">
                      <Badge
                        text={eff}
                        color={
                          eff === 'Cumplida'
                            ? 'ok'
                            : vencidaEff
                            ? 'crit'
                            : eff === 'En proceso'
                            ? 'info'
                            : 'warn'
                        }
                      />
                    </td>
                    <td className="small muted">
                      {o.verificadoPor ? `${o.verificadoPor} (${fdate(o.verificadoFecha)})` : '—'}
                    </td>
                    <td className="nw">
                      <Link
                        className="btn sm"
                        href={obligationHref(o.id)}
                        title="Ver detalle y checklist"
                      >
                        Ficha
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title={activeTab === 'vencidas' ? 'Sin obligaciones vencidas' : 'No se encontraron obligaciones'}
                      description={
                        hasActiveFilters
                          ? 'Ajusta la búsqueda, la pestaña activa o los filtros para ver más resultados.'
                          : 'Cuando se registren obligaciones en los contratos aparecerán aquí.'
                      }
                      action={
                        hasActiveFilters ? (
                          <Button
                            className="btn sm"
                            style={{ marginTop: 8 }}
                            onClick={() => {
                              setQ('');
                              setFilterTipo('');
                              setFilterContract('');
                              setActiveTab('todas');
                              setPage(1);
                            }}
                          >
                            <Icon name="trash" /> Restablecer filtros
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={9}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> obligaciones
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                          <Button key={p} className={p === currentPage ? 'on' : ''} onClick={() => setPage(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPage >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Página siguiente"
                        >
                          &gt;
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Obligation Detail & Checklist Modal */}
      </>}
      {detailId && <div className="crumb"><Link href="/obligaciones">Obligaciones</Link> / Ficha</div>}
      {selectedObl && (
        <DetailFrame
          inline={Boolean(detailId)}
          title={`Obligación ${selectedObl.id} · Detalle y Verificación`}
          onClose={closeDetail}
          size="lg"
          footer={
            <>
              {selectedObl.estado !== 'Cumplida' && (
                <Button className="btn pri" onClick={() => handleVerify(selectedObl)}>
                  <Icon name="check-circle" /> Aprobar cumplimiento (100%)
                </Button>
              )}
              <span style={{ flex: 1 }}></span>
              <Button className="btn" onClick={closeDetail}>
                Cerrar
              </Button>
            </>
          }
        >
          <div>
            <div className="mb-4 p-3" style={{ background: 'var(--bg-sub)', borderRadius: '6px' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="badge">{selectedObl.tipo}</span>
                <span className="small muted">Límite: {fdate(selectedObl.fechaLimite)}</span>
              </div>
              <p style={{ margin: 0, fontWeight: 500 }}>{selectedObl.descripcion}</p>
              <div className="mt-2 pbar">
                <div className="bar sm">
                  <i
                    style={{
                      width: `${Number(selectedObl.cumplimiento) || 0}%`,
                      background:
                        (Number(selectedObl.cumplimiento) || 0) >= 100
                          ? 'var(--ok)'
                          : (Number(selectedObl.cumplimiento) || 0) >= 50
                          ? 'var(--warn)'
                          : 'var(--crit)'
                    }}
                  />
                </div>
                <span className="mono small">{pct(Number(selectedObl.cumplimiento) || 0, 0)}</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  Responsable: <b>{selectedObl.responsable}</b>
                </span>
                <span>·</span>
                <span>
                  Estado: <b>{selectedObl.estado}</b>
                </span>
                {selectedObl.verificadoPor && (
                  <span className="badge b-ok" style={{ marginLeft: 'auto' }}>
                    <Icon name="check-circle" size={11} /> Verificada por {selectedObl.verificadoPor} ({fdate(selectedObl.verificadoFecha)})
                  </span>
                )}
              </div>
            </div>

            {/* Checklist */}
            <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>
              Checklist de actividades ({selectedObl.checklist?.length || 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {(selectedObl.checklist || []).map((chk) => (
                <label
                  key={chk.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    border: '1px solid var(--line)',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Input
                    type="checkbox"
                    checked={chk.listo}
                    onChange={() => handleToggleChecklist(chk.id)}
                  />
                  <span style={{ textDecoration: chk.listo ? 'line-through' : 'none' }}>
                    {chk.texto}
                  </span>
                </label>
              ))}
              {(!selectedObl.checklist || selectedObl.checklist.length === 0) && (
                <EmptyState
                  title="Sin checklist de verificación"
                  description="Crea el checklist estándar (revisión técnica, soportes documentales y visto bueno del supervisor) para registrar el avance."
                  action={
                    <Button className="btn sm pri" style={{ marginTop: 8 }} onClick={handleCreateChecklist}>
                      <Icon name="list-check" /> Crear checklist base
                    </Button>
                  }
                />
              )}
            </div>

            {/* Comments */}
            <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>
              Bitácora y comentarios ({selectedObl.comentarios?.length || 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
              {(selectedObl.comentarios || []).map((com) => (
                <div
                  key={com.id}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-sub)',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}
                >
                  <div className="flex justify-between text-muted-foreground mb-1">
                    <b>{com.usuario}</b>
                    <span>{fdate(com.fecha)}</span>
                  </div>
                  <div>{com.texto}</div>
                </div>
              ))}
              {(!selectedObl.comentarios || selectedObl.comentarios.length === 0) && (
                <div className="small muted">Sin observaciones adicionales registradas.</div>
              )}
            </div>

            <div className="row-flex" style={{ gap: '8px' }}>
              <Input
                className="inp sm"
                placeholder="Escribir comentario u observación..."
                aria-label="Nuevo comentario de la obligación"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddComment();
                }}
              />
              <Button className="btn sm pri" onClick={handleAddComment}>
                Agregar
              </Button>
            </div>
          </div>
        </DetailFrame>
      )}
        </>
      )}
    </div>
  );
};
