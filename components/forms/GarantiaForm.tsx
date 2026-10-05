'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select } from '../ui/Controls';
import { notify, confirmAction } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Guarantee, Cupo } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { cupoStats } from '../../lib/metrics';
import { money, moneyM, pct, todayIso, uid } from '../../lib/format';
import { Icon } from '../icons';

/**
 * Póliza de garantía en VISTA dedicada (reemplaza al modal de GarantiasView).
 * Sigue la anatomía de referencia: breadcrumb, título con descripción,
 * formulario en secciones con FormGrid, validación visible y footer de acciones.
 * Se conservan intactas las reglas del handler original (contrato, póliza y
 * valor) y la confirmación de exceso de cupo, que sigue siendo un modal.
 */
export const GarantiaForm = ({ onDone }: { onDone: (savedId: string) => void }) => {
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    tipo: 'Cumplimiento',
    aseguradora: CAT('aseguradoras')[0] || 'Seguros del Estado S.A.',
    poliza: '',
    modalidadPoliza: 'Póliza individual',
    cupoId: '',
    porcentaje: 10,
    tomador: '',
    intermediario: '',
    prima: 0,
    valor: 0,
    fechaExp: todayIso(),
    fechaInicio: todayIso(),
    fechaVenc: todayIso(),
    estado: 'Aprobada',
    documento: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const contracts = Store.all('contracts').filter((c) => !c.anulado);
  const cupos = Store.all('cupos');
  const availableCupos = cupos.filter(
    (cp) => cp.aseguradora === form.aseguradora && cp.estado === 'Vigente'
  );
  const cupoSel: Cupo | undefined = form.cupoId
    ? availableCupos.find((cp) => cp.id === form.cupoId)
    : undefined;
  const cupoStat = cupoSel ? cupoStats(cupoSel) : undefined;

  // Mismas reglas del flujo original + fechas de vigencia nunca vacías.
  const poliza = form.poliza.trim();
  const errCampo: Record<string, string> = {};
  const errores: string[] = [];
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato al que se ampara la póliza.';
    errores.push('El contrato es obligatorio.');
  }
  if (!poliza) {
    errCampo.poliza = 'Ingresa el número de la póliza emitida.';
    errores.push('El número de póliza es obligatorio.');
  }
  if (!form.valor) {
    errCampo.valor = 'Ingresa el valor asegurado (monto total cubierto).';
    errores.push('El valor asegurado es obligatorio.');
  }
  if (!form.fechaInicio) {
    errCampo.fechaInicio = 'Define el inicio de la vigencia.';
    errores.push('La fecha de inicio de vigencia es obligatoria.');
  }
  if (!form.fechaVenc) {
    errCampo.fechaVenc = 'Define el vencimiento de la vigencia.';
    errores.push('La fecha de vencimiento de la vigencia es obligatoria.');
  }
  if (
    form.fechaInicio &&
    form.fechaVenc &&
    form.fechaVenc < form.fechaInicio
  ) {
    errCampo.fechaVenc = 'El vencimiento no puede ser anterior al inicio de vigencia.';
    errores.push('La vigencia final debe ser posterior a la inicial.');
  }

  const excedeCupo =
    cupoSel && cupoStat && Number(form.valor) > cupoStat.disponible;

  const guardar = async () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    // Confirmación de exceso de cupo: se conserva como modal de confirmación.
    if (form.modalidadPoliza === 'Póliza por cupo' && form.cupoId && cupoSel && cupoStat) {
      if (Number(form.valor) > cupoStat.disponible) {
        const proceed = await confirmAction(
          `El valor asegurado (${money(form.valor)}) supera el saldo disponible del cupo (${money(
            cupoStat.disponible
          )}).\n\n¿Desea registrar la póliza de todas formas?`
        );
        if (!proceed) return;
      }
    }

    const newG: Guarantee = {
      id: uid('GR'),
      contractId: form.contractId,
      tipo: form.tipo,
      aseguradora: form.aseguradora,
      poliza,
      modalidadPoliza: form.modalidadPoliza,
      cupoId: form.modalidadPoliza === 'Póliza por cupo' ? form.cupoId : undefined,
      porcentaje: Number(form.porcentaje) || 10,
      tomador: form.tomador,
      intermediario: form.intermediario,
      prima: Number(form.prima) || 0,
      valor: Number(form.valor),
      fechaExp: form.fechaExp,
      fechaInicio: form.fechaInicio,
      fechaVenc: form.fechaVenc,
      estado: form.estado,
      documento: form.documento || `${poliza}.pdf`
    };

    Store.insert('guarantees', newG);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Garantías',
      accion: 'Creación',
      campo: 'Póliza ' + newG.poliza,
      nuevo: `${newG.tipo} - ${newG.aseguradora} - ${money(newG.valor)}`
    });

    notify(`Póliza «${poliza}» registrada exitosamente.`);
    onDone(newG.id);
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/garantias">Garantías</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>Nueva póliza</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Nueva póliza de garantía
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Registra la póliza que ampara un contrato: cobertura, vigencia y, si aplica, consumo de
            un cupo de la aseguradora.
          </p>
        </div>
      </PageHeader>

      {/* Sección 1: contrato y aseguradora */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="file-signature" /> Contrato y aseguradora
            </h3>
            <span className="sub small muted">Sujeto asegurado y emisor de la cobertura</span>
          </div>
        </div>
        <FormGrid className="form-grid">
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select
              value={form.contractId}
              onChange={(e) => set({ contractId: e.target.value })}
              aria-describedby={err('contractId') ? 'err-contrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-contrato">
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label className="req">Aseguradora</label>
            <Select
              value={form.aseguradora}
              onChange={(e) => set({ aseguradora: e.target.value, cupoId: '' })}
            >
              {CAT('aseguradoras').map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f">
            <label className="req">Tipo de garantía</label>
            <Select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {CAT('tiposGarantia').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="f">
            <label>Estado de la póliza</label>
            <Select value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
              <option value="Aprobada">Aprobada</option>
              <option value="Pendiente">Pendiente</option>
            </Select>
          </Field>
        </FormGrid>
      </Surface>

      {/* Sección 2: póliza, modalidad y partes */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="shield" /> Póliza y modalidad de expedición
            </h3>
            <span className="sub small muted">Identificación del documento y esquema de cobertura</span>
          </div>
        </div>
        <FormGrid className="form-grid">
          <Field className={`f${err('poliza') ? ' err' : ''}`}>
            <label className="req">Número de póliza</label>
            <Input
              value={form.poliza}
              placeholder="Ej. POL-984321"
              onChange={(e) => set({ poliza: e.target.value })}
              aria-describedby={err('poliza') ? 'err-poliza' : undefined}
            />
            {err('poliza') && (
              <span className="emsg" id="err-poliza">
                {err('poliza')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label className="req">Modalidad de expedición</label>
            <Select
              value={form.modalidadPoliza}
              onChange={(e) => set({ modalidadPoliza: e.target.value, cupoId: '' })}
            >
              <option value="Póliza individual">Póliza individual</option>
              <option value="Póliza por cupo">Póliza por cupo</option>
            </Select>
          </Field>

          <Field className="f">
            <label>Porcentaje de cobertura</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.porcentaje}
              onChange={(e) => set({ porcentaje: Number(e.target.value) })}
            />
            <span className="hint">Participación de la póliza sobre el alcance del contrato.</span>
          </Field>

          <Field className="f">
            <label>Tomador</label>
            <Input
              value={form.tomador}
              placeholder="Razón social o contratista"
              onChange={(e) => set({ tomador: e.target.value })}
            />
          </Field>

          <Field className="f">
            <label>Intermediario / Corredor</label>
            <Input
              value={form.intermediario}
              placeholder="Corredor de seguros"
              onChange={(e) => set({ intermediario: e.target.value })}
            />
          </Field>
        </FormGrid>

        {/* Detalle del cupo: saldo y vigencia de la línea, solo en modalidad por cupo */}
        {form.modalidadPoliza === 'Póliza por cupo' && (
          <div style={{ marginTop: 16, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <Field className={`f${err('cupo') ? ' err' : ''}`}>
              <label>
                Cupo de la aseguradora ({availableCupos.length} disponibles)
              </label>
              <Select value={form.cupoId} onChange={(e) => set({ cupoId: e.target.value })}>
                <option value="">— Seleccione un cupo vigente —</option>
                {availableCupos.map((cp) => {
                  const st = cupoStats(cp);
                  return (
                    <option key={cp.id} value={cp.id}>
                      {cp.numero} · Total {moneyM(cp.valor)} · Disp: {moneyM(st.disponible)} (
                      {pct(st.pct, 0)} usado)
                    </option>
                  );
                })}
              </Select>
              {availableCupos.length === 0 && (
                <span className="emsg">
                  No hay cupos vigentes registrados para {form.aseguradora}.
                </span>
              )}
            </Field>

            {/* Resumen del cupo: columnas responsivas heredadas de .dl */}
            {cupoSel && cupoStat && (
              <div
                className="dl"
                style={{ marginTop: 14, border: 0, borderTop: '1px solid var(--line)' }}
              >
                <div>
                  <span>Cupo total</span>
                  <b>{money(cupoSel.valor)}</b>
                </div>
                <div>
                  <span>Utilizado</span>
                  <b>{money(cupoStat.utilizado)}</b>
                </div>
                <div>
                  <span>Disponible</span>
                  <b style={{ color: cupoStat.disponible < 0 ? 'var(--crit-text)' : undefined }}>
                    {money(cupoStat.disponible)}
                  </b>
                </div>
                <div>
                  <span>Vigencia del cupo</span>
                  <b>
                    {cupoSel.fechaInicio} → {cupoSel.fechaVenc}
                  </b>
                </div>
                <div>
                  <span>Uso del cupo</span>
                  <b>
                    {pct(cupoStat.pct, 0)}
                    {excedeCupo && (
                      <span style={{ color: 'var(--crit-text)', fontWeight: 600 }}>
                        {' '}
                        · supera el saldo disponible
                      </span>
                    )}
                  </b>
                </div>
              </div>
            )}
          </div>
        )}
      </Surface>

      {/* Sección 3: cobertura y vigencias */}
      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="hourglass" /> Cobertura y vigencias
            </h3>
            <span className="sub small muted">Montos asegurados y periodo de responsabilidad</span>
          </div>
        </div>
        <FormGrid className="form-grid">
          <Field className={`f${err('valor') ? ' err' : ''}`}>
            <label className="req">Valor asegurado</label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.valor}
              onChange={(e) => set({ valor: Number(e.target.value) })}
              aria-describedby={err('valor') ? 'err-valor' : undefined}
            />
            {err('valor') && (
              <span className="emsg" id="err-valor">
                {err('valor')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label>Prima</label>
            <Input
              type="number"
              min={0}
              step={1000}
              value={form.prima}
              onChange={(e) => set({ prima: Number(e.target.value) })}
            />
          </Field>

          <Field className="f">
            <label>Fecha de expedición</label>
            <Input
              type="date"
              value={form.fechaExp}
              onChange={(e) => set({ fechaExp: e.target.value })}
            />
          </Field>

          <Field className={`f${err('fechaInicio') ? ' err' : ''}`}>
            <label className="req">Fecha inicio vigencia</label>
            <Input
              type="date"
              value={form.fechaInicio}
              onChange={(e) => set({ fechaInicio: e.target.value })}
              aria-describedby={err('fechaInicio') ? 'err-finicio' : undefined}
            />
            {err('fechaInicio') && (
              <span className="emsg" id="err-finicio">
                {err('fechaInicio')}
              </span>
            )}
          </Field>

          <Field className={`f${err('fechaVenc') ? ' err' : ''}`}>
            <label className="req">Fecha fin vigencia</label>
            <Input
              type="date"
              value={form.fechaVenc}
              onChange={(e) => set({ fechaVenc: e.target.value })}
              aria-describedby={err('fechaVenc') ? 'err-fvenc' : undefined}
            />
            {err('fechaVenc') && (
              <span className="emsg" id="err-fvenc">
                {err('fechaVenc')}
              </span>
            )}
          </Field>
        </FormGrid>
      </Surface>

      {intentado && errores.length > 0 && (
        <Surface className="panel mb" role="alert" style={{ borderColor: 'var(--crit, #c0392b)' }}>
          <b>Atención: corrige antes de guardar</b>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            {errores.map((e) => (
              <li key={e} style={{ fontSize: 13 }}>
                {e}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      <div className="form-foot">
        <Button className="btn ghost" onClick={() => window.history.back()}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={guardar}>
          <Icon name="check" /> Registrar póliza
        </Button>
      </div>
    </>
  );
};
