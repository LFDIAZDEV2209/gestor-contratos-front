'use client';

import { useState } from 'react';
import { Textarea, Select, Input } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import { RiskMatrix } from '../ui/RiskMatrix';
import { riskPresentation } from '../ui/presentation';
import type { Risk } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { riskClass, riskLevel } from '../../lib/metrics';
import { fdate, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabRiesgos = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingRisk, setEditingRisk] = useState<Risk | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ p: number; i: number } | null>(null);

  const [form, setForm] = useState({
    categoria: 'Operativo',
    riesgo: '',
    prob: 3,
    impacto: 3,
    responsable: '',
    tratamiento: 'Mitigar',
    mitigacion: '',
    estado: 'Abierto',
    evidencia: ''
  });

  const c = Store.get('contracts', cid);
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar la matriz de riesgos."
      />
    );
  }

  const rawRisks = Store.byContract('risks', cid) as Risk[];
  const risks = rawRisks.map(riskPresentation).sort((a, b) => {
    const na = Number(a.prob) * Number(a.impacto);
    const nb = Number(b.prob) * Number(b.impacto);
    return nb - na;
  });

  const activeRisks = risks.filter((r) => r.estado !== 'Cerrado');
  const filteredRisks = selectedCell
    ? risks.filter((r) => Number(r.prob) === selectedCell.p && Number(r.impacto) === selectedCell.i)
    : risks;

  // Estadísticas de riesgo
  const totalRisks = risks.length;
  const extremos = risks.filter((r) => Number(r.prob) * Number(r.impacto) >= 15 && r.estado !== 'Cerrado').length;
  const altos = risks.filter((r) => {
    const s = Number(r.prob) * Number(r.impacto);
    return s >= 10 && s < 15 && r.estado !== 'Cerrado';
  }).length;
  const moderadosYBajos = risks.filter((r) => {
    const s = Number(r.prob) * Number(r.impacto);
    return s < 10 && r.estado !== 'Cerrado';
  }).length;
  const cerradosOControlados = risks.filter((r) => r.estado === 'Cerrado' || r.estado === 'Controlado').length;

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Riesgo', k: 'riesgo' },
      { l: 'Categoría', k: 'categoria' },
      { l: 'Probabilidad', k: 'prob' },
      { l: 'Impacto', k: 'impacto' },
      { l: 'Nivel', k: 'nivel', r: (r: any) => `${r.prob * r.impacto} (${riskLevel(r.prob * r.impacto)})` },
      { l: 'Responsable', k: 'responsable' },
      { l: 'Tratamiento', k: 'tratamiento' },
      { l: 'Estado', k: 'estado' },
      { l: 'Mitigación', k: 'mitigacion' }
    ];
    exportRows('Matriz de Riesgos - ' + c.numero, cols, filteredRisks, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!form.riesgo.trim()) return notify('Ingrese la descripción del riesgo');

    const newRisk: Risk = {
      id: uid('RG'),
      contractId: cid,
      categoria: form.categoria,
      riesgo: form.riesgo.trim(),
      prob: Number(form.prob),
      impacto: Number(form.impacto),
      responsable: form.responsable.trim() || c.responsable || 'Supervisor',
      tratamiento: form.tratamiento,
      mitigacion: form.mitigacion.trim(),
      fecha: todayIso(),
      estado: form.estado,
      evidencia: form.evidencia.trim()
    };

    Store.insert('risks', newRisk);
    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Creación',
      campo: 'Nuevo riesgo ' + newRisk.id,
      nuevo: `${newRisk.categoria}: ${(newRisk.riesgo || newRisk.descripcion || '').slice(0, 40)} (P${newRisk.prob}xI${newRisk.impacto})`
    });

    notify(`Riesgo registrado en la matriz`);
    setShowModal(false);
    setForm({
      categoria: 'Operativo',
      riesgo: '',
      prob: 3,
      impacto: 3,
      responsable: '',
      tratamiento: 'Mitigar',
      mitigacion: '',
      estado: 'Abierto',
      evidencia: ''
    });
  };

  const handleUpdate = () => {
    if (!AuthService.guard('editar')) return;
    if (!editingRisk) return;
    if (!editingRisk.riesgo?.trim()) return notify('La descripción del riesgo es requerida');

    Store.update('risks', editingRisk.id, {
      riesgo: editingRisk.riesgo.trim(),
      categoria: editingRisk.categoria,
      prob: Number(editingRisk.prob),
      impacto: Number(editingRisk.impacto),
      responsable: editingRisk.responsable?.trim(),
      tratamiento: editingRisk.tratamiento,
      mitigacion: editingRisk.mitigacion?.trim(),
      estado: editingRisk.estado
    });

    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Edición',
      campo: 'Riesgo ' + editingRisk.id,
      nuevo: `P${editingRisk.prob}xI${editingRisk.impacto} (${editingRisk.estado})`
    });

    notify(`Riesgo ${editingRisk.id} actualizado`);
    setEditingRisk(null);
  };

  const handleUpdateStatus = (risk: Risk, newEstado: string) => {
    if (!AuthService.guard('editar')) return;
    Store.update('risks', risk.id, { estado: newEstado });
    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Edición',
      campo: 'Estado del riesgo ' + risk.id,
      anterior: risk.estado,
      nuevo: newEstado
    });
    notify(`Estado del riesgo cambiado a ${newEstado}`);
  };

  const handleDelete = async (r: Risk) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Está seguro de eliminar el riesgo "${r.riesgo}" de la matriz?`);
    if (!ok) return;

    const db = Store.getDB();
    db.risks = (db.risks || []).filter((item) => item.id !== r.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Riesgos',
      accion: 'Eliminación',
      campo: 'Riesgo ' + r.id,
      anterior: r.riesgo
    });
    notify(`Riesgo eliminado`);
  };

  return (
    <div className="tab-riesgos-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Matriz y mapa de calor de riesgos</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Identificación, evaluación de severidad (probabilidad × impacto) y planes de mitigación
          </span>
        </div>
        <div className="row-flex">
          <div className="exp-actions">
            <Button className="btn sm" onClick={() => handleExport('xlsx')} title="Exportar a Excel" aria-label="Exportar Excel">
              <Icon name="file-excel" /> Excel
            </Button>
            <Button className="btn sm" onClick={() => handleExport('pdf')} title="Exportar a PDF" aria-label="Exportar PDF">
              <Icon name="file-pdf" /> PDF
            </Button>
            <Button className="btn sm" onClick={() => handleExport('csv')} title="Exportar a CSV" aria-label="Exportar CSV">
              <Icon name="file-csv" /> CSV
            </Button>
          </div>
          <Button className="btn sm pri" onClick={() => setShowModal(true)} aria-label="Registrar nuevo riesgo">
            <Icon name="plus" /> Nuevo riesgo
          </Button>
        </div>
      </div>

      {/* KPI Cards canónicas */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total riesgos identificados"
          value={totalRisks}
          sub={`${activeRisks.length} activos · ${totalRisks - activeRisks.length} cerrados`}
          color="brand"
          icon="shield-alert"
        />
        <Kpi
          label="Riesgos extremos"
          value={extremos}
          sub={extremos > 0 ? 'Puntaje 15–25 (Crítico)' : 'Sin eventos extremos'}
          color={extremos > 0 ? 'crit' : 'ok'}
          icon="alert-octagon"
        />
        <Kpi
          label="Riesgos altos"
          value={altos}
          sub={altos > 0 ? 'Puntaje 10–14 (Vigilancia)' : 'Sin riesgos altos'}
          color={altos > 0 ? 'risk' : 'ok'}
          icon="alert-triangle"
        />
        <Kpi
          label="Moderados y bajos"
          value={moderadosYBajos}
          sub="Puntaje 1–9 (Tolerables)"
          color="info"
          icon="shield"
        />
        <Kpi
          label="Controlados / Cerrados"
          value={cerradosOControlados}
          sub="Con plan ejecutado"
          color="ok"
          icon="shield-check"
        />
      </div>

      {/* Layout Matriz + Listado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-4">
        {/* Columna Mapa de Calor (4 cols) */}
        <Surface className="panel lg:col-span-4 p-4">
          <div className="mb-3">
            <h4 className="font-semibold text-sm text-[var(--ink)]">
              Mapa de calor de severidad ({activeRisks.length} activos)
            </h4>
            <span className="text-xs text-[var(--muted)]">Haga clic en una celda para filtrar</span>
          </div>

          <div className="flex justify-center my-2 overflow-x-auto max-w-full">
            <RiskMatrix risks={activeRisks} selected={selectedCell} onSelect={setSelectedCell} />
          </div>

          {/* Leyenda con tokens semánticos Seven Save */}
          <div className="legend mt-4 pt-3 border-t flex flex-wrap gap-3 text-xs" style={{ borderColor: 'var(--line)' }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="sem" style={{ background: 'var(--ok)' }}></span> Bajo (1–4)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="sem" style={{ background: 'var(--warn)' }}></span> Moderado (5–9)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="sem" style={{ background: 'var(--risk)' }}></span> Alto (10–14)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="sem" style={{ background: 'var(--crit)' }}></span> Extremo (15–25)
            </span>
          </div>

          {selectedCell && (
            <div
              className="mt-3 p-2.5 rounded text-xs flex items-center justify-between"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--line)' }}
            >
              <span>
                Filtro activo: <b>P{selectedCell.p} × I{selectedCell.i}</b> ({filteredRisks.length} riesgo(s))
              </span>
              <Button
                className="btn ghost xs"
                onClick={() => setSelectedCell(null)}
                aria-label="Quitar filtro de celda"
              >
                Limpiar filtro
              </Button>
            </div>
          )}
        </Surface>

        {/* Columna Tabla de Riesgos (8 cols) */}
        <Surface className="panel lg:col-span-8">
          <div className="panel-h flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Inventario de riesgos evaluados</h3>
              <span className="sub text-xs text-[var(--muted)]">
                {filteredRisks.length} riesgo(s) {selectedCell ? 'filtrado(s)' : 'registrado(s)'}
              </span>
            </div>
          </div>

          {filteredRisks.length === 0 ? (
            <EmptyState
              title={selectedCell ? 'Sin riesgos en esta celda' : 'Sin riesgos registrados'}
              description={
                selectedCell
                  ? 'No hay eventos de riesgo registrados con esa combinación de probabilidad e impacto.'
                  : 'Aún no se han evaluado riesgos para el contrato.'
              }
              action={
                selectedCell ? (
                  <Button className="btn ghost sm" onClick={() => setSelectedCell(null)}>
                    Mostrar todos
                  </Button>
                ) : (
                  <Button className="btn pri sm" onClick={() => setShowModal(true)}>
                    <Icon name="plus" /> Registrar primer riesgo
                  </Button>
                )
              }
            />
          ) : (
            <TableViewport className="tbl-wrap">
              <DataTable className="tbl">
                <thead>
                  <tr>
                    <th>Evento de riesgo</th>
                    <th className="nw">Categoría</th>
                    <th className="nw text-center">P</th>
                    <th className="nw text-center">I</th>
                    <th className="nw">Nivel</th>
                    <th>Tratamiento</th>
                    <th className="nw">Estado</th>
                    <th className="nw text-right" style={{ width: '130px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.map((r) => {
                    const score = Number(r.prob) * Number(r.impacto);
                    const lvl = riskLevel(score);
                    return (
                      <tr key={r.id} className="hover:bg-[var(--surface-2)] transition-colors">
                        <td className="clip" style={{ maxWidth: '240px' }} title={r.riesgo}>
                          <b className="text-xs text-[var(--ink)] block">{r.riesgo}</b>
                          {r.mitigacion && (
                            <div className="small text-[var(--muted)] line-clamp-1 mt-0.5">
                              <b>Mitigación:</b> {r.mitigacion}
                            </div>
                          )}
                        </td>
                        <td className="nw text-xs text-[var(--muted)]">{r.categoria}</td>
                        <td className="nw text-center font-mono text-xs">{r.prob}</td>
                        <td className="nw text-center font-mono text-xs">{r.impacto}</td>
                        <td className="nw">
                          <span
                            className={`badge ${
                              lvl === 'Extremo'
                                ? 'b-crit'
                                : lvl === 'Alto'
                                ? 'b-risk'
                                : lvl === 'Moderado'
                                ? 'b-warn'
                                : 'b-ok'
                            }`}
                            style={{ fontSize: '11px', fontWeight: 600 }}
                          >
                            {score} · {lvl}
                          </span>
                        </td>
                        <td className="text-xs text-[var(--ink-2)]">{r.tratamiento || '—'}</td>
                        <td className="nw">
                          <Badge
                            text={r.estado}
                            color={
                              r.estado === 'Cerrado'
                                ? 'na'
                                : r.estado === 'Controlado'
                                ? 'ok'
                                : 'risk'
                            }
                          />
                        </td>
                        <td className="nw text-right">
                          <div className="inline-flex items-center gap-1 justify-end">
                            <Button
                              className="btn ghost xs"
                              onClick={() =>
                                handleUpdateStatus(
                                  r,
                                  r.estado === 'Cerrado' ? 'Abierto' : r.estado === 'Abierto' ? 'Controlado' : 'Cerrado'
                                )
                              }
                              title={`Cambiar estado (actual: ${r.estado})`}
                              aria-label={`Cambiar estado de ${r.riesgo}`}
                            >
                              <Icon name={r.estado === 'Cerrado' ? 'rotate-ccw' : 'check'} size={13} />
                            </Button>
                            <Button
                              className="btn ghost xs"
                              onClick={() => setEditingRisk({ ...r })}
                              title="Editar riesgo"
                              aria-label={`Editar riesgo ${r.riesgo}`}
                            >
                              <Icon name="pencil" size={13} />
                            </Button>
                            <Button
                              className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                              onClick={() => handleDelete(r)}
                              title="Eliminar riesgo"
                              aria-label={`Eliminar riesgo ${r.riesgo}`}
                            >
                              <Icon name="trash" size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableViewport>
          )}
        </Surface>
      </div>

      {/* Modal Nuevo Riesgo */}
      {showModal && (
        <Modal
          title="Nuevo riesgo contractual"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="check" /> Registrar Riesgo
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Descripción del evento de riesgo</label>
              <Textarea
                rows={2}
                value={form.riesgo}
                placeholder="Descripción concisa de la amenaza o evento que podría impactar el contrato..."
                onChange={(e) => setForm({ ...form, riesgo: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Categoría de riesgo</label>
              <Select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              >
                {CAT('categoriasRiesgo').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Responsable del monitoreo</label>
              <Input
                value={form.responsable}
                placeholder={c.responsable || 'Supervisor designado'}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Probabilidad (1 a 5)</label>
              <Select
                value={form.prob}
                onChange={(e) => setForm({ ...form, prob: Number(e.target.value) })}
              >
                <option value={1}>1 - Muy baja (Raro)</option>
                <option value={2}>2 - Baja (Poco probable)</option>
                <option value={3}>3 - Media (Posible)</option>
                <option value={4}>4 - Alta (Probable)</option>
                <option value={5}>5 - Muy alta (Casi seguro)</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Impacto (1 a 5)</label>
              <Select
                value={form.impacto}
                onChange={(e) => setForm({ ...form, impacto: Number(e.target.value) })}
              >
                <option value={1}>1 - Leve (Insignificante)</option>
                <option value={2}>2 - Menor</option>
                <option value={3}>3 - Moderado</option>
                <option value={4}>4 - Mayor</option>
                <option value={5}>5 - Catastrófico</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Estrategia de tratamiento</label>
              <Select
                value={form.tratamiento}
                onChange={(e) => setForm({ ...form, tratamiento: e.target.value })}
              >
                <option value="Mitigar">Mitigar (Reducir probabilidad o impacto)</option>
                <option value="Transferir">Transferir (Pólizas / Subcontratos)</option>
                <option value="Aceptar">Aceptar (Asumir riesgo residual)</option>
                <option value="Evitar">Evitar (Modificar términos)</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Estado inicial</label>
              <Select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Controlado">Controlado</option>
                <option value="Cerrado">Cerrado</option>
              </Select>
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Plan de mitigación / Controles preventivos</label>
              <Textarea
                rows={3}
                value={form.mitigacion}
                placeholder="Acciones preventivas, controles operacionales y protocolos de contingencia..."
                onChange={(e) => setForm({ ...form, mitigacion: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}

      {/* Modal Editar Riesgo */}
      {editingRisk && (
        <Modal
          title={`Editar riesgo · ${editingRisk.id}`}
          onClose={() => setEditingRisk(null)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setEditingRisk(null)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleUpdate}>
                <Icon name="check" /> Guardar Cambios
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Descripción del riesgo</label>
              <Textarea
                rows={2}
                value={editingRisk.riesgo || ''}
                onChange={(e) => setEditingRisk({ ...editingRisk, riesgo: e.target.value })}
                required
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Categoría</label>
              <Select
                value={editingRisk.categoria}
                onChange={(e) => setEditingRisk({ ...editingRisk, categoria: e.target.value })}
              >
                {CAT('categoriasRiesgo').map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Responsable</label>
              <Input
                value={editingRisk.responsable || ''}
                onChange={(e) => setEditingRisk({ ...editingRisk, responsable: e.target.value })}
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Probabilidad (1 a 5)</label>
              <Select
                value={editingRisk.prob}
                onChange={(e) => setEditingRisk({ ...editingRisk, prob: Number(e.target.value) })}
              >
                <option value={1}>1 - Muy baja</option>
                <option value={2}>2 - Baja</option>
                <option value={3}>3 - Media</option>
                <option value={4}>4 - Alta</option>
                <option value={5}>5 - Muy alta</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Impacto (1 a 5)</label>
              <Select
                value={editingRisk.impacto}
                onChange={(e) => setEditingRisk({ ...editingRisk, impacto: Number(e.target.value) })}
              >
                <option value={1}>1 - Leve</option>
                <option value={2}>2 - Menor</option>
                <option value={3}>3 - Moderado</option>
                <option value={4}>4 - Mayor</option>
                <option value={5}>5 - Catastrófico</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Tratamiento</label>
              <Select
                value={editingRisk.tratamiento || 'Mitigar'}
                onChange={(e) => setEditingRisk({ ...editingRisk, tratamiento: e.target.value })}
              >
                <option value="Mitigar">Mitigar</option>
                <option value="Transferir">Transferir</option>
                <option value="Aceptar">Aceptar</option>
                <option value="Evitar">Evitar</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="font-medium text-xs">Estado</label>
              <Select
                value={editingRisk.estado}
                onChange={(e) => setEditingRisk({ ...editingRisk, estado: e.target.value })}
              >
                <option value="Abierto">Abierto</option>
                <option value="Controlado">Controlado</option>
                <option value="Cerrado">Cerrado</option>
              </Select>
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Plan de mitigación</label>
              <Textarea
                rows={3}
                value={editingRisk.mitigacion || ''}
                onChange={(e) => setEditingRisk({ ...editingRisk, mitigacion: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
