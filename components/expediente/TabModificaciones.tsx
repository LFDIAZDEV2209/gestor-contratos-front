'use client';

import { useState } from 'react';
import { Select, Input, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Modification, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, uid } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabModificaciones = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar sus modificaciones."
      />
    );
  }

  const m = M(c);
  const modifications = (Store.byContract('modifications', cid) as Modification[]).sort((a, b) =>
    (a.fecha || '') < (b.fecha || '') ? 1 : -1
  );

  const [tipo, setTipo] = useState('Adición');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(todayIso());
  const [justificacion, setJustificacion] = useState('');
  const [valorNuevo, setValorNuevo] = useState(m.valorActual);
  const [fechaNueva, setFechaNueva] = useState(c.fechaFin || todayIso());
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [soporte, setSoporte] = useState('');

  const totalAdiciones = modifications
    .filter((x) => x.tipo === 'Adición' && !x.anulada)
    .reduce((acc, curr) => acc + (Number(curr.valorNuevo) - Number(curr.valorAnterior || 0)), 0);

  const totalReducciones = modifications
    .filter((x) => x.tipo === 'Reducción' && !x.anulada)
    .reduce((acc, curr) => acc + (Number(curr.valorAnterior || 0) - Number(curr.valorNuevo)), 0);

  const prorrogas = modifications.filter((x) => x.tipo === 'Prórroga' && !x.anulada);

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Valor nuevo', k: 'valorNuevo', r: (r: any) => (r.valorNuevo ? money(r.valorNuevo) : '—') },
      { l: 'Fecha nueva', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') },
      { l: 'Nuevo valor/texto', k: 'nuevoTexto' },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Modificaciones - ' + c.numero, cols, modifications, format);
  };

  const handleCreate = () => {
    if (!AuthService.guard('editar')) return;
    if (!numero.trim()) return notify('Ingrese el número o identificador de la modificación');
    if (!justificacion.trim()) return notify('Ingrese la justificación de la modificación');

    const before = JSON.parse(JSON.stringify(c));
    const newMod: Modification = {
      id: uid('MD'),
      contractId: cid,
      numero: numero.trim(),
      tipo,
      fecha,
      justificacion: justificacion.trim(),
      soporte: soporte.trim() || `mod_${numero.trim()}.pdf`,
      valorAnterior: m.valorActual,
      fechaAnterior: c.fechaFin,
      anulada: false
    };

    const contractPatch: Partial<Contract> = {};

    if (tipo === 'Adición') {
      const added = Number(valorNuevo) - m.valorActual;
      contractPatch.adiciones = (Number(c.adiciones) || 0) + added;
      newMod.valorNuevo = Number(valorNuevo);
    } else if (tipo === 'Reducción') {
      const reduced = m.valorActual - Number(valorNuevo);
      contractPatch.reducciones = (Number(c.reducciones) || 0) + reduced;
      newMod.valorNuevo = Number(valorNuevo);
    } else if (tipo === 'Prórroga') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = fechaNueva;
      contractPatch.fechaFin = fechaNueva;
      if (c.estado === 'Terminado') contractPatch.estado = 'Activo';
    } else if (tipo === 'Suspensión') {
      contractPatch.estado = 'Suspendido';
    } else if (tipo === 'Reinicio') {
      contractPatch.estado = 'Activo';
      if (fechaNueva) {
        newMod.fechaAnterior = c.fechaFin;
        newMod.fechaNueva = fechaNueva;
        contractPatch.fechaFin = fechaNueva;
      }
    } else if (tipo === 'Cesión') {
      newMod.valorAnterior = 0;
      newMod.impacto = `Cesionario anterior: ${c.contratista}.`;
      contractPatch.contratista = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (tipo === 'Modificación de supervisor') {
      contractPatch.supervisor = nuevoTexto;
      newMod.nuevoTexto = nuevoTexto;
    } else if (tipo === 'Terminación anticipada') {
      newMod.fechaAnterior = c.fechaFin;
      newMod.fechaNueva = fechaNueva;
      contractPatch.fechaFin = fechaNueva;
      contractPatch.estado = 'Terminado';
    }

    Store.insert('modifications', newMod);
    if (Object.keys(contractPatch).length > 0) {
      Store.update('contracts', cid, contractPatch);
      Audit.diff('Modificaciones', cid, before, { ...c, ...contractPatch }, {
        adiciones: 'Adiciones presupuestales',
        reducciones: 'Reducciones presupuestales',
        fechaFin: 'Fecha de terminación',
        estado: 'Estado contractual',
        contratista: 'Cesión de contratista',
        supervisor: 'Designación de supervisor'
      });
    }

    const hasGuarantees = Store.byContract('guarantees', cid).length > 0;
    if (['Adición', 'Prórroga', 'Reinicio'].includes(tipo) && hasGuarantees) {
      setWarningMsg(
        `Atención normativa: La ${tipo.toLowerCase()} puede exigir ajustar el valor asegurado o ampliar la vigencia de las pólizas y garantías suscritas.`
      );
    } else {
      setWarningMsg(null);
    }

    notify(`Modificación ${newMod.numero} (${tipo}) aplicada exitosamente`);
    setShowModal(false);
    setNumero('');
    setJustificacion('');
    setNuevoTexto('');
    setSoporte('');
  };

  const handleAnular = async (mItem: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular la modificación ${mItem.numero} (${mItem.tipo})? Esta acción revertirá los impactos aplicados al contrato.`
    );
    if (!ok) return;

    const before = JSON.parse(JSON.stringify(c));
    const patch: Partial<Contract> = {};

    // Revertir efectos en el contrato
    if (mItem.tipo === 'Adición' && mItem.valorNuevo && mItem.valorAnterior) {
      const added = Number(mItem.valorNuevo) - Number(mItem.valorAnterior);
      patch.adiciones = Math.max(0, (Number(c.adiciones) || 0) - added);
    } else if (mItem.tipo === 'Reducción' && mItem.valorNuevo && mItem.valorAnterior) {
      const reduced = Number(mItem.valorAnterior) - Number(mItem.valorNuevo);
      patch.reducciones = Math.max(0, (Number(c.reducciones) || 0) - reduced);
    } else if (mItem.tipo === 'Prórroga' && mItem.fechaAnterior) {
      patch.fechaFin = mItem.fechaAnterior;
    } else if (mItem.tipo === 'Suspensión') {
      patch.estado = 'Activo';
    }

    Store.update('modifications', mItem.id, { anulada: true });
    if (Object.keys(patch).length > 0) {
      Store.update('contracts', cid, patch);
      Audit.diff('Modificaciones', cid, before, { ...c, ...patch }, {
        adiciones: 'Reversión adición por anulación',
        reducciones: 'Reversión reducción por anulación',
        fechaFin: 'Reversión fecha fin por anulación',
        estado: 'Reversión estado por anulación'
      });
    }

    Audit.log({
      contractId: cid,
      modulo: 'Modificaciones',
      accion: 'Anulación',
      campo: 'Modificación ' + mItem.numero,
      anterior: 'Vigente',
      nuevo: 'Anulada'
    });

    notify(`Modificación ${mItem.numero} anulada y contrato actualizado`);
  };

  const handleDelete = async (mItem: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Desea eliminar definitivamente el registro de la modificación ${mItem.numero}?`
    );
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((item) => item.id !== mItem.id);
    Store.persist();
    Audit.log({
      contractId: cid,
      modulo: 'Modificaciones',
      accion: 'Eliminación',
      campo: 'Modificación ' + mItem.numero,
      anterior: mItem.tipo
    });
    notify(`Modificación ${mItem.numero} eliminada`);
  };

  return (
    <div className="tab-modificaciones-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Modificaciones y otrosíes contractuales</h3>
          <span className="sub text-xs text-[var(--muted)]">
            Adiciones presupuestales, prórrogas de plazo, suspensiones, cesiones y modificaciones de cláusulas
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
          <Button className="btn sm pri" onClick={() => setShowModal(true)} aria-label="Registrar nueva modificación">
            <Icon name="plus" /> Nueva modificación
          </Button>
        </div>
      </div>

      {/* Tarjetas KPI canónicas Seven Save */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Total modificaciones"
          value={modifications.length}
          sub={`${modifications.filter((m) => m.anulada).length} anulada(s)`}
          color="brand"
          icon="file-signature"
        />
        <Kpi
          label="Total adiciones"
          value={moneyM(totalAdiciones || Number(c.adiciones) || 0).replace(/\s/g, '\u00A0')}
          sub={money(totalAdiciones || Number(c.adiciones) || 0).replace(/\s/g, '\u00A0')}
          color={totalAdiciones > 0 ? 'ok' : 'na'}
          icon="plus-circle"
        />
        <Kpi
          label="Total reducciones"
          value={moneyM(totalReducciones || Number(c.reducciones) || 0).replace(/\s/g, '\u00A0')}
          sub={money(totalReducciones || Number(c.reducciones) || 0).replace(/\s/g, '\u00A0')}
          color={totalReducciones > 0 ? 'risk' : 'na'}
          icon="minus-circle"
        />
        <Kpi
          label="Prórrogas de plazo"
          value={prorrogas.length}
          sub={
            prorrogas.length > 0 && prorrogas[0].fechaAnterior
              ? `+${diffDays(prorrogas[0].fechaAnterior, c.fechaFin)} días acumulados`
              : 'Sin prórrogas'
          }
          color={prorrogas.length > 0 ? 'info' : 'na'}
          icon="calendar-plus"
        />
      </div>

      {/* Banner de alerta normativa de garantías */}
      {warningMsg && (
        <div
          className="mb-4 p-3 rounded flex items-center gap-3 text-sm"
          style={{
            background: 'var(--warn-bg)',
            border: '1px solid var(--warn)',
            color: 'var(--warn-text)'
          }}
          role="status"
        >
          <Icon name="triangle-exclamation" />
          <span className="flex-1 font-medium">{warningMsg}</span>
          <Button
            className="btn ghost sm text-xs"
            onClick={() => setWarningMsg(null)}
            aria-label="Cerrar aviso"
          >
            Entendido
          </Button>
        </div>
      )}

      {/* Tabla detallada de Modificaciones */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Historial de actos modificatorios</h3>
            <span className="sub text-xs text-[var(--muted)]">{modifications.length} modificación(es)</span>
          </div>
        </div>

        {modifications.length === 0 ? (
          <EmptyState
            title="Sin modificaciones registradas"
            description="El contrato se mantiene con las condiciones y plazos pactados inicialmente."
            action={
              <Button className="btn pri sm" onClick={() => setShowModal(true)}>
                <Icon name="plus" /> Registrar primer otrosí o modificación
              </Button>
            }
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número</th>
                  <th>Tipo</th>
                  <th className="nw">Fecha trámite</th>
                  <th>Justificación / Impacto</th>
                  <th className="nw">Impacto económico</th>
                  <th className="nw">Impacto plazo</th>
                  <th>Detalle / Sujeto</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modifications.map((mItem) => {
                  const diffVal =
                    mItem.valorNuevo && mItem.valorAnterior
                      ? Number(mItem.valorNuevo) - Number(mItem.valorAnterior)
                      : null;
                  const daysExt =
                    mItem.fechaNueva && mItem.fechaAnterior
                      ? diffDays(mItem.fechaAnterior, mItem.fechaNueva)
                      : null;
                  return (
                    <tr
                      key={mItem.id}
                      className={`hover:bg-[var(--surface-2)] transition-colors ${mItem.anulada ? 'opacity-60 line-through' : ''}`}
                    >
                      <td className="nw">
                        <b className="text-[var(--ink)]">{mItem.numero}</b>
                        {mItem.anulada && (
                          <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                        )}
                      </td>
                      <td className="nw">
                        <Badge
                          text={mItem.tipo}
                          color={
                            mItem.anulada
                              ? 'na'
                              : mItem.tipo === 'Adición'
                              ? 'ok'
                              : mItem.tipo === 'Reducción'
                              ? 'warn'
                              : mItem.tipo === 'Suspensión'
                              ? 'crit'
                              : mItem.tipo === 'Reinicio'
                              ? 'brand'
                              : 'info'
                          }
                        />
                      </td>
                      <td className="nw text-xs text-[var(--muted)]">{fdate(mItem.fecha)}</td>
                      <td className="clip" style={{ maxWidth: '300px' }} title={mItem.justificacion}>
                        <span className="text-xs text-[var(--ink)]">{mItem.justificacion}</span>
                        {mItem.impacto && <div className="small text-[var(--muted)]">{mItem.impacto}</div>}
                      </td>
                      <td className="nw">
                        {mItem.valorNuevo ? (
                          <div>
                            <div className="font-semibold text-xs text-[var(--ink)]">{money(mItem.valorNuevo)}</div>
                            {diffVal != null && (
                              <div
                                className="small font-medium"
                                style={{ color: diffVal > 0 ? 'var(--ok-text)' : 'var(--crit-text)' }}
                              >
                                {diffVal > 0 ? '+' : ''}
                                {money(diffVal)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw">
                        {mItem.fechaNueva ? (
                          <div>
                            <div className="font-medium text-xs text-[var(--ink)]">{fdate(mItem.fechaNueva)}</div>
                            {daysExt != null && daysExt !== 0 && (
                              <div className="small text-[var(--muted)] font-mono">+{daysExt} días</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="clip text-xs text-[var(--ink-2)]" style={{ maxWidth: '180px' }}>
                        {mItem.nuevoTexto || '—'}
                      </td>
                      <td className="nw">
                        {mItem.soporte ? (
                          <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                            <Icon name="paperclip" size={12} /> {mItem.soporte}
                          </span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="nw text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {!mItem.anulada && (
                            <Button
                              className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                              onClick={() => handleAnular(mItem)}
                              title="Anular modificación"
                              aria-label={`Anular modificación ${mItem.numero}`}
                            >
                              <Icon name="ban" size={13} />
                            </Button>
                          )}
                          <Button
                            className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                            onClick={() => handleDelete(mItem)}
                            title="Eliminar modificación"
                            aria-label={`Eliminar modificación ${mItem.numero}`}
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

      {/* Modal Nueva Modificación */}
      {showModal && (
        <Modal
          title="Nueva modificación contractual (Otrosí)"
          onClose={() => setShowModal(false)}
          size="lg"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                <Icon name="check" /> Aplicar modificación
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req font-medium text-xs">Tipo de modificación</label>
              <Select
                value={tipo}
                onChange={(e) => {
                  const t = e.target.value;
                  setTipo(t);
                  if (t === 'Adición' || t === 'Reducción') {
                    setValorNuevo(m.valorActual);
                  }
                  if (t === 'Prórroga' || t === 'Reinicio') {
                    setFechaNueva(c.fechaFin || todayIso());
                  }
                }}
              >
                <option value="Adición">Adición (aumento de valor)</option>
                <option value="Reducción">Reducción (disminución de valor)</option>
                <option value="Prórroga">Prórroga (ampliación de plazo)</option>
                <option value="Suspensión">Suspensión temporal de ejecución</option>
                <option value="Reinicio">Reinicio de ejecución</option>
                <option value="Cesión">Cesión contractual (cambio de contratista)</option>
                <option value="Modificación de supervisor">Modificación de supervisor</option>
                <option value="Terminación anticipada">Terminación anticipada por mutuo acuerdo</option>
                <option value="Modificación de cláusula">Aclaración o modificación de cláusula</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Número o radicado del Otrosí</label>
              <Input
                value={numero}
                placeholder="Ej. OTROSI-01 o MOD-2026-01"
                onChange={(e) => setNumero(e.target.value)}
                required
              />
            </Field>

            <Field className="f">
              <label className="req font-medium text-xs">Fecha de suscripción</label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </Field>

            {(tipo === 'Adición' || tipo === 'Reducción') && (
              <>
                <Field className="f">
                  <label className="font-medium text-xs">Valor actual del contrato</label>
                  <Input value={money(m.valorActual)} disabled readOnly />
                </Field>
                <Field className="f">
                  <label className="req font-medium text-xs">
                    {tipo === 'Adición' ? 'Nuevo valor total actualizado (con adición)' : 'Nuevo valor total reducido'}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={valorNuevo}
                    onChange={(e) => setValorNuevo(Number(e.target.value))}
                    required
                  />
                  <div className="small text-[var(--muted)] mt-1">
                    Diferencia: {tipo === 'Adición' ? '+' : '-'}
                    {money(Math.abs(Number(valorNuevo) - m.valorActual))}
                  </div>
                </Field>
              </>
            )}

            {(tipo === 'Prórroga' || tipo === 'Reinicio' || tipo === 'Terminación anticipada') && (
              <>
                <Field className="f">
                  <label className="font-medium text-xs">Fecha de terminación contractual actual</label>
                  <Input value={fdate(c.fechaFin)} disabled readOnly />
                </Field>
                <Field className="f">
                  <label className="req font-medium text-xs">Nueva fecha de terminación</label>
                  <Input
                    type="date"
                    value={fechaNueva}
                    onChange={(e) => setFechaNueva(e.target.value)}
                    required
                  />
                  {tipo === 'Prórroga' && fechaNueva && (
                    <div className="small text-[var(--muted)] mt-1">
                      Días adicionales calculados: +{diffDays(c.fechaFin, fechaNueva)} días
                    </div>
                  )}
                </Field>
              </>
            )}

            {tipo === 'Cesión' && (
              <Field className="f span2">
                <label className="req font-medium text-xs">Nuevo contratista cesionario (Razón Social y NIT)</label>
                <Input
                  value={nuevoTexto}
                  placeholder="Ej. INGENIERÍA INTEGRAL S.A.S. - NIT 900.123.456-7"
                  onChange={(e) => setNuevoTexto(e.target.value)}
                  required
                />
              </Field>
            )}

            {tipo === 'Modificación de supervisor' && (
              <Field className="f span2">
                <label className="req font-medium text-xs">Nuevo supervisor asignado (Nombre y cargo)</label>
                <Input
                  value={nuevoTexto}
                  placeholder="Ej. Ing. Carlos Martínez - Supervisor de Contratos"
                  onChange={(e) => setNuevoTexto(e.target.value)}
                  required
                />
              </Field>
            )}

            <Field className="f span2">
              <label className="req font-medium text-xs">Justificación técnica y jurídica</label>
              <Textarea
                rows={3}
                value={justificacion}
                placeholder="Motivo y justificación detallada de la modificación suscrita..."
                onChange={(e) => setJustificacion(e.target.value)}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Documento soporte (archivo radicado)</label>
              <Input
                value={soporte}
                placeholder="Ej. otrosi_01_firmado.pdf"
                onChange={(e) => setSoporte(e.target.value)}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
