'use client';
import { Input, Select } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { Surface, TableViewport, DataTable, FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Guarantee, Cupo } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { M, contractInsurers, cupoStats } from '../../lib/metrics';
import { money, moneyM, fdate, diffDays, todayIso, sum, uid } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Icon } from '../icons';

export const TabGarantias = ({ cid }: { cid: string }) => {
  const [showNewModal, setShowNewModal] = useState(false);
  const [newGar, setNewGar] = useState({
    tipo: 'Cumplimiento',
    aseguradora: 'Seguros del Estado S.A.',
    poliza: '',
    modalidadPoliza: 'Póliza individual',
    cupoId: '',
    porcentaje: 10,
    valor: 0,
    fechaInicio: todayIso(),
    fechaVenc: todayIso()
  });

  const c = Store.get('contracts', cid);
  if (!c) return <div className="empty">Contrato no encontrado</div>;

  const m = M(c);
  const guarantees = (Store.byContract('guarantees', cid) as Guarantee[]).sort((a, b) =>
    a.fechaVenc < b.fechaVenc ? -1 : 1
  );

  const insurers = contractInsurers(c);
  const byAseg: Record<string, Guarantee[]> = {};
  guarantees
    .filter((g) => g.estado !== 'Anulada' && g.estado !== 'Rechazada')
    .forEach((g) => {
      byAseg[g.aseguradora] = byAseg[g.aseguradora] || [];
      byAseg[g.aseguradora].push(g);
    });

  const cum = guarantees.find((g) => g.tipo === 'Cumplimiento' && g.estado === 'Aprobada');

  const handleApprove = (g: Guarantee) => {
    if (!AuthService.guard('aprobar')) return;
    Store.update('guarantees', g.id, { estado: 'Aprobada' });
    Audit.log({
      contractId: cid,
      modulo: 'Garantías',
      accion: 'Aprobación',
      campo: 'Póliza ' + g.poliza,
      nuevo: 'Aprobada'
    });
  };

  const handleCreate = () => {
    if (!AuthService.guard('crear')) return;
    if (!newGar.poliza) return notify('Ingrese el número de la póliza');
    if (!newGar.valor) return notify('Ingrese el valor asegurado');

    const garObj: Guarantee = {
      id: uid('GR'),
      contractId: cid,
      tipo: newGar.tipo,
      aseguradora: newGar.aseguradora,
      poliza: newGar.poliza,
      modalidadPoliza: newGar.modalidadPoliza,
      cupoId: newGar.cupoId || '',
      porcentaje: Number(newGar.porcentaje),
      valor: Number(newGar.valor),
      fechaInicio: newGar.fechaInicio,
      fechaVenc: newGar.fechaVenc,
      estado: 'Pendiente',
      documento: `${newGar.poliza}.pdf`
    };

    Store.insert('guarantees', garObj);
    Audit.log({
      contractId: cid,
      modulo: 'Garantías',
      accion: 'Creación',
      campo: 'Póliza ' + newGar.poliza,
      nuevo: money(newGar.valor)
    });
    setShowNewModal(false);
  };

  const db = Store.getDB();
  const allCupos = Store.all('cupos') as Cupo[];
  const cuposForAseg = allCupos.filter((cp) => cp.aseguradora === newGar.aseguradora && cp.estado === 'Vigente');

  return (
    <div>
      <div className="panel-h mb-3">
        <div>
          <h3>Seguros y garantías del contrato</h3>
          <span className="sub">
            {insurers.length} aseguradora(s) · alertas a 30, 15, 5, 3 y 1 día
          </span>
        </div>
        <div className="row-flex">
          <Button className="btn sm pri" onClick={() => setShowNewModal(true)}>
            <Icon name="plus" /> Nueva póliza
          </Button>
        </div>
      </div>

      {/* Tarjetas resumen por aseguradora */}
      {Object.keys(byAseg).length > 0 && (
        <div className="grid g3 mb-4">
          {Object.keys(byAseg).map((aseg) => {
            const pols = byAseg[aseg];
            const cu = pols.filter((g) => g.modalidadPoliza === 'Póliza por cupo');
            const totalVal = sum(pols, (g) => +g.valor || 0);

            return (
              <div key={aseg} className="expcard p-3 rounded border bg-neutral-50 dark:bg-neutral-900" style={{ borderLeft: '4px solid var(--brand)' }}>
                <div className="row-flex" style={{ flexWrap: 'nowrap' }}>
                  <Icon name="umbrella" />
                  <b>{aseg}</b>
                </div>
                <div className="small muted mt-1">
                  {pols.length} póliza(s): {pols.map((g) => g.tipo).join(', ')}
                </div>
                <div className="row-flex justify-between items-center mt-2">
                  <b>{money(totalVal)}</b>
                  {cu.length > 0 ? (
                    <span className="badge b-info">
                      Por cupo {cu.map((g) => (Store.get('cupos', g.cupoId || '') as Cupo)?.numero || '').filter(Boolean).join(', ')}
                    </span>
                  ) : (
                    <span className="badge">Individual</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota de cobertura de la póliza de cumplimiento */}
      {cum && (
        <div className="readonly-note mb-4 flex items-center gap-2">
          <Icon name="shield-halved" />
          <div>
            Póliza de cumplimiento <b>{cum.poliza}</b>: cubre {money(cum.valor)}
            {cum.porcentaje ? ` (${cum.porcentaje}% del valor; requerido hoy ${money((m.valorActual * cum.porcentaje) / 100)})` : ''} hasta{' '}
            {fdate(cum.fechaVenc)}
            {c.fechaFin && cum.fechaVenc < c.fechaFin ? (
              <span style={{ color: 'var(--crit)', fontWeight: 'bold' }}>
                {' '}
                — no cubre el plazo actual del contrato ({fdate(c.fechaFin)})
              </span>
            ) : (
              <span className="text-green-700 dark:text-green-400 font-medium"> — vigencia adecuada</span>
            )}
            .
          </div>
        </div>
      )}

      {/* Tabla de pólizas */}
      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
            <thead>
              <tr>
                <th>Póliza</th>
                <th>Tipo de garantía</th>
                <th>Aseguradora</th>
                <th>Modalidad</th>
                <th className="num">Valor asegurado</th>
                <th>Vigencia</th>
                <th>Días</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {guarantees.map((g) => {
                const d = diffDays(todayIso(), g.fechaVenc);
                const vencida = g.fechaVenc < todayIso();
                return (
                  <tr key={g.id}>
                    <td>
                      <b>{g.poliza}</b>
                      {g.documento && (
                        <div className="small muted flex items-center gap-1 mt-1">
                          <Icon name="file-pdf" /> {g.documento}
                        </div>
                      )}
                    </td>
                    <td>{g.tipo}</td>
                    <td>{g.aseguradora}</td>
                    <td>
                      {g.modalidadPoliza === 'Póliza por cupo' ? (
                        <span className="badge b-info">Por cupo</span>
                      ) : (
                        <span className="badge">Individual</span>
                      )}
                    </td>
                    <td className="num font-semibold">{money(g.valor)}</td>
                    <td>
                      {fdate(g.fechaInicio)} → {fdate(g.fechaVenc)}
                    </td>
                    <td>
                      {vencida ? (
                        <span className="badge b-crit">Venció hace {Math.abs(d)} d</span>
                      ) : d <= 15 ? (
                        <span className="badge b-warn">{d} días</span>
                      ) : (
                        `${d} días`
                      )}
                    </td>
                    <td>
                      <Badge text={g.estado} />
                    </td>
                    <td>
                      <div className="acts">
                        {g.estado === 'Pendiente' && (
                          <Button
                            className="btn xs pri"
                            onClick={() => handleApprove(g)}
                            title="Aprobar póliza"
                          >
                            Aprobar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {guarantees.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty">
                    Sin garantías registradas para este contrato.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {showNewModal && (
        <Modal
          title="Registrar póliza de garantía"
          onClose={() => setShowNewModal(false)}
          footer={
            <div className="flex gap-2 justify-end w-full">
              <Button className="btn ghost" onClick={() => setShowNewModal(false)}>
                Cancelar
              </Button>
              <Button className="btn pri" onClick={handleCreate}>
                Guardar Póliza
              </Button>
            </div>
          }
        >
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Número de póliza</label>
              <Input
                value={newGar.poliza}
                onChange={(e) => setNewGar({ ...newGar, poliza: e.target.value })}
                placeholder="Ej. PL-992100"
              />
            </Field>
            <Field className="f">
              <label className="req">Tipo de garantía</label>
              <Select
                value={newGar.tipo}
                onChange={(e) => setNewGar({ ...newGar, tipo: e.target.value })}
              >
                {(db.settings?.catalogs?.tiposGarantia || ['Cumplimiento', 'Calidad', 'Responsabilidad civil']).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f span2">
              <label className="req">Aseguradora</label>
              <Select
                value={newGar.aseguradora}
                onChange={(e) => setNewGar({ ...newGar, aseguradora: e.target.value, cupoId: '' })}
              >
                {(db.settings?.catalogs?.aseguradoras || ['Seguros del Estado S.A.']).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </Field>
            <Field className="f">
              <label>Modalidad de expedición</label>
              <Select
                value={newGar.modalidadPoliza}
                onChange={(e) => setNewGar({ ...newGar, modalidadPoliza: e.target.value, cupoId: '' })}
              >
                <option value="Póliza individual">Póliza individual</option>
                <option value="Póliza por cupo">Póliza por cupo</option>
              </Select>
            </Field>
            {newGar.modalidadPoliza === 'Póliza por cupo' && (
              <Field className="f">
                <label className="req">Cupo asignado</label>
                <Select
                  value={newGar.cupoId}
                  onChange={(e) => setNewGar({ ...newGar, cupoId: e.target.value })}
                >
                  <option value="">Seleccione cupo...</option>
                  {cuposForAseg.map((cp) => {
                    const st = cupoStats(cp);
                    return (
                      <option key={cp.id} value={cp.id}>
                        {cp.numero} (Disp: {moneyM(st.disponible)})
                      </option>
                    );
                  })}
                </Select>
              </Field>
            )}
            <Field className="f">
              <label className="req">Valor asegurado</label>
              <Input
                type="number"
                value={newGar.valor || ''}
                onChange={(e) => setNewGar({ ...newGar, valor: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label>Porcentaje (%)</label>
              <Input
                type="number"
                value={newGar.porcentaje || ''}
                onChange={(e) => setNewGar({ ...newGar, porcentaje: Number(e.target.value) })}
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha de inicio</label>
              <Input
                type="date"
                value={newGar.fechaInicio}
                onChange={(e) => setNewGar({ ...newGar, fechaInicio: e.target.value })}
              />
            </Field>
            <Field className="f">
              <label className="req">Fecha de vencimiento</label>
              <Input
                type="date"
                value={newGar.fechaVenc}
                onChange={(e) => setNewGar({ ...newGar, fechaVenc: e.target.value })}
              />
            </Field>
          </FormGrid>
        </Modal>
      )}
    </div>
  );
};
