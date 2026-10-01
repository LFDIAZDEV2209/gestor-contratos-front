'use client';

import React from 'react';
import Link from 'next/link';
import { PageHeader, Surface, TableViewport, DataTable, EmptyState } from '../ui/Workspace';
import { Button } from '../ui/button';
import type { Company } from '../../lib/types';
import { M } from '../../lib/metrics';
import { Store } from '../../lib/store';
import { Icon } from '../icons';
import { Kpi } from '../ui/Kpi';
import { Badge } from '../ui/Badge';
import { PBar } from '../ui/PBar';
import { money, moneyM, pct } from '../../lib/format';
import { contractHref } from '../app/routes';

export const EmpresaView = ({ id, onBack }: { id: string; onBack: () => void }) => {
  const company = Store.get('companies', id) as Company | undefined;
  const contracts = Store.all('contracts').filter(
    (c) => c.company === id || c.companyId === id
  );

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

      {/* Cabecera de detalle (variant="plain" según brief 1.1) */}
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
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                {company.razon || company.name}
                <Badge
                  text={company.estado || company.status || 'Activa'}
                  color={isActiva ? 'ok' : 'na'}
                />
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
        </div>
      </PageHeader>

      {/* KPI Cards con entrada escalonada */}
      <div className="kpis mb">
        <Kpi
          label="Contratos Registrados"
          value={contracts.length.toString()}
          icon="file-contract"
          className="anim-fade-rise stagger-1"
        />
        <Kpi
          label="Contratos Activos"
          value={activeContracts.toString()}
          color="ok"
          icon="check-circle"
          className="anim-fade-rise stagger-2"
        />
        <Kpi
          label="Valor Histórico Total"
          value={moneyM(totalVal)}
          sub={money(totalVal)}
          icon="wallet"
          className="anim-fade-rise stagger-3"
        />
        <Kpi
          label="Ejecución Financiera Prom."
          value={contracts.length ? pct(avgPctFin) : 'Sin contratos'}
          color="info"
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
                <b>{company.razon || company.name}</b>
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
                  <Badge
                    text={company.estado || company.status || 'Activa'}
                    color={isActiva ? 'ok' : 'na'}
                  />
                </b>
              </div>
              <div>
                <span>Nivel de Riesgo Operativo</span>
                <b>
                  <span
                    className="badge"
                    style={{
                      background: 'var(--surface-2)',
                      color: 'var(--brand-2)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r-pill)',
                      padding: '2px 8px',
                      fontSize: '11px'
                    }}
                  >
                    Nivel {company.level || '1'} (Bajo)
                  </span>
                </b>
              </div>
              <div>
                <span>Dirección / Sede</span>
                <b>{company.direccion || 'No especificada'}</b>
              </div>
              <div>
                <span>Teléfono de Contacto</span>
                <b>{company.tel || 'No registrado'}</b>
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
                const num = c.num ?? c.numero ?? c.id;
                const ratio = totalVal > 0 ? (val / totalVal) * 100 : 0;

                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '12px',
                        marginBottom: 4
                      }}
                    >
                      <Link
                        href={contractHref(c.id)}
                        className="link mono"
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
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Número</th>
                  <th style={{ minWidth: 260 }}>Objeto Contractual</th>
                  <th style={{ width: 120 }}>Estado</th>
                  <th className="num" style={{ width: 150 }}>Valor Contratado</th>
                  <th style={{ width: 170 }}>Avance Financiero</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Expediente</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c, idx) => {
                  const num = c.numero || (c as any).num || c.id;
                  const obj = c.objeto || (c as any).obj || '—';
                  const metrics = M(c.id);
                  const st = metrics.estado || c.estado || c.status || 'Activo';

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
                        <Link
                          href={contractHref(c.id)}
                          className="link mono"
                          style={{ fontWeight: 700 }}
                        >
                          {num}
                        </Link>
                      </td>
                      <td>
                        <div className="clip" style={{ maxWidth: 360, color: 'var(--ink)' }}>
                          {obj}
                        </div>
                      </td>
                      <td>
                        <Badge
                          text={st}
                          color={st === 'Activo' ? 'ok' : st === 'Vencido' ? 'crit' : 'na'}
                        />
                      </td>
                      <td className="num">
                        <span style={{ fontWeight: 600 }}>{money(metrics.valorActual)}</span>
                      </td>
                      <td>
                        <PBar value={metrics.pctFin} showLabel={true} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          href={contractHref(c.id)}
                          className="btn sm ghost"
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
    </div>
  );
};
