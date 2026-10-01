'use client';
import { Store } from '../../lib/store';
import { Icon } from '../icons';

export const TabDocumentos = ({ cid }: { cid: string }) => {
  const docs = Store.byContract('documents', cid);
  return (
    <div className="panel">
      <div className="panel-h"><h3>Documentos</h3><button className="btn sm"><Icon name="plus"/> Añadir</button></div>
      <table className="tbl">
        <thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th>Tamaño</th><th>Acciones</th></tr></thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.id}>
              <td>{d.name}</td><td>{d.type}</td><td>{d.date}</td><td>{d.size}KB</td>
              <td><button className="icon-btn"><Icon name="search"/></button></td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={5} className="empty">Sin documentos</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
