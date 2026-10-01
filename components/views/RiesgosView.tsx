'use client';
import { Select, Textarea, Input } from '../ui/Controls';
import { notify, requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, MetricCard, Surface, TableViewport, DataTable, FormGrid } from '../ui/Workspace';

import React, { useState } from 'react';
import { Store, AuthService, Audit } from '@/lib/store';
import { riskLevel, activeContracts } from '@/lib/metrics';
import { exportRows } from '@/lib/export';
import { CAT } from '@/lib/catalog';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Chart } from '../ui/Chart';
import { RiskMatrix } from '../ui/RiskMatrix';
import { riskPresentation, riskScore } from '../ui/presentation';
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
  const allRisks: Risk[] = Store.all('risks').map(riskPresentation).filter((r) => {
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
      notify('Por favor ingresa la descripción del riesgo.');
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

  const handleAnular = async (r: Risk) => {
    if (!AuthService.guard('anular')) return;
    const motivo = await requestReason('Motivo de la anulación / cierre del riesgo:');
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
      <PageHeader className="page-h">
        <div>
          <h1>Riesgos</h1>
          <p className="sub">Matriz de riesgos contractuales: probabilidad × impacto.</p>
        </div>
        <div className="row-flex">
          <Button className="btn sm xs" onClick={() => handleExport('xlsx')}>
            <Icon name="file-spreadsheet" /> Excel
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('pdf')}>
            <Icon name="file-text" /> PDF
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('csv')}>
            <Icon name="file-text" /> CSV
          </Button>
          <Button className="btn sm xs" onClick={() => handleExport('print')}>
            <Icon name="printer" /> Imprimir
          </Button>
          <Button className="btn pri sm" onClick={openNewModal}>
            <Icon name="plus" /> Nuevo riesgo
          </Button>
        </div>
      </PageHeader>

      {/* KPIs */}
      <div className="kpis mb">
        <MetricCard className="kpi-card">
          <div className="kpi-t">Riesgos identificados</div>
          <div className="kpi-v">{totalR}</div>
          <div className="kpi-s">En contratos activos</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Abiertos</div>
          <div className="kpi-v" style={{ color: 'var(--risk)' }}>
            {abiertosR}
          </div>
          <div className="kpi-s">Requieren control</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Extremos</div>
          <div className="kpi-v" style={{ color: 'var(--crit)' }}>
            {extremosR}
          </div>
          <div className="kpi-s">Prioridad crítica</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Altos</div>
          <div className="kpi-v" style={{ color: 'var(--risk)' }}>
            {altosR}
          </div>
          <div className="kpi-s">Seguimiento continuo</div>
        </MetricCard>
        <MetricCard className="kpi-card">
          <div className="kpi-t">Sin mitigación</div>
          <div className="kpi-v" style={{ color: sinMitigacionR > 0 ? 'var(--warn)' : 'var(--ok)' }}>
            {sinMitigacionR}
          </div>
          <div className="kpi-s">Sin plan de acción</div>
        </MetricCard>
      </div>

      {/* Grid: Heatmap + Categorías */}
      <div className="grid g-12 mb">
        {/* Heatmap */}
        <Surface className="panel">
          <div className="panel-h">
            <h3>Mapa de calor</h3>
            <span className="sub">
              Riesgos no cerrados · Haz clic en una celda para filtrar la tabla
              {heatmapCell && (
                <Button
                  className="btn xs"
                  style={{ marginLeft: 8 }}
                  onClick={() => setHeatmapCell(null)}
                >
                  Limpiar celda (P:{heatmapCell.p} × I:{heatmapCell.i})
                </Button>
              )}
            </span>
          </div>
          <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <RiskMatrix risks={openRisks} selected={heatmapCell} onSelect={setHeatmapCell} />
          </div>
        </Surface>

        {/* Gráfica por categoría */}
        <Surface className="panel">
          <div className="panel-h">
            <h3>Riesgos por categoría</h3>
            <span className="sub">Distribución por severidad</span>
          </div>
          <div className="panel-b">
            <div className="chart-box" style={{ height: 240 }}>
              <Chart config={chartConfig} />
            </div>
          </div>
        </Surface>
      </div>

      {/* Tabla completa de riesgos */}
      <Surface className="panel">
        <div className="panel-h">
          <h3>Matriz de riesgos ({filteredRisks.length})</h3>
          <div className="row-flex">
            <Select
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
            </Select>
            <Select
              className="inp"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="Abierto">Abierto</option>
              <option value="Mitigado">Mitigado</option>
              <option value="Cerrado">Cerrado</option>
            </Select>
          </div>
        </div>

        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
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
                          {level} ({riskScore(r) ?? 'Sin evaluar'})
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
                        <Button
                          className="icon-btn"
                          title="Editar riesgo"
                          onClick={() => openEditModal(r)}
                        >
                          <Icon name="edit" />
                        </Button>
                        {r.estado !== 'Cerrado' && (
                          <Button
                            className="icon-btn"
                            title="Cerrar / Anular riesgo"
                            onClick={() => handleAnular(r)}
                          >
                            <Icon name="x" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {/* Modal Nuevo / Editar Riesgo */}
      {modalOpen && (
        <Modal
          title={editingRisk ? 'Editar riesgo' : 'Nuevo riesgo'}
          onClose={() => setModalOpen(false)}
          footer={
            <>
              <Button className="btn" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleSave}>
                Guardar riesgo
              </Button>
            </>
          }
        >
          <FormGrid className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Contrato *</label>
              <Select
                className="inp"
                value={formData.contractId}
                onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} — {c.contratista}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="form-label">Categoría *</label>
              <Select
                className="inp"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="form-label">Estado</label>
              <Select
                className="inp"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Mitigado">Mitigado</option>
                <option value="Cerrado">Cerrado</option>
              </Select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Descripción del riesgo *</label>
              <Textarea
                className="inp"
                rows={2}
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Identificación del evento o riesgo contractual"
              />
            </div>

            <div>
              <label className="form-label">Probabilidad (1 a 5) *</label>
              <Input
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
              <Input
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
              <Textarea
                className="inp"
                rows={2}
                value={formData.mitigacion}
                onChange={(e) => setFormData({ ...formData, mitigacion: e.target.value })}
                placeholder="Acciones preventivas o correctivas implementadas"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Responsable del monitoreo</label>
              <Input
                className="inp"
                value={formData.responsable}
                onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
                placeholder="Nombre del responsable"
              />
            </div>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
