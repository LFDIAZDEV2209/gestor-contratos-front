'use client';
import { useState } from 'react';
import type { Contract, User } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Validator } from '../../lib/validator';
import { Modal } from '../ui/Modal';
import { uid, addDays, iso } from '../../lib/format';

export const ContratoFormModal = ({ contract, onClose }: { contract?: Partial<Contract>, onClose: () => void }) => {
  const [tab, setTab] = useState('General');
  const [form, setForm] = useState<Partial<Contract>>(contract || { status: 'Borrador' });
  const companies = Store.all('companies');
  
  const issues = Validator.draft(form);
  const hasCritical = issues.some(i => i.sev === 'Alta');

  const handleSave = () => {
    if (hasCritical) return alert('Corrige los errores críticos antes de guardar.');
    
    const isNew = !form.id;
    const saveId = form.id || uid();
    const finalData = { ...form, id: saveId } as Contract;
    
    if (isNew) {
      Store.insert('contracts', finalData);
      Audit.log('u1', 'Crear', 'Contrato', saveId, 'Creó contrato');
    } else {
      Store.update('contracts', saveId, finalData);
      Audit.log('u1', 'Editar', 'Contrato', saveId, 'Editó contrato');
    }
    onClose();
  };

  return (
    <Modal title={contract?.id ? `Editar Contrato: ${contract.num}` : 'Nuevo Contrato'} onClose={onClose}>
      <div className="tabs mb">
        {['General', 'Fechas', 'Económica', 'Alcance'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div style={{ minHeight: '300px' }}>
        {tab === 'General' && (
          <div className="form-grid">
            <div className="f">
              <label className="req">Número</label>
              <input value={form.num || ''} onChange={e => setForm({...form, num: e.target.value})} />
            </div>
            <div className="f">
              <label>Tipo</label>
              <select value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="Obra">Obra</option>
                <option value="Servicios">Servicios</option>
                <option value="Suministro">Suministro</option>
              </select>
            </div>
            <div className="f">
              <label className="req">Empresa</label>
              <select value={form.company || ''} onChange={e => setForm({...form, company: e.target.value})}>
                <option value="">Seleccione...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="f span3">
              <label className="req">Objeto</label>
              <textarea value={form.obj || ''} onChange={e => setForm({...form, obj: e.target.value})} />
            </div>
          </div>
        )}

        {tab === 'Fechas' && (
          <div className="form-grid">
            <div className="f">
              <label>Fecha Firma</label>
              <input type="date" value={form.signDate || ''} onChange={e => setForm({...form, signDate: e.target.value})} />
            </div>
            <div className="f">
              <label>Fecha Inicio</label>
              <input type="date" value={form.startDate || ''} onChange={e => setForm({...form, startDate: e.target.value})} />
            </div>
            <div className="f">
              <label>Fecha Fin</label>
              <input type="date" value={form.endDate || ''} onChange={e => setForm({...form, endDate: e.target.value})} />
            </div>
            <div className="f span3">
              <label className="chk">
                <input type="checkbox" /> Hasta agotar presupuesto
              </label>
            </div>
          </div>
        )}

        {tab === 'Económica' && (
          <div className="form-grid">
            <div className="f">
              <label>Valor Base</label>
              <input type="number" value={form.val || 0} onChange={e => setForm({...form, val: Number(e.target.value)})} />
            </div>
            <div className="f">
              <label>Moneda</label>
              <select value={form.cur || 'COP'} onChange={e => setForm({...form, cur: e.target.value})}>
                <option value="COP">COP</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="f span3">
              <div className="calc">
                <div><span>Valor Base</span><b>${form.val || 0}</b></div>
                <div><span>Valor Actualizado</span><b>${form.val || 0}</b></div>
                <div><span>Saldo</span><b>${form.val || 0}</b></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Alcance' && (
          <div className="f">
            <label>Descripción detallada</label>
            <textarea rows={5} value={form.obj || ''} readOnly />
            <span className="hint">El alcance se mapea en base al objeto</span>
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <div className="result-banner bad mt-4" style={{ fontSize: '12px', padding: '8px' }}>
          <b>Avisos:</b> {issues.map(i => `${i.sev}: ${i.msg}`).join(', ')}
        </div>
      )}

      <div className="modal-f mt-4">
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={handleSave} disabled={hasCritical}>Guardar Contrato</button>
      </div>
    </Modal>
  );
};
