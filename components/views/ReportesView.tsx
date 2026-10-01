'use client';

import React, { useState } from 'react';
import { Store, AuthService } from '@/lib/store';
import { M, activeContracts, companyName, effOblig, effDeliv, riskLevel, cupoStats, mapData } from '@/lib/metrics';
import { fdate, money, moneyM, pct, sum, groupBy, todayIso, diffDays } from '@/lib/format';
import { LEVEL_TXT, LEVEL } from '@/lib/catalog';
import { DEPTOS } from '@/lib/geo';
import { exportRows } from '@/lib/export';
import { Icon } from '../icons';
import { Modal } from '../ui/Modal';
import type { Contract, Guarantee, Payment, Breach, Risk, Subcontract, Cupo, AuditEntry } from '@/lib/types';

interface ReportCol {
  k?: string;
  l: string;
  num?: boolean | number;
  x?: (row: any) => any;
  r?: (row: any) => any;
}

interface ReportDef {
  k: string;
  t: string;
  ic: string;
  d: string;
  b: () => { cols: ReportCol[]; rows: any[] } | null;
}

export const ReportesView: React.FC = () => {
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  function groupReport(keyFn: (c: Contract) => string, label: string) {
    const csList = activeContracts();
    const g = groupBy(csList, keyFn);
    const rows = Object.keys(g)
      .map((k) => {
        const cs = g[k];
        const v = sum(cs, (c) => M(c).valorActual);
        const e = sum(cs, (c) => M(c).ejecutado);
        return {
          k,
          n: cs.length,
          act: cs.filter((c) => M(c).activo).length,
          crit: cs.filter((c) => LEVEL[M(c).nivel] >= 3).length,
          v,
          e,
          s: v - e,
          p: v ? Math.round((e / v) * 1000) / 10 : 0
        };
      })
      .sort((a, b) => b.v - a.v);

    return {
      cols: [
        { k: 'k', l: label },
        { k: 'n', l: 'Contratos', num: true },
        { k: 'act', l: 'Activos', num: true },
        { k: 'crit', l: 'En riesgo / críticos', num: true },
        { k: 'v', l: 'Valor actualizado', num: true, r: (r: any) => money(r.v) },
        { k: 'e', l: 'Ejecutado', num: true, r: (r: any) => money(r.e) },
        { k: 's', l: 'Saldo', num: true, r: (r: any) => money(r.s) },
        { k: 'p', l: '% ejecución', num: true, r: (r: any) => pct(r.p) }
      ],
      rows
    };
  }

  function getInsurerStats() {
    const pol = Store.all('guarantees').filter((g) => {
      const c = Store.get('contracts', g.contractId);
      return c && !c.anulado && g.estado !== 'Anulada' && g.estado !== 'Rechazada';
    });
    const by = groupBy(pol, (g) => g.aseguradora);
    return Object.keys(by)
      .map((a) => {
        const ps = by[a];
        const ap = ps.filter((g) => g.estado === 'Aprobada');
        const cups = Store.all('cupos').filter((cp) => cp.aseguradora === a && cp.estado !== 'Anulado');
        const cupoTotal = sum(cups, (cp) => +cp.valor || 0);
        const cupoUso = sum(cups, (cp) => cupoStats(cp).utilizado);
        return {
          a,
          n: ps.length,
          nc: ps.map((g) => g.contractId).filter((v, i, x) => x.indexOf(v) === i).length,
          valor: sum(ps, (g) => +g.valor || 0),
          prima: sum(ps, (g) => Number(g.prima ?? 0)),
          porCupo: ps.filter((g) => g.modalidadPoliza === 'Póliza por cupo').length,
          indiv: ps.filter((g) => g.modalidadPoliza !== 'Póliza por cupo').length,
          cupoTotal,
          cupoUso,
          prox: ap.filter((g) => {
            const d = diffDays(todayIso(), g.fechaVenc);
            return d >= 0 && d <= 30;
          }).length,
          vencidas: ap.filter((g) => g.fechaVenc < todayIso()).length
        };
      })
      .sort((x, y) => y.valor - x.valor);
  }

  const reports: ReportDef[] = [
    {
      k: 'r_general',
      t: 'Reporte general de contratos',
      ic: 'folder',
      d: 'Todos los contratos con valores, fechas, ejecución, estado y semáforo.',
      b: () => ({
        cols: [
          { k: 'numero', l: 'Contrato' },
          { l: 'Empresa', x: (c: Contract) => companyName(c.companyId) },
          { k: 'contratista', l: 'Contratista' },
          { k: 'tipo', l: 'Tipo' },
          { k: 'modalidad', l: 'Modalidad' },
          { k: 'objeto', l: 'Objeto' },
          { l: 'Inicio', x: (c: Contract) => fdate(c.fechaInicio) },
          { l: 'Terminación', x: (c: Contract) => fdate(c.fechaFin) },
          { l: 'Días rest.', x: (c: Contract) => M(c).restantes ?? '—' },
          { l: 'Valor actualizado', num: true, r: (c: Contract) => money(M(c).valorActual) },
          { l: 'Ejecutado', num: true, r: (c: Contract) => money(M(c).ejecutado) },
          { l: 'Saldo', num: true, r: (c: Contract) => money(M(c).saldo) },
          { l: '% Fin.', num: true, r: (c: Contract) => pct(M(c).pctFin) },
          { l: '% Fís.', num: true, r: (c: Contract) => pct(M(c).pctFis) },
          { l: 'Semáforo', x: (c: Contract) => LEVEL_TXT[M(c).nivel] },
          { l: 'Estado', x: (c: Contract) => M(c).estado },
          { k: 'responsable', l: 'Responsable' }
        ],
        rows: activeContracts()
      })
    },
    {
      k: 'r_empresa',
      t: 'Contratos por empresa',
      ic: 'building',
      d: 'Cantidad, valor, ejecución y saldo por empresa contratante.',
      b: () => groupReport((c) => companyName(c.companyId), 'Empresa')
    },
    {
      k: 'r_estado',
      t: 'Contratos por estado',
      ic: 'traffic-light',
      d: 'Distribución del portafolio por estado efectivo.',
      b: () => groupReport((c) => M(c).estado, 'Estado')
    },
    {
      k: 'r_anio',
      t: 'Contratos por año',
      ic: 'calendar',
      d: 'Agrupado por año de firma o inicio.',
      b: () => groupReport((c) => String(c.fechaFirma || c.fechaInicio || 'Sin fecha').slice(0, 4), 'Año')
    },
    {
      k: 'r_proximos',
      t: 'Contratos próximos a vencer',
      ic: 'clock',
      d: 'Activos que terminan en los próximos 30 días y vencidos.',
      b: () => {
        const cs = activeContracts()
          .filter((c) => {
            const m = M(c);
            return (m.activo && m.restantes != null && m.restantes <= 30) || m.estado === 'Vencido';
          })
          .sort((a, b) => (M(a).restantes || 0) - (M(b).restantes || 0));
        return {
          cols: [
            { k: 'numero', l: 'Contrato' },
            { l: 'Empresa', x: (c: Contract) => companyName(c.companyId) },
            { k: 'contratista', l: 'Contratista' },
            { k: 'objeto', l: 'Objeto' },
            { l: 'Inicio', x: (c: Contract) => fdate(c.fechaInicio) },
            { l: 'Terminación', x: (c: Contract) => fdate(c.fechaFin) },
            { l: 'Días restantes', x: (c: Contract) => M(c).restantes ?? '—' },
            { l: 'Estado', x: (c: Contract) => M(c).estado },
            { k: 'responsable', l: 'Responsable' }
          ],
          rows: cs
        };
      }
    },
    {
      k: 'r_fin',
      t: 'Ejecución financiera',
      ic: 'dollar-sign',
      d: 'Valor actualizado, ejecutado, pagado, saldo y proyección de agotamiento.',
      b: () => ({
        cols: [
          { k: 'numero', l: 'Contrato' },
          { l: 'Empresa', x: (c: Contract) => companyName(c.companyId) },
          { l: 'Valor inicial', num: true, r: (c: Contract) => money(M(c).valorInicial) },
          { l: 'Adiciones', num: true, r: (c: Contract) => money(Number(c.adiciones ?? 0)) },
          { l: 'Reducciones', num: true, r: (c: Contract) => money(Number(c.reducciones ?? 0)) },
          { l: 'Valor actualizado', num: true, r: (c: Contract) => money(M(c).valorActual) },
          { l: 'Ejecutado', num: true, r: (c: Contract) => money(M(c).ejecutado) },
          { l: 'Pagado', num: true, r: (c: Contract) => money(M(c).pagado) },
          { l: 'Saldo', num: true, r: (c: Contract) => money(M(c).saldo) },
          { l: '% ejecución', num: true, r: (c: Contract) => pct(M(c).pctFin) },
          { l: 'Agotamiento proyectado', x: (c: Contract) => (M(c).fechaAgotar ? fdate(M(c).fechaAgotar) : '—') }
        ],
        rows: activeContracts()
      })
    },
    {
      k: 'r_cont',
      t: 'Ejecución contractual',
      ic: 'list-check',
      d: 'Tiempo vs. avance físico y financiero, obligaciones y entregables.',
      b: () => ({
        cols: [
          { k: 'numero', l: 'Contrato' },
          { l: '% tiempo', num: true, r: (c: Contract) => pct(M(c).pctTiempo) },
          { l: '% físico', num: true, r: (c: Contract) => pct(M(c).pctFis) },
          { l: '% financiero', num: true, r: (c: Contract) => pct(M(c).pctFin) },
          { l: 'Brecha fin.-física', num: true, r: (c: Contract) => pct(M(c).pctFin - M(c).pctFis) },
          { l: '% cumpl. oblig.', num: true, r: (c: Contract) => pct(M(c).pctCumpl) },
          { l: 'Oblig. vencidas', num: true, x: (c: Contract) => M(c).oblVencidas },
          { l: 'Entregables vencidos', num: true, x: (c: Contract) => M(c).entVencidos },
          { l: 'Semáforo', x: (c: Contract) => LEVEL_TXT[M(c).nivel] }
        ],
        rows: activeContracts()
      })
    },
    {
      k: 'r_pagos',
      t: 'Pagos',
      ic: 'credit-card',
      d: 'Pagos con factura, bruto, IVA, retenciones, neto y estado.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          {
            l: 'Contrato',
            x: (p: Payment) => {
              const c = Store.get('contracts', p.contractId);
              return c ? c.numero : p.contractId;
            }
          },
          { k: 'numero', l: 'Factura / Cuenta' },
          { k: 'concepto', l: 'Concepto' },
          { l: 'Fecha radicado', x: (p: Payment) => fdate(p.fecha) },
          { l: 'Fecha pago', x: (p: Payment) => (p.fechaPago ? fdate(p.fechaPago) : '—') },
          { l: 'Valor bruto', num: true, r: (p: Payment) => money(p.bruto) },
          { l: 'IVA', num: true, r: (p: Payment) => money(p.iva) },
          { l: 'Retenciones', num: true, r: (p: Payment) => money(p.retenciones) },
          { l: 'Neto a pagar', num: true, r: (p: Payment) => money(p.neto) },
          { k: 'estado', l: 'Estado' }
        ],
        rows: Store.all('payments')
      })
    },
    {
      k: 'r_gar',
      t: 'Garantías',
      ic: 'shield',
      d: 'Pólizas, valores asegurados y vencimientos.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          {
            l: 'Contrato',
            x: (g: Guarantee) => {
              const c = Store.get('contracts', g.contractId);
              return c ? c.numero : g.contractId;
            }
          },
          { k: 'poliza', l: 'Póliza' },
          { k: 'aseguradora', l: 'Aseguradora' },
          { k: 'tipo', l: 'Amparo' },
          { l: 'Valor asegurado', num: true, r: (g: Guarantee) => money(g.valor) },
          { l: 'Prima', num: true, r: (g: Guarantee) => (g.prima ? money(g.prima) : '—') },
          { l: 'Inicio vigencia', x: (g: Guarantee) => fdate(g.fechaInicio) },
          { l: 'Vencimiento', x: (g: Guarantee) => fdate(g.fechaVenc) },
          { k: 'modalidadPoliza', l: 'Modalidad' },
          { k: 'estado', l: 'Estado' }
        ],
        rows: Store.all('guarantees')
      })
    },
    {
      k: 'r_inc',
      t: 'Incumplimientos',
      ic: 'alert-triangle',
      d: 'Incumplimientos, impacto, plan de acción y multas.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          {
            l: 'Contrato',
            x: (b: Breach) => {
              const c = Store.get('contracts', b.contractId);
              return c ? c.numero : b.contractId;
            }
          },
          { l: 'Fecha', x: (b: Breach) => fdate(b.fecha) },
          { k: 'tipo', l: 'Tipo' },
          { k: 'descripcion', l: 'Descripción' },
          { k: 'impacto', l: 'Impacto' },
          { l: 'Multa', num: true, r: (b: Breach) => (b.multa ? money(b.multa) : '—') },
          { k: 'planAccion', l: 'Plan de acción' },
          { k: 'responsable', l: 'Responsable' },
          { k: 'estado', l: 'Estado' }
        ],
        rows: Store.all('breaches')
      })
    },
    {
      k: 'r_rg',
      t: 'Riesgos',
      ic: 'shield-alert',
      d: 'Matriz de riesgos con nivel P × I y tratamiento.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          {
            l: 'Contrato',
            x: (r: Risk) => {
              const c = Store.get('contracts', r.contractId);
              return c ? c.numero : r.contractId;
            }
          },
          { k: 'categoria', l: 'Categoría' },
          { k: 'descripcion', l: 'Descripción' },
          { k: 'probabilidad', l: 'P', num: true },
          { k: 'impacto', l: 'I', num: true },
          { l: 'Nivel', x: (r: Risk) => riskLevel(r) },
          { k: 'mitigacion', l: 'Mitigación' },
          { k: 'responsable', l: 'Responsable' },
          { k: 'estado', l: 'Estado' }
        ],
        rows: Store.all('risks')
      })
    },
    {
      k: 'r_sub',
      t: 'Subcontratos',
      ic: 'diagram-project',
      d: 'Subcontratos por contrato principal.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          {
            l: 'Contrato principal',
            x: (s: Subcontract) => {
              const c = Store.get('contracts', s.contractId);
              return c ? c.numero : s.contractId;
            }
          },
          { k: 'numero', l: 'N.º Subcontrato' },
          { k: 'contratista', l: 'Subcontratista' },
          { k: 'nit', l: 'NIT' },
          { k: 'objeto', l: 'Objeto' },
          { l: 'Valor', num: true, r: (s: Subcontract) => money(s.valor) },
          { l: 'Inicio', x: (s: Subcontract) => fdate(s.fechaInicio) },
          { l: 'Fin', x: (s: Subcontract) => fdate(s.fechaFin) },
          { l: '% Ejecución', num: true, r: (s: Subcontract) => pct(s.ejecucion) },
          { k: 'estado', l: 'Estado' },
          { k: 'responsable', l: 'Responsable' }
        ],
        rows: Store.all('subcontracts')
      })
    },
    {
      k: 'r_aud',
      t: 'Auditoría',
      ic: 'history',
      d: 'Bitácora completa de cambios (requiere permiso de auditoría).',
      b: () => {
        if (!AuthService.can('auditar')) {
          alert('Tu rol no tiene permiso de auditoría.');
          return null;
        }
        const db = Store.getDB();
        return {
          cols: [
            { l: 'Fecha', x: (a: AuditEntry) => `${fdate(a.fecha)} ${a.hora}` },
            { k: 'usuario', l: 'Usuario' },
            { k: 'rol', l: 'Rol' },
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
            { k: 'anterior', l: 'Anterior' },
            { k: 'nuevo', l: 'Nuevo' },
            { k: 'obs', l: 'Observación' }
          ],
          rows: (db.audit || []).slice().reverse()
        };
      }
    },
    {
      k: 'r_resp',
      t: 'Contratos por responsable',
      ic: 'user',
      d: 'Carga y estado por responsable del contrato.',
      b: () => groupReport((c) => c.responsable || 'Sin responsable', 'Responsable')
    },
    {
      k: 'r_aseg',
      t: 'Reporte por aseguradora',
      ic: 'umbrella',
      d: 'Pólizas, contratos, valor asegurado, primas, cupos y vencimientos por aseguradora.',
      b: () => ({
        cols: [
          { k: 'a', l: 'Aseguradora' },
          { k: 'n', l: 'Pólizas', num: true },
          { k: 'nc', l: 'Contratos', num: true },
          { k: 'valor', l: 'Valor asegurado', num: true, r: (r: any) => money(r.valor) },
          { k: 'prima', l: 'Primas', num: true, r: (r: any) => money(r.prima) },
          { k: 'porCupo', l: 'Por cupo', num: true },
          { k: 'indiv', l: 'Individuales', num: true },
          { k: 'cupoTotal', l: 'Cupo total', num: true, r: (r: any) => money(r.cupoTotal) },
          { k: 'cupoUso', l: 'Cupo utilizado', num: true, r: (r: any) => money(r.cupoUso) },
          { k: 'prox', l: 'Vencen ≤ 30 d', num: true },
          { k: 'vencidas', l: 'Vencidas', num: true }
        ],
        rows: getInsurerStats()
      })
    },
    {
      k: 'r_aseg_det',
      t: 'Pólizas por aseguradora y contrato',
      ic: 'file-text',
      d: 'Detalle de cada póliza ordenado por aseguradora, con modalidad y cupo.',
      b: () => {
        const rows = Store.all('guarantees')
          .slice()
          .sort((a, b) => a.aseguradora.localeCompare(b.aseguradora) || a.contractId.localeCompare(b.contractId));
        return {
          cols: [
            { k: 'aseguradora', l: 'Aseguradora' },
            {
              l: 'Contrato',
              x: (g: Guarantee) => {
                const c = Store.get('contracts', g.contractId);
                return c ? c.numero : g.contractId;
              }
            },
            { k: 'poliza', l: 'Póliza' },
            { k: 'tipo', l: 'Amparo' },
            { l: 'Valor asegurado', num: true, r: (g: Guarantee) => money(g.valor) },
            { l: 'Prima', num: true, r: (g: Guarantee) => (g.prima ? money(g.prima) : '—') },
            { l: 'Vencimiento', x: (g: Guarantee) => fdate(g.fechaVenc) },
            { k: 'modalidadPoliza', l: 'Modalidad' },
            { k: 'estado', l: 'Estado' }
          ],
          rows
        };
      }
    },
    {
      k: 'r_cupos',
      t: 'Cupos por aseguradora',
      ic: 'layers',
      d: 'Cupo total, utilizado, disponible, % de uso y vigencia.',
      b: () => ({
        cols: [
          { k: 'id', l: 'ID' },
          { k: 'numero', l: 'Número de cupo' },
          { k: 'aseguradora', l: 'Aseguradora' },
          { l: 'Valor cupo', num: true, r: (c: Cupo) => money(+c.valor || 0) },
          { l: 'Utilizado', num: true, r: (c: Cupo) => money(cupoStats(c).utilizado) },
          { l: 'Disponible', num: true, r: (c: Cupo) => money(cupoStats(c).disponible) },
          { l: '% Uso', num: true, r: (c: Cupo) => pct(cupoStats(c).pct) },
          { l: 'Fecha inicio', x: (c: Cupo) => fdate(c.fechaInicio) },
          { l: 'Fecha vencimiento', x: (c: Cupo) => fdate(c.fechaVenc) },
          { k: 'estado', l: 'Estado' }
        ],
        rows: Store.all('cupos')
      })
    },
    {
      k: 'r_region',
      t: 'Contratos por departamento y región',
      ic: 'map',
      d: 'Contratos, pólizas y clientes por departamento de ejecución.',
      b: () => {
        const md = mapData();
        const rows = Object.keys(md.D)
          .map((k) => {
            const x = md.D[k];
            const deptInfo = DEPTOS[k] || [k, 'Sin región'];
            return {
              d: deptInfo[0],
              r: deptInfo[1],
              c: x.contratos.length,
              v: x.valorC,
              p: x.polizas.length,
              vp: x.valorP,
              cl: Object.keys(x.clientes).length
            };
          })
          .filter((r) => r.c > 0)
          .sort((a, b) => b.c - a.c);

        return {
          cols: [
            { k: 'd', l: 'Departamento' },
            { k: 'r', l: 'Región' },
            { k: 'c', l: 'Contratos', num: true },
            { k: 'v', l: 'Valor contratado', num: true, r: (r: any) => money(r.v) },
            { k: 'p', l: 'Pólizas', num: true },
            { k: 'vp', l: 'Valor asegurado', num: true, r: (r: any) => money(r.vp) },
            { k: 'cl', l: 'Clientes', num: true }
          ],
          rows
        };
      }
    },
    {
      k: 'r_sup',
      t: 'Contratos por supervisor',
      ic: 'user-check',
      d: 'Carga y estado por supervisor.',
      b: () => groupReport((c) => c.supervisor || 'Sin supervisor', 'Supervisor')
    }
  ];

  const handleExportDirect = (r: ReportDef, format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const data = r.b();
    if (!data) return;
    exportRows(r.t, data.cols, data.rows, format);
  };

  const previewReport = previewKey ? reports.find((x) => x.k === previewKey) : null;
  const previewData = previewReport ? previewReport.b() : null;

  const totalPages = previewData ? Math.ceil(previewData.rows.length / pageSize) : 1;
  const pagedRows = previewData
    ? previewData.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : [];

  return (
    <div className="view-content">
      {/* Header */}
      <div className="page-h">
        <div>
          <h2>Reportes</h2>
          <p className="sub">{reports.length} reportes exportables a Excel, PDF o impresión. Los datos se calculan al momento de generar.</p>
        </div>
      </div>

      {/* Grid de 19 reportes en 3 columnas */}
      <div className="grid g3">
        {reports.map((r) => (
          <div key={r.k} className="panel">
            <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div className="row-flex" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
                <div
                  className="alert-ic"
                  style={{
                    backgroundColor: 'var(--brand-soft)',
                    color: 'var(--brand-2)',
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon name={r.ic} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: '13.5px', marginBottom: 3 }}>
                    {r.t}
                  </div>
                  <div className="small muted" style={{ fontSize: '11.5px', lineHeight: 1.35 }}>
                    {r.d}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: 14 }}>
                <div className="row-flex" style={{ gap: 4 }}>
                  <button
                    className="btn xs"
                    onClick={() => {
                      setPreviewKey(r.k);
                      setCurrentPage(1);
                    }}
                  >
                    <Icon name="eye" /> Vista previa
                  </button>
                  <span className="sp" style={{ flex: 1 }} />
                  <button
                    className="btn xs"
                    onClick={() => handleExportDirect(r, 'xlsx')}
                    title="Exportar Excel"
                  >
                    <Icon name="file-spreadsheet" /> Excel
                  </button>
                  <button
                    className="btn xs"
                    onClick={() => handleExportDirect(r, 'pdf')}
                    title="Exportar PDF"
                  >
                    <Icon name="file-text" /> PDF
                  </button>
                  <button
                    className="btn xs"
                    onClick={() => handleExportDirect(r, 'print')}
                    title="Imprimir"
                  >
                    <Icon name="printer" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Vista Previa */}
      {previewReport && previewData && (
        <Modal
          title={previewReport.t}
          size="xl"
          onClose={() => setPreviewKey(null)}
          footer={
            <>
              <button
                className="btn sm"
                onClick={() => handleExportDirect(previewReport, 'xlsx')}
              >
                <Icon name="file-spreadsheet" /> Excel
              </button>
              <button
                className="btn sm"
                onClick={() => handleExportDirect(previewReport, 'pdf')}
              >
                <Icon name="file-text" /> PDF
              </button>
              <button
                className="btn sm"
                onClick={() => handleExportDirect(previewReport, 'csv')}
              >
                <Icon name="file-text" /> CSV
              </button>
              <button
                className="btn sm"
                onClick={() => handleExportDirect(previewReport, 'print')}
              >
                <Icon name="printer" /> Imprimir
              </button>
              <span className="sp" style={{ flex: 1 }} />
              <button className="btn pri sm" onClick={() => setPreviewKey(null)}>
                Cerrar
              </button>
            </>
          }
        >
          <div style={{ marginBottom: 12 }}>
            <span className="small muted">
              Total registros: <b>{previewData.rows.length}</b> · Mostrando página {currentPage} de{' '}
              {totalPages || 1}
            </span>
          </div>

          <div className="tbl-wrap" style={{ maxHeight: '55vh', overflow: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  {previewData.cols.map((col, idx) => (
                    <th key={idx} className={col.num ? 'num' : ''}>
                      {col.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={previewData.cols.length} className="empty">
                      No hay registros en este reporte.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {previewData.cols.map((col, cIdx) => {
                        let val = '';
                        if (col.r) {
                          val = col.r(row);
                        } else if (col.x) {
                          val = col.x(row);
                        } else if (col.k) {
                          val = row[col.k];
                        }
                        return (
                          <td key={cIdx} className={col.num ? 'num' : ''}>
                            {val != null ? String(val) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              className="row-flex"
              style={{ justifyContent: 'center', marginTop: 14, gap: 10 }}
            >
              <button
                className="btn sm xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                Anterior
              </button>
              <span className="small muted">
                Página {currentPage} de {totalPages}
              </span>
              <button
                className="btn sm xs"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Siguiente
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
