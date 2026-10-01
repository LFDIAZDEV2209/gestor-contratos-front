'use client';
import { Icon } from '../icons';

export const Sidebar = ({
  current,
  onNavigate
}: {
  current: string;
  onNavigate: (v: string, id?: string) => void;
}) => {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">GC</div>
        <div>
          <div className="brand-t">GestorContratos</div>
          <div className="brand-s">v2.0 Next · Nexo</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-g">General</div>
        <a className={current === 'dash' || current === 'dashboard' ? 'on' : ''} onClick={() => onNavigate('dash')}>
          <Icon name="home" /> Inicio
        </a>
        <a className={current === 'gerencia' ? 'on' : ''} onClick={() => onNavigate('gerencia')}>
          <Icon name="chart-pie" /> Gerencia
        </a>
        <a className={current === 'agenda' ? 'on' : ''} onClick={() => onNavigate('agenda')}>
          <Icon name="calendar-days" /> Agenda
        </a>
        <a className={current === 'calendario' ? 'on' : ''} onClick={() => onNavigate('calendario')}>
          <Icon name="calendar" /> Calendario
        </a>

        <div className="nav-g">Contratación</div>
        <a className={current === 'contratos' || current === 'contracts' || current === 'contrato' ? 'on' : ''} onClick={() => onNavigate('contratos')}>
          <Icon name="folder" /> Contratos
        </a>
        <a className={current === 'empresas' || current === 'empresa' ? 'on' : ''} onClick={() => onNavigate('empresas')}>
          <Icon name="building" /> Empresas
        </a>
        <a className={current === 'subcontratos' ? 'on' : ''} onClick={() => onNavigate('subcontratos')}>
          <Icon name="diagram-project" /> Subcontratos
        </a>
        <a className={current === 'obligaciones' ? 'on' : ''} onClick={() => onNavigate('obligaciones')}>
          <Icon name="list-check" /> Obligaciones
        </a>
        <a className={current === 'ejecucion' ? 'on' : ''} onClick={() => onNavigate('ejecucion')}>
          <Icon name="trending-up" /> Ejecución
        </a>
        <a className={current === 'pagos' ? 'on' : ''} onClick={() => onNavigate('pagos')}>
          <Icon name="dollar-sign" /> Pagos
        </a>
        <a className={current === 'garantias' ? 'on' : ''} onClick={() => onNavigate('garantias')}>
          <Icon name="shield" /> Garantías
        </a>
        <a className={current === 'aseguradoras' ? 'on' : ''} onClick={() => onNavigate('aseguradoras')}>
          <Icon name="umbrella" /> Aseguradoras / Cupos
        </a>
        <a className={current === 'documentos' ? 'on' : ''} onClick={() => onNavigate('documentos')}>
          <Icon name="file-text" /> Documentos
        </a>
        <a className={current === 'actas' ? 'on' : ''} onClick={() => onNavigate('actas')}>
          <Icon name="file-signature" /> Actas
        </a>
        <a className={current === 'modificaciones' ? 'on' : ''} onClick={() => onNavigate('modificaciones')}>
          <Icon name="edit" /> Modificaciones
        </a>

        <div className="nav-g">Control</div>
        <a className={current === 'alertas' ? 'on' : ''} onClick={() => onNavigate('alertas')}>
          <Icon name="alert-triangle" /> Alertas
        </a>
        <a className={current === 'riesgos' ? 'on' : ''} onClick={() => onNavigate('riesgos')}>
          <Icon name="shield-alert" /> Riesgos
        </a>
        <a className={current === 'incumplimientos' ? 'on' : ''} onClick={() => onNavigate('incumplimientos')}>
          <Icon name="alert-circle" /> Incumplimientos
        </a>
        <a className={current === 'auditoria' ? 'on' : ''} onClick={() => onNavigate('auditoria')}>
          <Icon name="history" /> Auditoría
        </a>
        <a className={current === 'reportes' ? 'on' : ''} onClick={() => onNavigate('reportes')}>
          <Icon name="file-chart" /> Reportes (19)
        </a>

        <div className="nav-g">Sistema</div>
        <a className={current === 'configuracion' || current === 'settings' ? 'on' : ''} onClick={() => onNavigate('configuracion')}>
          <Icon name="cog" /> Configuración
        </a>
      </nav>
    </aside>
  );
};
