'use client';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid, EmptyState, Field } from '../ui/Workspace';
import { Kpi } from '../ui/Kpi';

import React, { useState } from 'react';
import Link from 'next/link';
import { Store, AuthService, Audit } from '@/lib/store';
import { activeContracts } from '@/lib/metrics';
import { fdate, money, moneyM, todayIso } from '@/lib/format';
import { exportRows } from '@/lib/export';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { PBar } from '../ui/PBar';
import { contractHref } from '../app/routes';
import type { Breach, Plan, Contract } from '@/lib/types';

interface IncumplimientosViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
}

/* ---------- Presentación local (2ª pasada): hover lift en filas y badges pill con pop ---------- */
const rowLift = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.animation = 'none'; // libera el transform final del fadeRise para permitir el lift
  el.style.transform = 'translateY(-2px)';
  el.style.boxShadow = 'var(--shadow-2)';
  el.style.position = 'relative';
  el.style.zIndex = '2';
};
const rowReset = (e: React.MouseEvent<HTMLTableRowElement>) => {
  const el = e.currentTarget;
  el.style.transform = 'none';
  el.style.boxShadow = 'none';
  el.style.zIndex = 'auto';
};
const badgePop = { animation: 'pop 250ms var(--ease)' } as const;
const countPill = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  padding: '2px 8px',
  borderRadius: 'var(--r-pill)',
  background: 'rgba(255, 255, 255, 0.18)',
  color: 'var(--surface)',
  whiteSpace: 'nowrap' as const
};

// Desplazamiento suave a un panel de la vista (respeta prefers-reduced-motion)
const scrollToPanel = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

// Semáforo institucional de impacto -> clase de badge con tokens AA
const impactoBadge: Record<string, string> = { Alto: 'b-crit', Medio: 'b-risk', Bajo: 'b-ok' };

export const IncumplimientosView: React.FC<IncumplimientosViewProps> = ({ onSelectContract }) => {
  const [tick, setTick] = useState(0);

  // Filtros del panel de incumplimientos
  const [qB, setQB] = useState('');
  const [filterBEstado, setFilterBEstado] = useState('');
  const [filterBImpacto, setFilterBImpacto] = useState('');
  const [pageB, setPageB] = useState(1);
  const [pageP, setPageP] = useState(1);
  const pageSize = 12;

  // Modales
  const [breachModalOpen, setBreachModalOpen] = useState(false);
  const [editingBreach, setEditingBreach] = useState<Breach | null>(null);
  const [breachForm, setBreachForm] = useState({
    contractId: '',
    fecha: todayIso(),
    tipo: 'Retraso en cronograma',
    descripcion: '',
    impacto: 'Medio',
    multa: 0,
    planAccion: '',
    responsable: '',
    estado: 'Abierto'
  });

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({
    contractId: '',
    accion: '',
    responsable: '',
    fechaInicio: todayIso(),
    fechaFin: todayIso(),
    avance: 0,
    estado: 'En curso'
  });

  const refresh = () => setTick((t) => t + 1);

  const contracts: Contract[] = activeContracts();
  const breaches: Breach[] = Store.all('breaches');
  const openBreaches = breaches.filter((b) => b.estado !== 'Cerrado' && b.estado !== 'Subsanado');
  const totalMultas = breaches.reduce((acc, b) => acc + (Number(b.multa) || 0), 0);

  const plans: Plan[] = Store.all('plans');
  const activePlans = plans.filter((p) => p.estado !== 'Cerrado');

  // Filtrado del panel de incumplimientos
  const filteredBreaches = breaches.filter((b) => {
    if (filterBEstado && b.estado !== filterBEstado) return false;
    if (filterBImpacto && b.impacto !== filterBImpacto) return false;
    if (qB) {
      const c = Store.get('contracts', b.contractId);
      const ql = qB.toLowerCase();
      const match =
        b.descripcion.toLowerCase().includes(ql) ||
        b.tipo.toLowerCase().includes(ql) ||
        (b.planAccion || '').toLowerCase().includes(ql) ||
        (b.responsable || '').toLowerCase().includes(ql) ||
        (c?.numero || '').toLowerCase().includes(ql);
      if (!match) return false;
    }
    return true;
  });

  // Paginación real de ambas tablas
  const totalPagesB = Math.max(1, Math.ceil(filteredBreaches.length / pageSize));
  const currentPageB = Math.min(pageB, totalPagesB);
  const pagedBreaches = filteredBreaches.slice((currentPageB - 1) * pageSize, currentPageB * pageSize);

  const totalPagesP = Math.max(1, Math.ceil(plans.length / pageSize));
  const currentPageP = Math.min(pageP, totalPagesP);
  const pagedPlans = plans.slice((currentPageP - 1) * pageSize, currentPageP * pageSize);

  const hasFilters = Boolean(qB || filterBEstado || filterBImpacto);

  const clearFilters = () => {
    setQB('');
    setFilterBEstado('');
    setFilterBImpacto('');
    setPageB(1);
  };

  const exportBreaches = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (b: Breach) => {
          const c = Store.get('contracts', b.contractId);
          return c ? c.numero : b.contractId;
        }
      },
      { l: 'Fecha', x: (b: Breach) => fdate(b.fecha) },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Multa', x: (b: Breach) => (b.multa ? money(b.multa) : '—') },
      { l: 'Plan de acción', k: 'planAccion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Incumplimientos', cols, filteredBreaches, format);
  };

  const exportPlans = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (p: Plan) => {
          const c = Store.get('contracts', p.contractId);
          return c ? c.numero : p.contractId;
        }
      },
      { l: 'Acción', k: 'accion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Fecha inicio', x: (p: Plan) => fdate(p.fechaInicio) },
      { l: 'Fecha fin', x: (p: Plan) => fdate(p.fechaFin) },
      { l: '% Avance', x: (p: Plan) => `${p.avance}%` },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Planes de mejoramiento', cols, plans, format);
  };

  // Handlers Breach
  const openNewBreachModal = () => {
    if (!AuthService.guard('crear')) return;
    setEditingBreach(null);
    setBreachForm({
      contractId: contracts[0]?.id || '',
      fecha: todayIso(),
      tipo: 'Retraso en cronograma',
      descripcion: '',
      impacto: 'Medio',
      multa: 0,
      planAccion: '',
      responsable: '',
      estado: 'Abierto'
    });
    setBreachModalOpen(true);
  };

  const openEditBreachModal = (b: Breach) => {
    if (!AuthService.guard('editar')) return;
    setEditingBreach(b);
    setBreachForm({
      contractId: b.contractId || '',
      fecha: b.fecha || todayIso(),
      tipo: b.tipo || 'Retraso en cronograma',
      descripcion: b.descripcion || '',
      impacto: b.impacto || 'Medio',
      multa: Number(b.multa) || 0,
      planAccion: b.planAccion || '',
      responsable: b.responsable || '',
      estado: b.estado || 'Abierto'
    });
    setBreachModalOpen(true);
  };

  const handleSaveBreach = () => {
    if (!breachForm.descripcion.trim()) {
      notify('Ingresa la descripción del incumplimiento.');
      return;
    }
    if (editingBreach) {
      Store.update('breaches', editingBreach.id, breachForm);
      Audit.log({
        contractId: breachForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Modificación',
        campo: 'Incumplimiento ' + editingBreach.id,
        nuevo: breachForm.descripcion
      });
    } else {
      Store.insert('breaches', breachForm);
      Audit.log({
        contractId: breachForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Creación',
        campo: 'Incumplimiento',
        nuevo: breachForm.descripcion
      });
    }
    setBreachModalOpen(false);
    refresh();
  };

  const handleAnularBreach = async (b: Breach) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo del cierre / anulación del incumplimiento:');
    if (motivo == null) return;
    Store.update('breaches', b.id, { estado: 'Subsanado' });
    Audit.log({
      contractId: b.contractId,
      modulo: 'Incumplimientos',
      accion: 'Cierre de incumplimiento',
      campo: 'Estado',
      anterior: b.estado,
      nuevo: 'Subsanado',
      obs: motivo
    });
    refresh();
  };

  // Handlers Plan
  const openNewPlanModal = () => {
    if (!AuthService.guard('crear')) return;
    setEditingPlan(null);
    setPlanForm({
      contractId: contracts[0]?.id || '',
      accion: '',
      responsable: '',
      fechaInicio: todayIso(),
      fechaFin: todayIso(),
      avance: 0,
      estado: 'En curso'
    });
    setPlanModalOpen(true);
  };

  const openEditPlanModal = (p: Plan) => {
    if (!AuthService.guard('editar')) return;
    setEditingPlan(p);
    setPlanForm({
      contractId: p.contractId || '',
      accion: p.accion || '',
      responsable: p.responsable || '',
      fechaInicio: p.fechaInicio || todayIso(),
      fechaFin: p.fechaFin || todayIso(),
      avance: Number(p.avance) || 0,
      estado: p.estado || 'En curso'
    });
    setPlanModalOpen(true);
  };

  const handleSavePlan = () => {
    if (!planForm.accion.trim()) {
      notify('Ingresa la acción o título del plan de mejoramiento.');
      return;
    }
    if (editingPlan) {
      Store.update('plans', editingPlan.id, planForm);
      Audit.log({
        contractId: planForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Modificación',
        campo: 'Plan ' + editingPlan.id,
        nuevo: planForm.accion
      });
    } else {
      Store.insert('plans', planForm);
      Audit.log({
        contractId: planForm.contractId,
        modulo: 'Incumplimientos',
        accion: 'Creación',
        campo: 'Plan de mejoramiento',
        nuevo: planForm.accion
      });
    }
    setPlanModalOpen(false);
    refresh();
  };

  const handleAnularPlan = async (p: Plan) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo del cierre del plan de mejoramiento:');
    if (motivo == null) return;
    Store.update('plans', p.id, { estado: 'Cerrado' });
    Audit.log({
      contractId: p.contractId,
      modulo: 'Incumplimientos',
      accion: 'Cierre de plan',
      campo: 'Estado',
      anterior: p.estado,
      nuevo: 'Cerrado',
      obs: motivo
    });
    refresh();
  };

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
              <Icon name="gavel" size={24} />
            </span>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                Incumplimientos
                <span style={countPill}>{openBreaches.length} abiertos</span>
              </h1>
              <p style={{ margin: '4px 0 0' }}>
                Registro de incumplimientos con impacto, multas, planes de mejoramiento y responsables de seguimiento
              </p>
            </div>
          </div>

          {/* Leyenda institucional de impacto, dentro del hero */}
          <div className="legend" style={{ marginTop: 16 }}>
            <span><span className="sem ok" /> Bajo</span>
            <span><span className="sem risk" /> Medio</span>
            <span><span className="sem crit" /> Alto</span>
            <span><span className="sem na" /> Subsanado / Cerrado</span>
          </div>
        </div>

        <div className="ph-actions">
          <Button className="btn sm" onClick={openNewPlanModal}>
            <Icon name="clipboard-check" /> Plan de mejoramiento
          </Button>
          <Button className="btn sm pri" onClick={openNewBreachModal}>
            <Icon name="plus" /> Registrar incumplimiento
          </Button>
        </div>
      </PageHeader>

      {/* KPIs canónicos con entrada escalonada; clic aplica el filtro correspondiente */}
      <div className="kpis mb">
        <Kpi
          label="Incumplimientos"
          value={breaches.length}
          sub="Registrados en total"
          icon="triangle-exclamation"
          color="na"
          className="anim-fade-rise stagger-1 click"
          onClick={clearFilters}
        />
        <Kpi
          label="Abiertos"
          value={openBreaches.length}
          sub="Sin subsanar"
          icon="alert-circle"
          color={openBreaches.length > 0 ? 'crit' : 'ok'}
          className="anim-fade-rise stagger-2 click"
          onClick={() => {
            setFilterBEstado(filterBEstado === 'Abierto' ? '' : 'Abierto');
            setPageB(1);
          }}
        />
        <Kpi
          label="Impacto alto"
          value={openBreaches.filter((b) => b.impacto === 'Alto').length}
          sub="Abiertos"
          icon="fire"
          color="risk"
          className="anim-fade-rise stagger-3 click"
          onClick={() => {
            setFilterBImpacto(filterBImpacto === 'Alto' ? '' : 'Alto');
            setPageB(1);
          }}
        />
        <Kpi
          label="Multas / sanciones"
          value={moneyM(totalMultas)}
          sub={money(totalMultas)}
          icon="dollar-sign"
          color={totalMultas > 0 ? 'warn' : 'na'}
          className="anim-fade-rise stagger-4"
        />
        <Kpi
          label="Planes de mejoramiento"
          value={plans.length}
          sub={`${activePlans.length} en curso`}
          icon="clipboard-check"
          color="info"
          className="anim-fade-rise stagger-5 click"
          onClick={() => scrollToPanel('panel-planes')}
        />
      </div>

      {/* Panel 1: Incumplimientos */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="triangle-exclamation" size={14} /> Incumplimientos
              <span className="badge b-na">{filteredBreaches.length}</span>
            </h3>
            <span className="sub">Hechos, impacto, multas y plan de acción exigido</span>
          </div>
          <div className="row-flex">
            <Button className="btn sm xs" onClick={() => exportBreaches('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
            <Button className="btn sm xs" onClick={() => exportBreaches('print')} title="Imprimir">
              <Icon name="print" /> Imprimir
            </Button>
          </div>
        </div>

        <div className="filters">
          <div className="gsearch" style={{ minWidth: 240 }}>
            <Icon name="search" />
            <Input
              aria-label="Buscar incumplimientos por descripción, tipo, contrato o responsable"
              value={qB}
              onChange={(e) => {
                setQB(e.target.value);
                setPageB(1);
              }}
              placeholder="Buscar por descripción, tipo, contrato o responsable..."
            />
          </div>
          <Field className="f">
            <label>Estado</label>
            <Select
              value={filterBEstado}
              onChange={(e) => {
                setFilterBEstado(e.target.value);
                setPageB(1);
              }}
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="En descargos">En descargos</option>
              <option value="Sancionado">Sancionado</option>
              <option value="Subsanado">Subsanado</option>
              <option value="Cerrado">Cerrado</option>
            </Select>
          </Field>
          <Field className="f">
            <label>Impacto</label>
            <Select
              value={filterBImpacto}
              onChange={(e) => {
                setFilterBImpacto(e.target.value);
                setPageB(1);
              }}
            >
              <option value="">Todos los impactos</option>
              <option value="Bajo">Bajo</option>
              <option value="Medio">Medio</option>
              <option value="Alto">Alto</option>
            </Select>
          </Field>
          {hasFilters && (
            <Button className="btn sm ghost" onClick={clearFilters} style={{ alignSelf: 'flex-end', height: 38 }}>
              <Icon name="trash" /> Limpiar filtros
            </Button>
          )}
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Impacto</th>
                <th className="num">Multa</th>
                <th>Plan de acción</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedBreaches.map((b, idx) => {
                const c = Store.get('contracts', b.contractId);
                return (
                  <tr
                    key={b.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${Math.min(idx, 12) * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    onMouseEnter={rowLift}
                    onMouseLeave={rowReset}
                  >
                    <td className="strong mono">{b.id}</td>
                    <td>
                      {c ? (
                        <Link
                          className="link mono"
                          href={contractHref(c.id, 'incumplimientos')}
                          title="Ver expediente digital"
                          style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{fdate(b.fecha)}</td>
                    <td>
                      <span className="badge b-info">{b.tipo}</span>
                    </td>
                    <td style={{ maxWidth: 240 }}>{b.descripcion}</td>
                    <td>
                      <span className={`badge ${impactoBadge[b.impacto] || 'b-na'}`} style={badgePop}>
                        {b.impacto}
                      </span>
                    </td>
                    <td className="num strong">{b.multa ? money(b.multa) : '—'}</td>
                    <td style={{ maxWidth: 200 }} className="clip">
                      {b.planAccion || '—'}
                    </td>
                    <td>{b.responsable || '—'}</td>
                    <td>
                      <Badge state={b.estado} style={badgePop} />
                    </td>
                    <td className="acts">
                      <Button
                        className="icon-btn"
                        title="Editar incumplimiento"
                        aria-label={`Editar incumplimiento ${b.id}`}
                        onClick={() => openEditBreachModal(b)}
                      >
                        <Icon name="edit" />
                      </Button>
                      {b.estado !== 'Subsanado' && b.estado !== 'Cerrado' && (
                        <Button
                          className="icon-btn"
                          title="Marcar subsanado"
                          aria-label={`Marcar subsanado el incumplimiento ${b.id}`}
                          onClick={() => handleAnularBreach(b)}
                        >
                          <Icon name="check-circle" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredBreaches.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      title="No se registran incumplimientos"
                      description={
                        hasFilters
                          ? 'Ningún incumplimiento coincide con los filtros actuales.'
                          : 'Cuando se registre un hecho incumplido aparecerá aquí con su impacto y multa asociada.'
                      }
                      action={
                        hasFilters ? (
                          <Button className="btn sm" onClick={clearFilters} style={{ marginTop: 8 }}>
                            Limpiar filtros
                          </Button>
                        ) : (
                          <Button className="btn sm pri" onClick={openNewBreachModal} style={{ marginTop: 8 }}>
                            <Icon name="plus" /> Registrar incumplimiento
                          </Button>
                        )
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {filteredBreaches.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={11}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPageB - 1) * pageSize + 1}–{Math.min(currentPageB * pageSize, filteredBreaches.length)} de{' '}
                        <b>{filteredBreaches.length}</b> incumplimientos
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPageB <= 1}
                          onClick={() => setPageB((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPagesB }, (_, i) => i + 1).map((p) => (
                          <Button key={p} className={p === currentPageB ? 'on' : ''} onClick={() => setPageB(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPageB >= totalPagesB}
                          onClick={() => setPageB((p) => Math.min(totalPagesB, p + 1))}
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

      {/* Panel 2: Planes de mejoramiento */}
      <Surface className="panel" id="panel-planes">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clipboard-check" size={14} /> Planes de mejoramiento
              <span className="badge b-info">{activePlans.length} en curso</span>
            </h3>
            <span className="sub">Compromisos con responsable, fechas y % de avance</span>
          </div>
          <div className="row-flex">
            <Button className="btn sm xs" onClick={() => exportPlans('xlsx')} title="Exportar a Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('pdf')} title="Exportar a PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('csv')} title="Exportar a CSV">
              <Icon name="file-csv" /> CSV
            </Button>
            <Button className="btn sm xs" onClick={() => exportPlans('print')} title="Imprimir">
              <Icon name="print" /> Imprimir
            </Button>
          </div>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Acción / Compromiso</th>
                <th>Responsable</th>
                <th>Fecha inicio</th>
                <th>Fecha compromiso</th>
                <th style={{ width: 150 }}>% Avance</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pagedPlans.map((p, idx) => {
                const c = Store.get('contracts', p.contractId);
                return (
                  <tr
                    key={p.id}
                    className="anim-fade-rise"
                    style={{ animationDelay: `${Math.min(idx, 12) * 25}ms`, transition: 'transform var(--t-fast) var(--ease), box-shadow var(--t-fast) var(--ease)' }}
                    onMouseEnter={rowLift}
                    onMouseLeave={rowReset}
                  >
                    <td className="strong mono">{p.id}</td>
                    <td>
                      {c ? (
                        <Link
                          className="link mono"
                          href={contractHref(c.id, 'incumplimientos')}
                          title="Ver expediente digital"
                          style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                        >
                          {c.numero}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>{p.accion}</td>
                    <td>{p.responsable || '—'}</td>
                    <td>{fdate(p.fechaInicio)}</td>
                    <td>
                      {fdate(p.fechaFin)}
                      {p.fechaFin && p.estado !== 'Cerrado' && p.estado !== 'Cumplido' && new Date(p.fechaFin) < new Date(todayIso()) && (
                        <span className="badge b-crit" style={{ ...badgePop, marginLeft: 6 }}>Vencido</span>
                      )}
                    </td>
                    <td>
                      <PBar value={Number(p.avance) || 0} max={100} />
                    </td>
                    <td>
                      <Badge state={p.estado} style={badgePop} />
                    </td>
                    <td className="acts">
                      <Button
                        className="icon-btn"
                        title="Editar plan"
                        aria-label={`Editar plan ${p.id}`}
                        onClick={() => openEditPlanModal(p)}
                      >
                        <Icon name="edit" />
                      </Button>
                      {p.estado !== 'Cerrado' && (
                        <Button
                          className="icon-btn"
                          title="Cerrar plan"
                          aria-label={`Cerrar plan ${p.id}`}
                          onClick={() => handleAnularPlan(p)}
                        >
                          <Icon name="check-circle" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {plans.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No se registran planes de mejoramiento"
                      description="Los compromisos de mejora derivados de los incumplimientos se gestionan aquí."
                      action={
                        <Button className="btn sm pri" onClick={openNewPlanModal} style={{ marginTop: 8 }}>
                          <Icon name="plus" /> Nuevo plan
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>

            {plans.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={9}>
                    <div className="tbl-foot">
                      <span>
                        Mostrando {(currentPageP - 1) * pageSize + 1}–{Math.min(currentPageP * pageSize, plans.length)} de{' '}
                        <b>{plans.length}</b> planes
                      </span>
                      <div className="pager">
                        <Button
                          disabled={currentPageP <= 1}
                          onClick={() => setPageP((p) => Math.max(1, p - 1))}
                          aria-label="Página anterior"
                        >
                          &lt;
                        </Button>
                        {Array.from({ length: totalPagesP }, (_, i) => i + 1).map((p) => (
                          <Button key={p} className={p === currentPageP ? 'on' : ''} onClick={() => setPageP(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button
                          disabled={currentPageP >= totalPagesP}
                          onClick={() => setPageP((p) => Math.min(totalPagesP, p + 1))}
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

      {/* Modal Incumplimiento */}
      {breachModalOpen && (
        <Modal
          title={editingBreach ? 'Editar incumplimiento' : 'Registrar incumplimiento'}
          onClose={() => setBreachModalOpen(false)}
          footer={
            <>
              <Button className="btn" onClick={() => setBreachModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSaveBreach}>
                Guardar incumplimiento
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid" style={{ gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <Select
                className="inp"
                value={breachForm.contractId}
                onChange={(e) => setBreachForm({ ...breachForm, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="form-label">Fecha del hecho *</label>
              <Input
                type="date"
                className="inp"
                value={breachForm.fecha}
                onChange={(e) => setBreachForm({ ...breachForm, fecha: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Tipo de incumplimiento *</label>
              <Select
                className="inp"
                value={breachForm.tipo}
                onChange={(e) => setBreachForm({ ...breachForm, tipo: e.target.value })}
              >
                <option value="Retraso en cronograma">Retraso en cronograma</option>
                <option value="Calidad del entregable">Calidad del entregable</option>
                <option value="Incumplimiento de obligación">Incumplimiento de obligación</option>
                <option value="No renovación de garantía">No renovación de garantía</option>
                <option value="Falta de personal">Falta de personal</option>
                <option value="Otro">Otro</option>
              </Select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Descripción detallada *</label>
              <Textarea
                className="inp"
                rows={2}
                value={breachForm.descripcion}
                onChange={(e) => setBreachForm({ ...breachForm, descripcion: e.target.value })}
                placeholder="Hechos que configuran el presunto incumplimiento"
              />
            </div>

            <div>
              <label className="form-label">Nivel de impacto *</label>
              <Select
                className="inp"
                value={breachForm.impacto}
                onChange={(e) => setBreachForm({ ...breachForm, impacto: e.target.value })}
              >
                <option value="Bajo">Bajo</option>
                <option value="Medio">Medio</option>
                <option value="Alto">Alto</option>
              </Select>
            </div>

            <div>
              <label className="form-label">Multa / sanción económica (COP)</label>
              <Input
                type="number"
                min={0}
                className="inp"
                value={breachForm.multa}
                onChange={(e) => setBreachForm({ ...breachForm, multa: Number(e.target.value) })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Plan de acción requerido</label>
              <Textarea
                className="inp"
                rows={2}
                value={breachForm.planAccion}
                onChange={(e) => setBreachForm({ ...breachForm, planAccion: e.target.value })}
                placeholder="Medidas de mitigación o plan exigido al contratista"
              />
            </div>

            <div>
              <label className="form-label">Responsable del seguimiento</label>
              <Input
                className="inp"
                value={breachForm.responsable}
                onChange={(e) => setBreachForm({ ...breachForm, responsable: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Estado</label>
              <Select
                className="inp"
                value={breachForm.estado}
                onChange={(e) => setBreachForm({ ...breachForm, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="En descargos">En descargos</option>
                <option value="Sancionado">Sancionado</option>
                <option value="Subsanado">Subsanado</option>
                <option value="Cerrado">Cerrado</option>
              </Select>
            </div>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Plan de Mejoramiento */}
      {planModalOpen && (
        <Modal
          title={editingPlan ? 'Editar plan de mejoramiento' : 'Nuevo plan de mejoramiento'}
          onClose={() => setPlanModalOpen(false)}
          footer={
            <>
              <Button className="btn" onClick={() => setPlanModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSavePlan}>
                Guardar plan
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid" style={{ gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <Select
                className="inp"
                value={planForm.contractId}
                onChange={(e) => setPlanForm({ ...planForm, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </Select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Acción / Compromiso *</label>
              <Textarea
                className="inp"
                rows={2}
                value={planForm.accion}
                onChange={(e) => setPlanForm({ ...planForm, accion: e.target.value })}
                placeholder="Descripción del compromiso de mejora o plan de choque"
              />
            </div>

            <div>
              <label className="form-label">Responsable *</label>
              <Input
                className="inp"
                value={planForm.responsable}
                onChange={(e) => setPlanForm({ ...planForm, responsable: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">% de Avance (0 a 100)</label>
              <Input
                type="number"
                min={0}
                max={100}
                className="inp"
                value={planForm.avance}
                onChange={(e) => setPlanForm({ ...planForm, avance: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="form-label">Fecha de inicio</label>
              <Input
                type="date"
                className="inp"
                value={planForm.fechaInicio}
                onChange={(e) => setPlanForm({ ...planForm, fechaInicio: e.target.value })}
              />
            </div>

            <div>
              <label className="form-label">Fecha límite / compromiso</label>
              <Input
                type="date"
                className="inp"
                value={planForm.fechaFin}
                onChange={(e) => setPlanForm({ ...planForm, fechaFin: e.target.value })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Estado</label>
              <Select
                className="inp"
                value={planForm.estado}
                onChange={(e) => setPlanForm({ ...planForm, estado: e.target.value })}
              >
                <option value="En curso">En curso</option>
                <option value="Cumplido">Cumplido</option>
                <option value="Incumplido">Incumplido</option>
                <option value="Cerrado">Cerrado</option>
              </Select>
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
