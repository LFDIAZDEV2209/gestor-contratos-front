'use client';

import { useState } from 'react';
import { Input, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, diffDays, addDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabProrrogas = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [diasAdd, setDiasAdd] = useState(30);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [numero, setNumero] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar sus prórrogas."
      />
    );
  }

  const prorrogas = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Prórroga')
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  const first = prorrogas[prorrogas.length - 1];
  const originalEnd = first?.fechaAnterior || c.fechaFin;
  const totalDays = originalEnd && c.fechaFin ? diffDays(originalEnd, c.fechaFin) : 0;
  const activeProrrogas = prorrogas.filter((p) => !p.anulada);

  const handleOpen = () => {
    const base = c.fechaFin || todayIso();
    setDiasAdd(30);
    setNuevaFecha(addDays(base, 30));
    setNumero(`PRO-${Date.now().toString().slice(-4)}`);
    setJustificacion('');
    setSoporte('');
    setShowModal(true);
  };

  const handleCreate = () => {
    if (!AuthService.guard('editar')) return;
    if (!nuevaFecha) return notify('Seleccione la nueva fecha de terminación');
    if (!justificacion.trim()) return notify('Ingrese la justificación técnica de la prórroga');

    const before = JSON.parse(JSON.stringify(c));
    const newMod: Modification = {
      id: uid('MD'),
      contractId: cid,
      numero: numero.trim() || `PRO-${Date.now().toString().slice(-4)}`,
      tipo: 'Prórroga',
      fecha: todayIso(),
      justificacion: justificacion.trim(),
      soporte: soporte.trim() || `${numero}.pdf`,
      fechaAnterior: c.fechaFin,
      fechaNueva: nuevaFecha,
      anulada: false
    };

    Store.insert('modifications', newMod);

    const patch: Partial<Contract> = { fechaFin: nuevaFecha };
    if (c.estado === 'Terminado') patch.estado = 'Activo';

    Store.update('contracts', cid, patch);
    Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
      fechaFin: 'Fecha de terminación contractual (Prórroga)'
    });

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (hasGuarantees) {
      notify('Atención: La ampliación de plazo puede requerir modificar la vigencia de las pólizas de garantía.');
    }

    notify(`Prórroga ${newMod.numero} registrada exitosamente (+${diffDays(c.fechaFin, nuevaFecha)} días)`);
    setShowModal(false);
  };

  const handleAnular = async (p: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular la prórroga ${p.numero}? Se restaurará la fecha de vencimiento anterior (${fdate(p.fechaAnterior)}).`
    );
    if (!ok) return;

    const before = JSON.parse(JSON.stringify(c));
    Store.update('modifications', p.id, { anulada: true });

    if (p.fechaAnterior) {
      Store.update('contracts', cid, { fechaFin: p.fechaAnterior });
      Audit.diff('Contratos', cid, before, { ...c, fechaFin: p.fechaAnterior }, {
        fechaFin: 'Reversión fecha de terminación por anulación de prórroga'
      });
    }

    notify(`Prórroga ${p.numero} anulada y fecha de terminación revertida`);
  };

  const handleDelete = async (p: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Desea eliminar definitivamente el registro de la prórroga ${p.numero}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((item) => item.id !== p.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Prórrogas',
      accion: 'Eliminación',
      campo: 'Prórroga ' + p.numero,
      anterior: fdate(p.fechaNueva)
    });
    notify(`Prórroga ${p.numero} eliminada`);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Fecha trámite', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Término anterior', k: 'fechaAnterior', r: (r: any) => fdate(r.fechaAnterior) },
      { l: 'Nuevo término', k: 'fechaNueva', r: (r: any) => fdate(r.fechaNueva) },
      { l: 'Días prorrogados', k: 'dias', r: (r: any) => diffDays(r.fechaAnterior, r.fechaNueva) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Prorrogas - ' + c.numero, cols, prorrogas, format);
  };

  return (
    <div className="tab-prorrogas-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Prórrogas y ampliaciones de plazo</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Control cronológico de adiciones en tiempo sobre el plazo contractual pactado
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
          <Button className="btn sm pri" onClick={handleOpen} aria-label="Crear prórroga">
            <Icon name="calendar-plus" /> Crear prórroga
          </Button>
        </div>
      </div>

      {/* KPI Cards con datos del plazo */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total prórrogas"
          value={prorrogas.length}
          sub={`${activeProrrogas.length} vigentes · ${prorrogas.length - activeProrrogas.length} anuladas`}
          color="brand"
          icon="calendar-plus"
        />
        <Kpi
          label="Plazo inicial pactado"
          value={fdate(originalEnd)}
          sub="Vencimiento sin otrosíes"
          color="na"
          icon="calendar"
        />
        <Kpi
          label="Vencimiento contractual actual"
          value={fdate(c.fechaFin)}
          sub={c.estado}
          color="info"
          icon="clock"
        />
        <Kpi
          label="Días totales prorrogados"
          value={`+${Math.max(0, totalDays)} días`}
          sub={totalDays > 0 ? `${Math.round(totalDays / 30)} mes(es) adicional(es)` : 'Sin adición de tiempo'}
          color={totalDays > 0 ? 'warn' : 'ok'}
          icon="plus-circle"
        />
      </div>

      {/* Tabla detallada de Prórrogas */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Historial de prórrogas suscritas</h3>
            <span className="sub text-xs text-[var(--muted)]">{prorrogas.length} registro(s)</span>
          </div>
        </div>

        {prorrogas.length === 0 ? (
          <EmptyState
            title="El contrato no registra prórrogas"
            description="El plazo de ejecución se mantiene según la fecha de terminación estipulada originalmente."
            action={
              <Button className="btn pri sm" onClick={handleOpen}>
                <Icon name="calendar-plus" /> Crear primera prórroga
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número Otrosí</th>
                  <th className="nw">Fecha trámite</th>
                  <th className="nw">Término anterior</th>
                  <th className="nw">Nuevo término</th>
                  <th className="nw">Días adicionales</th>
                  <th>Justificación técnica</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {prorrogas.map((p) => {
                  const days = diffDays(p.fechaAnterior, p.fechaNueva);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[var(--surface-2)] transition-colors ${p.anulada ? 'opacity-60 line-through' : ''}`}
                    >
                      <td className="nw">
                        <b className="text-[var(--ink)]">{p.numero}</b>
                        {p.anulada && (
                          <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                        )}
                      </td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(p.fecha)}</td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(p.fechaAnterior)}</td>
                      <td className="nw">
                        <b className="text-xs text-[var(--ink)]">{fdate(p.fechaNueva)}</b>
                      </td>
                      <td className="nw">
                        <Badge
                          text={`+${days} días`}
                          color={p.anulada ? 'na' : 'brand'}
                        />
                      </td>
                      <td className="clip" style={{ maxWidth: '350px' }} title={p.justificacion}>
                        <span className="text-xs text-[var(--ink)]">{p.justificacion}</span>
                      </td>
                      <td className="nw">
                        {p.soporte ? (
                          <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                            <Icon name="paperclip" size={12} /> {p.soporte}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {!p.anulada && (
                            <Button
                              className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                              onClick={() => handleAnular(p)}
                              title="Anular prórroga"
                              aria-label={`Anular prórroga ${p.numero}`}
                            >
                              <Icon name="ban" size={13} />
                            </Button>
                          )}
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDelete(p)}
                            title="Eliminar prórroga"
                            aria-label={`Eliminar prórroga ${p.numero}`}
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

      {/* Modal Crear Prórroga */}
      {showModal && (
        <Modal
          title="Crear prórroga contractual (ampliación de plazo)"
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="calendar-plus" /> Registrar prórroga
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="font-medium text-xs">Fecha de terminación contractual actual</label>
              <Input value={fdate(c.fechaFin)} disabled readOnly />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Días de ampliación</label>
              <Input
                type="number"
                min="1"
                step="1"
                value={diasAdd}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDiasAdd(d);
                  setNuevaFecha(addDays(c.fechaFin || todayIso(), d));
                }}
                required
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Nueva fecha de terminación calculada</label>
              <Input
                type="date"
                value={nuevaFecha}
                onChange={(e) => {
                  setNuevaFecha(e.target.value);
                  if (c.fechaFin) {
                    setDiasAdd(Math.max(0, diffDays(c.fechaFin, e.target.value)));
                  }
                }}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Número / Referencia del Otrosí</label>
              <Input
                value={numero}
                placeholder="Ej. OTROSI-02 o PRO-2026-01"
                onChange={(e) => setNumero(e.target.value)}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="req font-medium text-xs">Justificación técnica y operativa</label>
              <Textarea
                rows={3}
                value={justificacion}
                placeholder="Exposición de motivos, causas imprevistas o razones técnicas que justifican ampliar el plazo..."
                onChange={(e) => setJustificacion(e.target.value)}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Documento soporte (archivo radicado)</label>
              <Input
                value={soporte}
                placeholder="Ej. otrosi_prorroga_02_firmado.pdf"
                onChange={(e) => setSoporte(e.target.value)}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
