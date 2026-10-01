'use client';

import React, { useState } from 'react';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { FormGrid, Field } from '../ui/Workspace';
import type { Contract } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { Modal } from '../ui/Modal';
import { uid, money, num } from '../../lib/format';
import { Icon } from '../icons';

export const ContratoFormModal = ({
  contract,
  onClose,
  onSave
}: {
  contract?: Partial<Contract>;
  onClose: () => void;
  onSave?: () => void;
}) => {
  const [tab, setTab] = useState<'General' | 'Fechas' | 'Económica' | 'Alcance'>('General');
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
    ...contract
  }));

  const companies = Store.all('companies');

  const updateField = (field: string, value: any) => {
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

  const issues = Validator.draft(form);
  const hasCritical = issues.some((i) => i.sev === 'Alta');

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
    if (hasCritical) {
      notify('Corrige los errores críticos marcados antes de guardar.');
      return;
    }

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

    if (onSave) onSave();
    onClose();
  };

  const currentNumber = form.numero || form.num;

  return (
    <Modal
      title={form.id ? `Expediente Contractual: ${currentNumber}` : 'Registro de Nuevo Contrato'}
      subtitle="Complete los datos del expediente con apego a los lineamientos institucionales"
      size="lg"
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 12 }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {hasCritical ? (
              <span style={{ color: 'var(--crit-text)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="alert-circle" size={14} /> Faltan campos obligatorios o existen incongruencias
              </span>
            ) : issues.length > 0 ? (
              <span style={{ color: 'var(--warn-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="alert-triangle" size={14} /> {issues.length} advertencia(s) no impeditiva(s)
              </span>
            ) : (
              <span style={{ color: 'var(--ok-text)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="check-circle" size={14} /> Formulario validado correctamente
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button className="btn ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              className="btn pri"
              onClick={handleSave}
              disabled={hasCritical}
              title={hasCritical ? 'Corrija los errores críticos para guardar' : 'Guardar expediente'}
            >
              <Icon name="check" /> Guardar Contrato
            </Button>
          </div>
        </div>
      }
    >
      {/* Navegación por Pestañas */}
      <div className="tabs mb">
        {[
          { id: 'General', label: 'General', icon: 'file-contract', count: generalIssuesCount },
          { id: 'Fechas', label: 'Plazos y Fechas', icon: 'calendar', count: fechasIssuesCount },
          { id: 'Económica', label: 'Económica', icon: 'wallet', count: econIssuesCount },
          { id: 'Alcance', label: 'Alcance y Entregables', icon: 'list-check', count: 0 }
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id as any)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name={t.icon} size={14} />
            <span>{t.label}</span>
            {t.count > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: 'var(--r-pill)',
                  padding: '1px 6px',
                  background: 'var(--crit-bg)',
                  color: 'var(--crit-text)',
                  border: '1px solid var(--crit)'
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '320px' }}>
        {/* Pestaña: General */}
        {tab === 'General' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Número de Contrato</label>
              <Input
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
              <Select
                value={form.tipo || form.type || 'Servicios'}
                onChange={(e) => updateField('tipo', e.target.value)}
              >
                <option value="Obra">Obra</option>
                <option value="Servicios">Prestación de Servicios</option>
                <option value="Suministro">Suministro</option>
                <option value="Consultoría">Consultoría</option>
                <option value="Interventoría">Interventoría</option>
              </Select>
            </Field>

            <Field className="f">
              <label className="req">Empresa Contratante</label>
              <Select
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
              <Input
                value={form.contratista || ''}
                onChange={(e) => updateField('contratista', e.target.value)}
                placeholder="Razón social o contratista"
              />
            </Field>

            <Field className="f">
              <label>NIT / Identificación Contratista</label>
              <Input
                value={form.nitContratista || ''}
                onChange={(e) => updateField('nitContratista', e.target.value)}
                placeholder="Ej. 900.123.456-7"
              />
            </Field>

            <Field className="f">
              <label>Estado Inicial</label>
              <Select
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
              <Textarea
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
              <Input
                value={form.responsable || ''}
                onChange={(e) => updateField('responsable', e.target.value)}
                placeholder="Nombre del funcionario responsable"
              />
            </Field>

            <Field className="f">
              <label>Supervisor Designado</label>
              <Input
                value={form.supervisor || ''}
                onChange={(e) => updateField('supervisor', e.target.value)}
                placeholder="Nombre del supervisor"
              />
            </Field>
          </FormGrid>
        )}

        {/* Pestaña: Fechas y Plazos */}
        {tab === 'Fechas' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label>Fecha de Firma</label>
              <Input
                type="date"
                value={form.fechaFirma || form.signDate || ''}
                onChange={(e) => updateField('fechaFirma', e.target.value)}
              />
            </Field>

            <Field className="f">
              <label className="req">Fecha de Inicio</label>
              <Input
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
              <Input
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
                  <span>Hasta agotar presupuesto pactado</span>
                </label>
              </div>
            </Field>
          </FormGrid>
        )}

        {/* Pestaña: Económica */}
        {tab === 'Económica' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Valor Base / Inicial</label>
              <Input
                type="number"
                min="0"
                step="1000"
                value={form.valorBase || form.val || ''}
                onChange={(e) => updateField('valorBase', Number(e.target.value))}
                placeholder="0"
              />
            </Field>

            <Field className="f">
              <label>Moneda</label>
              <Select
                value={form.cur || 'COP'}
                onChange={(e) => updateField('cur', e.target.value)}
              >
                <option value="COP">COP — Peso Colombiano</option>
                <option value="USD">USD — Dólar Estadounidense</option>
              </Select>
            </Field>

            <Field className="f">
              <label>IVA Aplicable</label>
              <Input
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
              <Input
                type="number"
                min="0"
                value={form.adiciones || ''}
                onChange={(e) => updateField('adiciones', Number(e.target.value))}
                placeholder="0"
              />
            </Field>

            <Field className="f">
              <label>Reducciones Contractuales</label>
              <Input
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

            <Field className="f span3">
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                  padding: '16px 20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 16
                }}
              >
                <div>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>Valor Base</span>
                  <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{money(valBase)}</b>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>IVA + Otros</span>
                  <b style={{ fontSize: '15px', color: 'var(--ink)' }}>{money(valIva + valOtros)}</b>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>Adiciones (+)</span>
                  <b style={{ fontSize: '15px', color: 'var(--ok-text)' }}>{money(valAdic)}</b>
                </div>
                <div>
                  <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>Reducciones (-)</span>
                  <b style={{ fontSize: '15px', color: 'var(--crit-text)' }}>{money(valReduc)}</b>
                </div>
                <div style={{ borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
                  <span style={{ fontSize: '11.5px', color: 'var(--brand-2)', fontWeight: 600, display: 'block' }}>
                    Valor Total Actualizado
                  </span>
                  <b style={{ fontSize: '18px', color: 'var(--brand)' }}>{money(valTotalActual)}</b>
                </div>
              </div>
            </Field>
          </FormGrid>
        )}

        {/* Pestaña: Alcance */}
        {tab === 'Alcance' && (
          <FormGrid className="form-grid">
            <Field className="f span3">
              <label>Descripción Detallada del Alcance</label>
              <Textarea
                rows={4}
                value={form.descripcion || form.objeto || form.obj || ''}
                onChange={(e) => updateField('descripcion', e.target.value)}
                placeholder="Especificaciones técnicas y descripción pormenorizada del alcance contratado..."
              />
            </Field>

            <Field className="f span3">
              <label>Entregables y Productos Esperados</label>
              <Textarea
                rows={3}
                value={form.productos || ''}
                onChange={(e) => updateField('productos', e.target.value)}
                placeholder="Lista o descripción de informes, actas, hitos o productos contractuales..."
              />
            </Field>

            <Field className="f span3">
              <label>Indicadores de Cumplimiento / Seguimiento</label>
              <Input
                value={form.indicadores || ''}
                onChange={(e) => updateField('indicadores', e.target.value)}
                placeholder="Ej. Cumplimiento de cronograma 100%, nivel de satisfacción > 90%"
              />
            </Field>
          </FormGrid>
        )}
      </div>

      {/* Banner de validaciones generales si existen incidencias */}
      {issues.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: '12px 16px',
            borderRadius: 'var(--r)',
            background: hasCritical ? 'var(--crit-bg)' : 'var(--warn-bg)',
            border: `1px solid ${hasCritical ? 'var(--crit)' : 'var(--warn)'}`,
            color: hasCritical ? 'var(--crit-text)' : 'var(--warn-text)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: '13px' }}>
            <Icon name={hasCritical ? 'alert-circle' : 'alert-triangle'} size={16} />
            <span>
              {hasCritical
                ? 'Atención: Existen inconsistencias críticas que deben corregirse antes de guardar'
                : 'Observaciones de validación normativa'}
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: '12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {issues.map((issue, idx) => (
              <li key={idx}>
                <strong>{issue.campo}:</strong> {issue.msg}{' '}
                {issue.rec && <span style={{ opacity: 0.85 }}>({issue.rec})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
};
