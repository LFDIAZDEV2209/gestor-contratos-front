'use client';
import type { Company, Contract } from '../../lib/types';
import { Store } from '../../lib/store';
import { Icon } from '../icons';
import { Kpi } from '../ui/Kpi';
import { money, pct } from '../../lib/format';

export const EmpresaView = ({ id, onBack }: { id: string, onBack: () => void }) => {
  const company = Store.get('companies', id) as Company | undefined;
  const contracts = Store.all('contracts').filter(c => c.company === id || c.companyId === id);
  
  if (!company) return <div>Empresa no encontrada</div>;

  const activeContracts = contracts.filter(c => c.status === 'Activo' || c.estado === 'Activo').length;
  const totalVal = contracts.reduce((a, b) => a + (Number(b.val ?? b.valorBase ?? 0)), 0);

  return (
    <div>
      <div className="crumb"><a onClick={onBack}>Empresas</a> / Ficha</div>
      <div className="ph">
        <div>
          <h1>{company.razon || company.name}</h1>
          <p>NIT: {company.nit} | Rep: {company.rep || '—'}</p>
        </div>
      </div>

      <div className="kpis mb">
        <Kpi label="Contratos Activos" value={activeContracts.toString()} color="ok" />
        <Kpi label="Valor Histórico" value={money(totalVal)} />
        <Kpi label="Ejecución Promedio" value={pct(65)} color="info" />
      </div>

      <div className="grid g2">
        <div className="panel">
          <div className="panel-h"><h3>Información General</h3></div>
          <div className="panel-b np">
            <div className="dl">
              <div><span>Razón Social</span><b>{company.razon || company.name}</b></div>
              <div><span>NIT</span><b>{company.nit}</b></div>
              <div><span>Tipo</span><b>{company.tipo || company.type || '—'}</b></div>
              <div><span>Representante</span><b>{company.rep || '—'}</b></div>
              <div><span>Estado</span><b>{company.estado || company.status || '—'}</b></div>
              <div><span>Nivel de Riesgo</span><b>{company.level || '1'}</b></div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-h"><h3>Valor por Contrato</h3></div>
          <div className="panel-b">
            {/* Simple horizontal bars */}
            {contracts.map(c => {
              const val = Number(c.val ?? c.valorBase ?? 0);
              const num = c.num ?? c.numero ?? c.id;
              return (
                <div key={c.id} className="mb">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{num}</span><span>{money(val)}</span>
                  </div>
                  <div className="bar lg"><i style={{ width: Math.max(10, (val / (totalVal || 1)) * 100) + '%' }}></i></div>
                </div>
              );
            })}
            {contracts.length === 0 && <div className="empty">No hay datos</div>}
          </div>
        </div>
      </div>

      <div className="panel mt-4">
        <div className="panel-h"><h3>Estructura de Contratos</h3></div>
        <div className="tree">
          <ul>
            <li>
              <div className="node co"><Icon name="folder"/> {company.name}</div>
              <ul>
                {contracts.map(c => (
                  <li key={c.id}>
                    <div className="node">
                      <Icon name="file-contract"/> {c.num} - {c.obj}
                    </div>
                    {/* Subcontracts would render here if mapped */}
                  </li>
                ))}
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
