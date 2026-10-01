'use client';

import React, { useState } from 'react';
import { Input, Select } from '../ui/Controls';
import { requestReason, notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Company } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { uid } from '../../lib/format';
import { exportRows } from '../../lib/export';

export const EmpresasView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [companies, setCompanies] = useState<Company[]>(Store.all('companies'));
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  const [q, setQ] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [statusChip, setStatusChip] = useState<string>('todas');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const contracts = Store.all('contracts');

  const total = companies.length;
  const activas = companies.filter((c) => ['Activa', 'Activo'].includes(c.estado || c.status || '')).length;
  const inactivas = companies.filter((c) => ['Inactiva', 'Inactivo', 'Anulada', 'Anulado'].includes(c.estado || c.status || '')).length;
  const totalContratosAsociados = contracts.length;

  const filtered = companies.filter((c) => {
    const nit = (c.nit || '').toLowerCase();
    const razon = (c.razon || c.name || '').toLowerCase();
    const rep = (c.rep || '').toLowerCase();
    const tipo = (c.tipo || c.type || '').toLowerCase();
    const estado = (c.estado || c.status || '');
    const isActiva = ['Activa', 'Activo'].includes(estado);

    if (q) {
      const ql = q.toLowerCase();
      if (!nit.includes(ql) && !razon.includes(ql) && !rep.includes(ql) && !tipo.includes(ql)) {
        return false;
      }
    }

    if (filterTipo && (c.tipo || c.type) !== filterTipo) {
      return false;
    }

    if (statusChip === 'activas' && !isActiva) return false;
    if (statusChip === 'inactivas' && isActiva) return false;
    if (statusChip === 'privadas' && (c.tipo || c.type) !== 'Privada') return false;
    if (statusChip === 'publicas' && (c.tipo || c.type) !== 'Pública') return false;

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCompanies = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSave = () => {
    if (!editing) return;
    const razon = editing.razon || editing.name;
    if (!editing.nit || !razon) {
      notify('El NIT y la Razón Social son obligatorios.');
      return;
    }

    if (editing.id) {
      const updated: Company = {
        ...editing,
        razon: razon,
        name: razon,
        tipo: editing.tipo || editing.type || 'Privada',
        type: editing.tipo || editing.type || 'Privada'
      } as Company;
      Store.update('companies', editing.id, updated);
      Audit.log({
        modulo: 'Empresas',
        accion: 'Edición',
        campo: 'Empresa ' + razon,
        nuevo: 'Actualización de datos institucionales'
      });
      notify(`Empresa «${razon}» actualizada.`);
    } else {
      const newId = uid();
      const created: Company = {
        ...editing,
        id: newId,
        razon: razon,
        name: razon,
        tipo: editing.tipo || editing.type || 'Privada',
        type: editing.tipo || editing.type || 'Privada',
        risk: 0,
        level: '1',
        estado: 'Activa',
        status: 'Activo'
      } as Company;
      Store.insert('companies', created);
      Audit.log({
        modulo: 'Empresas',
        accion: 'Creación',
        campo: 'Empresa ' + razon,
        nuevo: 'Registro de nueva empresa'
      });
      notify(`Empresa «${razon}» registrada exitosamente.`);
    }
    setCompanies(Store.all('companies'));
    setEditing(null);
  };

  const handleAnular = async (id: string) => {
    const target = companies.find((c) => c.id === id);
    const motivo = await requestReason(`Motivo de anulación para ${target?.razon || target?.name || 'la empresa'}:`);
    if (motivo) {
      Store.update('companies', id, { estado: 'Anulada', status: 'Anulado' });
      Audit.log({
        modulo: 'Empresas',
        accion: 'Anulación',
        campo: 'Empresa ' + (target?.razon || target?.name || id),
        obs: `Motivo: ${motivo}`
      });
      notify('Empresa marcada como anulada.');
      setCompanies(Store.all('companies'));
    }
  };

  const handleExport = () => {
    exportRows(
      'Empresas',
      [
        { l: 'NIT', k: 'nit' },
        { l: 'Razón Social', x: (c: Company) => c.razon || c.name || '' },
        { l: 'Representante', x: (c: Company) => c.rep || '—' },
        { l: 'Tipo', x: (c: Company) => c.tipo || c.type || '—' },
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
            <Icon name="file-contract" /> Exportar
          </Button>
          <Button className="btn pri" onClick={() => setEditing({})}>
            <Icon name="plus" /> Nueva Empresa
          </Button>
        </div>
      </PageHeader>

      {/* Tarjetas KPI con entrada escalonada */}
      <div className="kpis mb">
        <Kpi
          label="Total Empresas"
          value={total.toString()}
          icon="building"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Empresas Activas"
          value={activas.toString()}
          color="ok"
          icon="check-circle"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Inactivas / Anuladas"
          value={inactivas.toString()}
          color="na"
          icon="alert-circle"
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Contratos Vinculados"
          value={totalContratosAsociados.toString()}
          color="brand"
          icon="file-signature"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {/* Superficie de Filtros y Búsqueda */}
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
            />
          </div>

          <Field className="f">
            <label>Tipo de Persona</label>
            <Select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos los tipos</option>
              <option value="Privada">Privada</option>
              <option value="Pública">Pública</option>
              <option value="Mixta">Mixta</option>
            </Select>
          </Field>

          {hasFilters && (
            <Button
              className="btn sm ghost"
              onClick={clearFilters}
              style={{ alignSelf: 'flex-end', height: 38 }}
            >
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Chips de filtro rápido */}
        <div className="filter-chips">
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', marginRight: 6 }}>
            Filtrar por:
          </span>
          {[
            { id: 'todas', label: 'Todas las empresas' },
            { id: 'activas', label: 'Activas' },
            { id: 'inactivas', label: 'Inactivas / Anuladas' },
            { id: 'privadas', label: 'Sector Privado' },
            { id: 'publicas', label: 'Sector Público' }
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
                style={{
                  borderRadius: 'var(--r-pill)',
                  background: isActive ? 'var(--selection, var(--brand-soft))' : 'var(--surface-2)',
                  color: isActive ? 'var(--selection-text, var(--brand-2))' : 'var(--ink-2)',
                  borderColor: isActive ? 'var(--brand)' : 'var(--border-control)',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all var(--t-fast) var(--ease)'
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Tabla de Empresas */}
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th style={{ width: 140 }}>NIT</th>
                <th style={{ minWidth: 260 }}>Razón Social</th>
                <th style={{ minWidth: 200 }}>Representante Legal</th>
                <th style={{ width: 130 }}>Tipo</th>
                <th style={{ width: 110, textAlign: 'center' }}>Contratos</th>
                <th style={{ width: 120 }}>Estado</th>
                <th style={{ width: 100, textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedCompanies.map((c, idx) => {
                const isActiva = ['Activa', 'Activo'].includes(c.estado || c.status || '');
                const relatedContracts = contracts.filter((ct) => ct.companyId === c.id || ct.company === c.id);

                return (
                  <tr
                    key={c.id}
                    className="anim-fade-rise"
                    style={{
                      animationDelay: `${idx * 40}ms`,
                      transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                    }}
                  >
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {c.nit}
                      </span>
                    </td>
                    <td>
                      <Button
                        variant="link"
                        className="text-link"
                        onClick={() => onSelect(c.id)}
                        style={{ fontWeight: 600, fontSize: '13px', textAlign: 'left' }}
                      >
                        {c.razon || c.name}
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
                      <span
                        className="badge"
                        style={{
                          background: 'var(--surface-2)',
                          color: 'var(--brand-2)',
                          border: '1px solid var(--line)',
                          borderRadius: 'var(--r-pill)',
                          fontSize: '11.5px',
                          padding: '2px 8px'
                        }}
                      >
                        {relatedContracts.length}
                      </span>
                    </td>
                    <td>
                      <Badge
                        text={c.estado || c.status || 'Activa'}
                        color={isActiva ? 'ok' : 'na'}
                      />
                    </td>
                    <td>
                      <div className="acts">
                        <Button
                          className="icon-btn"
                          onClick={() => onSelect(c.id)}
                          title="Ver Ficha Institucional"
                          aria-label={`Ver ficha de ${c.razon || c.name}`}
                        >
                          <Icon name="search" />
                        </Button>
                        <Button
                          className="icon-btn"
                          onClick={() => setEditing(c)}
                          title="Editar Empresa"
                          aria-label={`Editar ${c.razon || c.name}`}
                        >
                          <Icon name="cog" />
                        </Button>
                        <Button
                          className="icon-btn"
                          onClick={() => handleAnular(c.id)}
                          title="Anular Empresa"
                          aria-label={`Anular ${c.razon || c.name}`}
                        >
                          <Icon name="exclamation-circle" />
                        </Button>
                        <details className="action-disclosure" style={{ display: 'none' }}>
                          <summary aria-label={`Acciones para ${c.razon || c.name}`}>
                            <Icon name="settings" />
                          </summary>
                          <div className="action-disclosure-content">
                            <Button className="btn text-link" onClick={() => onSelect(c.id)}>
                              <Icon name="eye" /> Ver expediente
                            </Button>
                            <Button className="btn text-link" onClick={() => setEditing(c)}>
                              <Icon name="cog" /> Modificar
                            </Button>
                            <Button className="btn text-link" onClick={() => handleAnular(c.id)}>
                              <Icon name="trash" /> Anular
                            </Button>
                          </div>
                        </details>
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

      {/* Modal de edición / nueva empresa */}
      {editing && (
        <Modal
          title={editing.id ? `Editar Empresa: ${editing.razon || editing.name}` : 'Nueva Empresa'}
          subtitle="Directorio de contratistas y contrapartes contractuales"
          size="md"
          onClose={() => setEditing(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <Button className="btn ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSave}>
                <Icon name="check" /> Guardar Empresa
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">NIT / Identificación Tributaria</label>
              <Input
                value={editing.nit || ''}
                onChange={(e) => setEditing({ ...editing, nit: e.target.value })}
                placeholder="Ej. 900.876.543-1"
              />
            </Field>

            <Field className="f span2">
              <label className="req">Razón Social o Nombre Legal</label>
              <Input
                value={editing.razon || editing.name || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    razon: e.target.value,
                    name: e.target.value
                  })
                }
                placeholder="Nombre comercial o personería jurídica"
              />
            </Field>

            <Field className="f span2">
              <label>Representante Legal</label>
              <Input
                value={editing.rep || ''}
                onChange={(e) => setEditing({ ...editing, rep: e.target.value })}
                placeholder="Nombre del representante legal"
              />
            </Field>

            <Field className="f">
              <label>Naturaleza / Tipo</label>
              <Select
                value={editing.tipo || editing.type || 'Privada'}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    tipo: e.target.value,
                    type: e.target.value
                  })
                }
              >
                <option value="Privada">Privada</option>
                <option value="Pública">Pública</option>
                <option value="Mixta">Mixta</option>
              </Select>
            </Field>

            <Field className="f span3">
              <label>Dirección y Ciudad</label>
              <Input
                value={editing.direccion || ''}
                onChange={(e) => setEditing({ ...editing, direccion: e.target.value })}
                placeholder="Ej. Cra 7 # 71-52, Bogotá"
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
