'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Cupo } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { CAT } from '../../lib/catalog';
import { money, todayIso, uid } from '../../lib/format';
import { Icon } from '../icons';

/**
 * Cupo de afianzamiento en VISTA dedicada (reemplaza al modal de AseguradorasView).
 * Mismas reglas que el handler original: número y valor obligatorios.
 */
export const CupoForm = ({ onDone }: { onDone: (savedId: string) => void }) => {
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    aseguradora: CAT('aseguradoras')[0] || 'Seguros del Estado S.A.',
    numero: '',
    tomador: '',
    intermediario: '',
    valor: 0,
    fechaInicio: todayIso(),
    fechaVenc: todayIso(),
    estado: 'Vigente',
    observaciones: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const errCampo: Record<string, string> = {};
  const errores: string[] = [];
  if (!form.numero.trim()) {
    errCampo.numero = 'Ingresa el número o código del cupo.';
    errores.push('El número de cupo es obligatorio.');
  }
  if (!form.valor) {
    errCampo.valor = 'Ingresa el valor total asignado al cupo.';
    errores.push('El valor asignado es obligatorio.');
  }
  if (!form.fechaInicio) {
    errCampo.fechaInicio = 'Define la fecha de apertura del cupo.';
    errores.push('La fecha de inicio es obligatoria.');
  }
  if (!form.fechaVenc) {
    errCampo.fechaVenc = 'Define la fecha de vencimiento del cupo.';
    errores.push('La fecha de vencimiento es obligatoria.');
  }
  if (form.fechaInicio && form.fechaVenc && form.fechaVenc < form.fechaInicio) {
    errCampo.fechaVenc = 'El vencimiento no puede ser anterior a la fecha de inicio.';
    errores.push('La fecha de vencimiento debe ser posterior a la de inicio.');
  }

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      return;
    }
    if (!AuthService.guard('crear')) return;

    const numero = form.numero.trim();
    const newCp: Cupo = {
      id: uid('CP'),
      aseguradora: form.aseguradora,
      numero,
      tomador: form.tomador,
      intermediario: form.intermediario,
      valor: Number(form.valor),
      fechaInicio: form.fechaInicio,
      fechaVenc: form.fechaVenc,
      estado: form.estado,
      observaciones: form.observaciones
    };

    Store.insert('cupos', newCp);
    Audit.log({
      modulo: 'Cupos',
      accion: 'Creación',
      campo: 'Cupo ' + newCp.numero,
      nuevo: `${newCp.aseguradora} - ${money(newCp.valor)}`
    });

    notify(`Cupo «${numero}» registrado exitosamente.`);
    onDone(newCp.id);
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/aseguradoras">Aseguradoras</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>Nuevo cupo</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Nuevo cupo de aseguradora
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Abre una línea global de afianzamiento que las pólizas podrán consumir como cobertura
            rotatoria.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="layers" /> Datos del cupo
            </h3>
            <span className="sub small muted">Aseguradora emisora, monto autorizado y vigencia</span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className="f span3">
            <label className="req">Aseguradora</label>
            <Select value={form.aseguradora} onChange={(e) => set({ aseguradora: e.target.value })}>
              {CAT('aseguradoras').map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Field>

          <Field className={`f${err('numero') ? ' err' : ''}`}>
            <label className="req">Número / Código de cupo</label>
            <Input
              value={form.numero}
              placeholder="Ej. CUP-SURA-2026"
              onChange={(e) => set({ numero: e.target.value })}
              aria-describedby={err('numero') ? 'err-cnumero' : undefined}
            />
            {err('numero') && (
              <span className="emsg" id="err-cnumero">
                {err('numero')}
              </span>
            )}
          </Field>

          <Field className={`f${err('valor') ? ' err' : ''}`}>
            <label className="req">Valor total asignado (COP)</label>
            <Input
              type="number"
              min={0}
              step={1000000}
              value={form.valor}
              onChange={(e) => set({ valor: Number(e.target.value) })}
              aria-describedby={err('valor') ? 'err-cvalor' : undefined}
            />
            {err('valor') && (
              <span className="emsg" id="err-cvalor">
                {err('valor')}
              </span>
            )}
          </Field>

          <Field className="f">
            <label>Estado</label>
            <Select value={form.estado} onChange={(e) => set({ estado: e.target.value })}>
              <option value="Vigente">Vigente</option>
              <option value="Suspendido">Suspendido</option>
              <option value="Vencido">Vencido</option>
            </Select>
          </Field>

          <Field className={`f${err('fechaInicio') ? ' err' : ''}`}>
            <label className="req">Fecha de apertura</label>
            <Input
              type="date"
              value={form.fechaInicio}
              onChange={(e) => set({ fechaInicio: e.target.value })}
              aria-describedby={err('fechaInicio') ? 'err-cfinicio' : undefined}
            />
            {err('fechaInicio') && (
              <span className="emsg" id="err-cfinicio">
                {err('fechaInicio')}
              </span>
            )}
          </Field>

          <Field className={`f${err('fechaVenc') ? ' err' : ''}`}>
            <label className="req">Fecha de vencimiento</label>
            <Input
              type="date"
              value={form.fechaVenc}
              onChange={(e) => set({ fechaVenc: e.target.value })}
              aria-describedby={err('fechaVenc') ? 'err-cfvenc' : undefined}
            />
            {err('fechaVenc') && (
              <span className="emsg" id="err-cfvenc">
                {err('fechaVenc')}
              </span>
            )}
          </Field>

          <Field className="f span3">
            <label>Tomador / Beneficiario</label>
            <Input
              value={form.tomador}
              placeholder="Razón social contratante o consorcio"
              onChange={(e) => set({ tomador: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Intermediario / Corredor</label>
            <Input
              value={form.intermediario}
              placeholder="Agencia o corredor de seguros"
              onChange={(e) => set({ intermediario: e.target.value })}
            />
          </Field>

          <Field className="f span3">
            <label>Observaciones</label>
            <Textarea
              rows={3}
              value={form.observaciones}
              placeholder="Condiciones particulares, exclusiones o acuerdos del cupo..."
              onChange={(e) => set({ observaciones: e.target.value })}
            />
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
          <Icon name="check" /> Registrar cupo
        </Button>
      </div>
    </>
  );
};
