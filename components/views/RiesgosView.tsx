'use client';

import React, { useState } from 'react';
import { Store, AuthService, Audit } from '@/lib/store';
import { riskLevel, activeContracts } from '@/lib/metrics';
import { exportRows } from '@/lib/export';
import { CAT } from '@/lib/catalog';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Chart } from '../ui/Chart';
import type { Risk, Contract } from '@/lib/types';

interface RiesgosViewProps {
  onSelectContract?: (contractId: string, tab?: string) => void;
}

export const RiesgosView: React.FC<RiesgosViewProps> = ({ onSelectContract }) => {
  const [tick, setTick] = useState(0);
  const [filterCat, setFilterCat] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [heatmapCell, setHeatmapCell] = useState<{ p: number; i: number } | null>(null);

  // Modal Nuevo / Editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [formData, setFormData] = useState({
    contractId: '',
    categoria: '',
    descripcion: '',
    probabilidad: 3,
    impacto: 3,
    mitigacion: '',
    responsable: '',
    estado: 'Abierto'
  });

  const refresh = () => setTick((t) => t + 1);

  const contracts: Contract[] = activeContracts();
  const allRisks: Risk[] = Store.all('risks').filter((r) => {
    const c = Store.get('contracts', r.contractId);
    return c && !c.anulado;
  });

  const openRisks = allRisks.filter((r) => r.estado !== 'Cerrado');

  // KPIs
  const totalR = allRisks.length;
  const abiertosR = allRisks.filter((r) => r.estado === 'Abierto').length;
  const extremosR = openRisks.filter((r) => riskLevel(r) === 'Extremo').length;
  const altosR = openRisks.filter((r) => riskLevel(r) === 'Alto').length;
  const sinMitigacionR = openRisks.filter((r) => !r.mitigacion).length;

  // Filtrado de la tabla
  const filteredRisks = allRisks.filter((r) => {
    if (filterCat && r.categoria !== filterCat) return false;
    if (filterEstado && r.estado !== filterEstado) return false;
    if (heatmapCell && (Number(r.probabilidad) !== heatmapCell.p || Number(r.impacto) !== heatmapCell.i)) {
      return false;
    }
    return true;
  });

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv' | 'print') => {
    const cols = [
      { l: 'ID', k: 'id' },
      {
        l: 'Contrato',
        x: (r: Risk) => {
          const c = Store.get('contracts', r.contractId);
          return c ? c.numero : r.contractId;
        }
      },
      { l: 'Categoría', k: 'categoria' },
      { l: 'Descripción', k: 'descripcion' },
      { l: 'Probabilidad', k: 'probabilidad' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Nivel', x: (r: Risk) => riskLevel(r) },
      { l: 'Mitigación', k: 'mitigacion' },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Estado', k: 'estado' }
    ];
    exportRows('Matriz de riesgos', cols, filteredRisks, format);
  };

  const openNewModal = () => {
    if (!AuthService.guard('crear')) return;
    setEditingRisk(null);
    setFormData({
      contractId: contracts[0]?.id || '',
      categoria: CAT('categoriasRiesgo')[0] || 'Operativo',
      descripcion: '',
      probabilidad: 3,
      impacto: 3,
      mitigacion: '',
      responsable: '',
      estado: 'Abierto'
    });
    setModalOpen(true);
  };

  const openEditModal = (r: Risk) => {
    if (!AuthService.guard('editar')) return;
    setEditingRisk(r);
    setFormData({
      contractId: r.contractId || '',
      categoria: r.categoria || '',
      descripcion: r.descripcion || '',
      probabilidad: r.probabilidad || 3,
      impacto: r.impacto || 3,
      mitigacion: r.mitigacion || '',
      responsable: r.responsable || '',
      estado: r.estado || 'Abierto'
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.descripcion.trim()) {
      alert('Por favor ingresa la descripción del riesgo.');
      return;
    }
    const nivelCalc = Number(formData.probabilidad) * Number(formData.impacto);
    if (editingRisk) {
      Store.update('risks', editingRisk.id, {
        ...formData,
        nivel: nivelCalc
      });
      Audit.log({
        contractId: formData.contractId,
        modulo: 'Riesgos',
        accion: 'Modificación',
        campo: 'Riesgo ' + editingRisk.id,
        nuevo: formData.descripcion
      });
    } else {
      Store.insert('risks', {
        ...formData,
        nivel: nivelCalc
      });
      Audit.log({
        contractId: formData.contractId,
        modulo: 'Riesgos',
        accion: 'Creación',
        campo: 'Riesgo',
        nuevo: formData.descripcion
      });
    }
    setModalOpen(false);
    refresh();
  };

  const handleAnular = (r: Risk) => {
    if (!AuthService.guard('anular')) return;
    const motivo = prompt('Motivo de la anulación / cierre del riesgo:');
    if (motivo == null) return;
    Store.update('risks', r.id, { estado: 'Cerrado' });
    Audit.log({
      contractId: r.contractId,
      modulo: 'Riesgos',
      accion: 'Cierre de riesgo',
      campo: 'Estado',
      anterior: r.estado,
      nuevo: 'Cerrado',
      obs: motivo
    });
    refresh();
  };

  // Datos para gráfica de riesgos por categoría
  const categories = CAT('categoriasRiesgo');
  const catData = categories.map((cat) => {
    const rs = openRisks.filter((r) => r.categoria === cat);
    return {
      cat,
      bajo: rs.filter((r) => riskLevel(r) === 'Bajo').length,
      moderado: rs.filter((r) => riskLevel(r) === 'Moderado').length,
      alto: rs.filter((r) => riskLevel(r) === 'Alto').length,
      extremo: rs.filter((r) => riskLevel(r) === 'Extremo').length
    };
  }).filter((c) => c.bajo + c.moderado + c.alto + c.extremo > 0);

  const chartConfig = {
    type: 'bar' as const,
    data: {
      labels: catData.map((c) => c.cat),
      datasets: [
        { label: 'Bajo', data: catData.map((c) => c.bajo), backgroundColor: '#7FBF93' },
        { label: 'Moderado', data: catData.map((c) => c.moderado), backgroundColor: '#D9C255' },
        { label: 'Alto', data: catData.map((c) => c.alto), backgroundColor: '#E49A52' },
        { label: 'Extremo', data: catData.map((c) => c.extremo), backgroundColor: '#D0543F' }
      ]
    },
    options: {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { precision: 0 } },
        y: { stacked: true }
      }
    }
  };

  return (
    <div className="view-content">
      {/* Header */}
      <div className="page-h">
        <div>
          <h2>Riesgos</h2>
          <p className="sub">Matriz de riesgos contractuales: probabilidad × impacto.</p>
        </div>
        <div className="row-flex">
          <button className="btn sm xs" onClick={() => handleExport('xlsx')}>
            <Icon name="file-spreadsheet" /> Excel
          </button>
          <button className="btn sm xs" onClick={() => handleExport('pdf')}>
            <Icon name="file-text" /> PDF
          </button>
          <button className="btn sm xs" onClick={() => handleExport('csv')}>
            <Icon name="file-text" /> CSV
          </button>
          <button className="btn sm xs" onClick={() => handleExport('print')}>
            <Icon name="printer" /> Imprimir
          </button>
          <button className="btn pri sm" onClick={openNewModal}>
            <Icon name="plus" /> Nuevo riesgo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis mb">
        <div className="kpi-card">
          <div className="kpi-t">Riesgos identificados</div>
          <div className="kpi-v">{totalR}</div>
          <div className="kpi-s">En contratos activos</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-t">Abiertos</div>
          <div className="kpi-v" style={{ color: 'var(--risk)' }}>
            {abiertosR}
          </div>
          <div className="kpi-s">Requieren control</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-t">Extremos</div>
          <div className="kpi-v" style={{ color: 'var(--crit)' }}>
            {extremosR}
          </div>
          <div className="kpi-s">Prioridad crítica</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-t">Altos</div>
          <div className="kpi-v" style={{ color: 'var(--risk)' }}>
            {altosR}
          </div>
          <div className="kpi-s">Seguimiento continuo</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-t">Sin mitigación</div>
          <div className="kpi-v" style={{ color: sinMitigacionR > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {sinMitigacionR}
          </div>
          <div className="kpi-s">Sin plan de acción</div>
        </div>
      </div>

      {/* Grid: Heatmap + Categorías */}
      <div className="grid g-12 mb">
        {/* Heatmap */}
        <div className="panel">
          <div className="panel-h">
            <h3>Mapa de calor</h3>
            <span className="sub">
              Riesgos no cerrados · Haz clic en una celda para filtrar la tabla
              {heatmapCell && (
                <button
                  className="btn xs"
                  style={{ marginLeft: 8 }}
                  onClick={() => setHeatmapCell(null)}
                >
                  Limpiar celda (P:{heatmapCell.p} × I:{heatmapCell.i})
                </button>
              )}
            </span>
          </div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <table className="heatmap-tbl" style={{ borderCollapse: 'collapse', textAlign: 'center' }}>
              <thead>
                <tr>
                  <th style={{ fontSize: '11px', padding: '4px' }}>P \ I</th>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <th key={i} style={{ width: 44, fontSize: '11px', padding: '4px' }}>
                      I{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[5, 4, 3, 2, 1].map((p) => (
                  <tr key={p}>
                    <td style={{ fontWeight: 600, fontSize: '11px', padding: '4px' }}>P{p}</td>
                    {[1, 2, 3, 4, 5].map((i) => {
                      const count = openRisks.filter(
                        (r) => Number(r.probabilidad) === p && Number(r.impacto) === i
                      ).length;
                      const score = p * i;
                      const bg =
                        score <= 5
                          ? '#7FBF93'
                          : score <= 10
                          ? '#D9C255'
                          : score <= 16
                          ? '#E49A52'
                          : '#D0543F';
                      const isSelected = heatmapCell?.p === p && heatmapCell?.i === i;
                      return (
                        <td
                          key={i}
                          onClick={() => {
                            if (isSelected) setHeatmapCell(null);
                            else setHeatmapCell({ p, i });
                          }}
                          style={{
                            width: 44,
                            height: 38,
                            backgroundColor: bg,
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer',
                            borderRadius: 4,
                            border: isSelected ? '3px solid #111' : '1px solid #fff',
                            boxShadow: isSelected ? '0 0 6px rgba(0,0,0,0.4)' : 'none'
                          }}
                          title={`Probabilidad ${p} × Impacto ${i} (${count} riesgos)`}
                        >
                          {count || ''}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gráfica por categoría */}
        <div className="panel">
          <div className="panel-h">
            <h3>Riesgos por categoría</h3>
            <span className="sub">Distribución por severidad</span>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 240 }}>
              <Chart config={chartConfig} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla completa de riesgos */}
      <div className="panel">
        <div className="panel-h">
          <h3>Matriz de riesgos ({filteredRisks.length})</h3>
          <div className="row-flex">
            <select
              className="inp"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="inp"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="Mitigado">Mitigado</option>
              <option value="Cerrado">Cerrado</option>
            </select>
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Contrato</th>
                <th>Categoría</th>
                <th>Descripción</th>
                <th className="num">P</th>
                <th className="num">I</th>
                <th>Nivel</th>
                <th>Mitigación</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th className="acts">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRisks.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty">
                    No se encontraron riesgos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                filteredRisks.map((r) => {
                  const c = Store.get('contracts', r.contractId);
                  const level = riskLevel(r);
                  const levelColor =
                    level === 'Extremo'
                      ? 'var(--crit)'
                      : level === 'Alto'
                      ? 'var(--risk)'
                      : level === 'Moderado'
                      ? 'var(--warn)'
                      : 'var(--ok)';
                  return (
                    <tr key={r.id}>
                      <td className="strong">{r.id}</td>
                      <td>
                        {c ? (
                          <span
                            className="link"
                            style={{ cursor: 'pointer', color: 'var(--brand-2)', fontWeight: 600 }}
                            onClick={() => onSelectContract?.(c.id, 'riesgos')}
                          >
                            {c.numero}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className="badge b-info">{r.categoria}</span>
                      </td>
                      <td style={{ maxWidth: 260 }}>{r.descripcion}</td>
                      <td className="num">{r.probabilidad}</td>
                      <td className="num">{r.impacto}</td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: levelColor,
                            color: '#fff',
                            fontWeight: 600
                          }}
                        >
                          {level} ({Number(r.probabilidad) * Number(r.impacto)})
                        </span>
                      </td>
                      <td style={{ maxWidth: 200 }} className="clip">
                        {r.mitigacion || <span className="muted">Sin mitigación</span>}
                      </td>
                      <td>{r.responsable || '—'}</td>
                      <td>
                        <Badge state={r.estado} />
                      </td>
                      <td className="acts">
                        <button
                          className="icon-btn"
                          title="Editar riesgo"
                          onClick={() => openEditModal(r)}
                        >
                          <Icon name="edit" />
                        </button>
                        {r.estado !== 'Cerrado' && (
                          <button
                            className="icon-btn"
                            title="Cerrar / Anular riesgo"
                            onClick={() => handleAnular(r)}
                          >
                            <Icon name="x" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo / Editar Riesgo */}
      {modalOpen && (
        <Modal
          title={editingRisk ? 'Editar riesgo' : 'Nuevo riesgo'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setModalOpen(false)}>
                Cancelar
              </button>
              <button className="btn pri" onClick={handleSave}>
                Guardar riesgo
              </button>
            </>
          }
        >
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <select
                className="inp"
                value={formData.contractId}
                onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Categoría *</label>
              <select
                className="inp"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Estado</label>
              <select
                className="inp"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Mitigado">Mitigado</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Descripción del riesgo *</label>
              <textarea
                className="inp"
                rows={2}
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Identificación del evento o riesgo contractual"
              />
            </div>

            <div>
              <label className="form-label">Probabilidad (1 a 5) *</label>
              <input
                type="number"
                min={1}
                max={5}
                className="inp"
                value={formData.probabilidad}
                onChange={(e) => setFormData({ ...formData, probabilidad: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="form-label">Impacto (1 a 5) *</label>
              <input
                type="number"
                min={1}
                max={5}
                className="inp"
                value={formData.impacto}
                onChange={(e) => setFormData({ ...formData, impacto: Number(e.target.value) })}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Medidas de mitigación</label>
              <textarea
                className="inp"
                rows={2}
                value={formData.mitigacion}
                onChange={(e) => setFormData({ ...formData, mitigacion: e.target.value })}
                placeholder="Acciones preventivas o correctivas implementadas"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Responsable del monitoreo</label>
              <input
                className="inp"
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
