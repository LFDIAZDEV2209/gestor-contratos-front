'use client';
import { Input, Select } from '../ui/Controls';
import { requestReason } from '../ui/Feedback';
import { Button } from '../ui/button';
import { PageHeader, Surface, TableViewport, DataTable, FormGrid, Field } from '../ui/Workspace';
import { useState } from 'react';
import type { Company } from '../../lib/types';
import { Store, Audit } from '../../lib/store';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { Kpi } from '../ui/Kpi';
import { Modal } from '../ui/Modal';
import { uid } from '../../lib/format';
import { exportRows } from '../../lib/export';

export const EmpresasView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [companies, setCompanies] = useState<Company[]>(Store.all('companies'));
  const [editing, setEditing] = useState<Partial<Company> | null>(null);
  
  const total = companies.length;
  const activas = companies.filter(c => ['Activa', 'Activo'].includes(c.estado || c.status || '')).length;
  const inactivas = total - activas;

  const handleSave = () => {
    if (editing) {
      if (editing.id) {
        Store.update('companies', editing.id, editing);
        Audit.log({
          modulo: 'Empresas',
          accion: 'Edición',
          campo: 'Empresa ' + (editing.razon || editing.name || editing.id),
          nuevo: 'Actualización de empresa'
        });
      } else {
        const newId = uid();
        Store.insert('companies', { ...editing, id: newId, risk: 0, level: '1', estado: 'Activa', status: 'Activo' } as Company);
        Audit.log({
          modulo: 'Empresas',
          accion: 'Creación',
          campo: 'Empresa ' + (editing.razon || editing.name || newId),
          nuevo: 'Registro de empresa'
        });
      }
      setCompanies(Store.all('companies'));
      setEditing(null);
    }
  };

  const handleAnular = async (id: string) => {
    const motivo = await requestReason('Motivo de anulación:');
    if (motivo) {
      Store.update('companies', id, { estado: 'Anulada', status: 'Anulado' });
      Audit.log({
        modulo: 'Empresas',
        accion: 'Anulación',
        campo: 'Empresa ' + id,
        obs: `Motivo: ${motivo}`
      });
      setCompanies(Store.all('companies'));
    }
  };

  return (
    <div>
      <PageHeader className="ph">
        <div>
          <h1>Empresas</h1>
          <p>Directorio de contratistas y terceros</p>
        </div>
        <div className="ph-actions">
          <Button className="btn ghost" onClick={()=>exportRows('Empresas', [{l:'NIT',k:'nit'},{l:'Razón social',x:(c:Company)=>c.razon || c.name || ''},{l:'Tipo',x:(c:Company)=>c.tipo || c.type || ''},{l:'Estado',x:(c:Company)=>c.estado || c.status || ''}],companies,'xlsx')}><Icon name="file-contract"/> Exportar</Button>
          <Button className="btn pri" onClick={() => setEditing({})}><Icon name="plus"/> Nueva Empresa</Button>
        </div>
      </PageHeader>
      
      <div className="kpis mb">
        <Kpi label="Total Empresas" value={total.toString()} />
        <Kpi label="Activas" value={activas.toString()} color="ok" />
        <Kpi label="Inactivas" value={inactivas.toString()} color="na" />
      </div>

      <Surface className="panel">
        <TableViewport className="tbl-wrap">
          <DataTable className="tbl">
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
                  <td><Button variant="link" className="text-link" onClick={()=>onSelect(c.id)}>{c.razon || c.name}</Button></td>
                  <td>{c.rep}</td>
                  <td>{c.tipo || c.type}</td>
                  <td><Badge text={c.estado || c.status} color={['Activa','Activo'].includes(c.estado || c.status || '') ? 'ok' : 'na'} /></td>
                  <td>
                    <div className="acts">
                      <Button className="icon-btn" onClick={() => onSelect(c.id)} title="Ver Ficha"><Icon name="search"/></Button>
                      <Button className="icon-btn" onClick={() => setEditing(c)} title="Editar"><Icon name="cog"/></Button>
                      <Button className="icon-btn" onClick={() => handleAnular(c.id)} title="Anular"><Icon name="exclamation-circle"/></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && <tr><td colSpan={6} className="empty">No hay empresas</td></tr>}
            </tbody>
          </DataTable>
        </TableViewport>
      </Surface>

      {editing && (
        <Modal title={editing.id ? 'Editar Empresa' : 'Nueva Empresa'} onClose={() => setEditing(null)}>
          <FormGrid className="form-grid">
            <Field className="f">
              <label className="req">NIT</label>
              <Input value={editing.nit || ''} onChange={e => setEditing({...editing, nit: e.target.value})} />
            </Field>
            <Field className="f span2">
              <label className="req">Razón Social</label>
              <Input value={editing.razon || editing.name || ''} onChange={e => setEditing({...editing, razon: e.target.value, name: e.target.value})} />
            </Field>
            <Field className="f span2">
              <label>Representante Legal</label>
              <Input value={editing.rep || ''} onChange={e => setEditing({...editing, rep: e.target.value})} />
            </Field>
            <Field className="f">
              <label>Tipo</label>
              <Select value={editing.tipo || editing.type || ''} onChange={e => setEditing({...editing, tipo: e.target.value, type: e.target.value})}>
                <option value={editing.tipo || editing.type || ''}>{editing.tipo || editing.type || 'Seleccione…'}</option>
                <option value="Privada">Privada</option>
                <option value="Pública">Pública</option>
                <option value="Mixta">Mixta</option>
              </Select>
            </Field>
          </FormGrid>
          <div className="modal-f mt-4">
            <Button className="btn ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="btn pri" onClick={handleSave}>Guardar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};
