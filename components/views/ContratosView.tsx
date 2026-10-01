'use client';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field, TableViewport, DataTable } from '../ui/Workspace';

import React, { useState } from 'react';
import type { Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { M, companyName } from '../../lib/metrics';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { PBar } from '../ui/PBar';
import { ContratoFormModal } from './ContratoFormModal';
import { money as fmtMoney, daysTxt } from '../../lib/format';
import { exportRows } from '../../lib/export';

export const ContratosView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [contracts, setContracts] = useState<Contract[]>(Store.all('contracts'));
  const [editing, setEditing] = useState<Partial<Contract> | null>(null);

  // Filtros
  const [q, setQ] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEmpresa, setFilterEmpresa] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [quickFilter, setQuickFilter] = useState<string | null>(null);

  // Paginación
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const companies = Store.all('companies');

  const filtered = contracts.filter((c) => {
    const num = c.numero || (c as any).num || '';
    const obj = c.objeto || (c as any).obj || '';
    const cont = c.contratista || '';
    const nit = c.nitContratista || '';
    const m = M(c.id);

    // Texto
    if (q) {
      const ql = q.toLowerCase();
      const match =
        num.toLowerCase().includes(ql) ||
        obj.toLowerCase().includes(ql) ||
        cont.toLowerCase().includes(ql) ||
        nit.toLowerCase().includes(ql);
      if (!match) return false;
    }

    // Estado
    if (filterEstado && m.estado !== filterEstado) return false;

    // Empresa
    if (filterEmpresa && c.companyId !== filterEmpresa) return false;

    // Semáforo
    if (filterSem && m.sem !== filterSem) return false;

    // Quick filters
    if (quickFilter === 'vencidos' && m.estado !== 'Vencido') return false;
    if (quickFilter === 'proximos' && !(m.activo && m.restantes != null && m.restantes >= 0 && m.restantes <= 30)) return false;
    if (quickFilter === 'sobreejec' && m.pctFin <= 100) return false;
    if (quickFilter === 'riesgo' && m.sem !== 'crit' && m.sem !== 'risk') return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedContracts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => {
    const cols = [
      { l: 'Número', x: (c: Contract) => c.numero },
      { l: 'Empresa', x: (c: Contract) => companyName(c.companyId) },
      { l: 'Contratista', x: (c: Contract) => c.contratista },
      { l: 'Objeto', x: (c: Contract) => c.objeto },
      { l: 'Estado', x: (c: Contract) => M(c).estado },
      { l: 'Semáforo', x: (c: Contract) => M(c).sem },
      { l: 'Valor Actual', x: (c: Contract) => M(c).valorActual },
      { l: '% Avance Fin.', x: (c: Contract) => M(c).pctFin },
      { l: 'Días Restantes', x: (c: Contract) => M(c).restantes ?? '—' }
    ];
    exportRows('Contratos Nexo', cols, filtered, 'xlsx');
  };

  const clearAllFilters = () => {
    setQ('');
    setFilterEstado('');
    setFilterEmpresa('');
    setFilterSem('');
    setQuickFilter(null);
    setPage(1);
  };

  const hasActiveFilters = Boolean(q || filterEstado || filterEmpresa || filterSem || quickFilter);

  return (
    <div className="anim-fade-rise">
      <PageHeader className="ph">
        <div>
          <h1>Contratos</h1>
          <p>Registro maestro de contratos, seguimiento financiero y control de vencimientos</p>
        </div>
        <div className="ph-actions">
          <Button className="btn" onClick={handleExport} title="Descargar como Excel">
            <Icon name="file-excel" /> Exportar XLSX
          </Button>
          <Button className="btn pri" onClick={() => setEditing({})}>
            <Icon name="plus" /> Nuevo Contrato
          </Button>
        </div>
      </PageHeader>

      {/* Barra de Filtros */}
      <Surface className="panel mb">
        <div className="filters">
          <div className="gsearch" style={{ minWidth: 260 }}>
            <Icon name="search" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Buscar por número, contratista, objeto, NIT..."
            />
          </div>

          <Field className="f">
            <label>Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => { setFilterEstado(e.target.value); setPage(1); }}
            >
              <option value="">Todos los estados</option>
              <option value="Activo">Activo</option>
              <option value="Vencido">Vencido</option>
              <option value="Suspendido">Suspendido</option>
              <option value="En liquidación">En liquidación</option>
              <option value="Liquidado">Liquidado</option>
            </select>
          </Field>

          <Field className="f">
            <label>Empresa</label>
            <select
              value={filterEmpresa}
              onChange={(e) => { setFilterEmpresa(e.target.value); setPage(1); }}
            >
              <option value="">Todas las empresas</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.razon || (co as any).name}
                </option>
              ))}
            </select>
          </Field>

          <Field className="f">
            <label>Semáforo</label>
            <select
              value={filterSem}
              onChange={(e) => { setFilterSem(e.target.value); setPage(1); }}
            >
              <option value="">Todos los niveles</option>
              <option value="ok">Normal (Verde)</option>
              <option value="warn">Atención (Amarillo)</option>
              <option value="risk">Riesgo (Naranja)</option>
              <option value="crit">Crítico (Rojo)</option>
            </select>
          </Field>

          {hasActiveFilters && (
            <Button className="btn sm ghost" onClick={clearAllFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              Limpiar filtros
            </Button>
          )}
        </div>

        {/* Chips de acceso rápido */}
        <div className="filter-chips">
          <span style={{ fontSize: '11.5px', color: 'var(--muted)', marginRight: 4 }}>Vistas rápidas:</span>
          <Button
            className={`btn xs ${quickFilter === 'proximos' ? 'pri' : 'ghost'}`}
            onClick={() => { setQuickFilter(quickFilter === 'proximos' ? null : 'proximos'); setPage(1); }}
          >
            Próximos a vencer (≤30d)
          </Button>
          <Button
            className={`btn xs ${quickFilter === 'vencidos' ? 'dan' : 'ghost'}`}
            onClick={() => { setQuickFilter(quickFilter === 'vencidos' ? null : 'vencidos'); setPage(1); }}
          >
            Vencidos
          </Button>
          <Button
            className={`btn xs ${quickFilter === 'sobreejec' ? 'dan' : 'ghost'}`}
            onClick={() => { setQuickFilter(quickFilter === 'sobreejec' ? null : 'sobreejec'); setPage(1); }}
          >
            Sobreejecución (&gt;100%)
          </Button>
          <Button
            className={`btn xs ${quickFilter === 'riesgo' ? 'pri' : 'ghost'}`}
            onClick={() => { setQuickFilter(quickFilter === 'riesgo' ? null : 'riesgo'); setPage(1); }}
          >
            Críticos / Riesgo
          </Button>
        </div>

        {/* Tabla de Contratos */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th style={{ width: 48, textAlign: 'center' }}>Sem</th>
                <th style={{ width: 130 }}>Número</th>
                <th>Empresa</th>
                <th style={{ minWidth: 220 }}>Contratista y Objeto</th>
                <th style={{ width: 110 }}>Estado</th>
                <th className="num" style={{ width: 140 }}>Valor Actual</th>
                <th style={{ width: 160 }}>Avance Fin.</th>
                <th style={{ width: 140 }}>Días Restantes</th>
                <th style={{ width: 80, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedContracts.map((c) => {
                const metrics = M(c.id);
                const rail =
                  metrics.sem === 'ok'
                    ? 'var(--ok)'
                    : metrics.sem === 'warn'
                    ? 'var(--warn)'
                    : metrics.sem === 'risk'
                    ? 'var(--risk)'
                    : 'var(--crit)';
                const co = Store.get('companies', c.companyId || (c as any).company || '');
                const num = c.numero || (c as any).num || '';
                const obj = c.objeto || (c as any).obj || '';
                const st = metrics.estado;

                return (
                  <tr key={c.id} className="rail" style={{ '--railc': rail } as any}>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`sem ${metrics.sem}`} title={`Semáforo: ${metrics.sem}`} />
                    </td>
                    <td>
                      <a
                        className="link mono"
                        onClick={() => onSelect(c.id)}
                        title="Ver expediente digital"
                        style={{ fontWeight: 700 }}
                      >
                        {num}
                      </a>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{co?.razon || (co as any).name || '—'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.contratista}</div>
                      <div className="clip" style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                        {obj}
                      </div>
                    </td>
                    <td>
                      <Badge text={st} color={st === 'Activo' ? 'ok' : st === 'Vencido' ? 'crit' : 'na'} />
                    </td>
                    <td className="num">
                      <span style={{ fontWeight: 600 }}>{fmtMoney(metrics.valorActual)}</span>
                    </td>
                    <td>
                      {/* Corregido: usa metrics.pctFin directamente en escala 0-100 con clamp y sin dividir por 100 */}
                      <PBar value={metrics.pctFin} showLabel={true} />
                    </td>
                    <td>
                      {metrics.daysLeft < 0 ? (
                        <span className="badge b-crit" style={{ fontSize: '11px' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      ) : metrics.daysLeft <= 15 ? (
                        <span className="badge b-warn" style={{ fontSize: '11px' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {daysTxt(metrics.daysLeft)}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="acts">
                        <Button
                          className="icon-btn"
                          onClick={() => setEditing(c)}
                          title="Editar contrato"
                          aria-label={`Editar contrato ${num}`}
                        >
                          <Icon name="cog" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    <div className="empty-icon">
                      <Icon name="folder" />
                    </div>
                    <b>No se encontraron contratos</b>
                    <p style={{ margin: '4px 0 0', fontSize: '12px' }}>
                      Prueba ajustando los filtros o realizando otra búsqueda.
                    </p>
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
                        <b>{filtered.length}</b> contratos
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
                          <Button
                            key={p}
                            className={p === currentPage ? 'on' : ''}
                            onClick={() => setPage(p)}
                          >
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

      {editing && (
        <ContratoFormModal
          contract={editing}
          onClose={() => {
            setEditing(null);
            setContracts(Store.all('contracts'));
          }}
        />
      )}
    </div>
  );
};
