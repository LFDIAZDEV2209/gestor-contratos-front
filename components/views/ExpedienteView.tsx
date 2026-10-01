'use client';
import { useState } from 'react';
import { Store } from '../../lib/store';
import { M } from '../../lib/metrics';
import { money, pct } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { Icon } from '../icons';

import { TabResumen } from '../expediente/TabResumen';
import { TabInformacion } from '../expediente/TabInformacion';
import { TabDocumentos } from '../expediente/TabDocumentos';
import { TabObligaciones } from '../expediente/TabObligaciones';
import { TabEntregables } from '../expediente/TabEntregables';
import { TabEjecucion } from '../expediente/TabEjecucion';
import { TabPagos } from '../expediente/TabPagos';
import { TabGarantias } from '../expediente/TabGarantias';
import { TabActas } from '../expediente/TabActas';
import { TabModificaciones } from '../expediente/TabModificaciones';
import { TabSuspensiones } from '../expediente/TabSuspensiones';
import { TabProrrogas } from '../expediente/TabProrrogas';
import { TabRiesgos } from '../expediente/TabRiesgos';
import { TabIncumplimientos } from '../expediente/TabIncumplimientos';
import { TabSubcontratos } from '../expediente/TabSubcontratos';
import { TabAuditoria } from '../expediente/TabAuditoria';
import { TabTimeline } from '../expediente/TabTimeline';

const TABS = [
  'Resumen', 'Información', 'Documentos', 'Obligaciones', 'Entregables', 'Ejecución',
  'Pagos', 'Garantías', 'Actas', 'Modificaciones', 'Suspensiones', 'Prórrogas',
  'Riesgos', 'Incumplimientos', 'Subcontratos', 'Auditoría', 'Línea de Tiempo'
];

export const ExpedienteView = ({ id, onBack }: { id: string, onBack: () => void }) => {
  const [activeTab, setActiveTab] = useState('Resumen');
  const c = Store.get('contracts', id);
  if (!c) return <div>Contrato no encontrado</div>;

  const m = M(id);
  const company = Store.get('companies', c.company);

  return (
    <div>
      <div className="crumb"><a onClick={onBack}>Contratos</a> / Expediente</div>
      
      <div className="exp-head" style={{ '--railc': `var(--${m.sem})` } as any}>
        <div className="exp-top">
          <div className="exp-num">
            {c.num}
            <Badge text={c.status} color={c.status === 'Activo' ? 'ok' : 'na'} />
            <div className={`semtag ${m.sem}`}><div className={`sem ${m.sem}`}></div> {m.sem.toUpperCase()}</div>
          </div>
          <div className="ph-actions">
            <button className="btn ghost"><Icon name="cog"/> Editar</button>
            <button className="btn pri"><Icon name="check-circle"/> Validar Contrato</button>
          </div>
        </div>
        <div className="exp-obj">{c.obj}</div>
        
        <div className="exp-meta">
          <div><span>Contratista</span><b>{company?.name}</b></div>
          <div><span>Valor Actualizado</span><b>{money(m.valAct)}</b></div>
          <div><span>Saldo</span><b>{money(m.saldo)}</b></div>
          <div><span>Días Restantes</span><b>{m.daysLeft} días</b></div>
        </div>
        
        <div className="pbar mt-4">
          <div className="bar lg"><i style={{width: pct(m.pExecFin)}}></i></div>
          <span>Financiera: {pct(m.pExecFin)}</span>
        </div>
      </div>

      <div className="tabs mb">
        {TABS.map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'on' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      <div className="tab-content mt-4">
        {activeTab === 'Resumen' && <TabResumen cid={id} />}
        {activeTab === 'Información' && <TabInformacion cid={id} />}
        {activeTab === 'Documentos' && <TabDocumentos cid={id} />}
        {activeTab === 'Obligaciones' && <TabObligaciones cid={id} />}
        {activeTab === 'Entregables' && <TabEntregables cid={id} />}
        {activeTab === 'Ejecución' && <TabEjecucion cid={id} />}
        {activeTab === 'Pagos' && <TabPagos cid={id} />}
        {activeTab === 'Garantías' && <TabGarantias cid={id} />}
        {activeTab === 'Actas' && <TabActas cid={id} />}
        {activeTab === 'Modificaciones' && <TabModificaciones cid={id} />}
        {activeTab === 'Suspensiones' && <TabSuspensiones cid={id} />}
        {activeTab === 'Prórrogas' && <TabProrrogas cid={id} />}
        {activeTab === 'Riesgos' && <TabRiesgos cid={id} />}
        {activeTab === 'Incumplimientos' && <TabIncumplimientos cid={id} />}
        {activeTab === 'Subcontratos' && <TabSubcontratos cid={id} />}
        {activeTab === 'Auditoría' && <TabAuditoria cid={id} />}
        {activeTab === 'Línea de Tiempo' && <TabTimeline cid={id} />}
      </div>
    </div>
  );
};
