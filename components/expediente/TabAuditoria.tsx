'use client';
import { Input, Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { useState } from 'react';
import type { AuditEntry } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { fdate } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';

type Vista = 'tabla' | 'timeline';

export const TabAuditoria = ({ cid }: { cid: string }) => {
  const [filterUser, setFilterUser] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [search, setSearch] = useState('');
  const [vista, setVista] = useState<Vista>('tabla');

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const allAudit: AuditEntry[] = (Store.all('audit') as AuditEntry[])
    .filter((a) => a.contractId === cid)
    .slice()
    .reverse();

  const users = Array.from(new Set(allAudit.map((a) => a.usuario || a.user || '').filter(Boolean)));
  const modules = Array.from(new Set(allAudit.map((a) => a.modulo || a.module || '').filter(Boolean)));

  const filtered = allAudit.filter((a) => {
    const user = a.usuario || a.user || '';
    const mod = a.modulo || a.module || '';
    const detail = `${a.campo || ''} ${a.anterior || ''} ${a.nuevo || ''} ${a.accion || ''} ${a.obs || ''}`.toLowerCase();

    if (filterUser && user !== filterUser) return false;
    if (filterModule && mod !== filterModule) return false;
    if (search && !detail.includes(search.toLowerCase())) return false;
    return true;
  });

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Fecha/Hora', k: 'fecha', r: (r: any) => r.fecha || r.timestamp },
      { l: 'Usuario', k: 'usuario', r: (r: any) => r.usuario || r.user },
      { l: 'Módulo', k: 'modulo', r: (r: any) => r.modulo || r.module },
      { l: 'Acción', k: 'accion', r: (r: any) => r.accion || r.action },
      { l: 'Campo/Detalle', k: 'campo', r: (r: any) => r.campo || r.field || '—' },
      { l: 'Valor anterior', k: 'anterior', r: (r: any) => (r.anterior != null ? String(r.anterior) : '—') },
      { l: 'Valor nuevo', k: 'nuevo', r: (r: any) => (r.nuevo != null ? String(r.nuevo) : '—') },
      { l: 'Observación', k: 'obs', r: (r: any) => r.obs || '—' }
    ];
    exportRows('Auditoria - ' + c.numero, cols, filtered, format);
  };

  return (
    <Surface className="panel">
      <div className="panel-h" style={{ borderTop: 0 }}>
        <div>
          <h3>Auditoría del contrato</h3>
          <span className="sub">Bitácora inmutable · solo lectura</span>
        </div>
        <div className="row-flex">
          <div className="row-flex" style={{ gap: 0 }}>
            <Button className={`btn sm ${vista === 'tabla' ? 'pri' : 'ghost'}`} onClick={() => setVista('tabla')} title="Vista de tabla">
              <Icon name="list-check" /> Tabla
            </Button>
            <Button className={`btn sm ${vista === 'timeline' ? 'pri' : 'ghost'}`} onClick={() => setVista('timeline')} title="Vista de línea de tiempo">
              <Icon name="clock" /> Timeline
            </Button>
          </div>
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
      </div>

      <div
        className="mx-4 mt-3 p-3 readonly-note"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'var(--bg-sub)',
          border: '1px solid var(--line)',
          borderRadius: '10px',
          fontSize: '13px',
          color: 'var(--muted)'
        }}
      >
        <Icon name="lock" />
        <span>Los registros de auditoría no pueden editarse ni eliminarse desde la interfaz.</span>
      </div>

      {/* Filter Toolbar */}
      <div className="row-flex p-4" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <Input
          className="inp sm"
          style={{ maxWidth: '240px' }}
          placeholder="Buscar en auditoría..."
          aria-label="Buscar en la auditoría del contrato"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {users.length > 0 && (
          <Select
            className="inp sm"
            style={{ maxWidth: '180px' }}
            value={filterUser}
            aria-label="Filtrar auditoría por usuario"
            onChange={(e) => setFilterUser(e.target.value)}
          >
            <option value="">— Todos los usuarios —</option>
            {users.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        )}
        {modules.length > 0 && (
          <Select
            className="inp sm"
            style={{ maxWidth: '180px' }}
            value={filterModule}
            aria-label="Filtrar auditoría por módulo"
            onChange={(e) => setFilterModule(e.target.value)}
          >
            <option value="">— Todos los módulos —</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        )}
        {(filterUser || filterModule || search) && (
          <Button
            className="btn ghost sm"
            onClick={() => {
              setFilterUser('');
              setFilterModule('');
              setSearch('');
            }}
          >
            Limpiar filtros
          </Button>
        )}
        <span className="small muted mono" style={{ marginLeft: 'auto' }}>
          {filtered.length} registro(s)
        </span>
      </div>

      {vista === 'tabla' ? (
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th className="nw">Fecha / Hora</th>
                <th>Usuario</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Detalle / Campo</th>
                <th>Valor anterior</th>
                <th>Valor nuevo</th>
                <th>Observación</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => {
                const dt = a.fecha || (a as any).timestamp || '';
                const colorAccion =
                  a.accion === 'Creación' ? 'ok'
                  : a.accion === 'Eliminación' || a.accion === 'Anulación' ? 'crit'
                  : a.accion === 'Aprobación' ? 'brand'
                  : 'default';
                return (
                  <tr key={a.id || idx}>
                    <td className="nw small muted mono">
                      {dt} {a.hora ? `· ${a.hora}` : ''}
                    </td>
                    <td>
                      <b>{a.usuario || a.user}</b>
                      {a.rol && <span className="small muted"> ({a.rol})</span>}
                    </td>
                    <td>{a.modulo || a.module}</td>
                    <td>
                      <Badge text={a.accion || a.action} color={colorAccion} dot={false} />
                    </td>
                    <td>{a.campo || a.field || '—'}</td>
                    <td className="small muted mono" style={{ maxWidth: '200px' }}>
                      {a.anterior != null ? String(a.anterior) : '—'}
                    </td>
                    <td className="small mono" style={{ maxWidth: '220px' }}>
                      {a.nuevo != null ? <b>{String(a.nuevo)}</b> : '—'}
                    </td>
                    <td className="small muted clip" style={{ maxWidth: '200px' }} title={a.obs}>
                      {a.obs || '—'}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty">
                    No hay registros de auditoría para este contrato.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      ) : (
        <div className="px-4 pb-4">
          <div className="tl">
            {filtered.map((a, idx) => (
              <div key={a.id || idx} className="tl-i" style={{ '--tlc': a.accion === 'Anulación' || a.accion === 'Eliminación' ? 'var(--crit)' : a.accion === 'Aprobación' ? 'var(--ok)' : 'var(--brand)' } as any}>
                <div className="tl-d small mono muted">
                  {fdate(a.fecha || (a as any).timestamp || '')} {a.hora ? `· ${a.hora}` : ''}
                </div>
                <div className="tl-t">
                  <b>{a.usuario || a.user}</b> <span className="small muted">({a.rol || '—'})</span>
                </div>
                <div className="tl-x small">
                  {Audit.sentence?.(a) || `${a.accion || 'Movimiento'} · ${a.modulo || a.module || ''}${a.campo ? ` · ${a.campo}` : ''}${a.nuevo ? ` → ${a.nuevo}` : ''}`}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <EmptyState title="Sin registros" description="No hay registros de auditoría que coincidan con los filtros." />
            )}
          </div>
        </div>
      )}
    </Surface>
  );
};
