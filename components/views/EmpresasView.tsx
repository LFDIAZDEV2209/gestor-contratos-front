'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { requestReason, notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, Field, EmptyState } from '../ui/Workspace';
import type { Company } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { exportRows } from '../../lib/export';

// El Badge resuelve el color semántico con el catálogo del sistema
// (Activa → ok, Inactiva/Anulada → crit), sin colores improvisados por vista.
export const EmpresasView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [companies, setCompanies] = useState<Company[]>(Store.all('companies'));
  const [q, setQ] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [statusChip, setStatusChip] = useState<string>('todas');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contracts = Store.all('contracts');

  // Naturalezas jurídicas reales presentes en el directorio: el filtro
  // nunca ofrece opciones que no existen en los datos.
  const tipos = Array.from(new Set(companies.map((c) => (c.tipo || c.type || '').trim()).filter(Boolean))).sort();

  const total = companies.length;
  const activas = companies.filter((c) => ['Activa', 'Activo'].includes(c.estado || c.status || '')).length;
  const inactivas = total - activas;
  const totalContratosAsociados = contracts.filter((ct) => !ct.anulado).length;

  const filtered = companies.filter((c) => {
    const nit = (c.nit || '').toLowerCase();
    const razon = (c.razon || c.name || '').toLowerCase();
    const rep = (c.rep || '').toLowerCase();
    const tipo = (c.tipo || c.type || '').toLowerCase();
    const estado = c.estado || c.status || '';
    const isActiva = ['Activa', 'Activo'].includes(estado);

    if (q) {
      const ql = q.toLowerCase();
      if (!nit.includes(ql) && !razon.includes(ql) && !rep.includes(ql) && !tipo.includes(ql)) return false;
    }
    if (filterTipo && (c.tipo || c.type) !== filterTipo) return false;
    if (statusChip === 'activas' && !isActiva) return false;
    if (statusChip === 'inactivas' && isActiva) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCompanies = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleAnular = async (id: string) => {
    if (!AuthService.guard('anular')) return;
    const target = companies.find((c) => c.id === id);
    const nombre = target?.razon || target?.name || 'la empresa';
    if (['Anulada', 'Anulado'].includes(target?.estado || target?.status || '')) {
      notify(`«${nombre}» ya se encuentra anulada.`);
      return;
    }
    const motivo = await requestReason(`Motivo de anulación para ${nombre}:`);
    if (!motivo) return;
    Store.update('companies', id, { estado: 'Anulada', status: 'Anulado' });
    Audit.log({
      modulo: 'Empresas',
      accion: 'Anulación',
      campo: 'Empresa ' + nombre,
      anterior: target?.estado || target?.status || '',
      nuevo: 'Anulada',
      obs: `Motivo: ${motivo}`
    });
    notify(`«${nombre}» quedó anulada.`);
    setCompanies(Store.all('companies'));
  };

  const handleExport = () => {
    exportRows(
      'Empresas',
      [
        { l: 'NIT', k: 'nit' },
        { l: 'Razón Social', x: (c: Company) => c.razon || c.name || '' },
        { l: 'Representante', x: (c: Company) => c.rep || '—' },
        { l: 'Tipo', x: (c: Company) => c.tipo || c.type || '—' },
        { l: 'Dirección', x: (c: Company) => [c.direccion, c.ciudad].filter(Boolean).join(', ') || '—' },
        { l: 'Teléfono', x: (c: Company) => c.tel || '—' },
        { l: 'Estado', x: (c: Company) => c.estado || c.status || '' }
      ],
      filtered,
      'xlsx'
    );
  };

  const clearFilters = () => {
    setQ('');
    setFilterTipo('');
    setStatusChip('todas');
    setPage(1);
  };

  const hasFilters = Boolean(q || filterTipo || statusChip !== 'todas');

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
              <Icon name="building" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Empresas
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
                  {filtered.length} {filtered.length === 1 ? 'entidad' : 'entidades'}
                </span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Directorio institucional de contratistas, entidades públicas y terceros vinculados
              </p>
            </div>
          </div>
        </div>

        <div className="ph-actions">
          <Button className="btn" onClick={handleExport} title="Exportar directorio a Excel">
            <Icon name="file-excel" /> Exportar
          </Button>
          {AuthService.can('crear') && (
            <Link href="/empresas/nueva" className="btn pri">
              <Icon name="plus" /> Nueva Empresa
            </Link>
          )}
        </div>
      </PageHeader>

      {/* Tarjetas KPI: los totales funcionan como accesos a los filtros de la tabla */}
      <div className="kpis mb">
        <Kpi
          label="Total Empresas"
          value={total}
          icon="building"
          color="brand"
          className="anim-fade-rise stagger-1 click"
          onClick={() => {
            setStatusChip('todas');
            setPage(1);
          }}
        />
        <Kpi
          label="Empresas Activas"
          value={activas}
          color="ok"
          icon="check-circle"
          className="anim-fade-rise stagger-2 click"
          onClick={() => {
            setStatusChip('activas');
            setPage(1);
          }}
        />
        <Kpi
          label="Inactivas / Anuladas"
          value={inactivas}
          color="na"
          icon="alert-circle"
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setStatusChip('inactivas');
            setPage(1);
          }}
        />
        <Kpi
          label="Contratos Vinculados"
          value={totalContratosAsociados}
          color="info"
          icon="file-signature"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {/* Superficie de filtros y búsqueda */}
      <Surface className="panel mb">
        <div className="filters">
          <div className="gsearch" style={{ minWidth: 280 }}>
            <Icon name="search" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por NIT, razón social o representante..."
              aria-label="Buscar empresas por NIT, razón social o representante"
            />
          </div>

          <Field className="f">
            <label>Naturaleza</label>
            <Select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas las naturalezas</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          {hasFilters && (
            <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Chips de filtro rápido con micro-interacción de activación */}
        <div className="filter-chips">
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginRight: 6 }}>
            Filtrar por:
          </span>
          {[
            { id: 'todas', label: 'Todas las empresas', icon: 'building' },
            { id: 'activas', label: 'Activas', icon: 'check-circle' },
            { id: 'inactivas', label: 'Inactivas / Anuladas', icon: 'alert-circle' }
          ].map((chip) => {
            const isActive = statusChip === chip.id;
            return (
              <button
                type="button"
                key={chip.id}
                onClick={() => {
                  setStatusChip(chip.id);
                  setPage(1);
                }}
                className={`btn xs ${isActive ? 'active-chip' : 'ghost'}`}
                aria-pressed={isActive}
                style={{
                  borderRadius: 'var(--r-pill)',
                  background: isActive ? 'var(--selection, var(--brand-soft))' : 'var(--surface-2)',
                  color: isActive ? 'var(--selection-text, var(--brand-2))' : 'var(--ink-2)',
                  borderColor: isActive ? 'var(--brand)' : 'var(--border-control)',
                  fontWeight: isActive ? 600 : 500,
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  boxShadow: isActive ? '0 2px 8px -2px rgba(6, 47, 88, 0.35)' : 'none',
                  transition: 'transform var(--t-fast) cubic-bezier(0.34, 1.56, 0.64, 1), background var(--t-fast) var(--ease), border-color var(--t-fast) var(--ease)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.transform = 'scale(1.03)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = isActive ? 'scale(1.05)' : 'scale(1)';
                }}
              >
                <Icon name={chip.icon} size={12} style={{ color: isActive ? 'var(--brand)' : 'var(--muted)' }} />
                <span>{chip.label}</span>
                {isActive && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', marginLeft: 2 }} />}
              </button>
            );
          })}
        </div>

        {/* Tabla de empresas con hover de elevación y entrada escalonada */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl" aria-label="Directorio de empresas y contratistas">
            <thead>
              <tr>
                <th style={{ width: 140 }}>NIT</th>
                <th style={{ minWidth: 260 }}>Razón Social</th>
                <th style={{ minWidth: 200 }}>Representante Legal</th>
                <th style={{ width: 150 }}>Naturaleza</th>
                <th style={{ width: 110, textAlign: 'center' }}>Contratos</th>
                <th style={{ width: 120 }}>Estado</th>
                <th style={{ width: 110, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedCompanies.map((c, idx) => {
                const nombre = c.razon || c.name || '—';
                const relatedContracts = contracts.filter((ct) => !ct.anulado && (ct.companyId === c.id || ct.company === c.id));

                return (
                  <tr
                    key={c.id}
                    className="anim-fade-rise"
                    style={{
                      animationDelay: `${idx * 25}ms`,
                      transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-2)';
                      e.currentTarget.style.position = 'relative';
                      e.currentTarget.style.zIndex = '2';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.zIndex = 'auto';
                    }}
                  >
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {c.nit}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="link"
                        className="text-link"
                        onClick={() => onSelect(c.id)}
                        style={{ fontWeight: 600, fontSize: '13px' }}
                        title="Ver ficha institucional"
                      >
                        {nombre}
                      </Button>
                    </td>
                    <td>
                      <span style={{ color: 'var(--ink-2)' }}>{c.rep || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                        {c.tipo || c.type || 'Privada'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {/* Atajo real: lleva a Contratos filtrado por esta empresa */}
                      <Link
                        href={`/contratos?empresa=${encodeURIComponent(c.id)}`}
                        className="badge b-info"
                        title={`Abrir los ${relatedContracts.length} contratos de esta empresa`}
                        aria-label={`Ver los ${relatedContracts.length} contratos vinculados a ${nombre}`}
                        style={{ borderRadius: 'var(--r-pill)', fontSize: '11.5px', padding: '2px 8px' }}
                      >
                        {relatedContracts.length}
                      </Link>
                    </td>
                    <td>
                      <Badge text={c.estado || c.status || 'Activa'} />
                    </td>
                    <td>
                      <div className="acts">
                        <Button
                          className="icon-btn"
                          onClick={() => onSelect(c.id)}
                          title="Ver ficha institucional"
                          aria-label={`Ver ficha de ${nombre}`}
                        >
                          <Icon name="search" />
                        </Button>
                        {AuthService.can('editar') && (
                          <Link
                            href={`/empresas/${encodeURIComponent(c.id)}/editar`}
                            className="icon-btn"
                            title="Editar empresa"
                            aria-label={`Editar ${nombre}`}
                          >
                            <Icon name="cog" />
                          </Link>
                        )}
                        <Button
                          className="icon-btn"
                          onClick={() => handleAnular(c.id)}
                          title="Anular empresa (requiere motivo)"
                          aria-label={`Anular ${nombre}`}
                        >
                          <Icon name="trash" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      title="No se encontraron empresas"
                      description="Prueba ajustando los criterios de búsqueda o los filtros de estado."
                      action={
                        hasFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                            Restablecer filtros
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
                  <td colSpan={7}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{' '}
                        <b>{filtered.length}</b> empresas
                      </span>
                      <div className="pager" role="navigation" aria-label="Paginación de empresas">
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
                            aria-current={p === currentPage ? 'page' : undefined}
                            onClick={() => setPage(p)}
                            aria-label={`Ir a la página ${p}`}
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
    </div>
  );
};
