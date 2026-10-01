'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import { Button } from '../ui/button';
import { Input } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import type { Company } from '../../lib/types';
import { M } from '../../lib/metrics';
import { Store, Audit, AuthService } from '../../lib/store';
import { Icon } from '../icons';
import { Kpi } from '../ui/Kpi';
import { Badge } from '../ui/Badge';
import { PBar } from '../ui/PBar';
import { Modal } from '../ui/Modal';
import { money, moneyM, pct, fdate, daysTxt } from '../../lib/format';
import { contractHref } from '../app/routes';
import { exportRows } from '../../lib/export';

// Escala de nivel de riesgo con tokens semánticos del semáforo institucional
const NIVEL_TXT: Record<string, string> = { '1': 'Bajo', '2': 'Moderado', '3': 'Alto', '4': 'Extremo' };
const NIVEL_BADGE: Record<string, string> = { '1': 'b-ok', '2': 'b-warn', '3': 'b-risk', '4': 'b-crit' };

export const EmpresaView = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const company = Store.get('companies', id) as Company | undefined;
  const contracts = Store.all('contracts').filter(
    (c) => (c.company === id || c.companyId === id) && !c.anulado
  );
  const [editing, setEditing] = useState<Partial<Company> | null>(null);

  if (!company) {
    return (
      <div className="anim-fade-rise" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <EmptyState
          title="Empresa no encontrada"
          description="El identificador de la empresa no existe o ha sido eliminado del sistema."
          action={
            <Button className="btn pri" onClick={onBack} style={{ marginTop: 12 }}>
              <Icon name="chevron-left" /> Volver al Directorio de Empresas
            </Button>
          }
        />
      </div>
    );
  }

  const activeContracts = contracts.filter(
    (c) => c.status === 'Activo' || c.estado === 'Activo'
  ).length;

  const totalVal = contracts.reduce(
    (a, b) => a + Number(b.val ?? b.valorBase ?? 0),
    0
  );

  const avgPctFin = contracts.length
    ? contracts.reduce((sum, c) => sum + M(c.id).pctFin, 0) / contracts.length
    : 0;

  const isActiva = ['Activa', 'Activo'].includes(company.estado || company.status || '');
  const nombre = company.razon || company.name || '—';

  // El tono de la KPI de ejecución refleja el desempeño real de la cartera
  const finTone = avgPctFin >= 90 ? 'ok' : avgPctFin >= 60 ? 'info' : avgPctFin >= 35 ? 'warn' : 'risk';

  const handleExport = () => {
    exportRows(
      `Contratos ${nombre}`,
      [
        { l: 'Número', x: (c: any) => c.numero || c.num || c.id },
        { l: 'Contratista', x: (c: any) => c.contratista || '—' },
        { l: 'Objeto', x: (c: any) => c.objeto || c.obj || '—' },
        { l: 'Estado', x: (c: any) => M(c.id).estado },
        { l: 'Valor Actual', x: (c: any) => M(c.id).valorActual },
        { l: '% Avance Financiero', x: (c: any) => M(c.id).pctFin },
        { l: 'Días Restantes', x: (c: any) => M(c.id).restantes ?? '—' }
      ],
      contracts,
      'xlsx'
    );
  };

  const openEdit = () => {
    if (AuthService.guard('editar')) setEditing({ ...company });
  };

  const handleSave = () => {
    if (!editing) return;
    const razon = (editing.razon || editing.name || '').trim();
    const nit = (editing.nit || '').trim();
    const email = (editing.email || '').trim();

    if (!nit || !razon) {
      notify('El NIT y la razón social son obligatorios.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('El correo electrónico no tiene un formato válido.');
      return;
    }
    // NIT único en el directorio (excluyendo esta misma empresa)
    const duplicado = Store.all('companies').find((c: Company) => (c.nit || '').trim() === nit && c.id !== id);
    if (duplicado) {
      notify(`Ya existe «${duplicado.razon || duplicado.name}» registrada con el NIT ${nit}.`);
      return;
    }

    // Snapshot previo: Store.update muta el registro en sitio y falsearía el diff
    const before = { ...company };
    const payload: Company = { ...company, ...editing, razon, name: razon, nit } as Company;
    Store.update('companies', id, payload);
    Audit.diff('Empresas', '', before, payload, {
      nit: 'NIT de empresa',
      razon: 'Razón social de empresa',
      name: 'Razón social de empresa',
      rep: 'Representante legal de empresa',
      tel: 'Teléfono de empresa',
      email: 'Correo de empresa',
      direccion: 'Dirección de empresa'
    });
    notify(`Ficha de «${razon}» actualizada.`);
    setEditing(null);
  };

  return (
    <div className="anim-fade-rise">
      {/* Breadcrumb de navegación contextual */}
      <nav className="crumb mb" aria-label="Ruta de navegación" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Button
          variant="link"
          className="text-link"
          onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}
        >
          <Icon name="chevron-left" size={13} /> Empresas
        </Button>
        <span style={{ color: 'var(--muted)' }}>/</span>
        <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Ficha Institucional</span>
      </nav>

      {/* Cabecera de detalle con acciones reales de exportación y edición */}
      <PageHeader variant="plain" className="ph">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                width: 46,
                height: 46,
                borderRadius: 'var(--r)',
                background: 'var(--brand-soft)',
                color: 'var(--brand-2)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <Icon name="building" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, flexWrap: 'wrap' }}>
                {nombre}
                <Badge text={company.estado || company.status || 'Activa'} />
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                NIT: <span className="mono">{company.nit}</span> • Representante:{' '}
                <strong>{company.rep || 'No registrado'}</strong> • Sector:{' '}
                <span>{company.tipo || company.type || 'Privada'}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="ph-actions">
          <Button className="btn ghost" onClick={onBack}>
            <Icon name="chevron-left" /> Volver
          </Button>
          <Button className="btn" onClick={handleExport} title="Exportar los contratos de esta empresa a Excel">
            <Icon name="file-excel" /> Exportar
          </Button>
          <Button className="btn pri" onClick={openEdit}>
            <Icon name="pen" /> Editar Ficha
          </Button>
        </div>
      </PageHeader>

      {/* KPI Cards con entrada escalonada */}
      <div className="kpis mb">
        <Kpi
          label="Contratos Registrados"
          value={contracts.length}
          icon="file-contract"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Contratos Activos"
          value={activeContracts}
          color="ok"
          icon="check-circle"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Valor Histórico Total"
          value={moneyM(totalVal)}
          sub={money(totalVal)}
          color="info"
          icon="money-check-dollar"
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Ejecución Financiera Prom."
          value={contracts.length ? pct(avgPctFin) : 'Sin contratos'}
          color={finTone}
          icon="trending-up"
          className="anim-fade-rise stagger-4"
        />
      </div>

      {/* Distribución en 2 columnas: Ficha General y Distribución de Valor */}
      <div className="grid g2 mb">
        {/* Panel 1: Información General */}
        <Surface className="panel anim-fade-rise stagger-2">
          <div className="panel-h">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="building" size={16} /> Identificación Institucional
            </h3>
            <span className="sub">Datos de registro</span>
          </div>
          <div className="panel-b np">
            <div className="dl">
              <div>
                <span>Razón Social / Nombre</span>
                <b>{nombre}</b>
              </div>
              <div>
                <span>NIT / Documento</span>
                <b className="mono">{company.nit}</b>
              </div>
              <div>
                <span>Naturaleza / Sector</span>
                <b>{company.tipo || company.type || 'Privada'}</b>
              </div>
              <div>
                <span>Representante Legal</span>
                <b>{company.rep || 'No registrado'}</b>
              </div>
              <div>
                <span>Estado de Actividad</span>
                <b>
                  <Badge text={company.estado || company.status || 'Activa'} />
                </b>
              </div>
              <div>
                <span>Nivel de Riesgo Operativo</span>
                <b>
                  <span className={`badge ${NIVEL_BADGE[company.level || '1'] || 'b-na'}`}>
                    Nivel {company.level || '1'} ({NIVEL_TXT[company.level || '1'] || 'Bajo'})
                  </span>
                </b>
              </div>
              <div>
                <span>Dirección / Sede</span>
                <b>{[company.direccion, company.ciudad].filter(Boolean).join(', ') || 'No especificada'}</b>
              </div>
              <div>
                <span>Teléfono de Contacto</span>
                <b>{company.tel || 'No registrado'}</b>
              </div>
              <div>
                <span>Correo Electrónico</span>
                <b>{company.email || 'No registrado'}</b>
              </div>
            </div>
          </div>
        </Surface>

        {/* Panel 2: Concentración de Valor por Contrato */}
        <Surface className="panel anim-fade-rise stagger-3">
          <div className="panel-h">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="chart-pie" size={16} /> Distribución Económica
            </h3>
            <span className="sub">Participación por expediente</span>
          </div>
          <div className="panel-b">
            {contracts.length > 0 ? (
              contracts.map((c) => {
                const val = Number(c.val ?? c.valorBase ?? 0);
                const num = c.numero || c.num || c.id;
                const ratio = totalVal > 0 ? (val / totalVal) * 100 : 0;

                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        marginBottom: 4,
                        gap: 10,
                        flexWrap: 'wrap'
                      }}
                    >
                      <Link
                        href={contractHref(c.id)}
                        className="link mono"
                        title="Ver expediente digital"
                        style={{ fontWeight: 600 }}
                      >
                        {num}
                      </Link>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                          {money(val)}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                          ({pct(ratio)})
                        </span>
                      </div>
                    </div>
                    <PBar value={ratio} showLabel={false} />
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Sin contratos registrados"
                description="No se registran compromisos económicos vigentes con esta empresa."
              />
            )}
          </div>
        </Surface>
      </div>

      {/* Panel 3: Lista de Expedientes de Contratos */}
      <Surface className="panel anim-fade-rise stagger-4">
        <div className="panel-h">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file-contract" size={16} /> Expedientes Contractuales Vinculados
          </h3>
          <span className="sub">
            {contracts.length} {contracts.length === 1 ? 'contrato vinculado' : 'contratos vinculados'}
          </span>
        </div>

        {contracts.length > 0 ? (
          <TableViewport className="tbl-wrap" aria-label="Contratos vinculados a la empresa">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Número</th>
                  <th style={{ minWidth: 260 }}>Objeto Contractual</th>
                  <th style={{ width: 120 }}>Estado</th>
                  <th className="num" style={{ width: 150 }}>Valor Contratado</th>
                  <th style={{ width: 130 }}>Vigencia</th>
                  <th style={{ width: 150 }}>Avance Financiero</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Expediente</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, idx) => {
                  const num = c.numero || c.num || c.id;
                  const obj = c.objeto || c.obj || '—';
                  const metrics = M(c.id);
                  const st = metrics.estado || c.estado || c.status || 'Activo';
                  const restantes = metrics.restantes;

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
                        <Link
                          href={contractHref(c.id)}
                          className="link mono"
                          title="Ver expediente digital"
                          style={{ fontWeight: 700 }}
                        >
                          {num}
                        </Link>
                      </td>
                      <td>
                        <div className="clip" style={{ maxWidth: 360, color: 'var(--ink)' }} title={obj}>
                          {obj}
                        </div>
                      </td>
                      <td>
                        <Badge text={st} />
                      </td>
                      <td className="num">
                        <span style={{ fontWeight: 600 }}>{money(metrics.valorActual)}</span>
                      </td>
                      <td>
                        {/* Vigencia apilada: terminación, inicio y alerta de días restantes */}
                        <div
                          style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}
                          title={`Vigencia: ${fdate(c.fechaInicio || c.startDate)} a ${fdate(c.fechaFin || c.endDate)}`}
                        >
                          <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)' }}>
                            {fdate(c.fechaFin || c.endDate)}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                            inicia {fdate(c.fechaInicio || c.startDate)}
                          </span>
                          {restantes != null && restantes < 0 ? (
                            <span className="badge b-crit" style={{ width: 'fit-content' }}>
                              {daysTxt(restantes)}
                            </span>
                          ) : restantes != null && restantes <= 15 ? (
                            <span className="badge b-warn" style={{ width: 'fit-content' }}>
                              {daysTxt(restantes)}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                              {daysTxt(restantes)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <PBar value={metrics.pctFin} showLabel={true} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={contractHref(c.id)}
                          className="btn sm ghost"
                          title="Abrir expediente digital"
                          aria-label={`Abrir el expediente del contrato ${num}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Icon name="search" size={13} /> Ver Ficha
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableViewport>
        ) : (
          <div style={{ padding: 20 }}>
            <EmptyState
              title="No hay contratos asignados"
              description="Esta empresa no tiene contratos registrados actualmente en el sistema."
            />
          </div>
        )}
      </Surface>

      {/* Modal de edición de datos maestros de la empresa */}
      {editing && (
        <Modal
          title={`Editar Ficha: ${nombre}`}
          subtitle="Cada cambio queda registrado en la auditoría del sistema"
          size="md"
          onClose={() => setEditing(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
              <Button className="btn ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSave}>
                <Icon name="check" /> Guardar Cambios
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

            <Field className="f">
              <label className="req">Razón Social o Nombre Legal</label>
              <Input
                value={editing.razon || editing.name || ''}
                onChange={(e) => setEditing({ ...editing, razon: e.target.value, name: e.target.value })}
                placeholder="Nombre comercial o personería jurídica"
              />
            </Field>

            <Field className="f">
              <label>Representante Legal</label>
              <Input
                value={editing.rep || ''}
                onChange={(e) => setEditing({ ...editing, rep: e.target.value })}
                placeholder="Nombre del representante legal"
              />
            </Field>

            <Field className="f">
              <label>Teléfono de Contacto</label>
              <Input
                value={editing.tel || ''}
                onChange={(e) => setEditing({ ...editing, tel: e.target.value })}
                placeholder="Ej. 605 385 2210"
              />
            </Field>

            <Field className="f">
              <label>Correo Electrónico</label>
              <Input
                type="email"
                value={editing.email || ''}
                onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                placeholder="contratacion@empresa.co"
              />
            </Field>

            <Field className="f span3">
              <label>Dirección / Sede</label>
              <Input
                value={editing.direccion || ''}
                onChange={(e) => setEditing({ ...editing, direccion: e.target.value })}
                placeholder="Ej. Cra 54 # 72-80, Barranquilla"
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
