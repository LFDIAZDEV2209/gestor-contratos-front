'use client';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable } from '../ui/Workspace';
import { useState } from 'react';
import type { Obligation, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { effOblig } from '../../lib/metrics';
import { fdate, pct, sum, todayIso } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const ObligacionesView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string, tab?: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'todas' | 'pendientes' | 'vencidas' | 'cumplidas'>('todas');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [q, setQ] = useState('');
  const [selectedObl, setSelectedObl] = useState<Obligation | null>(null);
  const [newComment, setNewComment] = useState('');

  const allObligations = (Store.all('obligations') as Obligation[]).slice();
  const allContracts = (Store.all('contracts') as Contract[]).filter((c) => !c.anulado);

  const total = allObligations.length;
  const cumplidas = allObligations.filter((o) => o.estado === 'Cumplida').length;
  const vencidas = allObligations.filter((o) => {
    const e = effOblig(o);
    return e === 'Vencida' || e === 'Incumplida';
  }).length;
  const pendientes = total - cumplidas;
  const avgCumpl = total
    ? sum(allObligations, (o) => Number(o.cumplimiento || 0)) / total
    : 0;

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
    <div>
      {/* Page Header */}
      <PageHeader className="ph">
        <div>
          <h1>Obligaciones contractuales</h1>
          <p>Supervisión, checklist de evidencias y verificación de cumplimiento del portafolio</p>
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

      {/* KPI Cards */}
      <div className="kpis mb">
        <Kpi label="Total Obligaciones" value={total} />
        <Kpi label="Cumplimiento Promedio" value={pct(avgCumpl, 0)} color={avgCumpl >= 80 ? 'ok' : 'warn'} />
        <Kpi label="Pendientes" value={pendientes} color={pendientes > 0 ? 'warn' : 'ok'} />
        <Kpi label="Vencidas / En riesgo" value={vencidas} color={vencidas > 0 ? 'crit' : 'ok'} />
      </div>

      {/* Main Panel */}
      <Surface className="panel">
        {/* Quick Views Tabs */}
        <div className="tabs" style={{ padding: '0 12px' }}>
          <Button
            className={`tab ${activeTab === 'todas' ? 'on' : ''}`}
            onClick={() => setActiveTab('todas')}
          >
            Todas ({total})
          </Button>
          <Button
            className={`tab ${activeTab === 'pendientes' ? 'on' : ''}`}
            onClick={() => setActiveTab('pendientes')}
          >
            Pendientes / En proceso ({pendientes})
          </Button>
          <Button
            className={`tab ${activeTab === 'vencidas' ? 'on' : ''}`}
            onClick={() => setActiveTab('vencidas')}
          >
            Vencidas ({vencidas})
          </Button>
          <Button
            className={`tab ${activeTab === 'cumplidas' ? 'on' : ''}`}
            onClick={() => setActiveTab('cumplidas')}
          >
            Cumplidas ({cumplidas})
          </Button>
        </div>

        {/* Filter Toolbar */}
        <div className="filters mb" style={{ padding: '12px 16px' }}>
          <div className="gsearch">
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descripción u objeto..."
            />
          </div>
          <Field className="f">
            <Select
              className="inp sm"
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
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
              onChange={(e) => setFilterTipo(e.target.value)}
            >
              <option value="">— Todos los tipos —</option>
              <option value="General">General</option>
              <option value="Específica">Específica</option>
              <option value="Técnica">Técnica</option>
              <option value="Financiera">Financiera</option>
              <option value="Legal">Legal</option>
              <option value="Reporte / informe">Reporte / informe</option>
              <option value="Seguridad social">Seguridad social</option>
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
              {filtered.map((o) => {
                const c = Store.get('contracts', o.contractId);
                const eff = effOblig(o);
                return (
                  <tr key={o.id}>
                    <td className="nw">
                      {c ? (
                        <a
                          className="link font-bold"
                          onClick={() => onSelectContract(c.id, 'obligaciones')}
                          style={{ cursor: 'pointer' }}
                        >
                          {c.numero}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{o.tipo}</td>
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
                      <span
                        className={
                          eff === 'Vencida' ? 'badge crit' : eff === 'Incumplida' ? 'badge crit' : ''
                        }
                      >
                        {fdate(o.fechaLimite)}
                      </span>
                    </td>
                    <td className="nw">
                      <div className="row-flex" style={{ gap: '6px' }}>
                        <div className="bar" style={{ flex: 1, minWidth: '50px' }}>
                          <i
                            style={{
                              width: pct(o.cumplimiento || 0),
                              background:
                                eff === 'Cumplida'
                                  ? 'var(--ok)'
                                  : eff === 'Vencida'
                                  ? 'var(--crit)'
                                  : 'var(--brand)'
                            }}
                          ></i>
                        </div>
                        <span className="small">{pct(o.cumplimiento || 0)}</span>
                      </div>
                    </td>
                    <td className="nw">
                      <Badge
                        text={eff}
                        color={
                          eff === 'Cumplida'
                            ? 'ok'
                            : eff === 'Vencida'
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
                      <Button
                        className="btn sm"
                        onClick={() => setSelectedObl(o)}
                        title="Ver detalle y checklist"
                      >
                        Ficha
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    No se encontraron obligaciones con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Obligation Detail & Checklist Modal */}
      {selectedObl && (
        <Modal
          title={`Obligación ${selectedObl.id} · Detalle y Verificación`}
          onClose={() => setSelectedObl(null)}
          size="lg"
          footer={
            <>
              {selectedObl.estado !== 'Cumplida' && (
                <Button className="btn pri" onClick={() => handleVerify(selectedObl)}>
                  <Icon name="check-circle" /> Aprobar cumplimiento (100%)
                </Button>
              )}
              <span style={{ flex: 1 }}></span>
              <Button className="btn" onClick={() => setSelectedObl(null)}>
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
              <div className="mt-2 text-xs text-muted-foreground">
                Responsable: <b>{selectedObl.responsable}</b> · Estado: <b>{selectedObl.estado}</b>
              </div>
            </div>

            {/* Checklist */}
            <h4 style={{ fontSize: '13px', marginBottom: '8px' }}>
              Checklist de actividades ({selectedObl.checklist?.length || 0})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
              {(selectedObl.checklist || [
                { id: '1', texto: 'Revisión y verificación técnica del entregable', listo: selectedObl.estado === 'Cumplida' },
                { id: '2', texto: 'Aporte de soportes documentales y actas', listo: selectedObl.estado === 'Cumplida' },
                { id: '3', texto: 'Visto bueno del supervisor técnico', listo: selectedObl.estado === 'Cumplida' }
              ]).map((chk) => (
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
        </Modal>
      )}
    </div>
  );
};
