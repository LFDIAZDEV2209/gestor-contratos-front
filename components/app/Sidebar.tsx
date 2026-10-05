'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { viewHref } from './routes';
import { Icon } from '../icons';
import { AuthService } from '../../lib/store';
import { Alerts } from '../../lib/alerts';
import { initials } from '../../lib/format';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  current: string;
  onLinkFollow?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  current,
  onLinkFollow,
  collapsed: controlledCollapsed,
  onToggleCollapse
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(!internalCollapsed);
    }
  };

  const user = AuthService.currentUser();
  const alertsCount = Alerts.compute().filter((a) => a.estado === 'Nueva').length;

  const navSections = [
    {
      group: 'General',
      items: [
        { key: 'dash', label: 'Inicio', icon: 'home', match: ['dash', 'dashboard'] },
        { key: 'gerencia', label: 'Gerencia', icon: 'chart-pie', match: ['gerencia'] },
        { key: 'agenda', label: 'Agenda', icon: 'calendar-days', match: ['agenda'] },
        { key: 'calendario', label: 'Calendario', icon: 'calendar', match: ['calendario'] },
      ]
    },
    {
      group: 'Contratación',
      items: [
        { key: 'contratos', label: 'Contratos', icon: 'folder', match: ['contratos', 'contracts', 'contrato'] },
        { key: 'empresas', label: 'Empresas', icon: 'building', match: ['empresas', 'empresa'] },
        { key: 'subcontratos', label: 'Subcontratos', icon: 'diagram-project', match: ['subcontratos'] },
        { key: 'obligaciones', label: 'Obligaciones', icon: 'list-check', match: ['obligaciones'] },
        { key: 'ejecucion', label: 'Ejecución', icon: 'trending-up', match: ['ejecucion'] },
        { key: 'pagos', label: 'Pagos', icon: 'dollar-sign', match: ['pagos'] },
        { key: 'garantias', label: 'Garantías', icon: 'shield', match: ['garantias'] },
        { key: 'aseguradoras', label: 'Aseguradoras / Cupos', icon: 'umbrella', match: ['aseguradoras'] },
        { key: 'documentos', label: 'Documentos', icon: 'file-text', match: ['documentos'] },
        { key: 'actas', label: 'Actas', icon: 'file-signature', match: ['actas'] },
        { key: 'modificaciones', label: 'Modificaciones', icon: 'edit', match: ['modificaciones'] },
      ]
    },
    {
      group: 'Control',
      items: [
        { key: 'alertas', label: 'Alertas', icon: 'alert-triangle', match: ['alertas'], count: alertsCount },
        { key: 'riesgos', label: 'Riesgos', icon: 'shield-alert', match: ['riesgos'] },
        { key: 'incumplimientos', label: 'Incumplimientos', icon: 'alert-circle', match: ['incumplimientos'] },
        { key: 'auditoria', label: 'Auditoría', icon: 'history', match: ['auditoria'] },
        { key: 'reportes', label: 'Reportes (19)', icon: 'file-chart', match: ['reportes'] },
      ]
    },
    {
      group: 'Sistema',
      items: [
        { key: 'configuracion', label: 'Configuración', icon: 'cog', match: ['configuracion', 'settings'] },
      ]
    }
  ];

  return (
    <aside
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      aria-label="Navegación principal"
      style={isCollapsed ? { width: 68 } : { width: 260 }}
    >
      {/* Header del Sidebar */}
      <div className="brand" style={{ padding: isCollapsed ? '16px 12px' : '16px 18px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        <Link
          className={`sidebar-brand-link${isCollapsed ? ' sidebar-brand-link--compact' : ''}`}
          href="/dashboard"
          onClick={onLinkFollow}
          title="Seven Safe · Gestión integral de contratos"
          style={{ cursor: 'pointer' }}
        >
          <BrandLogo compact={isCollapsed} />
        </Link>

        {!isCollapsed && (
          <span className="sr-only">Seven Safe · Gestión de contratos</span>
        )}

        <button
          className="side-collapse-btn"
          onClick={handleToggle}
          title={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          style={isCollapsed ? { position: 'absolute', right: 4, top: 4, width: 20, height: 20 } : {}}
        >
          <Icon name={isCollapsed ? 'chevron-right' : 'chevron-left'} />
        </button>
      </div>

      {/* Contenido con scroll estilizado */}
      <div className="sidebar-scroll">
        <nav className="nav" style={{ padding: isCollapsed ? '10px 6px' : '10px 10px 20px' }}>
          {navSections.map((section) => (
            <div key={section.group}>
              {!isCollapsed && <div className="nav-g">{section.group}</div>}
              {isCollapsed && <div style={{ height: 1, background: 'var(--side-line)', margin: '8px 4px' }} />}

              {section.items.map((item) => {
                const isActive = item.match.includes(current);
                return (
                  <Link
                    key={item.key}
                    className={isActive ? 'on' : ''}
                    href={viewHref(item.key)}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onLinkFollow}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    style={{
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      padding: isCollapsed ? '0' : '0 10px',
                    }}
                  >
                    <div className="nav-icon">
                      <Icon name={item.icon} />
                    </div>

                    {!isCollapsed && <span>{item.label}</span>}

                    {item.count != null && item.count > 0 && (
                      <span
                        className="cnt"
                        style={isCollapsed ? {
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          minWidth: 16,
                          height: 16,
                          padding: '0 4px',
                          fontSize: '9.5px',
                        } : {}}
                      >
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer del Sidebar con tarjeta de usuario y crédito sin recortes */}
      <div className="side-foot" style={{ padding: isCollapsed ? '10px 6px' : '12px 14px' }}>
        <Link
          className="side-user-card"
          href="/configuracion"
          onClick={onLinkFollow}
          title={isCollapsed ? `${user?.nombre || 'Usuario'} · ${user?.rol || 'Rol'}` : 'Ver perfil / configuración'}
          style={isCollapsed ? { justifyContent: 'center', padding: '6px' } : {}}
        >
          <div className="side-user-avatar">
            {initials(user?.nombre || 'AD')}
          </div>

          {!isCollapsed && (
            <>
              <div className="side-user-info">
                <div className="side-user-name">{user?.nombre || 'Usuario'}</div>
                <div className="side-user-role">{user?.rol || 'Administrador'}</div>
              </div>
              <div style={{ color: 'var(--side-ink)', fontSize: '11px', opacity: 0.7 }}>
                <Icon name="chevron-right" />
              </div>
            </>
          )}
        </Link>

        {!isCollapsed && (
          <div className="side-brand-credit">
            <span>Seven Safe v2.0</span>
            <span style={{ fontSize: '10px', color: 'var(--brand)', fontWeight: 600 }}>FYA TECH</span>
          </div>
        )}
      </div>
    </aside>
  );
};
