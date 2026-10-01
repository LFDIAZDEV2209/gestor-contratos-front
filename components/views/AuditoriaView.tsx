'use client';
import { Select, Input } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { Kpi } from '../ui/Kpi';

import React, { useState } from 'react';
import Link from 'next/link';
import { Store, AuthService, Audit } from '@/lib/store';
import { fdate, todayIso } from '@/lib/format';
import { exportRows } from '@/lib/export';
import { Icon } from '../icons';
import { contractHref } from '../app/routes';
import type { AuditEntry, Contract } from '@/lib/types';

interface AuditoriaViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
  onOpenUserSwitcher?: () => void;
}

/* ---------- Presentación local (2ª pasada): hover lift en filas y badges pill con pop ---------- */
const rowLift = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.animation = 'none'; // libera el transform final del fadeRise para permitir el lift
  el.style.transform = 'translateY(-2px)';
  el.style.boxShadow = 'var(--shadow-2)';
  el.style.position = 'relative';
  el.style.zIndex = '2';
};
const rowReset = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.transform = 'none';
  el.style.boxShadow = 'none';
  el.style.zIndex = 'auto';
};
const badgePop = { animation: 'pop 250ms var(--ease)' } as const;
const countPill = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  background: 'rgba(255, 255, 255, 0.18)',
  color: 'var(--surface)',
  whiteSpace: 'nowrap' as const
};

// Semáforo institucional por tipo de acción -> clase de badge con tokens AA
const accionBadge = (act?: string) =>
  act === 'Anulación' ? 'b-crit' : act === 'Creación' ? 'b-ok' : act === 'Modificación' ? 'b-info' : 'b-na';

export const AuditoriaView: React.FC<AuditoriaViewProps> = ({ onSelectContract, onOpenUserSwitcher }) => {
  const [modo, setModo] = useState<'tabla' | 'timeline'>('tabla');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [filterUser, setFilterUser] = useState('');
  const [filterContract, setFilterContract] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [filterAccion, setFilterAccion] = useState('');
  const [filterModulo, setFilterModulo] = useState('');
  const [filterCampo, setFilterCampo] = useState('');

  const canAudit = AuthService.can('auditar');
  const curUser = AuthService.currentUser();

  if (!canAudit) {
    return (
      <div className="anim-fade-rise">
        <PageHeader className="ph">
          <div>
            <h1>Auditoría</h1>
            <p className="sub">Bitácora automática de todos los cambios.</p>
          </div>
        </PageHeader>
        <Surface className="panel">
          <div className="empty-state" style={{ padding: '48px 16px' }}>
            <span className="empty-state-icon" style={{ background: 'var(--crit-bg)', color: 'var(--crit-text)' }}>
              <Icon name="lock" />
            </span>
            <strong>Acceso restringido</strong>
            <p style={{ maxWidth: 460 }}>
              Tu rol ({curUser ? curUser.rol : 'Sin rol'}) no tiene permiso de auditoría. Cambia a un
              usuario ADMINISTRADOR o AUDITOR desde el menú superior.
            </p>
            {onOpenUserSwitcher && (
              <Button className="btn sm pri" onClick={onOpenUserSwitcher} style={{ marginTop: 8 }}>
                Cambiar usuario
              </Button>
            )}
          </div>
        </Surface>
      </div>
    );
  }

  const db = Store.getDB();
  const allAudit: AuditEntry[] = (db.audit || []).slice();
  const contracts: Contract[] = Store.all('contracts');

  // Valores únicos para filtros
  const uniqueUsers = Array.from(new Set(allAudit.map((a) => a.usuario).filter(Boolean))).sort();
  const uniqueAcciones = Array.from(new Set(allAudit.map((a) => a.accion || (a as any).action).filter(Boolean))).sort();
  const uniqueModulos = Array.from(new Set(allAudit.map((a) => a.modulo || (a as any).module).filter(Boolean))).sort();

  // KPIs
  const totalAudit = allAudit.length;
  const todayCount = allAudit.filter((a) => a.fecha === todayIso()).length;
  const usersWithActivity = uniqueUsers.length;
  const modifCount = allAudit.filter((a) => (a.accion || (a as any).action) === 'Modificación').length;
  const anulaCount = allAudit.filter((a) => (a.accion || (a as any).action) === 'Anulación').length;

  // Filtrado de registros
  const qCampo = (filterCampo || '').toLowerCase().trim();
  const filteredRows = allAudit
    .filter((a) => {
      const act = a.accion || (a as any).action;
      const mod = a.modulo || (a as any).module;
      const cmp = String(a.campo || (a as any).field || '').toLowerCase();
      if (filterUser && a.usuario !== filterUser) return false;
      if (filterContract && a.contractId !== filterContract) return false;
      if (filterDesde && a.fecha < filterDesde) return false;
      if (filterHasta && a.fecha > filterHasta) return false;
      if (filterAccion && act !== filterAccion) return false;
      if (filterModulo && mod !== filterModulo) return false;
      if (qCampo && !cmp.includes(qCampo)) return false;
      return true;
    })
    .reverse(); // Más recientes primero

  // Paginación real de la vista tabla
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const hasFilters = Boolean(
    filterUser || filterContract || filterDesde || filterHasta || filterAccion || filterModulo || filterCampo
  );

  const clearFilters = () => {
    setFilterUser('');
    setFilterContract('');
    setFilterDesde('');
    setFilterHasta('');
    setFilterAccion('');
    setFilterModulo('');
    setFilterCampo('');
    setPage(1);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'Fecha', x: (a: AuditEntry) => `${fdate(a.fecha)} ${a.hora}` },
      { l: 'Usuario', k: 'usuario' },
      { l: 'Rol', k: 'rol' },
      { l: 'Acción', x: (a: AuditEntry) => a.accion || (a as any).action },
      { l: 'Módulo', x: (a: AuditEntry) => a.modulo || (a as any).module },
      {
        l: 'Contrato',
        x: (a: AuditEntry) => {
          const c = a.contractId ? Store.get('contracts', a.contractId) : null;
          return c ? c.numero : a.contractId;
        }
      },
      { l: 'Campo', x: (a: AuditEntry) => a.campo || (a as any).field },
      { l: 'Valor anterior', k: 'anterior' },
      { l: 'Valor nuevo', k: 'nuevo' },
      { l: 'Observación', k: 'obs' }
    ];
    exportRows('Bitácora de auditoría contractual', cols, filteredRows, format);
  };

  // Agrupamiento por fecha para Timeline
  const timelineGroups: Record<string, AuditEntry[]> = {};
  filteredRows.slice(0, 250).forEach((a) => {
    const key = a.fecha || 'Sin fecha';
    if (!timelineGroups[key]) timelineGroups[key] = [];
    timelineGroups[key].push(a);
  });
  const sortedDates = Object.keys(timelineGroups).sort().reverse();

  return (
    <div className="anim-fade-rise">
      {/* Banner de cabecera con gradiente de marca institucional */}
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
              <Icon name="fingerprint" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Auditoría contractual
                <span style={countPill}>{filteredRows.length} registros</span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Bitácora automática e inmutable de todas las acciones · Registro append-only, no editable desde la
                interfaz
              </p>
            </div>
          </div>

          {/* Conmutador de vista: tabla detallada o línea de tiempo */}
          <div className="row-flex" style={{ marginTop: 16 }}>
            <Button
              className={`btn sm ${modo === 'tabla' ? 'pri' : 'ghost'}`}
              onClick={() => setModo('tabla')}
              aria-pressed={modo === 'tabla'}
            >
              <Icon name="list-check" /> Tabla
            </Button>
            <Button
              className={`btn sm ${modo === 'timeline' ? 'pri' : 'ghost'}`}
              onClick={() => setModo('timeline')}
              aria-pressed={modo === 'timeline'}
            >
              <Icon name="clock" /> Timeline
            </Button>
          </div>
        </div>

        <div className="ph-actions">
          <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
            <Icon name="file-excel" /> Excel
          </Button>
          <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
            <Icon name="file-pdf" /> PDF
          </Button>
          <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
            <Icon name="file-csv" /> CSV
          </Button>
          <Button className="btn sm" onClick={() => handleExport('print')} title="Imprimir bitácora">
            <Icon name="print" /> Imprimir
          </Button>
        </div>
      </PageHeader>

      {/* KPIs canónicos con entrada escalonada */}
      <div className="kpis mb">
        <Kpi
          label="Registros totales"
          value={totalAudit}
          sub="Histórico inmutable"
          icon="list-check"
          color="na"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Registros de hoy"
          value={todayCount}
          sub={fdate(todayIso())}
          icon="clock"
          color="info"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Usuarios con actividad"
          value={usersWithActivity}
          sub="En el registro"
          icon="user"
          color="na"
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Modificaciones"
          value={modifCount}
          sub="Cambios de campo"
          icon="edit"
          color="info"
          className="anim-fade-rise stagger-4"
        />
        <Kpi
          label="Anulaciones"
          value={anulaCount}
          sub="Registros anulados"
          icon="xmark"
          color={anulaCount > 0 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-5"
        />
      </div>

      {/* Panel principal con filtros y tabla/timeline */}
      <Surface className="panel">
        <div
          className="readonly-note"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            backgroundColor: 'var(--surface-2)',
            borderBottom: '1px solid var(--line)',
            fontSize: '12px',
            color: 'var(--muted)'
          }}
        >
          <span style={{ color: 'var(--brand-2)', display: 'inline-flex', flexShrink: 0 }}>
            <Icon name="lock" />
          </span>
          <span>
            <b style={{ color: 'var(--ink-2)' }}>Registro append-only:</b> cada entrada queda congelada al crearse
            (Object.freeze). IP de sesión simulada.
          </span>
        </div>

        {/* Barra de Filtros */}
        <div className="filters">
          <Field className="f" style={{ minWidth: 140 }}>
            <label>Usuario</label>
            <Select
              className="inp"
              value={filterUser}
              onChange={(e) => {
                setFilterUser(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los usuarios</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f" style={{ minWidth: 160 }}>
            <label>Contrato</label>
            <Select
              className="inp"
              value={filterContract}
              onChange={(e) => {
                setFilterContract(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los contratos</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f" style={{ width: 130 }}>
            <label>Desde</label>
            <Input
              type="date"
              className="inp"
              value={filterDesde}
              onChange={(e) => {
                setFilterDesde(e.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field className="f" style={{ width: 130 }}>
            <label>Hasta</label>
            <Input
              type="date"
              className="inp"
              value={filterHasta}
              onChange={(e) => {
                setFilterHasta(e.target.value);
                setPage(1);
              }}
            />
          </Field>

          <Field className="f" style={{ width: 140 }}>
            <label>Acción</label>
            <Select
              className="inp"
              value={filterAccion}
              onChange={(e) => {
                setFilterAccion(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las acciones</option>
              {uniqueAcciones.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f" style={{ width: 140 }}>
            <label>Módulo</label>
            <Select
              className="inp"
              value={filterModulo}
              onChange={(e) => {
                setFilterModulo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los módulos</option>
              {uniqueModulos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f" style={{ width: 150 }}>
            <label>Campo</label>
            <Input
              className="inp"
              placeholder="Ej.: fecha, valor"
              value={filterCampo}
              onChange={(e) => {
                setFilterCampo(e.target.value);
                setPage(1);
              }}
            />
          </Field>

          {hasFilters && (
            <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Vista Tabla */}
        {modo === 'tabla' ? (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th>Fecha / Hora</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Módulo</th>
                  <th>Acción</th>
                  <th>Contrato</th>
                  <th>Campo</th>
                  <th>Anterior</th>
                  <th>Nuevo</th>
                  <th>Observación</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((a, idx) => {
                  const c = a.contractId ? Store.get('contracts', a.contractId) : null;
                  const act = a.accion || (a as any).action;
                  const mod = a.modulo || (a as any).module;
                  const field = a.campo || (a as any).field;
                  return (
                    <tr
                      key={a.id}
                      className="anim-fade-rise"
                      style={{ animationDelay: `${Math.min(idx, 12) * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                      onMouseEnter={rowLift}
                      onMouseLeave={rowReset}
                    >
                      <td style={{ whiteSpace: 'nowrap' }} className="small mono">
                        {fdate(a.fecha)} {a.hora}
                      </td>
                      <td className="strong">{a.usuario}</td>
                      <td>
                        <span className="badge b-info">{a.rol}</span>
                      </td>
                      <td>{mod}</td>
                      <td>
                        <span className={`badge ${accionBadge(act)}`} style={badgePop}>
                          {act}
                        </span>
                      </td>
                      <td>
                        {c ? (
                          <Link
                            className="link mono"
                            href={contractHref(c.id, 'auditoria')}
                            title="Ver expediente digital"
                            style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
                            {c.numero}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="strong">{field || '—'}</td>
                      <td style={{ maxWidth: 160 }} className="clip small muted">
                        {a.anterior || '—'}
                      </td>
                      <td style={{ maxWidth: 160 }} className="clip small strong">
                        {a.nuevo || '—'}
                      </td>
                      <td style={{ maxWidth: 200 }} className="clip small">
                        {a.obs || '—'}
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10}>
                      <EmptyState
                        title="No se encontraron registros de auditoría"
                        description="La bitácora registra automáticamente cada cambio; ajusta los filtros para acotar la búsqueda."
                        action={
                          hasFilters ? (
                            <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                              Limpiar filtros
                            </Button>
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>

              {filteredRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={10}>
                      <div className="tbl-foot">
                        <span>
                          Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)} de{' '}
                          <b>{filteredRows.length}</b> registros
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
        ) : (
          /* Vista Timeline */
          <div className="panel-b" style={{ padding: '16px' }}>
            {filteredRows.length === 0 ? (
              <EmptyState
                title="Sin registros para estos filtros"
                description="La línea de tiempo agrupa la bitácora por fecha, del evento más reciente al más antiguo."
                action={
                  hasFilters ? (
                    <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div>
                {sortedDates.map((d) => (
                  <div key={d} style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 10px', borderBottom: '1px solid var(--line)', paddingBottom: '4px' }}>
                      {fdate(d)}
                    </h4>
                    <div className="tl">
                      {timelineGroups[d].map((a) => {
                        const act = a.accion || (a as any).action;
                        const mod = a.modulo || (a as any).module;
                        const cc =
                          act === 'Anulación'
                            ? 'var(--crit)'
                            : act === 'Creación'
                            ? 'var(--ok)'
                            : act === 'Modificación'
                            ? 'var(--info)'
                            : 'var(--na)';
                        // Contenido compartido entre el ítem enlazable y el ítem informativo
                        const body = (
                          <>
                            <div className="tl-d">
                              {fdate(a.fecha)} {a.hora} — <b>{a.rol}</b> · {mod}
                            </div>
                            <div className="tl-x tl-t" style={{ marginTop: 2 }}>
                              {Audit.sentence(a)}
                            </div>
                            {a.obs && (
                              <div className="tl-d" style={{ marginTop: 2 }}>
                                Observación: «{a.obs}»
                              </div>
                            )}
                          </>
                        );
                        const tlc = { '--tlc': cc } as React.CSSProperties;
                        return a.contractId ? (
                          <Link
                            key={a.id}
                            className="tl-i"
                            href={contractHref(a.contractId, 'auditoria')}
                            title="Ver expediente digital"
                            style={tlc}
                          >
                            {body}
                          </Link>
                        ) : (
                          <div key={a.id} className="tl-i" style={{ ...tlc, cursor: 'default' }}>
                            {body}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {filteredRows.length > 250 && (
                  <p className="small muted">
                    Se muestran los 250 registros más recientes. Usa filtros o exporta para ver el resto.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Surface>
    </div>
  );
};
