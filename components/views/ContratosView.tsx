'use client';
import { useState } from 'react';
import type { Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { M } from '../../lib/metrics';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';
import { ContratoFormModal } from './ContratoFormModal';
import { STATE_BADGE } from '../../lib/catalog';
import { money as fmtMoney, pct as fmtPct } from '../../lib/format';

export const ContratosView = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const [contracts, setContracts] = useState<Contract[]>(Store.all('contracts'));
  const [editing, setEditing] = useState<Partial<Contract> | null>(null);
  
  // Basic filter state
  const [q, setQ] = useState('');
  
  const filtered = contracts.filter(c => {
    const num = c.numero || c.num || '';
    const obj = c.objeto || c.obj || '';
    return !q || num.toLowerCase().includes(q.toLowerCase()) || obj.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <div className="ph">
        <div>
          <h1>Contratos</h1>
          <p>Registro maestro de contratos</p>
        </div>
        <div className="ph-actions">
          <button className="btn ghost"><Icon name="file-contract"/> Exportar XLSX</button>
          <button className="btn pri" onClick={() => setEditing({})}><Icon name="plus"/> Nuevo Contrato</button>
        </div>
      </div>
      
      <div className="filters mb">
        <div className="gsearch">
          <Icon name="search"/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contrato..." />
        </div>
        <div className="f">
          <select><option value="">Estado</option><option value="Activo">Activo</option></select>
        </div>
        <div className="f">
          <select><option value="">Empresa</option></select>
        </div>
      </div>

      <div className="panel">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Sem</th>
                <th>Número</th>
                <th>Empresa</th>
                <th>Objeto</th>
                <th>Estado</th>
                <th className="num">Valor Act.</th>
                <th>Avance Fin.</th>
                <th>Días Rest.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 12).map(c => {
                const metrics = M(c.id);
                // Rail class depends on sem, simple mapping for demo
                const rail = metrics.sem === 'ok' ? 'var(--ok)' : 'var(--warn)';
                const co = Store.get('companies', c.companyId || c.company || '');
                const num = c.numero || c.num || '';
                const obj = c.objeto || c.obj || '';
                const st = c.estado || c.status || '';
                return (
                  <tr key={c.id} className="rail" style={{ '--railc': rail } as any}>
                    <td><div className={`sem ${metrics.sem}`}></div></td>
                    <td><a className="link" onClick={() => onSelect(c.id)}>{num}</a></td>
                    <td>{co?.razon || co?.name || '—'}</td>
                    <td><div className="clip">{obj}</div></td>
                    <td><Badge text={st} color={st === 'Activo' ? 'ok' : 'na'} /></td>
                    <td className="num">{fmtMoney(metrics.valAct)}</td>
                    <td>
                      <div className="pbar"><div className="bar"><i style={{width: fmtPct(metrics.pExecFin)}}></i></div><span>{fmtPct(metrics.pExecFin)}</span></div>
                    </td>
                    <td>{metrics.daysLeft}</td>
                    <td>
                      <div className="acts">
                        <button className="icon-btn" onClick={() => setEditing(c)} title="Editar"><Icon name="cog"/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={9} className="empty">No se encontraron contratos</td></tr>}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={9}>
                    <div className="tbl-foot">
                      <span>Mostrando {Math.min(filtered.length, 12)} de {filtered.length}</span>
                      <div className="pager">
                        <button disabled>&lt;</button>
                        <button className="on">1</button>
                        <button disabled>&gt;</button>
                      </div>
                    </div>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editing && <ContratoFormModal contract={editing} onClose={() => { setEditing(null); setContracts(Store.all('contracts')); }} />}
    </div>
  );
};
