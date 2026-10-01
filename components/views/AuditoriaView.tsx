'use client';
import { Select, Input } from '../ui/Controls';
import { Button } from '../ui/button';
import { PageHeader, Surface, MetricCard, Field, TableViewport, DataTable } from '../ui/Workspace';

import React, { useState } from 'react';
import { Store, AuthService, Audit } from '@/lib/store';
import { fdate, todayIso } from '@/lib/format';
import { exportRows } from '@/lib/export';
import { Icon } from '../icons';
import type { AuditEntry, Contract } from '@/lib/types';

interface AuditoriaViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
  onOpenUserSwitcher?: () => void;
}

export const AuditoriaView: React.FC<AuditoriaViewProps> = ({ onSelectContract, onOpenUserSwitcher }) => {
  const [modo, setModo] = useState<'tabla' | 'timeline'>('tabla');
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
      <div className="view-content">
        <PageHeader className="page-h">
          <div>
            <h1>Auditoría</h1>
            <p className="sub">Bitácora automática de todos los cambios.</p>
          </div>
        </PageHeader>
        <Surface className="panel">
          <div className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', color: 'var(--crit)', marginBottom: '12px' }}>
              <Icon name="lock" />
            </div>
            <h3>Acceso restringido</h3>
            <p className="muted" style={{ maxWidth: 460, margin: '8px auto' }}>
              Tu rol ({curUser ? curUser.rol : 'Sin rol'}) no tiene permiso de auditoría. Cambia a un
              usuario ADMINISTRADOR o AUDITOR desde el menú superior.
            </p>
            {onOpenUserSwitcher && (
              <div style={{ marginTop: '16px' }}>
                <Button className="btn sm pri" onClick={onOpenUserSwitcher}>
                  Cambiar usuario
                </Button>
              </div>
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
    <div className="view-content">
      {/* Header */}
      <PageHeader className="page-h">
        <div>
          <h1>Auditoría contractual</h1>
          <p className="sub">Bitácora automática e inmutable de todas las acciones. No puede editarse desde la interfaz.</p>
        </div>
        <div className="row-flex">
          <Button className="btn sm xs" onClick={() => handleExport('xlsx')}>
            <Icon name="file-spreadsheet" /> Excel
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('pdf')}>
            <Icon name="file-text" /> PDF
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('csv')}>
            <Icon name="file-text" /> CSV
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('print')}>
            <Icon name="printer" /> Imprimir
          </Button>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="kpis mb">
        <MetricCard className="kpi-card">
          <div className="kpi-t">Registros totales</div>
          <div className="kpi-v">{totalAudit}</div>
          <div className="kpi-s">Histórico inmutable</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Registros de hoy</div>
          <div className="kpi-v" style={{ color: 'var(--brand-2)' }}>
            {todayCount}
          </div>
          <div className="kpi-s">{fdate(todayIso())}</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Usuarios con actividad</div>
          <div className="kpi-v">{usersWithActivity}</div>
          <div className="kpi-s">En el registro</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Modificaciones</div>
          <div className="kpi-v">{modifCount}</div>
          <div className="kpi-s">Cambios de campo</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Anulaciones</div>
          <div className="kpi-v" style={{ color: 'var(--crit)' }}>
            {anulaCount}
          </div>
          <div className="kpi-s">Registros anulados</div>
        </MetricCard>
      </div>

      {/* Panel principal con filtros y tabla/timeline */}
      <Surface className="panel">
        <div className="readonly-note" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', backgroundColor: 'var(--bg-soft, #f7f9fa)', borderBottom: '1px solid var(--border)', fontSize: '12px' }}>
          <Icon name="lock" />
          <span>
            <b>Registro append-only:</b> cada entrada queda congelada al crearse (Object.freeze). IP de sesión simulada.
          </span>
        </div>

        {/* Barra de Filtros */}
        <div className="filters" style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
          <Field className="f" style={{ minWidth: 140 }}>
            <label className="small muted">Usuario</label>
            <Select
              className="inp"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="">Todos los usuarios</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f" style={{ minWidth: 180 }}>
            <label className="small muted">Contrato</label>
            <Select
              className="inp"
              value={filterContract}
              onChange={(e) => setFilterContract(e.target.value)}
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
            <label className="small muted">Desde</label>
            <Input
              type="date"
              className="inp"
              value={filterDesde}
              onChange={(e) => setFilterDesde(e.target.value)}
            />
          </Field>

          <Field className="f" style={{ width: 130 }}>
            <label className="small muted">Hasta</label>
            <Input
              type="date"
              className="inp"
              value={filterHasta}
              onChange={(e) => setFilterHasta(e.target.value)}
            />
          </Field>

          <Field className="f" style={{ width: 140 }}>
            <label className="small muted">Acción</label>
            <Select
              className="inp"
              value={filterAccion}
              onChange={(e) => setFilterAccion(e.target.value)}
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
            <label className="small muted">Módulo</label>
            <Select
              className="inp"
              value={filterModulo}
              onChange={(e) => setFilterModulo(e.target.value)}
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
            <label className="small muted">Campo</label>
            <Input
              className="inp"
              placeholder="Ej.: fecha, valor"
              value={filterCampo}
              onChange={(e) => setFilterCampo(e.target.value)}
            />
          </Field>

          <span className="sp" style={{ flex: 1 }} />

          <div className="row-flex" style={{ gap: 4 }}>
            <Button
              className={`btn sm ${modo === 'tabla' ? 'pri' : ''}`}
              onClick={() => setModo('tabla')}
            >
              <Icon name="table" /> Tabla
            </Button>
            <Button
              className={`btn sm ${modo === 'timeline' ? 'pri' : ''}`}
              onClick={() => setModo('timeline')}
            >
              <Icon name="clock" /> Timeline
            </Button>
          </div>
        </div>

        {/* Vista Tabla o Timeline */}
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
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      No se encontraron registros de auditoría con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((a) => {
                    const c = a.contractId ? Store.get('contracts', a.contractId) : null;
                    const act = a.accion || (a as any).action;
                    const mod = a.modulo || (a as any).module;
                    const field = a.campo || (a as any).field;
                    return (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'nowrap' }} className="small">
                          {fdate(a.fecha)} {a.hora}
                        </td>
                        <td className="strong">{a.usuario}</td>
                        <td>
                          <span className="badge b-info">{a.rol}</span>
                        </td>
                        <td>{mod}</td>
                        <td>
                          <span
                            className="badge"
                            style={{
                              backgroundColor:
                                act === 'Anulación'
                                  ? 'var(--crit)'
                                  : act === 'Creación'
                                  ? 'var(--ok)'
                                  : act === 'Modificación'
                                  ? 'var(--info)'
                                  : 'var(--na)',
                              color: '#fff'
                            }}
                          >
                            {act}
                          </span>
                        </td>
                        <td>
                          {c ? (
                            <span
                              className="link"
                              style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                              onClick={() => onSelectContract?.(c.id, 'auditoria')}
                            >
                              {c.numero}
                            </span>
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
                  })
                )}
              </tbody>
            </DataTable>
          </TableViewport>
        ) : (
          <div className="panel-b" style={{ padding: '16px' }}>
            {filteredRows.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
                <p className="muted">Sin registros para estos filtros.</p>
              </div>
            ) : (
              <div>
                {sortedDates.map((d) => (
                  <div key={d} style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 10px', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>
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
                        return (
                          <div
                            key={a.id}
                            className="tl-i"
                            style={{
                              borderLeft: `3px solid ${cc}`,
                              paddingLeft: '12px',
                              marginBottom: '12px',
                              cursor: a.contractId ? 'pointer' : 'default'
                            }}
                            onClick={() => {
                              if (a.contractId) onSelectContract?.(a.contractId, 'auditoria');
                            }}
                          >
                            <div className="tl-d" style={{ fontSize: '11px', color: 'var(--muted)' }}>
                              {fdate(a.fecha)} {a.hora} — <b>{a.rol}</b> · {mod}
                            </div>
                            <div className="tl-x" style={{ fontSize: '13px', marginTop: 2 }}>
                              {Audit.sentence(a)}
                            </div>
                            {a.obs && (
                              <div className="tl-d" style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                                Observación: «{a.obs}»
                              </div>
                            )}
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
