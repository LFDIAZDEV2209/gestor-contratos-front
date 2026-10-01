'use client';
import { contractHref } from '../app/routes';
import Link from 'next/link';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable } from '../ui/Workspace';
import { useState } from 'react';
import type { Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { fdate, daysTxt, money, todayIso } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

export const AgendaView = ({
  onSelectContract
}: {
  onSelectContract: (cid: string) => void;
}) => {
  const cs = activeContracts().filter((c) => {
    const m = M(c);
    return m.activo || m.estado === 'Vencido' || m.estado === 'Suspendido';
  });

  const buckets = [
    {
      title: 'Vencen hoy',
      filter: (d: number | null) => d === 0,
      sem: 'crit',
      icon: 'clock',
      desc: 'Acción inmediata requerida'
    },
    {
      title: 'Vencen en 1 a 5 días',
      filter: (d: number | null) => d !== null && d >= 1 && d <= 5,
      sem: 'crit',
      icon: 'hourglass',
      desc: 'Plazo crítico de gestión'
    },
    {
      title: 'Vencen en 6 a 15 días',
      filter: (d: number | null) => d !== null && d >= 6 && d <= 15,
      sem: 'risk',
      icon: 'alert-triangle',
      desc: 'Próxima prórroga o liquidación'
    },
    {
      title: 'Vencen en 16 a 30 días',
      filter: (d: number | null) => d !== null && d >= 16 && d <= 30,
      sem: 'warn',
      icon: 'calendar',
      desc: 'En seguimiento preventivo'
    },
    {
      title: 'Contratos vencidos',
      filter: (d: number | null) => d !== null && d < 0,
      sem: 'crit',
      icon: 'alert-circle',
      desc: 'Pendientes de liquidar o cerrar'
    }
  ];

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const allRows: any[] = [];
    buckets.forEach((b) => {
      const rows = cs.filter((c) => b.filter(M(c).restantes));
      rows.forEach((r) => {
        allRows.push({ ...r, _bucket: b.title });
      });
    });

    const cols = [
      { l: 'Ventana', k: '_bucket' },
      { l: 'Número', k: 'numero' },
      { l: 'Empresa', k: 'companyId', r: (c: any) => companyName(c.companyId) },
      { l: 'Contratista', k: 'contratista' },
      { l: 'Objeto', k: 'objeto' },
      { l: 'Fecha Inicio', k: 'fechaInicio', r: (c: any) => fdate(c.fechaInicio) },
      { l: 'Fecha Terminación', k: 'fechaFin', r: (c: any) => fdate(c.fechaFin) },
      { l: 'Días Restantes', k: 'rest', r: (c: any) => daysTxt(M(c).restantes) },
      { l: 'Estado', k: 'estado', r: (c: any) => M(c).estado },
      { l: 'Responsable', k: 'responsable' }
    ];
    exportRows('Agenda Contractual', cols, allRows, format);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader variant="hero" className="page-h">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                display: 'inline-grid',
                placeItems: 'center',
                background: 'rgba(255, 255, 255, 0.16)',
                backdropFilter: 'blur(6px)',
                flexShrink: 0
              }}
            >
              <Icon name="calendar-days" size={22} style={{ color: 'var(--color-primary-foreground, white)' }} />
            </span>
            <div>
              <h1 style={{ margin: 0 }}>Agenda contractual</h1>
              <p style={{ margin: '4px 0 0' }}>
                Vencimientos por ventana de tiempo al {fdate(todayIso())}. Alertas automáticas a 60, 30, 15 y 5 días; nivel
                crítico en los últimos 5 días.
              </p>
            </div>
          </div>
        </div>
        <div className="ph-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
      </PageHeader>

      {/* Tarjetas KPI de ventanas temporales (Kpi v2 con tiles de tono suave y cifras Geist) */}
      <div className="kpis mb">
        {buckets.map((b, idx) => {
          const count = cs.filter((c) => b.filter(M(c).restantes)).length;
          return (
            <Kpi
              key={b.title}
              label={b.title}
              value={count}
              sub={count === 1 ? '1 contrato pendiente' : `${count} contratos pendientes`}
              icon={b.icon}
              color={count > 0 ? b.sem : 'na'}
              className="anim-fade-rise click"
              style={{ animationDelay: `${idx * 40}ms` }}
              onClick={() => {
                const el = document.getElementById(`bucket-${idx}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          );
        })}
      </div>

      {/* Paneles de ventanas de vencimiento con entrada escalonada y scroll suave */}
      {buckets.map((b, idx) => {
        const rows = cs
          .filter((c) => b.filter(M(c).restantes))
          .sort((a, x) => (M(a).restantes ?? 999) - (M(x).restantes ?? 999));

        return (
          <Surface
            key={b.title}
            id={`bucket-${idx}`}
            className="panel mb anim-fade-rise"
            style={{ animationDelay: `${idx * 60}ms`, scrollMarginTop: '80px' }}
          >
            <div className="panel-h">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`sem ${b.sem}`} />
                <Icon name={b.icon} />
                <h3 style={{ margin: 0 }}>{b.title}</h3>
                <span className="sub">
                  {rows.length} contrato{rows.length === 1 ? '' : 's'} · {b.desc}
                </span>
              </div>
            </div>

            <TableViewport className="tbl-wrap">
              <DataTable className="tbl">
                <thead>
                  <tr>
                    <th className="nw">Número</th>
                    <th>Empresa</th>
                    <th>Contratista</th>
                    <th>Objeto</th>
                    <th className="nw">Inicio</th>
                    <th className="nw">Terminación</th>
                    <th className="nw">Días restantes</th>
                    <th className="nw">Estado</th>
                    <th>Responsable</th>
                    <th className="nw">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, rIdx) => {
                    const m = M(c);
                    const rail = `var(--${m.sem})`;
                    return (
                      <tr
                        key={c.id}
                        className="rail anim-fade-rise"
                        style={{
                          '--railc': rail,
                          animationDelay: `${rIdx * 30}ms`,
                          transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)'
                        } as any}
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
                        <td className="nw">
                          <Link
                            className="link font-bold"
                            href={contractHref(c.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            {c.numero}
                          </Link>
                        </td>
                        <td className="clip" style={{ maxWidth: '180px' }}>
                          {companyName(c.companyId)}
                        </td>
                        <td className="clip" style={{ maxWidth: '180px' }} title={c.contratista}>
                          {c.contratista}
                        </td>
                        <td className="clip" style={{ maxWidth: '240px' }} title={c.objeto}>
                          {c.objeto}
                        </td>
                        <td className="nw">{fdate(c.fechaInicio)}</td>
                        <td className="nw font-semibold">{fdate(c.fechaFin)}</td>
                        <td className="nw">
                          <span
                            className={`badge ${
                              m.restantes != null && m.restantes <= 0
                                ? 'b-crit'
                                : m.restantes != null && m.restantes <= 5
                                ? 'b-crit'
                                : m.restantes != null && m.restantes <= 15
                                ? 'b-risk'
                                : 'b-warn'
                            }`}
                          >
                            {daysTxt(m.restantes)}
                          </span>
                        </td>
                        <td className="nw">
                          <Badge
                            text={m.estado}
                            color={m.estado === 'Activo' ? 'ok' : 'crit'}
                          />
                        </td>
                        <td>{c.responsable || '—'}</td>
                        <td className="nw">
                          <Button
                            className="btn sm"
                            onClick={() => onSelectContract(c.id)}
                            title="Ver expediente del contrato"
                          >
                            <Icon name="eye" /> Ver expediente
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="empty">
                        No hay contratos en esta ventana.
                      </td>
                    </tr>
                  )}
                </tbody>
              </DataTable>
            </TableViewport>
          </Surface>
        );
      })}
    </div>
  );
};
