'use client';
import { Icon } from '../icons';

export const Sidebar = ({ current, onNavigate }: { current: string, onNavigate: (v: string) => void }) => {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">GC</div>
        <div>
          <div className="brand-t">GestorContratos</div>
          <div className="brand-s">v2.0 Next</div>
        </div>
      </div>
      <nav className="nav">
        <div className="nav-g">General</div>
        <a className={current === 'dash' ? 'on' : ''} onClick={() => onNavigate('dash')}><Icon name="home"/> Inicio</a>
        <div className="nav-g">Contratación</div>
        <a className={current === 'contracts' ? 'on' : ''} onClick={() => onNavigate('contracts')}><Icon name="folder"/> Contratos</a>
        <div className="nav-g">Control</div>
        <a className={current === 'risks' ? 'on' : ''} onClick={() => onNavigate('risks')}><Icon name="shield"/> Riesgos</a>
        <div className="nav-g">Sistema</div>
        <a className={current === 'settings' ? 'on' : ''} onClick={() => onNavigate('settings')}><Icon name="cog"/> Ajustes</a>
      </nav>
    </aside>
  );
};
