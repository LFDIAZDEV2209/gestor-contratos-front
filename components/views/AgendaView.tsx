'use client';
import { useState } from 'react';
import type { Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { M, activeContracts, companyName } from '../../lib/metrics';
import { fdate, daysTxt, money } from '../../lib/format';
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
      sem: 'crit'
    },
    {
      title: 'Vencen en 1 a 5 días',
      filter: (d: number | null) => d !== null && d >= 1 && d <= 5,
      sem: 'crit'
    },
    {
      title: 'Vencen en 6 a 15 días',
      filter: (d: number | null) => d !== null && d >= 6 && d <= 15,
      sem: 'risk'
    },
    {
      title: 'Vencen en 16 a 30 días',
      filter: (d: number | null) => d !== null && d >= 16 && d <= 30,
      sem: 'warn'
    },
    {
      title: 'Contratos vencidos',
      filter: (d: number | null) => d !== null && d < 0,
      sem: 'crit'
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
      <div className="ph">
        <div>
          <h1>Agenda contractual</h1>
          <p>
            Vencimientos por ventana de tiempo. Alertas automáticas a 60, 30, 15 y 5 días; nivel
            crítico en los últimos 5 días.
          </p>
        </div>
        <div className="ph-actions">
          <div className="exp-actions">
            <button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </button>
            <button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </button>
            <button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpis mb">
        {buckets.map((b) => {
          const count = cs.filter((c) => b.filter(M(c).restantes)).length;
          return (
            <Kpi
              key={b.title}
              label={b.title}
              value={count}
              color={count > 0 ? b.sem : undefined}
            />
          );
        })}
      </div>

      {/* 5 Bucket Panels */}
      {buckets.map((b) => {
        const rows = cs
          .filter((c) => b.filter(M(c).restantes))
          .sort((a, x) => (M(a).restantes ?? 999) - (M(x).restantes ?? 999));

        return (
          <div key={b.title} className="panel mb">
            <div className="panel-h">
              <div>
                <span className={`sem ${b.sem}`} style={{ display: 'inline-block', marginRight: '8px' }}></span>
                <h3 style={{ display: 'inline' }}>{b.title}</h3>
                <span className="sub" style={{ marginLeft: '10px' }}>
                  {rows.length} contrato{rows.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            <div className="tbl-wrap">
              <table className="tbl">
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
                  {rows.map((c) => {
                    const m = M(c);
                    const rail = `var(--${m.sem})`;
                    return (
                      <tr key={c.id} className="rail" style={{ '--railc': rail } as any}>
                        <td className="nw">
                          <a
                            className="link font-bold"
                            onClick={() => onSelectContract(c.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            {c.numero}
                          </a>
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
                                ? 'crit'
                                : m.restantes != null && m.restantes <= 5
                                ? 'crit'
                                : m.restantes != null && m.restantes <= 15
                                ? 'risk'
                                : 'warn'
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
                          <button
                            className="btn sm"
                            onClick={() => onSelectContract(c.id)}
                            title="Ver expediente del contrato"
                          >
                            Ver expediente
                          </button>
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
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
