'use client';

import { useState } from 'react';
import { Input, Textarea } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field, EmptyState } from '../ui/Workspace';
import type { Modification, Acta, Contract } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { fdate, todayIso, uid, addDays, diffDays } from '../../lib/format';
import { exportRows } from '../../lib/export';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabSuspensiones = ({ cid }: { cid: string }) => {
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'Suspensión' | 'Reinicio'>('Suspensión');
  const [fecha, setFecha] = useState(todayIso());
  const [diasProrroga, setDiasProrroga] = useState(0);
  const [nuevaFechaFin, setNuevaFechaFin] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [soporte, setSoporte] = useState('');

  const c = Store.get('contracts', cid) as Contract | undefined;
  if (!c) {
    return (
      <EmptyState
        title="Contrato no encontrado"
        description="No se encontró el contrato especificado para consultar suspensiones."
      />
    );
  }

  const isSuspended = c.estado === 'Suspendido';

  const modSusp = (Store.byContract('modifications', cid) as Modification[])
    .filter((x) => x.tipo === 'Suspensión' || x.tipo === 'Reinicio')
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  const actasSusp = (Store.byContract('actas', cid) as Acta[])
    .filter((a) => /suspensión|reinicio/i.test(a.tipo || ''))
    .sort((a, b) => ((a.fecha || '') < (b.fecha || '') ? 1 : -1));

  // Cálculo de suspensiones
  const totalSusp = modSusp.filter((m) => m.tipo === 'Suspensión' && !m.anulada).length;
  const totalRein = modSusp.filter((m) => m.tipo === 'Reinicio' && !m.anulada).length;

  let totalDiasSusp = 0;
  for (let i = 0; i < modSusp.length; i++) {
    if (modSusp[i].tipo === 'Reinicio' && modSusp[i].fechaAnterior && modSusp[i].fechaNueva) {
      totalDiasSusp += Math.max(0, diffDays(modSusp[i].fechaAnterior, modSusp[i].fechaNueva));
    }
  }

  const handleOpenAction = (tipo: 'Suspensión' | 'Reinicio') => {
    setActionType(tipo);
    setFecha(todayIso());
    setJustificacion('');
    setSoporte('');
    if (tipo === 'Reinicio') {
      const lastSusp = modSusp.find((m) => m.tipo === 'Suspensión' && !m.anulada);
      if (lastSusp && lastSusp.fecha) {
        const dias = Math.max(0, diffDays(lastSusp.fecha, todayIso()));
        setDiasProrroga(dias);
        setNuevaFechaFin(addDays(c.fechaFin || todayIso(), dias));
      } else {
        setDiasProrroga(0);
        setNuevaFechaFin(c.fechaFin || todayIso());
      }
    }
    setShowModal(true);
  };

  const handleExecute = () => {
    if (!AuthService.guard('editar')) return;
    if (!justificacion.trim()) return notify('Ingrese la justificación de la actuación');

    const before = JSON.parse(JSON.stringify(c));
    const modId = uid('MD');
    const actaId = uid('AC');
    const modNum = `MOD-${actionType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const actaNum = `ACT-${actionType.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    if (actionType === 'Suspensión') {
      const newMod: Modification = {
        id: modId,
        contractId: cid,
        numero: modNum,
        tipo: 'Suspensión',
        fecha,
        justificacion: justificacion.trim(),
        soporte: soporte.trim() || `${modNum}.pdf`,
        fechaAnterior: c.fechaFin,
        anulada: false
      };
      Store.insert('modifications', newMod);

      const newActa: Acta = {
        id: actaId,
        contractId: cid,
        tipo: 'Acta de suspensión',
        numero: actaNum,
        fecha,
        descripcion: justificacion.trim(),
        firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
        estado: 'Firmada',
        archivo: soporte.trim() || `${actaNum}.pdf`
      };
      Store.insert('actas', newActa);

      Store.update('contracts', cid, { estado: 'Suspendido' });
      Audit.diff('Contratos', cid, before, { ...c, estado: 'Suspendido' }, {
        estado: 'Estado contractual (Suspensión)'
      });

      notify(`Contrato ${c.numero} suspendido formalmente`);
    } else {
      // Reinicio
      const newMod: Modification = {
        id: modId,
        contractId: cid,
        numero: modNum,
        tipo: 'Reinicio',
        fecha,
        justificacion: `${justificacion.trim()} (Ampliación por días de suspensión: ${diasProrroga} días)`,
        soporte: soporte.trim() || `${modNum}.pdf`,
        fechaAnterior: c.fechaFin,
        fechaNueva: nuevaFechaFin,
        anulada: false
      };
      Store.insert('modifications', newMod);

      const newActa: Acta = {
        id: actaId,
        contractId: cid,
        tipo: 'Acta de reinicio',
        numero: actaNum,
        fecha,
        descripcion: justificacion.trim(),
        firmantes: `${c.contratista} / ${c.supervisor || 'Supervisor'}`,
        estado: 'Firmada',
        archivo: soporte.trim() || `${actaNum}.pdf`
      };
      Store.insert('actas', newActa);

      const patch: Partial<Contract> = { estado: 'Activo' };
      if (nuevaFechaFin) patch.fechaFin = nuevaFechaFin;

      Store.update('contracts', cid, patch);
      Audit.diff('Contratos', cid, before, { ...c, ...patch }, {
        estado: 'Estado contractual (Reinicio)',
        fechaFin: 'Nueva fecha de terminación contractual'
      });

      notify(`Reinicio formal registrado. Contrato ${c.numero} pasa a estado Activo`);
    }

    setShowModal(false);
  };

  const handleAnular = async (item: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(
      `¿Está seguro de anular el registro de ${item.tipo} ${item.numero}? Se recalculará el estado del contrato.`
    );
    if (!ok) return;

    Store.update('modifications', item.id, { anulada: true });

    if (item.tipo === 'Suspensión') {
      Store.update('contracts', cid, { estado: 'Activo' });
    } else if (item.tipo === 'Reinicio' && item.fechaAnterior) {
      Store.update('contracts', cid, { fechaFin: item.fechaAnterior });
    }

    notify(`Registro de ${item.tipo} anulado correctamente`);
  };

  const handleDelete = async (item: Modification) => {
    if (!AuthService.guard('editar')) return;
    const ok = await confirmAction(`¿Desea eliminar definitivamente el registro ${item.numero}?`);
    if (!ok) return;

    const db = Store.getDB();
    db.modifications = (db.modifications || []).filter((m) => m.id !== item.id);
    Store.persist();
    notify(`Registro ${item.numero} eliminado`);
  };

  const handleExport = (format: 'xlsx' | 'pdf' | 'csv') => {
    const cols = [
      { l: 'Número', k: 'numero' },
      { l: 'Tipo', k: 'tipo' },
      { l: 'Fecha', k: 'fecha', r: (r: any) => fdate(r.fecha) },
      { l: 'Justificación', k: 'justificacion' },
      { l: 'Fecha nueva fin', k: 'fechaNueva', r: (r: any) => (r.fechaNueva ? fdate(r.fechaNueva) : '—') },
      { l: 'Estado', k: 'anulada', r: (r: any) => (r.anulada ? 'Anulada' : 'Vigente') }
    ];
    exportRows('Suspensiones - ' + c.numero, cols, modSusp, format);
  };

  return (
    <div className="tab-suspensiones-container">
      {/* Encabezado */}
      <div className="panel-h mb-3 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-bold text-[var(--ink)]">Suspensiones y reinicios de ejecución</h3>
          <span className="sub text-xs text-[var(--muted)]">
            {isSuspended ? (
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--warn-text)' }}>
                <Icon name="pause" size={13} /> Contrato actualmente en suspensión de ejecución
              </span>
            ) : (
              'Ejecución activa normal del contrato'
            )}
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
          <Button
            className={`btn sm ${isSuspended ? 'btn-ok pri' : 'btn-warn pri'}`}
            onClick={() => handleOpenAction(isSuspended ? 'Reinicio' : 'Suspensión')}
            aria-label={isSuspended ? 'Registrar reinicio' : 'Registrar suspensión'}
          >
            <Icon name={isSuspended ? 'play' : 'pause'} />
            {isSuspended ? 'Registrar reinicio' : 'Registrar suspensión'}
          </Button>
        </div>
      </div>

      {/* KPI Cards canónicas */}
      <div className="kpis mb [&_.kpi]:!p-2 sm:[&_.kpi]:!p-[14px_16px] [&_.kpi-ic]:!w-7 [&_.kpi-ic]:!h-7 sm:[&_.kpi-ic]:!w-[34px] sm:[&_.kpi-ic]:!h-[34px] [&_.kpi.kpi-v2]:!gap-2 sm:[&_.kpi.kpi-v2]:!gap-3 [&_.kpi-v]:!whitespace-nowrap [&_.kpi-v]:!text-[13.5px] sm:[&_.kpi-v]:!text-[23px] [&_.kpi-s]:!whitespace-nowrap [&_.kpi-s]:!text-[9.5px] sm:[&_.kpi-s]:!text-[11.5px]">
        <Kpi
          label="Estado de ejecución"
          value={c.estado}
          sub={isSuspended ? 'Plazo temporalmente detenido' : 'Ejecución en curso'}
          color={isSuspended ? 'warn' : 'ok'}
          icon={isSuspended ? 'pause' : 'play'}
        />
        <Kpi
          label="Suspensiones suscritas"
          value={totalSusp}
          sub="Actas de suspensión"
          color={totalSusp > 0 ? 'warn' : 'na'}
          icon="pause-circle"
        />
        <Kpi
          label="Reinicios formalizados"
          value={totalRein}
          sub="Actas de reinicio"
          color="ok"
          icon="play-circle"
        />
        <Kpi
          label="Días compensados"
          value={`+${totalDiasSusp} días`}
          sub="Tiempo compensado"
          color={totalDiasSusp > 0 ? 'info' : 'na'}
          icon="clock"
        />
      </div>

      {/* Tabla detallada de Modificaciones de suspensión/reinicio */}
      <Surface className="panel mb-4">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Registro de actos de suspensión y reinicio</h3>
            <span className="sub text-xs text-[var(--muted)]">{modSusp.length} evento(s)</span>
          </div>
        </div>

        {modSusp.length === 0 ? (
          <EmptyState
            title="Sin suspensiones ni reinicios"
            description="El contrato se ha ejecutado de manera continua sin interrupciones formales."
            action={
              <Button className="btn pri sm" onClick={() => handleOpenAction('Suspensión')}>
                <Icon name="pause" /> Registrar suspensión
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
                  <th className="nw">Fecha acta</th>
                  <th>Justificación / Hechos</th>
                  <th className="nw">Término resultante</th>
                  <th className="nw">Soporte</th>
                  <th className="nw text-right" style={{ width: '110px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {modSusp.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-[var(--surface-2)] transition-colors ${item.anulada ? 'opacity-60 line-through' : ''}`}
                  >
                    <td className="nw">
                      <b className="text-[var(--ink)]">{item.numero}</b>
                      {item.anulada && (
                        <span className="ml-2 badge b-crit text-[10px]">ANULADA</span>
                      )}
                    </td>
                    <td>
                      <Badge
                        text={item.tipo}
                        color={item.anulada ? 'na' : item.tipo === 'Suspensión' ? 'warn' : 'ok'}
                      />
                    </td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(item.fecha)}</td>
                    <td className="clip" style={{ maxWidth: '380px' }} title={item.justificacion}>
                      <span className="text-xs text-[var(--ink)]">{item.justificacion}</span>
                    </td>
                    <td className="nw font-medium text-xs">
                      {item.fechaNueva ? fdate(item.fechaNueva) : <span className="text-[var(--muted)]">—</span>}
                    </td>
                    <td className="nw">
                      {item.soporte ? (
                        <span className="link inline-flex items-center gap-1 text-xs" title="Ver documento adjunto">
                          <Icon name="paperclip" size={12} /> {item.soporte}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="nw text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        {!item.anulada && (
                          <Button
                            className="btn ghost xs text-[var(--warn-text)] hover:bg-[var(--warn-bg)]"
                            onClick={() => handleAnular(item)}
                            title={`Anular ${item.tipo}`}
                            aria-label={`Anular ${item.tipo} ${item.numero}`}
                          >
                            <Icon name="ban" size={13} />
                          </Button>
                        )}
                        <Button
                          className="btn ghost xs text-[var(--crit)] hover:bg-[var(--crit-bg)]"
                          onClick={() => handleDelete(item)}
                          title="Eliminar registro"
                          aria-label={`Eliminar registro ${item.numero}`}
                        >
                          <Icon name="trash" size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Actas asociadas de suspensión y reinicio */}
      <Surface className="panel">
        <div className="panel-h flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Actas bilaterales formalizadas</h3>
            <span className="sub text-xs text-[var(--muted)]">{actasSusp.length} acta(s) radicada(s)</span>
          </div>
        </div>

        {actasSusp.length === 0 ? (
          <EmptyState
            title="Sin actas de suspensión o reinicio"
            description="No se encuentran actas suscritas en el repositorio de documentos."
          />
        ) : (
          <TableViewport className="tbl-wrap">
            <DataTable className="tbl">
              <thead>
                <tr>
                  <th className="nw">Número acta</th>
                  <th>Tipo de acta</th>
                  <th className="nw">Fecha suscripción</th>
                  <th>Descripción del motivo</th>
                  <th>Firmantes registrados</th>
                  <th className="nw">Archivo</th>
                </tr>
              </thead>
              <tbody>
                {actasSusp.map((a) => (
                  <tr key={a.id} className="hover:bg-[var(--surface-2)] transition-colors">
                    <td className="nw font-bold text-[var(--ink)]">{a.numero}</td>
                    <td className="nw">
                      <Badge
                        text={a.tipo}
                        color={/suspensión/i.test(a.tipo) ? 'warn' : 'ok'}
                      />
                    </td>
                    <td className="nw text-xs text-[var(--muted)]">{fdate(a.fecha)}</td>
                    <td className="clip text-xs text-[var(--ink)]" style={{ maxWidth: '300px' }} title={a.descripcion}>
                      {a.descripcion}
                    </td>
                    <td className="text-xs text-[var(--ink-2)]">{a.firmantes || '—'}</td>
                    <td className="nw">
                      {a.archivo ? (
                        <span className="link inline-flex items-center gap-1 text-xs">
                          <Icon name="paperclip" size={12} /> {a.archivo}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableViewport>
        )}
      </Surface>

      {/* Modal Suspensión / Reinicio */}
      {showModal && (
        <Modal
          title={`Registrar ${actionType.toLowerCase()} contractual`}
          onClose={() => setShowModal(false)}
          size="md"
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleExecute}>
                <Icon name={actionType === 'Reinicio' ? 'play' : 'pause'} /> Confirmar {actionType}
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f span2">
              <label className="req font-medium text-xs">Fecha efectiva de {actionType.toLowerCase()}</label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
            </Field>

            {actionType === 'Reinicio' && (
              <>
                <Field className="f">
                  <label className="font-medium text-xs">Días acumulados en suspensión</label>
                  <Input
                    type="number"
                    min="0"
                    value={diasProrroga}
                    onChange={(e) => {
                      const d = Number(e.target.value);
                      setDiasProrroga(d);
                      setNuevaFechaFin(addDays(c.fechaFin || todayIso(), d));
                    }}
                  />
                </Field>
                <Field className="f">
                  <label className="font-medium text-xs">Nueva fecha de terminación resultante</label>
                  <Input
                    type="date"
                    value={nuevaFechaFin}
                    onChange={(e) => setNuevaFechaFin(e.target.value)}
                  />
                </Field>
              </>
            )}

            <Field className="f span2">
              <label className="req font-medium text-xs">Justificación y causas motivadoras</label>
              <Textarea
                rows={3}
                value={justificacion}
                placeholder={`Detalle los motivos, hechos imprevistos o acuerdos bilaterales que justifican la ${actionType.toLowerCase()}...`}
                onChange={(e) => setJustificacion(e.target.value)}
                required
              />
            </Field>

            <Field className="f span2">
              <label className="font-medium text-xs">Acta o soporte firmado (archivo radicado)</label>
              <Input
                value={soporte}
                placeholder={`Ej. acta_${actionType.toLowerCase()}_firmada.pdf`}
                onChange={(e) => setSoporte(e.target.value)}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
