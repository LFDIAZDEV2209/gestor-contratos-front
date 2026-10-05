'use client';
import { Select } from '../ui/Controls';
import { Button } from '../ui/button';
import { Surface, Field, MetricCard } from '../ui/Workspace';

import React, { useState, useRef } from 'react';
import { Store } from '@/lib/store';
import { M, activeContracts, contractInsurers, contractPolicies } from '@/lib/metrics';
import { DEPTOS, REGIONES, CO_GEO } from '@/lib/geo';
import { moneyM, fdate, groupBy, sum } from '@/lib/format';
import { Icon } from '../icons';
import type { Contract, Guarantee } from '@/lib/types';

interface MapaColombiaProps {
  onSelectContract?: (cid: string) => void;
  onNavigateToContractsFilter?: (filterKey: string, filterVal: string) => void;
}

const MAP_SCALE = ['#EDF5F8', '#CDE3EA', '#92C2CD', '#5CA6B2', '#286685', '#062F58'];

export const MapaColombia: React.FC<MapaColombiaProps> = ({
  onSelectContract,
  onNavigateToContractsFilter
}) => {
  const [metric, setMetric] = useState<'contratos' | 'polizas' | 'clientes'>('contratos');
  const [medida, setMedida] = useState<'n' | 'v'>('n');
  const [aseg, setAseg] = useState('');
  const [estado, setEstado] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [sel, setSel] = useState<string | null>(null);

  // Tooltip
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const mapBoxRef = useRef<HTMLDivElement>(null);

  const db = Store.getDB();
  const aseguradorasList = db.settings?.catalogs?.aseguradoras || [];
  const companiesList = Store.all('companies');

  // Cálculo de datos del mapa con los filtros actuales
  const cs = activeContracts().filter((c) => {
    const m = M(c);
    const passEstado =
      !estado ||
      (estado === 'activos' ? m.activo || m.estado === 'Vencido' : m.estado === estado);
    const passEmpresa = !empresa || c.companyId === empresa;
    const passAseg = !aseg || contractInsurers(c).indexOf(aseg) >= 0;
    return passEstado && passEmpresa && passAseg;
  });

  const D: Record<
    string,
    {
      contratos: Contract[];
      polizas: Guarantee[];
      clientes: Record<string, string>;
      valorC: number;
      valorP: number;
    }
  > = {};

  Object.keys(DEPTOS).forEach((k) => {
    D[k] = { contratos: [], polizas: [], clientes: {}, valorC: 0, valorP: 0 };
  });

  cs.forEach((c) => {
    const m = M(c);
    const pols = contractPolicies(c).filter((g) => !aseg || g.aseguradora === aseg);
    (c.deptos || ['08']).forEach((d) => {
      const x = D[d];
      if (!x) return;
      x.contratos.push(c);
      x.valorC += m.valorActual;
      if (c.nitContratista) x.clientes[c.nitContratista] = c.contratista;
      pols.forEach((g) => {
        x.polizas.push(g);
        x.valorP += +g.valor || 0;
      });
    });
  });

  const allFilteredPols = cs.flatMap((c) =>
    contractPolicies(c).filter((g) => !aseg || g.aseguradora === aseg)
  );

  const tot = {
    contratos: cs.length,
    polizas: allFilteredPols.length,
    clientes: Object.keys(groupBy(cs, (c) => c.nitContratista || c.contratista)).length
  };

  const mapVal = (x: { contratos: Contract[]; polizas: Guarantee[]; clientes: Record<string, string>; valorC: number; valorP: number }) => {
    const v = medida === 'v';
    if (metric === 'contratos') return v ? x.valorC : x.contratos.length;
    if (metric === 'polizas') return v ? x.valorP : x.polizas.length;
    return v ? x.valorC : Object.keys(x.clientes).length;
  };

  const mapFmt = (v: number) => {
    return medida === 'v' ? moneyM(v) : String(v);
  };

  const mapColor = (v: number, max: number) => {
    if (!v) return '#EEF1F2';
    const r = v / (max || 1);
    return MAP_SCALE[r > 0.8 ? 5 : r > 0.6 ? 4 : r > 0.4 ? 3 : r > 0.2 ? 2 : 1];
  };

  const codes = Object.keys(D);
  let maxVal = 0;
  codes.forEach((k) => {
    maxVal = Math.max(maxVal, mapVal(D[k]));
  });

  const present = codes.filter((k) => mapVal(D[k]) > 0);

  // Por región
  const byReg: Record<string, { v: number; nC: number; pol: number; nCli: number; valor: number }> = {};
  REGIONES.forEach((r) => {
    byReg[r] = { v: 0, nC: 0, pol: 0, nCli: 0, valor: 0 };
  });

  codes.forEach((k) => {
    const r = DEPTOS[k]?.[1];
    if (!r || !byReg[r]) return;
    const x = D[k];
    byReg[r].nC += x.contratos.length;
    byReg[r].pol += x.polizas.length;
    byReg[r].nCli += Object.keys(x.clientes).length;
    byReg[r].valor += x.valorC;
    byReg[r].v += mapVal(x);
  });

  const regMax = Math.max(...REGIONES.map((r) => byReg[r].v), 1);
  const leadReg = REGIONES.slice().sort((a, b) => byReg[b].v - byReg[a].v)[0];
  const topDepts = present.slice().sort((a, b) => mapVal(D[b]) - mapVal(D[a]));

  const handleMouseMove = (e: React.MouseEvent, code: string) => {
    if (!mapBoxRef.current) return;
    const rect = mapBoxRef.current.getBoundingClientRect();
    setHoverCode(code);
    setTooltipPos({
      x: Math.min(e.clientX - rect.left + 14, rect.width - 230),
      y: e.clientY - rect.top + 12
    });
  };

  const clearFilters = () => {
    setAseg('');
    setEstado('');
    setEmpresa('');
    setSel(null);
  };

  const selectedDeptoData = sel && D[sel] ? D[sel] : null;
  const selClients = selectedDeptoData ? Object.keys(selectedDeptoData.clientes) : [];

  return (
    <Surface className="panel mb" id="mapPanel">
      {/* Panel Header */}
      <div className="panel-h">
        <h3>
          <Icon name="map" /> Presencia contractual en Colombia
        </h3>
        <span className="sub">
          {present.length} de 33 departamentos · región líder: <b>{leadReg}</b>
        </span>
        <div className="row-flex">
          <div className="seg" style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <Button
              className={`btn sm ${metric === 'contratos' ? 'pri' : 'ghost'}`}
              style={{ borderRadius: 0, margin: 0, border: 'none' }}
              onClick={() => setMetric('contratos')}
            >
              <Icon name="file-text" /> Contratos <b>{tot.contratos}</b>
            </Button>
            <Button
              className={`btn sm ${metric === 'polizas' ? 'pri' : 'ghost'}`}
              style={{ borderRadius: 0, margin: 0, border: 'none' }}
              onClick={() => setMetric('polizas')}
            >
              <Icon name="umbrella" /> Pólizas <b>{tot.polizas}</b>
            </Button>
            <Button
              className={`btn sm ${metric === 'clientes' ? 'pri' : 'ghost'}`}
              style={{ borderRadius: 0, margin: 0, border: 'none' }}
              onClick={() => setMetric('clientes')}
            >
              <Icon name="user" /> Clientes <b>{tot.clientes}</b>
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros del mapa */}
      <div className="filters" style={{ padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', borderBottom: '1px solid var(--border)' }}>
        <Field className="f" style={{ width: 140 }}>
          <label className="small muted">Medir por</label>
          <Select
            className="inp"
            value={medida}
            onChange={(e) => setMedida(e.target.value as any)}
          >
            <option value="n">Cantidad</option>
            <option value="v">
              {metric === 'polizas' ? 'Valor asegurado' : 'Valor contratado'}
            </option>
          </Select>
        </Field>

        <Field className="f" style={{ minWidth: 180 }}>
          <label className="small muted">Aseguradora</label>
          <Select
            className="inp"
            value={aseg}
            onChange={(e) => setAseg(e.target.value)}
          >
            <option value="">Todas</option>
            {aseguradorasList.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>

        <Field className="f" style={{ width: 150 }}>
          <label className="small muted">Estado del contrato</label>
          <Select
            className="inp"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="activos">En ejecución</option>
            <option value="Suspendido">Suspendido</option>
            <option value="En liquidación">En liquidación</option>
            <option value="Liquidado">Liquidado</option>
            <option value="Terminado">Terminado</option>
          </Select>
        </Field>

        <Field className="f" style={{ minWidth: 180 }}>
          <label className="small muted">Empresa contratante</label>
          <Select
            className="inp"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          >
            <option value="">Todas</option>
            {companiesList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razon || (c as any).name}
              </option>
            ))}
          </Select>
        </Field>

        {(aseg || estado || empresa || sel) && (
          <Button
            className="btn sm"
            onClick={clearFilters}
            style={{ alignSelf: 'flex-end' }}
          >
            <Icon name="x" /> Limpiar
          </Button>
        )}
      </div>

      {/* Grid: SVG Mapa (Izquierda) + Detalle / Regiones (Derecha) */}
      <div className="map-wrap">
        {/* Caja de mapa SVG */}
        <div className="map-box" ref={mapBoxRef} style={{ position: 'relative' }}>
          <svg
            viewBox={`0 0 ${CO_GEO.W} 760`}
            className="comap"
            role="img"
            aria-label="Mapa de Colombia por departamentos"
            style={{ width: '100%', height: 'auto', maxHeight: 560, display: 'block' }}
          >
            {/* San Andrés recuadro */}
            <rect
              x="22"
              y="24"
              width="72"
              height="92"
              rx="6"
              fill="none"
              stroke="#C9D3D5"
              strokeDasharray="3 3"
            />
            <text x="58" y="128" textAnchor="middle" className="mlbl" style={{ fontSize: 11, fill: 'var(--muted)' }}>
              San Andrés
            </text>

            {/* Departamentos */}
            {codes.map((k) => {
              const v = mapVal(D[k]);
              const pathD = CO_GEO.p[k];
              const isSelected = sel === k;
              if (!pathD) return null;
              return (
                <path
                  key={k}
                  className={`dep ${isSelected ? 'sel' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${DEPTOS[k]?.[0] || k}: ${mapFmt(v)}`}
                  aria-pressed={isSelected}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSel(isSelected ? null : k); } }}
                  d={pathD}
                  fill={mapColor(v, maxVal)}
                  stroke={isSelected ? '#111' : '#fff'}
                  strokeWidth={isSelected ? 2.5 : 0.8}
                  style={{ cursor: 'pointer', transition: 'fill .2s, stroke .2s' }}
                  onClick={() => setSel(sel === k ? null : k)}
                  onMouseEnter={(e) => handleMouseMove(e, k)}
                  onMouseMove={(e) => handleMouseMove(e, k)}
                  onMouseLeave={() => setHoverCode(null)}
                />
              );
            })}

            {/* Burbujas centroides */}
            {present.map((k) => {
              const c = CO_GEO.c[k];
              if (!c) return null;
              const v = mapVal(D[k]);
              let t = mapFmt(v);
              if (medida === 'v') t = t.replace(/\s/g, '');
              const r = medida === 'v' ? Math.max(12, t.length * 3.1) : Math.max(9, Math.min(15, 8 + String(v).length * 3));
              return (
                <g
                  key={`bub-${k}`}
                  className="bub"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSel(sel === k ? null : k)}
                  onMouseEnter={(e) => handleMouseMove(e, k)}
                  onMouseMove={(e) => handleMouseMove(e, k)}
                  onMouseLeave={() => setHoverCode(null)}
                >
                  <circle
                    cx={c[0]}
                    cy={c[1]}
                    r={r}
                    fill="#111"
                    opacity={0.8}
                  />
                  <text
                    x={c[0]}
                    y={c[1] + 3.5}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {t}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Leyenda del mapa */}
          <div
            className="mleg"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '11px',
              marginTop: 10,
              color: 'var(--muted)'
            }}
          >
            <span>{medida === 'v' ? 'Menor valor' : 'Menos'}</span>
            {MAP_SCALE.slice(1).map((color, i) => (
              <i
                key={i}
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 10,
                  backgroundColor: color,
                  borderRadius: 2
                }}
              />
            ))}
            <span>{medida === 'v' ? 'Mayor valor' : 'Más'}</span>
            <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i
                style={{
                  display: 'inline-block',
                  width: 14,
                  height: 10,
                  backgroundColor: '#EEF1F2',
                  border: '1px solid var(--border)',
                  borderRadius: 2
                }}
              />
              Sin presencia
            </span>
          </div>

          {/* Tooltip flotante */}
          {hoverCode && tooltipPos && D[hoverCode] && (
            <div
              className="mtip"
              style={{
                position: 'absolute',
                left: tooltipPos.x,
                top: tooltipPos.y,
                backgroundColor: 'rgba(20, 28, 30, 0.95)',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '11.5px',
                pointerEvents: 'none',
                zIndex: 20,
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
              }}
            >
              <b>{DEPTOS[hoverCode]?.[0]}</b>
              <span style={{ color: '#A0B4B2' }}> · {DEPTOS[hoverCode]?.[1]}</span>
              <div style={{ marginTop: 4 }}>
                <Icon name="file-text" /> {D[hoverCode].contratos.length} contratos ·{' '}
                {moneyM(D[hoverCode].valorC)}
              </div>
              <div>
                <Icon name="umbrella" /> {D[hoverCode].polizas.length} pólizas ·{' '}
                {moneyM(D[hoverCode].valorP)}
              </div>
              <div>
                <Icon name="user" /> {Object.keys(D[hoverCode].clientes).length} clientes
              </div>
            </div>
          )}
        </div>

        {/* Panel Lateral: Detalle Departamento o Resumen Regional */}
        <div className="mside" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedDeptoData && sel ? (
            <div>
              {/* Header departamento */}
              <div
                className="mside-h"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--border)',
                  paddingBottom: 8
                }}
              >
                <div>
                  <div className="small muted">{DEPTOS[sel]?.[1]}</div>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>{DEPTOS[sel]?.[0]}</h3>
                </div>
                <Button
                  className="icon-btn"
                  onClick={() => setSel(null)}
                  title="Cerrar detalle"
                >
                  <Icon name="x" />
                </Button>
              </div>

              {/* Mini KPIs */}
              <div className="kpis mini" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                <MetricCard className="kpi-card" style={{ padding: '8px 10px' }}>
                  <div className="kpi-t" style={{ fontSize: '11px' }}>Contratos</div>
                  <div className="kpi-v" style={{ fontSize: '16px' }}>{selectedDeptoData.contratos.length}</div>
                  <div className="kpi-s" style={{ fontSize: '10px' }}>{moneyM(selectedDeptoData.valorC)}</div>
                </MetricCard>
                <MetricCard className="kpi-card" style={{ padding: '8px 10px' }}>
                  <div className="kpi-t" style={{ fontSize: '11px' }}>Pólizas</div>
                  <div className="kpi-v" style={{ fontSize: '16px' }}>{selectedDeptoData.polizas.length}</div>
                  <div className="kpi-s" style={{ fontSize: '10px' }}>{moneyM(selectedDeptoData.valorP)}</div>
                </MetricCard>
                <MetricCard className="kpi-card" style={{ padding: '8px 10px' }}>
                  <div className="kpi-t" style={{ fontSize: '11px' }}>Clientes</div>
                  <div className="kpi-v" style={{ fontSize: '16px' }}>{selClients.length}</div>
                  <div className="kpi-s" style={{ fontSize: '10px' }}>Contratistas</div>
                </MetricCard>
              </div>

              {/* Lista de contratos del depto */}
              <h4 className="mh4" style={{ fontSize: '12.5px', margin: '14px 0 8px' }}>
                Contratos ({selectedDeptoData.contratos.length})
              </h4>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {selectedDeptoData.contratos.length === 0 ? (
                  <p className="small muted">Sin contratos con estos filtros.</p>
                ) : (
                  selectedDeptoData.contratos.map((c) => {
                    const m = M(c);
                    return (
                      <div
                        key={c.id}
                        className="todo"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          marginBottom: 6,
                          cursor: 'pointer'
                        }}
                        onClick={() => onSelectContract?.(c.id)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b>{c.numero}</b> · {c.contratista}
                          <div className="small muted" style={{ fontSize: '11px' }}>
                            {m.estado} · {moneyM(m.valorActual)}
                          </div>
                        </div>
                        <Icon name="chevron-right" />
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pólizas por aseguradora */}
              <h4 className="mh4" style={{ fontSize: '12.5px', margin: '14px 0 8px' }}>
                Pólizas por aseguradora
              </h4>
              <div style={{ maxHeight: 120, overflow: 'auto' }}>
                {selectedDeptoData.polizas.length === 0 ? (
                  <p className="small muted">Sin pólizas registradas.</p>
                ) : (
                  Object.keys(groupBy(selectedDeptoData.polizas, (g) => g.aseguradora)).map((a) => {
                    const ps = selectedDeptoData.polizas.filter((g) => g.aseguradora === a);
                    return (
                      <div
                        key={a}
                        className="row-flex small"
                        style={{
                          padding: '4px 0',
                          borderBottom: '1px solid var(--border)',
                          fontSize: '11.5px',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span>{a}</span>
                        <span>
                          <b>{ps.length}</b> póliza(s) · {moneyM(sum(ps, (g) => +g.valor || 0))}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Clientes contratistas */}
              <h4 className="mh4" style={{ fontSize: '12.5px', margin: '14px 0 6px' }}>
                Clientes (contratistas)
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {selClients.length ? (
                  selClients.map((nit) => (
                    <span key={nit} className="chip" style={{ fontSize: '11px' }}>
                      {selectedDeptoData.clientes[nit]}
                    </span>
                  ))
                ) : (
                  <span className="small muted">—</span>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <Button
                  className="btn sm pri"
                  onClick={() => onNavigateToContractsFilter?.('depto', sel)}
                >
                  <Icon name="table" /> Ver en contratos
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* Resumen por región */}
              <h4 className="mh4" style={{ fontSize: '12.5px', margin: '0 0 10px' }}>
                Por región
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {REGIONES.map((r) => {
                  const b = byReg[r];
                  const barPct = (b.v / regMax) * 100;
                  return (
                    <div
                      key={r}
                      className="reg"
                      style={{
                        padding: '6px 8px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        cursor: 'pointer'
                      }}
                      onClick={() => onNavigateToContractsFilter?.('reg', r)}
                    >
                      <div
                        className="row-flex small"
                        style={{ justifyContent: 'space-between', fontSize: '11.5px', marginBottom: 4 }}
                      >
                        <b>{r}</b>
                        <span className="muted">
                          {b.nC} contr. · {b.pol} pól. · {b.nCli} cli.
                        </span>
                        <b>{mapFmt(b.v)}</b>
                      </div>
                      <div className="bar" style={{ height: 6 }}>
                        <i
                          style={{
                            width: `${Math.min(100, Math.max(0, barPct))}%`,
                            backgroundColor: 'var(--brand)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Departamentos líderes */}
              <h4 className="mh4" style={{ fontSize: '12.5px', margin: '16px 0 8px' }}>
                Departamentos con mayor{' '}
                {metric === 'contratos'
                  ? 'contratación'
                  : metric === 'polizas'
                  ? 'cobertura de pólizas'
                  : 'número de clientes'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto' }}>
                {topDepts.length === 0 ? (
                  <p className="small muted">Sin datos con estos filtros.</p>
                ) : (
                  topDepts.slice(0, 8).map((k, i) => {
                    const x = D[k];
                    return (
                      <div
                        key={k}
                        className="todo"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: '11.5px'
                        }}
                        onClick={() => setSel(k)}
                      >
                        <span className="n" style={{ fontWeight: 700, color: 'var(--brand)' }}>
                          {i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <b>{DEPTOS[k]?.[0]}</b>
                          <div className="small muted" style={{ fontSize: '10.5px' }}>
                            {x.contratos.length} contratos · {x.polizas.length} pólizas
                          </div>
                        </div>
                        <b>{mapFmt(mapVal(x))}</b>
                      </div>
                    );
                  })
                )}
              </div>

              <p className="small muted" style={{ margin: '12px 0 0', fontSize: '11px', lineHeight: 1.35 }}>
                <Icon name="info" /> Un contrato con cobertura en varios departamentos cuenta en cada
                uno; los totales de la cabecera no se duplican. Haz clic en un departamento para ver su detalle.
              </p>
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
};
