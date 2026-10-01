'use client';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../views/DashboardView';
import { Store } from '../../lib/store';
import { Seed } from '../../lib/demo';

export const AppShell = () => {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('dash');

  useEffect(() => {
    Store.init(Seed.build());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="app">
      <Sidebar current={view} onNavigate={setView} />
      <main className="main">
        <Header />
        <div className="content">
          {view === 'dash' && <DashboardView />}
          {view !== 'dash' && <div>Vista en construcción: {view}</div>}
        </div>
      </main>
    </div>
  );
};
