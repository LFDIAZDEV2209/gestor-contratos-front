'use client';
import { Input, Select, Textarea } from '../ui/Controls';
import { notify } from '../ui/Feedback';
import { Button } from '../ui/button';
import { FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Contract, User } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { Modal } from '../ui/Modal';
import { uid, addDays, iso } from '../../lib/format';

export const ContratoFormModal = ({
  contract,
  onClose,
  onSave
}: {
  contract?: Partial<Contract>;
  onClose: () => void;
  onSave?: () => void;
}) => {
  const [tab, setTab] = useState('General');
  const [form, setForm] = useState<Partial<Contract>>(contract || { status: 'Borrador' });
  const companies = Store.all('companies');
  
  const issues = Validator.draft(form);
  const hasCritical = issues.some(i => i.sev === 'Alta');

  const handleSave = () => {
    if (hasCritical) return notify('Corrige los errores críticos antes de guardar.');
    
    const isNew = !form.id;
    const saveId = form.id || uid();
    const finalData = { ...form, id: saveId } as Contract;
    
    if (isNew) {
      Store.insert('contracts', finalData);
      Audit.log({
        contractId: saveId,
        modulo: 'Contratos',
        accion: 'Creación',
        campo: 'Contrato ' + (form.numero || form.num || saveId),
        nuevo: 'Registro de contrato'
      });
    } else {
      Store.update('contracts', saveId, finalData);
      Audit.log({
        contractId: saveId,
        modulo: 'Contratos',
        accion: 'Edición',
        campo: 'Contrato ' + (form.numero || form.num || saveId),
        nuevo: 'Actualización de contrato'
      });
    }
    if (onSave) onSave();
    onClose();
  };

  return (
    <Modal title={contract?.id ? `Editar Contrato: ${contract.num}` : 'Nuevo Contrato'} onClose={onClose}>
      <div className="tabs mb">
        {['General', 'Fechas', 'Económica', 'Alcance'].map(t => (
          <Button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</Button>
        ))}
      </div>

      <div style={{ minHeight: '300px' }}>
        {tab === 'General' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">Número</label>
              <Input value={form.num || ''} onChange={e => setForm({...form, num: e.target.value})} />
            </Field>
            <Field className="f">
              <label>Tipo</label>
              <Select value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="Obra">Obra</option>
                <option value="Servicios">Servicios</option>
                <option value="Suministro">Suministro</option>
              </Select>
            </Field>
            <Field className="f">
              <label className="req">Empresa</label>
              <Select value={form.company || ''} onChange={e => setForm({...form, company: e.target.value})}>
                <option value="">Seleccione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field className="f span3">
              <label className="req">Objeto</label>
              <Textarea value={form.obj || ''} onChange={e => setForm({...form, obj: e.target.value})} />
            </Field>
          </FormGrid>
        )}

        {tab === 'Fechas' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label>Fecha Firma</label>
              <Input type="date" value={form.signDate || ''} onChange={e => setForm({...form, signDate: e.target.value})} />
            </Field>
            <Field className="f">
              <label>Fecha Inicio</label>
              <Input type="date" value={form.startDate || ''} onChange={e => setForm({...form, startDate: e.target.value})} />
            </Field>
            <Field className="f">
              <label>Fecha Fin</label>
              <Input type="date" value={form.endDate || ''} onChange={e => setForm({...form, endDate: e.target.value})} />
            </Field>
            <Field className="f span3">
              <label className="chk">
                <Input type="checkbox" /> Hasta agotar presupuesto
              </label>
            </Field>
          </FormGrid>
        )}

        {tab === 'Económica' && (
          <FormGrid className="form-grid">
            <Field className="f">
              <label>Valor Base</label>
              <Input type="number" value={form.val || 0} onChange={e => setForm({...form, val: Number(e.target.value)})} />
            </Field>
            <Field className="f">
              <label>Moneda</label>
              <Select value={form.cur || 'COP'} onChange={e => setForm({...form, cur: e.target.value})}>
                <option value="COP">COP</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field className="f span3">
              <div className="calc">
                <div><span>Valor Base</span><b>${form.val || 0}</b></div>
                <div><span>Valor Actualizado</span><b>${form.val || 0}</b></div>
                <div><span>Saldo</span><b>${form.val || 0}</b></div>
              </div>
            </Field>
          </FormGrid>
        )}

        {tab === 'Alcance' && (
          <Field className="f">
            <label>Descripción detallada</label>
            <Textarea rows={5} value={form.obj || ''} readOnly />
            <span className="hint">El alcance se mapea en base al objeto</span>
          </Field>
        )}
      </div>

      {issues.length > 0 && (
        <div className="result-banner bad mt-4" style={{ fontSize: '12px', padding: '8px' }}>
          <b>Avisos:</b> {issues.map(i => `${i.sev}: ${i.msg}`).join(', ')}
        </div>
      )}

      <div className="modal-f mt-4">
        <Button className="btn ghost" onClick={onClose}>Cancelar</Button>
        <Button className="btn pri" onClick={handleSave} disabled={hasCritical}>Guardar Contrato</Button>
      </div>
    </Modal>
  );
};
