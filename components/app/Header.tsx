'use client';
import { Input } from '../ui/Controls';

import React, { useState, useEffect, useRef } from 'react';
import { Store, AuthService } from '../../lib/store';
import { Alerts } from '../../lib/alerts';
import { activeContracts, companyName } from '../../lib/metrics';
import { fdate, todayIso, initials, money } from '../../lib/format';
import { Icon } from '../icons';
import type { User, Guarantee, Payment, Acta, Obligation, Subcontract } from '../../lib/types';

interface HeaderProps {
  onSelectContract?: (cid: string, tab?: string) => void;
  onSelectCompany?: (cid: string) => void;
  onNavigate?: (v: string, filter?: string) => void;
  onUserChanged?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectContract,
  onSelectCompany,
  onNavigate,
  onUserChanged,
  onToggleMobileMenu
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const currentUser = AuthService.currentUser();
  const db = Store.getDB();
  const allUsers: User[] = (db.users || []).filter((u) => u.estado === 'Activo');

  const allAlerts = Alerts.compute();
  const unreadAlerts = allAlerts.filter((a) => a.estado === 'Nueva');

  // Atajos de teclado: Ctrl+K / Cmd+K y Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchResults(true);
      } else if (e.key === 'Escape') {
        setShowSearchResults(false);
        setShowBellDropdown(false);
        setShowUserDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cierre de dropdowns al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
        setShowBellDropdown(false);
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 7 fuentes de búsqueda global (files/04 y prototipo HTML)
  const q = searchQuery.trim().toLowerCase();
  let searchGroups: [string, Array<{ t: string; s: string; onClick: () => void }>][] = [];

  if (q.length >= 2) {
    const has = (...args: any[]) =>
      args.some((a) => String(a || '').toLowerCase().includes(q));

    const gContracts = activeContracts()
      .filter((c) =>
        has(
          c.numero,
          c.nitContratista,
          c.contratista,
          c.objeto,
          c.responsable,
          c.supervisor,
          companyName(c.companyId)
        )
      )
      .map((c) => ({
        t: `${c.numero} · ${c.contratista}`,
        s: c.objeto || '',
        onClick: () => {
          onSelectContract?.(c.id);
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gCompanies = Store.all('companies')
      .filter((c) => has(c.razon, c.nit, (c as any).rep))
      .map((c) => ({
        t: c.razon || (c as any).name,
        s: `NIT ${c.nit}`,
        onClick: () => {
          onSelectCompany?.(c.id);
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gSubs = Store.all('subcontracts')
      .filter((s: Subcontract) => has(s.numero, s.contratista, s.nit, s.objeto))
      .map((s: Subcontract) => ({
        t: `${s.numero} · ${s.contratista}`,
        s: s.objeto || '',
        onClick: () => {
          onSelectContract?.(s.contractId, 'subcontratos');
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gGars = Store.all('guarantees')
      .filter((g: Guarantee) => has(g.poliza, g.aseguradora, g.tipo))
      .map((g: Guarantee) => ({
        t: `Póliza ${g.poliza}`,
        s: `${g.tipo} · ${g.aseguradora}`,
        onClick: () => {
          onSelectContract?.(g.contractId, 'garantias');
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gPays = Store.all('payments')
      .filter((p: Payment) => has(p.factura, p.numero, p.concepto))
      .map((p: Payment) => ({
        t: `${p.factura || p.numero} · ${p.concepto}`,
        s: `${money(p.neto)} · ${p.estado}`,
        onClick: () => {
          onSelectContract?.(p.contractId, 'pagos');
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gActas = Store.all('actas')
      .filter((a: Acta) => has(a.numero, a.tipo, a.descripcion))
      .map((a: Acta) => ({
        t: `${a.tipo} ${a.numero}`,
        s: fdate(a.fecha),
        onClick: () => {
          onSelectContract?.(a.contractId, 'actas');
          setShowSearchResults(false);
          setSearchQuery('');
        }
      }));

    const gObls = Store.all('obligations')
      .filter((o: Obligation) => has(o.descripcion, o.responsable))
      .map((o: Obligation) => {
        const c = Store.get('contracts', o.contractId);
        return {
          t: o.descripcion,
          s: c ? `Contrato ${c.numero}` : '',
          onClick: () => {
            onSelectContract?.(o.contractId, 'obligaciones');
            setShowSearchResults(false);
            setSearchQuery('');
          }
        };
      });

    searchGroups = [
      ['Contratos', gContracts],
      ['Empresas', gCompanies],
      ['Subcontratos', gSubs],
      ['Garantías (pólizas)', gGars],
      ['Pagos (facturas)', gPays],
      ['Actas', gActas],
      ['Obligaciones', gObls]
    ].filter((g) => (g[1] as any[]).length > 0) as any;
  }

  const markAllRead = () => {
    unreadAlerts.forEach((a) => Alerts.setState(a.key, { estado: 'Leída' }));
    setShowBellDropdown(false);
    onUserChanged?.();
  };

  const handleSwitchUser = (userId: string) => {
    AuthService.setCurrentUser(userId);
    setShowUserDropdown(false);
    onUserChanged?.();
  };

  return (
    <header className="header" ref={headerRef}>
      {/* Botón de menú responsive */}
      <button
        className="menu-btn icon-btn"
        aria-label="Abrir menú de navegación"
        onClick={onToggleMobileMenu}
      >
        <Icon name="bars" />
      </button>

      {/* Buscador global con atajo Ctrl+K y chip visual */}
      <div className="gsearch">
        <Icon name="search" />
        <Input
          ref={searchInputRef}
          type="search"
          placeholder="Buscar contrato, NIT, contratista, póliza, factura, acta... (Ctrl+K)"
          autoComplete="off"
          aria-label="Buscador global"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSearchResults(true);
          }}
          onFocus={() => {
            if (searchQuery.trim().length >= 2) setShowSearchResults(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const first = searchGroups[0]?.[1]?.[0];
              if (first) first.onClick();
            }
          }}
        />
        <kbd className="kbd-chip">Ctrl K</kbd>

        {/* Dropdown de resultados de búsqueda */}
        {showSearchResults && q.length >= 2 && (
          <div className="dropdown left" style={{ maxHeight: 420 }}>
            {searchGroups.length === 0 ? (
              <div className="empty" style={{ padding: '20px 16px', fontSize: '13px' }}>
                Sin resultados para «{searchQuery}». Prueba con número de contrato, NIT, póliza o factura.
              </div>
            ) : (
              searchGroups.map(([groupName, items]) => (
                <div key={groupName}>
                  <div className="dd-g">
                    {groupName} ({items.length})
                  </div>
                  {items.slice(0, 5).map((r, idx) => (
                    <div
                      key={idx}
                      className="dd-i"
                      onClick={r.onClick}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>
                        {r.t}
                      </div>
                      <div
                        className="clip"
                        style={{
                          fontSize: '11.5px',
                          color: 'var(--muted)',
                          marginTop: 2
                        }}
                      >
                        {r.s}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="hsp" />
      <div className="hdate" style={{ marginRight: 8 }}>
        {fdate(todayIso())}
      </div>

      {/* Campana de Notificaciones con badge pop */}
      <div style={{ position: 'relative' }}>
        <button
          className="hbtn icon-btn"
          aria-label="Notificaciones"
          onClick={() => {
            setShowBellDropdown(!showBellDropdown);
            setShowUserDropdown(false);
          }}
        >
          <Icon name="bell" />
          {unreadAlerts.length > 0 && (
            <span className="dot">
              {unreadAlerts.length > 99 ? '99+' : unreadAlerts.length}
            </span>
          )}
        </button>

        {showBellDropdown && (
          <div className="dropdown" style={{ width: 380, right: 0 }}>
            <div className="dd-h">
              <span>Notificaciones</span>
              {unreadAlerts.length > 0 && (
                <button
                  className="btn xs ghost"
                  onClick={markAllRead}
                  style={{ fontSize: '11.5px' }}
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {unreadAlerts.length === 0 ? (
                <div className="empty" style={{ padding: '28px 16px', fontSize: '12.5px' }}>
                  No tienes notificaciones pendientes.
                </div>
              ) : (
                unreadAlerts.slice(0, 8).map((a) => (
                  <div
                    key={a.key}
                    className={`dd-i alert-line lv-${a.nivel}`}
                    onClick={() => {
                      setShowBellDropdown(false);
                      if (a.contractId) onSelectContract?.(a.contractId);
                      else onNavigate?.('alertas');
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="t" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                        {a.tipo} · {a.numero}
                      </div>
                      <div className="d" style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: 2 }}>
                        {a.descripcion}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              className="dd-i"
              style={{
                padding: '11px',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--brand)',
                fontSize: '12.5px',
                borderTop: '1px solid var(--line)'
              }}
              onClick={() => {
                setShowBellDropdown(false);
                onNavigate?.('alertas');
              }}
            >
              Ir al centro de alertas →
            </div>
          </div>
        )}
      </div>

      {/* Selector de Usuario / Simulación de Login con indicador online */}
      <div style={{ position: 'relative' }}>
        <div
          className="user"
          onClick={() => {
            setShowUserDropdown(!showUserDropdown);
            setShowBellDropdown(false);
          }}
          title="Cambiar de usuario (simulación de login)"
          aria-label="Perfil de usuario"
        >
          <div className="avatar">
            {initials(currentUser?.nombre || 'AD')}
            <span className="avatar-status-dot" title="En línea" />
          </div>
          <div>
            <div className="user-n">
              {currentUser?.nombre || 'Usuario'}
            </div>
            <div className="user-r">
              {currentUser?.rol || 'Rol'}
            </div>
          </div>
          <Icon name="chevron-down" style={{ width: 12, height: 12, color: 'var(--muted)', marginLeft: 2 }} />
        </div>

        {/* Dropdown de cambio de usuario */}
        {showUserDropdown && (
          <div className="dropdown" style={{ width: 300, right: 0 }}>
            <div className="dd-h">
              <span>Cambiar usuario</span>
              <span className="badge b-info" style={{ fontSize: '9.5px' }}>
                Simulación
              </span>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {allUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                return (
                  <div
                    key={u.id}
                    className="dd-i"
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      backgroundColor: isCurrent ? 'var(--surface-hover)' : '#FFFFFF'
                    }}
                    onClick={() => handleSwitchUser(u.id)}
                  >
                    <div
                      className="avatar"
                      style={{
                        width: 28,
                        height: 28,
                        fontSize: '11px',
                      }}
                    >
                      {initials(u.nombre)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: isCurrent ? 700 : 500, fontSize: '12.5px', color: 'var(--ink)' }}>
                        {u.nombre}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {u.rol}
                      </div>
                    </div>
                    {isCurrent && <Icon name="check" style={{ color: 'var(--brand)', width: 14, height: 14 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
