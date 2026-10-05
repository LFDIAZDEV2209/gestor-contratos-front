'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, FormGrid, Field } from '../ui/Workspace';
import type { Exec } from '../../lib/types';
import { Store, AuthService, Audit } from '../../lib/store';
import { activeContracts, M } from '../../lib/metrics';
import { money, moneyM, pct, todayIso } from '../../lib/format';
import { Kpi } from '../ui/Kpi';
import { Icon } from '../icons';

/**
 * Registro de avance de ejecución en VISTA dedicada (reemplaza al modal de
 * EjecucionView). Conserva la regla original de validación: el valor se exige
 * como truthy (no se endurece a > 0 para no cambiar el criterio en silencio).
 */
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const EjecucionForm = ({ onDone }: { onDone: () => void }) => {
  const [intentado, setIntentado] = useState(false);
  const [form, setForm] = useState({
    contractId: '',
    periodo: todayIso().slice(0, 7),
    valor: 0,
    avanceFisico: 0,
    obs: ''
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  // Contratos vigentes: el filtro de origen (activos) se conserva tal cual
  const contracts = activeContracts();
  const seleccion = contracts.find((c) => c.id === form.contractId);
  const mSel = seleccion ? M(seleccion) : null;

  const errCampo: Record<string, string> = {};
  const errores: string[] = [];
  if (!form.contractId) {
    errCampo.contractId = 'Selecciona el contrato al que se imputa la ejecución.';
    errores.push('El contrato es obligatorio.');
  }
  if (!form.periodo) {
    errCampo.periodo = 'Indica el periodo (año-mes) del informe.';
    errores.push('El periodo es obligatorio.');
  }
  if (!form.valor) {
    errCampo.valor = 'Registra el valor facturado o ejecutado en el periodo.';
    errores.push('El valor ejecutado es obligatorio.');
  }

  const guardar = () => {
    setIntentado(true);
    if (errores.length) {
      notify('Corrige los errores del formulario antes de guardar.');
      requestAnimationFrame(() => {
        const el = document.querySelector('.f.err, .err') as HTMLElement | null;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const ctrl = el?.querySelector('input, select, textarea') as HTMLElement | null;
        ctrl?.focus({ preventScroll: true });
      });
      return;
    }
    if (!AuthService.guard('crear')) return;

    const newExec: Exec = {
      id: 'EX_' + Date.now(),
      contractId: form.contractId,
      periodo: form.periodo,
      valor: Number(form.valor),
      avanceFisico: Number(form.avanceFisico) || 0,
      obs: form.obs
    };

    Store.insert('execs', newExec);
    Audit.log({
      contractId: form.contractId,
      modulo: 'Ejecución',
      accion: 'Creación',
      campo: 'Periodo ' + form.periodo,
      nuevo: `${money(newExec.valor)} (${newExec.avanceFisico}% físico)`
    });

    notify(`Ejecución del periodo ${form.periodo} registrada.`);
    onDone();
  };

  const err = (campo: string) => (intentado ? errCampo[campo] : undefined);

  return (
    <>
      <PageHeader className="ph">
        <div>
          <div className="crumb" style={{ width: '100%', marginBottom: 6 }}>
            <Link href="/ejecucion">Ejecución</Link>
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span>Nueva ejecución</span>
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            Registrar avance de ejecución
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            Carga el informe mensual de ejecución financiera y física; el consolidado y las
            métricas del portafolio se recalculan de inmediato.
          </p>
        </div>
      </PageHeader>

      <Surface className="panel mb">
        <div className="panel-h">
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <Icon name="chart-line" /> Informe del periodo
            </h3>
            <span className="sub small muted">Contrato, periodo y valores ejecutados</span>
          </div>
        </div>

        <FormGrid className="form-grid">
          <Field className={`f span3${err('contractId') ? ' err' : ''}`}>
            <label className="req">Contrato</label>
            <Select
              value={form.contractId}
              onChange={(e) => set({ contractId: e.target.value })}
              aria-describedby={err('contractId') ? 'err-econtrato' : undefined}
            >
              <option value="">— Seleccione contrato —</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {c.contratista}
                </option>
              ))}
            </Select>
            {err('contractId') && (
              <span className="emsg" id="err-econtrato">
                {err('contractId')}
              </span>
            )}
          </Field>

          <Field className={`f${err('periodo') ? ' err' : ''}`}>
            <label className="req">Periodo (Año - Mes)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Select
                value={String(Number(form.periodo.split('-')[1] || '1') - 1)}
                onChange={(e) =>
                  set({ periodo: `${form.periodo.split('-')[0]}-${String(Number(e.target.value) + 1).padStart(2, '0')}` })
                }
                aria-label="Mes del informe"
                aria-describedby={err('periodo') ? 'err-eperiodo' : undefined}
              >
                {MESES.map((m, i) => (
                  <option key={m} value={String(i)}>
                    {m}
                  </option>
                ))}
              </Select>
              <Select
                value={form.periodo.split('-')[0]}
                onChange={(e) => set({ periodo: `${e.target.value}-${form.periodo.split('-')[1]}` })}
                aria-label="Año del informe"
              >
                {[-1, 0, 1].map((d) => String(Number(todayIso().slice(0, 4)) + d)).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            </div>
            {err('periodo') && (
              <span className="emsg" id="err-eperiodo">
                {err('periodo')}
              </span>
            )}
          </Field>

          <Field className={`f${err('valor') ? ' err' : ''}`}>
            <label className="req">Valor ejecutado / facturado en el periodo</label>
            <Input
              type="number"
              value={form.valor}
              placeholder="Ej. 45000000"
              onChange={(e) => set({ valor: Number(e.target.value) })}
              aria-describedby={err('valor') ? 'err-evalor' : undefined}
            />
            {err('valor') ? (
              <span className="emsg" id="err-evalor">
                {err('valor')}
              </span>
            ) : (
              <span className="hint">{form.valor ? money(form.valor) : 'Cifra en pesos colombianos (COP).'}</span>
            )}
          </Field>

          <Field className="f">
            <label>% Avance físico acumulado</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={form.avanceFisico}
              onChange={(e) => set({ avanceFisico: Number(e.target.value) })}
            />
            <span className="hint">Rango esperado 0–100 %; se registra el acumulado a la fecha.</span>
          </Field>

          <Field className="f span3">
            <label>Observaciones</label>
            <Textarea
              rows={3}
              value={form.obs}
              placeholder="Hitos o actividades ejecutadas en este periodo..."
              onChange={(e) => set({ obs: e.target.value })}
            />
          </Field>
        </FormGrid>
      </Surface>

      {seleccion && mSel && (
        <Surface className="panel mb">
          <div className="panel-h">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <Icon name="file-signature" /> Contexto del contrato
              </h3>
              <span className="sub small muted">
                {seleccion.numero} · {seleccion.contratista}
              </span>
            </div>
          </div>
          <div className="kpis">
            <Kpi
              label="Valor vigente"
              value={moneyM(mSel.valorActual)}
              sub={money(mSel.valorActual)}
              icon="file-signature"
              color="brand"
            />
            <Kpi
              label="Ejecutado a la fecha"
              value={moneyM(mSel.ejecutado)}
              sub={money(mSel.ejecutado)}
              icon="trending-up"
              color="info"
            />
            <Kpi
              label="Saldo disponible"
              value={moneyM(mSel.saldo)}
              sub={money(mSel.saldo)}
              icon="money-check-dollar"
              color={mSel.saldo < 0 ? 'crit' : 'ok'}
            />
            <Kpi
              label="% Ejecución financiera"
              value={pct(mSel.pctFin)}
              icon="chart-pie"
              color={mSel.pctFin > 100 ? 'crit' : 'ok'}
            />
          </div>
        </Surface>
      )}

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
          <Icon name="check" /> Guardar registro
        </Button>
      </div>
    </>
  );
};
