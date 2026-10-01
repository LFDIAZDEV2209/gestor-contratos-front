'use client';
import { useState } from 'react';
import type { Company } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { uid } from '../../lib/format';

export const EmpresasView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [companies, setCompanies] = useState<Company[]>(Store.all('companies'));
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  
  const total = companies.length;
  const activas = companies.filter(c => c.status === 'Activo').length;
  const inactivas = total - activas;

  const handleSave = () => {
    if (editing) {
      if (editing.id) {
        Store.update('companies', editing.id, editing);
        Audit.log('u1', 'Editar', 'Empresa', editing.id, 'Editó empresa');
      } else {
        const newId = uid();
        Store.insert('companies', { ...editing, id: newId, risk: 0, level: '1', status: 'Activo' } as Company);
        Audit.log('u1', 'Crear', 'Empresa', newId, 'Creó empresa');
      }
      setCompanies(Store.all('companies'));
      setEditing(null);
    }
  };

  const handleAnular = (id: string) => {
    const motivo = window.prompt('Motivo de anulación:');
    if (motivo) {
      Store.update('companies', id, { status: 'Anulado' });
      Audit.log('u1', 'Anular', 'Empresa', id, `Motivo: ${motivo}`);
      setCompanies(Store.all('companies'));
    }
  };

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Empresas</h1>
          <p>Directorio de contratistas y terceros</p>
        </div>
        <div className="ph-actions">
          <button className="btn ghost"><Icon name="file-contract"/> Exportar</button>
          <button className="btn pri" onClick={() => setEditing({})}><Icon name="plus"/> Nueva Empresa</button>
        </div>
      </div>
      
      <div className="kpis mb">
        <Kpi label="Total Empresas" value={total.toString()} />
        <Kpi label="Activas" value={activas.toString()} color="ok" />
        <Kpi label="Inactivas" value={inactivas.toString()} color="na" />
      </div>

      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>NIT</th>
                <th>Razón Social</th>
                <th>Representante</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td>{c.nit}</td>
                  <td>{c.name}</td>
                  <td>{c.rep}</td>
                  <td>{c.type}</td>
                  <td><Badge text={c.status} color={c.status === 'Activo' ? 'ok' : 'crit'} /></td>
                  <td>
                    <div className="acts">
                      <button className="icon-btn" onClick={() => onSelect(c.id)} title="Ver Ficha"><Icon name="search"/></button>
                      <button className="icon-btn" onClick={() => setEditing(c)} title="Editar"><Icon name="cog"/></button>
                      <button className="icon-btn" onClick={() => handleAnular(c.id)} title="Anular"><Icon name="exclamation-circle"/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && <tr><td colSpan={6} className="empty">No hay empresas</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal title={editing.id ? 'Editar Empresa' : 'Nueva Empresa'} onClose={() => setEditing(null)}>
          <div className="form-grid">
            <div className="f">
              <label className="req">NIT</label>
              <input value={editing.nit || ''} onChange={e => setEditing({...editing, nit: e.target.value})} />
            </div>
            <div className="f span2">
              <label className="req">Razón Social</label>
              <input value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})} />
            </div>
            <div className="f span2">
              <label>Representante Legal</label>
              <input value={editing.rep || ''} onChange={e => setEditing({...editing, rep: e.target.value})} />
            </div>
            <div className="f">
              <label>Tipo</label>
              <select value={editing.type || ''} onChange={e => setEditing({...editing, type: e.target.value})}>
                <option value="Privada">Privada</option>
                <option value="Pública">Pública</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
          </div>
          <div className="modal-f mt-4">
            <button className="btn ghost" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="btn pri" onClick={handleSave}>Guardar</button>
          </div>
        </Modal>
      )}
    </div>
  );
};
