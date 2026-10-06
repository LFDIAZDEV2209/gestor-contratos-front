'use client';

import { useState } from 'react';
import { useFormCancel } from './useFormCancel';
import { AccessibleForm } from './AccessibleForm';
import Link from 'next/link';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, Field } from '../ui/Workspace';
import { FormSection } from '../ui/FormSection';
import type { Contract } from '../../lib/types';
import { Store, Audit, AuthService } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { uid, money, num } from '../../lib/format';
import { Icon } from '../icons';

type TabId = 'General' | 'Fechas' | 'Económica' | 'Alcance';

/** Secciones navegables del expediente (mismas 4 del modal original). */
const SECCIONES: Array<{
  id: TabId;
  label: string;
  icon: string;
  titulo: string;
  sub: string;
}> = [
  {
    id: 'General',
    label: 'General',
    icon: 'file-contract',
    titulo: 'Identificación del contrato',
    sub: 'Número oficial, empresa contratante, contratista y responsables del expediente.'
  },
  {
    id: 'Fechas',
    label: 'Plazos y Fechas',
    icon: 'calendar',
    titulo: 'Plazos y fechas',
    sub: 'Firma, inicio y terminación; el plazo pactado debe guardar coherencia con las fechas.'
  },
  {
    id: 'Económica',
    label: 'Económica',
    icon: 'dollar-sign',
    titulo: 'Condiciones económicas',
    sub: 'Valores, impuestos, adiciones y reducciones; el valor total se recalcula en vivo.'
  },
  {
    id: 'Alcance',
    label: 'Alcance y Entregables',
    icon: 'list-check',
    titulo: 'Alcance y entregables',
    sub: 'Descripción pormenorizada del alcance, productos esperados e indicadores de seguimiento.'
  }
];

/**
 * Formulario de contrato en VISTA dedicada (creación y edición) — sin modal.
 * Conserva 1:1 las reglas del modal original: aliases de compatibilidad,
 * Validator.draft como autoridad de validación en vivo y relleno de defaults
 * al guardar. Anatomía: breadcrumb, resumen sticky con valor total en vivo,
 * secciones en pestañas, validación en bloque y footer con acciones.
 */
export const ContratoForm = ({
  initial,
  onDone
}: {
  initial?: Partial<Contract>;
  onDone: (savedId: string) => void;
}) => {
  const cancelar = useFormCancel("/contratos");
  const isEdit = Boolean(initial?.id);
  const [tab, setTab] = useState<TabId>('General');
  const [form, setForm] = useState<Partial<Contract>>(() => ({
    tipo: 'Servicios',
    type: 'Servicios',
    estado: 'Borrador',
    status: 'Borrador',
    cur: 'COP',
    valorBase: 0,
    val: 0,
    iva: 0,
    otrosImp: 0,
    adiciones: 0,
    reducciones: 0,
    ...initial
  }));

  const companies = Store.all('companies');

  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const updateField = (field: string, value: any) => {
    setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field)));
    setForm((prev) => {
      const next: Record<string, any> = { ...prev, [field]: value };
      // Sincronización bidireccional entre nombres normalizados y aliases de compatibilidad
      if (field === 'numero') next.num = value;
      if (field === 'num') next.numero = value;
      if (field === 'objeto') next.obj = value;
      if (field === 'obj') next.objeto = value;
      if (field === 'tipo') next.type = value;
      if (field === 'type') next.tipo = value;
      if (field === 'companyId') next.company = value;
      if (field === 'company') next.companyId = value;
      if (field === 'fechaFirma') next.signDate = value;
      if (field === 'signDate') next.fechaFirma = value;
      if (field === 'fechaInicio') next.startDate = value;
      if (field === 'startDate') next.fechaInicio = value;
      if (field === 'fechaFin') next.endDate = value;
      if (field === 'endDate') next.fechaFin = value;
      if (field === 'valorBase') next.val = num(value);
      if (field === 'val') next.valorBase = num(value);
      if (field === 'estado') next.status = value;
      if (field === 'status') next.estado = value;
      return next as Partial<Contract>;
    });
  };

  const allIssues = Validator.draft(form);
  const hasCritical = allIssues.some((i) => i.sev === 'Alta');
  const [intentado, setIntentado] = useState(false);
  const issueFields: Record<string, string> = {
    'Número': 'numero', 'Objeto': 'objeto', 'Fecha de inicio': 'fechaInicio',
    'Fecha de terminación': 'fechaFin', 'Duración': 'duracionDias',
    'Reducciones': 'reducciones', 'IVA': 'iva', 'Ejecución física': 'avanceFisico'
  };
  // Los avisos solo se muestran tras tocar el campo o intentar guardar: un formulario virgen no debe nacer en rojo.
  const issues = allIssues.filter((i) => intentado || touched.has(issueFields[i.campo ?? ''] ?? '') || (!((i.campo ?? '') in issueFields) && touched.size > 0));
  const fieldErrors = Object.fromEntries(allIssues.filter((issue) => issue.sev === 'Alta').map((issue) => [issueFields[issue.campo ?? ''] ?? 'numero', issue.msg]));
  const activateField = (field: string) => setTab(
    ['fechaInicio', 'fechaFin', 'duracionDias'].includes(field) ? 'Fechas'
      : ['reducciones', 'iva', 'avanceFisico'].includes(field) ? 'Económica' : 'General'
  );

  const getIssueFor = (campo: string) => {
    return issues.find((i) => (i.campo || '').toLowerCase() === campo.toLowerCase());
  };

  // Conteo de incidencias por pestaña
  const generalIssuesCount = issues.filter((i) => {
    const c = (i.campo || '').toLowerCase();
    return c === 'número' || c === 'objeto';
  }).length;

  const fechasIssuesCount = issues.filter((i) => {
    const c = (i.campo || '').toLowerCase();
    return c.includes('fecha') || c === 'duración';
  }).length;

  const econIssuesCount = issues.filter((i) => {
    const c = (i.campo || '').toLowerCase();
    return c === 'reducciones' || c === 'iva';
  }).length;

  const valBase = num(form.valorBase || form.val || 0);
  const valIva = num(form.iva || 0);
  const valOtros = num(form.otrosImp || 0);
  const valAdic = num(form.adiciones || 0);
  const valReduc = num(form.reducciones || 0);
  const valTotalActual = Math.max(0, valBase + valIva + valOtros + valAdic - valReduc);

  const handleSave = () => {
    setIntentado(true);
    if (hasCritical) {
      notify('Corrige los errores críticos marcados antes de guardar.');
      return;
    }
    // El modal original no exigía guard al guardar (petición del mapa-modal-a-vista):
    // el acceso ya está protegido por permiso al entrar; se refuerza en la mutación.
    if (!AuthService.guard(isEdit ? 'editar' : 'crear')) return;

    const isNew = !form.id;
    const saveId = form.id || uid();
    const finalData: Contract = {
      ...form,
      id: saveId,
      numero: form.numero || form.num || `CTR-${saveId.slice(0, 6).toUpperCase()}`,
      num: form.numero || form.num || `CTR-${saveId.slice(0, 6).toUpperCase()}`,
      objeto: form.objeto || form.obj || 'Sin objeto especificado',
      obj: form.objeto || form.obj || 'Sin objeto especificado',
      tipo: form.tipo || form.type || 'Servicios',
      type: form.tipo || form.type || 'Servicios',
      companyId: form.companyId || form.company || companies[0]?.id || '',
      company: form.companyId || form.company || companies[0]?.id || '',
      contratista: form.contratista || 'Por definir',
      nitContratista: form.nitContratista || '',
      responsable: form.responsable || 'Administración',
      supervisor: form.supervisor || 'Por asignar',
      fechaInicio: form.fechaInicio || form.startDate || new Date().toISOString().split('T')[0],
      fechaFin: form.fechaFin || form.endDate || new Date().toISOString().split('T')[0],
      valorBase: valBase,
      val: valBase,
      estado: form.estado || form.status || 'Activo',
      status: form.estado || form.status || 'Activo'
    } as Contract;

    if (isNew) {
      Store.insert('contracts', finalData);
      Audit.log({
        contractId: saveId,
        modulo: 'Contratos',
        accion: 'Creación',
        campo: 'Contrato ' + finalData.numero,
        nuevo: 'Registro de contrato'
      });
      notify(`Contrato ${finalData.numero} creado exitosamente.`);
    } else {
      Store.update('contracts', saveId, finalData);
      Audit.log({
        contractId: saveId,
        modulo: 'Contratos',
        accion: 'Edición',
        campo: 'Contrato ' + finalData.numero,
        nuevo: 'Actualización de contrato'
      });
      notify(`Contrato ${finalData.numero} actualizado correctamente.`);
    }

    onDone(saveId);
  };

  const currentNumber = form.numero || form.num;
  const seccion = SECCIONES.find((s) => s.id === tab)!;

  const conteoPorSeccion = (id: TabId) =>
    id === 'General' ? generalIssuesCount : id === 'Fechas' ? fechasIssuesCount : id === 'Económica' ? econIssuesCount : 0;

  return (
    <AccessibleForm errors={fieldErrors} attempted={intentado} activateField={activateField}>
      <PageHeader className="ph">
        <div>
          <nav className="crumb" style={{ width: '100%', marginBottom: 6 }} aria-label="Ruta de navegación">
            <Link href="/contratos">Contratos</Link>
            {isEdit && (
              <>
                <span style={{ color: 'var(--muted)' }}> / </span>
                <Link href={`/contrato/${encodeURIComponent(String(initial?.id))}`}>
                  Contrato {String(currentNumber || '')}
                </Link>
              </>
            )}
            <span style={{ color: 'var(--muted)' }}> / </span>
            <span aria-current="page">{isEdit ? 'Editar contrato' : 'Nuevo contrato'}</span>
          </nav>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10, margin: 0, flexWrap: 'wrap' }}>
            {isEdit ? 'Editar Contrato' : 'Registro de Nuevo Contrato'}
            {isEdit && <span className="badge b-info mono">{String(currentNumber || '')}</span>}
          </h1>
          <p style={{ margin: '4px 0 0' }}>
            {isEdit
              ? 'Actualiza los datos del expediente; cada cambio queda registrado en la auditoría del sistema.'
              : 'Complete los datos del expediente con apego a los lineamientos institucionales.'}
          </p>
        </div>
      </PageHeader>

      {/* Resumen sticky: número, contratista, estado de validación y valor total en vivo */}
      <div
        aria-label="Resumen en vivo del expediente"
        style={{
          position: 'sticky',
          top: 8,
          zIndex: 25,
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px 14px',
          padding: '10px 16px',
          marginBottom: 16,
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-lg)',
          boxShadow: 'var(--shadow-2)'
        }}
      >
        <span className="badge b-brand mono" style={{ fontWeight: 700 }}>
          {String(currentNumber || 'SIN NÚMERO')}
        </span>
        <span style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>
          {form.contratista || 'Contratista por definir'}
        </span>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 'auto',
            flexWrap: 'wrap',
            rowGap: 6
          }}
        >
          {issues.some((i) => i.sev === 'Alta') ? (
            <span
              style={{
                color: 'var(--crit-text)',
                fontWeight: 600,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--crit-bg)',
                padding: '4px 10px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--crit)'
              }}
            >
              <Icon name="alert-circle" size={14} /> Faltan campos obligatorios o existen incongruencias
            </span>
          ) : issues.length > 0 ? (
            <span
              style={{
                color: 'var(--warn-text)',
                fontWeight: 600,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--warn-bg)',
                padding: '4px 10px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--warn)'
              }}
            >
              <Icon name="alert-triangle" size={14} /> {issues.length} advertencia(s) no impeditiva(s)
            </span>
          ) : allIssues.length > 0 ? (
            <span style={{ color: 'var(--muted)', fontWeight: 500, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="info" size={14} /> Complete los campos marcados con *
            </span>
          ) : (
            <span
              style={{
                color: 'var(--ok-text)',
                fontWeight: 600,
                fontSize: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--ok-bg)',
                padding: '4px 10px',
                borderRadius: 'var(--r-pill)',
                border: '1px solid var(--ok)'
              }}
            >
              <Icon name="check-circle" size={14} /> Expediente verificado y listo para guardar
            </span>
          )}

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                color: 'var(--muted)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 600
              }}
            >
              Valor total en vivo:
            </span>
            <strong
              style={{
                fontFamily: 'var(--font-fig, var(--font-sans))',
                fontFeatureSettings: "'tnum' 1",
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--brand)',
                fontSize: 16,
                fontWeight: 700
              }}
            >
              {money(valTotalActual)} {form.cur || 'COP'}
            </strong>
          </div>
        </div>
      </div>

      {/* Superficie única con secciones navegables en pestañas */}
      <Surface className="panel mb">
        <div className="tabs" role="tablist" aria-label="Secciones del expediente">
          {SECCIONES.map((s, idx) => {
            const activo = tab === s.id;
            const conteo = conteoPorSeccion(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                id={`tab-seccion-${idx}`}
                aria-controls="contrato-form-panel"
                aria-selected={activo}
                tabIndex={activo ? 0 : -1}
                onKeyDown={(event) => {
                  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                  if (!keys.includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === 'Home' ? 0 : event.key === 'End' ? SECCIONES.length - 1 : (idx + (event.key === 'ArrowRight' ? 1 : -1) + SECCIONES.length) % SECCIONES.length;
                  setTab(SECCIONES[next].id);
                  document.getElementById(`tab-seccion-${next}`)?.focus();
                }}
                className={`tab ${activo ? 'on' : ''}`}
                onClick={() => setTab(s.id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <Icon name={s.icon} size={15} style={{ color: activo ? 'var(--brand)' : 'var(--muted)' }} />
                <span>{s.label}</span>
                {conteo > 0 && (
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      borderRadius: 'var(--r-pill)',
                      padding: '1px 7px',
                      background: 'var(--crit-bg)',
                      color: 'var(--crit-text)',
                      border: '1px solid var(--crit)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                  >
                    <Icon name="alert-circle" size={10} />
                    {conteo}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          key={tab}
          className="tab-content anim-fade-rise"
          role="tabpanel"
          id="contrato-form-panel"
          aria-labelledby={`tab-seccion-${SECCIONES.findIndex((s) => s.id === tab)}`}
          style={{ animationDuration: '200ms' }}
        >

          {tab === 'General' && (
            <FormSection title={seccion.titulo} icon={seccion.icon} description={seccion.sub} badge={`${SECCIONES.findIndex((s) => s.id === tab) + 1} / ${SECCIONES.length}`} accent>
              <Field className="f">
                <label className="req">Número de Contrato</label>
                <Input name="numero"
                  value={form.numero || form.num || ''}
                  onChange={(e) => updateField('numero', e.target.value)}
                  placeholder="Ej. CTR-2024-001"
                />
                {getIssueFor('Número') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--crit-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-circle" size={12} />
                    <span>{getIssueFor('Número')?.msg}</span>
                  </div>
                )}
              </Field>

              <Field className="f">
                <label>Tipo de Contrato</label>
                <Select name="tipo" value={form.tipo || form.type || 'Servicios'} onChange={(e) => updateField('tipo', e.target.value)}>
                  <option value="Obra">Obra</option>
                  <option value="Servicios">Prestación de Servicios</option>
                  <option value="Suministro">Suministro</option>
                  <option value="Consultoría">Consultoría</option>
                  <option value="Interventoría">Interventoría</option>
                </Select>
              </Field>

              <Field className="f">
                <label className="req">Empresa Contratante</label>
                <Select name="companyId"
                  value={form.companyId || form.company || ''}
                  onChange={(e) => updateField('companyId', e.target.value)}
                >
                  <option value="">Seleccione empresa...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.razon || (c as any).name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field className="f">
                <label>Nombre del Contratista</label>
                <Input name="contratista"
                  value={form.contratista || ''}
                  onChange={(e) => updateField('contratista', e.target.value)}
                  placeholder="Razón social o contratista"
                />
              </Field>

              <Field className="f">
                <label>NIT / Identificación Contratista</label>
                <Input name="nitContratista"
                  value={form.nitContratista || ''}
                  onChange={(e) => updateField('nitContratista', e.target.value)}
                  placeholder="Ej. 900.123.456-7"
                />
              </Field>

              <Field className="f">
                <label>Estado Inicial</label>
                <Select name="estado"
                  value={form.estado || form.status || 'Borrador'}
                  onChange={(e) => updateField('estado', e.target.value)}
                >
                  <option value="Borrador">Borrador</option>
                  <option value="Activo">Activo</option>
                  <option value="Suspendido">Suspendido</option>
                  <option value="En liquidación">En liquidación</option>
                  <option value="Liquidado">Liquidado</option>
                </Select>
              </Field>

              <Field className="f span3">
                <label className="req">Objeto Contractual</label>
                <Textarea name="objeto"
                  rows={3}
                  value={form.objeto || form.obj || ''}
                  onChange={(e) => updateField('objeto', e.target.value)}
                  placeholder="Describa de forma precisa el alcance y objeto a contratar..."
                />
                {getIssueFor('Objeto') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--warn-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-triangle" size={12} />
                    <span>{getIssueFor('Objeto')?.msg}</span>
                  </div>
                )}
              </Field>

              <Field className="f">
                <label>Responsable Interno</label>
                <Input name="responsable"
                  value={form.responsable || ''}
                  onChange={(e) => updateField('responsable', e.target.value)}
                  placeholder="Nombre del funcionario responsable"
                />
              </Field>

              <Field className="f">
                <label>Supervisor Designado</label>
                <Input name="supervisor"
                  value={form.supervisor || ''}
                  onChange={(e) => updateField('supervisor', e.target.value)}
                  placeholder="Nombre del supervisor"
                />
              </Field>
            </FormSection>
          )}

          {tab === 'Fechas' && (
            <FormSection title={seccion.titulo} icon={seccion.icon} description={seccion.sub} badge={`${SECCIONES.findIndex((s) => s.id === tab) + 1} / ${SECCIONES.length}`} accent>
              <Field className="f">
                <label>Fecha de Firma</label>
                <Input name="fechaFirma"
                  type="date"
                  value={form.fechaFirma || form.signDate || ''}
                  onChange={(e) => updateField('fechaFirma', e.target.value)}
                />
              </Field>

              <Field className="f">
                <label className="req">Fecha de Inicio</label>
                <Input name="fechaInicio"
                  type="date"
                  value={form.fechaInicio || form.startDate || ''}
                  onChange={(e) => updateField('fechaInicio', e.target.value)}
                />
                {getIssueFor('Fecha de inicio') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--warn-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-triangle" size={12} />
                    <span>{getIssueFor('Fecha de inicio')?.msg}</span>
                  </div>
                )}
              </Field>

              <Field className="f">
                <label className="req">Fecha de Terminación</label>
                <Input name="fechaFin"
                  type="date"
                  value={form.fechaFin || form.endDate || ''}
                  onChange={(e) => updateField('fechaFin', e.target.value)}
                />
                {getIssueFor('Fecha de terminación') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--crit-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-circle" size={12} />
                    <span>{getIssueFor('Fecha de terminación')?.msg}</span>
                  </div>
                )}
              </Field>

              <Field className="f span3">
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
                  <label className={`chk ${form.hastaAgotar ? 'on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.hastaAgotar)}
                      onChange={(e) => updateField('hastaAgotar', e.target.checked)}
                    />
                    <span className="field-checkbox-label"><span aria-hidden="true"><Icon name="wallet" size={16} /></span>Hasta agotar presupuesto pactado</span>
                  </label>
                </div>
              </Field>
            </FormSection>
          )}

          {tab === 'Económica' && (
            <FormSection title={seccion.titulo} icon={seccion.icon} description={seccion.sub} badge={`${SECCIONES.findIndex((s) => s.id === tab) + 1} / ${SECCIONES.length}`} accent>
              {isEdit && Number(initial?.avanceFisico) > 100 && <Field className="f">
                <label>Ejecución física acumulada (%)</label>
                <Input name="avanceFisico" type="number" min="0" max="100" value={form.avanceFisico ?? 0} onChange={(event) => updateField('avanceFisico', Number(event.target.value))} />
              </Field>}
              <Field className="f">
                <label className="req">Valor Base / Inicial</label>
                <Input name="valorBase"
                  type="number"
                  min="0"
                  step="1000"
                  value={form.valorBase || form.val || ''}
                  onChange={(e) => updateField('valorBase', Number(e.target.value))}
                  placeholder="0"
                />
                <span className="hint">{valBase ? money(valBase) : 'Cifra en pesos colombianos u otra moneda.'}</span>
              </Field>

              <Field className="f">
                <label>Moneda</label>
                <Select name="cur" value={form.cur || 'COP'} onChange={(e) => updateField('cur', e.target.value)}>
                  <option value="COP">COP — Peso Colombiano</option>
                  <option value="USD">USD — Dólar Estadounidense</option>
                </Select>
              </Field>

              <Field className="f">
                <label>IVA Aplicable</label>
                <Input name="iva"
                  type="number"
                  min="0"
                  value={form.iva || ''}
                  onChange={(e) => updateField('iva', Number(e.target.value))}
                  placeholder="0"
                />
                {getIssueFor('IVA') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--warn-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-triangle" size={12} />
                    <span>{getIssueFor('IVA')?.msg}</span>
                  </div>
                )}
              </Field>

              <Field className="f">
                <label>Adiciones Contractuales</label>
                <Input name="adiciones"
                  type="number"
                  min="0"
                  value={form.adiciones || ''}
                  onChange={(e) => updateField('adiciones', Number(e.target.value))}
                  placeholder="0"
                />
              </Field>

              <Field className="f">
                <label>Reducciones Contractuales</label>
                <Input name="reducciones"
                  type="number"
                  min="0"
                  value={form.reducciones || ''}
                  onChange={(e) => updateField('reducciones', Number(e.target.value))}
                  placeholder="0"
                />
                {getIssueFor('Reducciones') && (
                  <div style={{ fontSize: '11.5px', color: 'var(--crit-text)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="alert-circle" size={12} />
                    <span>{getIssueFor('Reducciones')?.msg}</span>
                  </div>
                )}
              </Field>

              {/* Desglose en vivo con filas separadas por líneas finas (sin caja anidada) */}
              <Field className="f span3">
                <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 6, maxWidth: 460, marginLeft: 'auto' }}>
                  {(
                    [
                      ['Valor base', valBase, 'var(--ink)'],
                      ['IVA + otros impuestos', valIva + valOtros, 'var(--ink)'],
                      ['Adiciones (+)', valAdic, 'var(--ok-text)'],
                      ['Reducciones (−)', valReduc, 'var(--crit-text)']
                    ] as Array<[string, number, string]>
                  ).map(([lbl, v, color]) => (
                    <div
                      key={lbl}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '7px 0',
                        borderBottom: '1px solid var(--line-2)',
                        fontSize: 13
                      }}
                    >
                      <span style={{ color: 'var(--muted)' }}>{lbl}</span>
                      <b
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          color,
                          fontWeight: 600
                        }}
                      >
                        {money(v)}
                      </b>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 0 0',
                      fontSize: 13
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>Valor Total Actualizado</span>
                    <b
                      style={{
                        fontSize: 17,
                        color: 'var(--brand)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {money(valTotalActual)}
                    </b>
                  </div>
                </div>
              </Field>
            </FormSection>
          )}

          {tab === 'Alcance' && (
            <FormSection title={seccion.titulo} icon={seccion.icon} description={seccion.sub} badge={`${SECCIONES.findIndex((s) => s.id === tab) + 1} / ${SECCIONES.length}`} accent>
              <Field className="f span3">
                <label>Descripción Detallada del Alcance</label>
                <Textarea name="descripcion"
                  rows={4}
                  value={form.descripcion || form.objeto || form.obj || ''}
                  onChange={(e) => updateField('descripcion', e.target.value)}
                  placeholder="Especificaciones técnicas y descripción pormenorizada del alcance contratado..."
                />
              </Field>

              <Field className="f span3">
                <label>Entregables y Productos Esperados</label>
                <Textarea name="productos"
                  rows={3}
                  value={form.productos || ''}
                  onChange={(e) => updateField('productos', e.target.value)}
                  placeholder="Lista o descripción de informes, actas, hitos o productos contractuales..."
                />
              </Field>

              <Field className="f span3">
                <label>Indicadores de Cumplimiento / Seguimiento</label>
                <Input name="indicadores"
                  value={form.indicadores || ''}
                  onChange={(e) => updateField('indicadores', e.target.value)}
                  placeholder="Ej. Cumplimiento de cronograma 100%, nivel de satisfacción > 90%"
                />
              </Field>
            </FormSection>
          )}
        </div>
      </Surface>

      {/* Validación en bloque al final: incidencias del Validator.draft */}
      {issues.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            borderRadius: 'var(--r-lg)',
            border: `1px solid ${hasCritical ? 'var(--crit)' : 'var(--warn)'}`,
            background: hasCritical ? 'var(--crit-bg)' : 'var(--warn-bg)',
            color: hasCritical ? 'var(--crit-text)' : 'var(--warn-text)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
            <Icon name={hasCritical ? 'alert-circle' : 'alert-triangle'} size={16} />
            <span>
              {hasCritical
                ? 'Atención: Existen inconsistencias críticas que deben corregirse antes de guardar'
                : 'Observaciones de validación normativa'}
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {issues.map((issue, idx) => (
              <li key={idx}>
                <strong>{issue.campo}:</strong> {issue.msg} {issue.rec && <span style={{ opacity: 0.85 }}>({issue.rec})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer de acciones canónico del sistema */}
      <div className="form-foot">
        <Button className="btn ghost" onClick={cancelar}>
          <Icon name="chevron-left" /> Cancelar
        </Button>
        <Button className="btn pri" onClick={handleSave} aria-disabled={hasCritical} title={hasCritical ? 'Corrija los errores críticos para guardar' : 'Guardar expediente'}>
          <Icon name="check" /> {isEdit ? 'Guardar Cambios' : 'Guardar Contrato'}
        </Button>
      </div>
    </AccessibleForm>
  );
};
