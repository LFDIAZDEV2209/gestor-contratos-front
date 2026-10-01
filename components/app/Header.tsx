'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Store, AuthService } from '../../lib/store';
import { Alerts } from '../../lib/alerts';
import { activeContracts, companyName } from '../../lib/metrics';
import { fdate, todayIso, initials, money } from '../../lib/format';
import { ALV } from '../../lib/catalog';
import { Icon } from '../icons';
import type { User, Contract, Guarantee, Payment, Acta, Obligation, Subcontract } from '../../lib/types';

interface HeaderProps {
  onSelectContract?: (cid: string, tab?: string) => void;
  onSelectCompany?: (cid: string) => void;
  onNavigate?: (v: string, filter?: string) => void;
  onUserChanged?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectContract,
  onSelectCompany,
  onNavigate,
  onUserChanged
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
    <header className="header" ref={headerRef} style={{ position: 'relative' }}>
      <button className="menu-btn icon-btn" aria-label="Menú">
        <Icon name="bars" />
      </button>

      {/* Buscador global con atajo Ctrl+K */}
      <div className="gsearch" style={{ position: 'relative', flex: 1, maxWidth: 520 }}>
        <Icon name="search" />
        <input
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

        {/* Dropdown de resultados de búsqueda */}
        {showSearchResults && q.length >= 2 && (
          <div
            className="dropdown left"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '100%',
              maxHeight: 380,
              overflowY: 'auto',
              backgroundColor: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              zIndex: 100,
              marginTop: 4
            }}
          >
            {searchGroups.length === 0 ? (
              <div className="empty" style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                Sin resultados para «{searchQuery}». Prueba con número de contrato, NIT, póliza o factura.
              </div>
            ) : (
              searchGroups.map(([groupName, items]) => (
                <div key={groupName}>
                  <div
                    className="dd-g"
                    style={{
                      padding: '6px 12px',
                      backgroundColor: 'var(--bg-soft, #f4f6f7)',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--muted)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {groupName} ({items.length})
                  </div>
                  {items.slice(0, 5).map((r, idx) => (
                    <div
                      key={idx}
                      className="dd-i"
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border)'
                      }}
                      onClick={r.onClick}
                    >
                      <div className="strong" style={{ fontSize: '12.5px' }}>
                        {r.t}
                      </div>
                      <div
                        className="small muted clip"
                        style={{
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
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

      <div className="hsp" style={{ flex: 1 }} />
      <div className="hdate" style={{ fontSize: '12px', color: 'var(--muted)', marginRight: 10 }}>
        {fdate(todayIso())}
      </div>

      {/* Campana de Notificaciones */}
      <div style={{ position: 'relative' }}>
        <button
          className="hbtn icon-btn"
          aria-label="Notificaciones"
          onClick={() => {
            setShowBellDropdown(!showBellDropdown);
            setShowUserDropdown(false);
          }}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <Icon name="bell" />
          {unreadAlerts.length > 0 && (
            <span
              className="dot"
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                backgroundColor: 'var(--crit)',
                color: '#fff',
                fontSize: '9.5px',
                fontWeight: 700,
                borderRadius: '50%',
                padding: '1px 5px',
                lineHeight: 1
              }}
            >
              {unreadAlerts.length > 99 ? '99+' : unreadAlerts.length}
            </span>
          )}
        </button>

        {showBellDropdown && (
          <div
            className="dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: 380,
              backgroundColor: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              zIndex: 100,
              marginTop: 6
            }}
          >
            <div
              className="dd-h"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              <span>Notificaciones</span>
              {unreadAlerts.length > 0 && (
                <button
                  className="btn xs"
                  onClick={markAllRead}
                  style={{ fontSize: '11px' }}
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {unreadAlerts.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                  No tienes notificaciones pendientes.
                </div>
              ) : (
                unreadAlerts.slice(0, 8).map((a) => (
                  <div
                    key={a.key}
                    className={`dd-i alert-line lv-${a.nivel}`}
                    style={{
                      padding: '9px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start'
                    }}
                    onClick={() => {
                      setShowBellDropdown(false);
                      if (a.contractId) onSelectContract?.(a.contractId);
                      else onNavigate?.('alertas');
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div className="t" style={{ fontSize: '12px', fontWeight: 600 }}>
                        {a.tipo} · {a.numero}
                      </div>
                      <div className="d" style={{ fontSize: '11px', color: 'var(--muted)' }}>
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
                padding: '10px',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--brand-2)',
                fontSize: '12px',
                cursor: 'pointer',
                borderTop: '1px solid var(--border)'
              }}
              onClick={() => {
                setShowBellDropdown(false);
                onNavigate?.('alertas');
              }}
            >
              Ir al centro de alertas
            </div>
          </div>
        )}
      </div>

      {/* Selector de Usuario / Simulación de Login */}
      <div style={{ position: 'relative' }}>
        <div
          className="user"
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}
          onClick={() => {
            setShowUserDropdown(!showUserDropdown);
            setShowBellDropdown(false);
          }}
          title="Cambiar de usuario (simulación de login)"
        >
          <div
            className="avatar"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'var(--brand-soft)',
              color: 'var(--brand-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px'
            }}
          >
            {initials(currentUser?.nombre || 'AD')}
          </div>
          <div>
            <div className="user-n" style={{ fontSize: '12.5px', fontWeight: 600 }}>
              {currentUser?.nombre || 'Usuario'}
            </div>
            <div className="user-r" style={{ fontSize: '10.5px', color: 'var(--muted)' }}>
              {currentUser?.rol || 'Rol'}
            </div>
          </div>
        </div>

        {/* Dropdown de cambio de usuario */}
        {showUserDropdown && (
          <div
            className="dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: 290,
              backgroundColor: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
              zIndex: 100,
              marginTop: 6
            }}
          >
            <div
              className="dd-h"
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border)',
                fontWeight: 700,
                fontSize: '13px'
              }}
            >
              Cambiar de usuario{' '}
              <span className="muted small" style={{ fontWeight: 400, fontSize: '10.5px' }}>
                simulación de login
              </span>
            </div>

            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {allUsers.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                return (
                  <div
                    key={u.id}
                    className="dd-i row-flex"
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      gap: 8,
                      alignItems: 'center',
                      backgroundColor: isCurrent ? 'var(--bg-soft, #f3faf9)' : '#fff'
                    }}
                    onClick={() => handleSwitchUser(u.id)}
                  >
                    <div
                      className="avatar"
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: '10.5px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--brand-soft)',
                        color: 'var(--brand-2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700
                      }}
                    >
                      {initials(u.nombre)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="strong" style={{ fontSize: '12px' }}>
                        {u.nombre}
                      </div>
                      <div className="small muted" style={{ fontSize: '10.5px' }}>
                        {u.rol}
                      </div>
                    </div>
                    {isCurrent && <Icon name="check" />}
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
