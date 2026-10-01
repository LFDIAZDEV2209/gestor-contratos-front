'use client';
import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Store } from '../../lib/store';
import { WorkspaceSkeleton } from '../ui/Workspace';
import { FeedbackHost } from '../ui/Feedback';
import { SessionRevision } from './SessionContext';

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  const [userRevision, setUserRevision] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (mobileOpen) {
        document.body.classList.add('side-open');
      } else {
        document.body.classList.remove('side-open');
      }
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const main = document.querySelector<HTMLElement>('.main');
    const previous = document.activeElement as HTMLElement | null;
    if (main) main.inert = true;
    const focusTimer = window.setTimeout(() => sidebar?.querySelector<HTMLElement>('a[aria-current="page"],a[href]')?.focus(), 200);
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab' || !sidebar) return;
      const items = Array.from(sidebar.querySelectorAll<HTMLElement>('a[href],button')).filter(el=>el.offsetParent !== null);
      const first = items[0], last = items[items.length-1];
      if (!sidebar.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { window.clearTimeout(focusTimer); document.removeEventListener('keydown', trap); if(main) main.inert=false; previous?.focus(); };
  }, [mobileOpen]);


  useEffect(() => {
    Store.init();
    setMounted(true);
  }, []);
  useEffect(() => {
    setMobileOpen(false);
    document.getElementById('workspace')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  useEffect(() => () => document.body.classList.remove('side-open'), []);

  return (
    <SessionRevision.Provider value={userRevision}>
      <div className="app">
        <button className="skip-link" onClick={() => document.getElementById('workspace')?.focus()}>Saltar al contenido</button>
        {mounted ? <Sidebar current={pathname.split('/')[1]} onLinkFollow={() => setMobileOpen(false)} /> : <aside className="sidebar" aria-label="Cargando navegación"><div className="skeleton skeleton-title" /></aside>}
        {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú lateral" />}
        <main className="main">
          {mounted ? <Header
            onUserChanged={() => setUserRevision(v => v + 1)}
            onToggleMobileMenu={() => setMobileOpen(v => !v)}
          /> : <header className="header"><div className="skeleton skeleton-title" /></header>}
          <div className="content" id="workspace" tabIndex={-1}>
            {mounted ? children : <WorkspaceSkeleton />}
          </div>
        </main>
        {mounted && <FeedbackHost />}
      </div>
    </SessionRevision.Provider>
  );
};
