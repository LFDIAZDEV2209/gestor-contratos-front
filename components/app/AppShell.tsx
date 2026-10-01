'use client';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../views/DashboardView';
import { EmpresasView } from '../views/EmpresasView';
import { EmpresaView } from '../views/EmpresaView';
import { ContratosView } from '../views/ContratosView';
import { Store } from '../../lib/store';
import { Seed } from '../../lib/demo';

export const AppShell = () => {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('dash');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    Store.init(Seed.build());
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const navigate = (v: string, id?: string) => {
    setView(v);
    if (id) setSelectedId(id);
  };

  return (
    <div className="app">
      <Sidebar current={view} onNavigate={navigate} />
      <main className="main">
        <Header />
        <div className="content">
          {view === 'dash' && <DashboardView />}
          {view === 'empresas' && <EmpresasView onSelect={(id) => navigate('empresa', id)} />}
          {view === 'empresa' && <EmpresaView id={selectedId} onBack={() => navigate('empresas')} />}
          {view === 'contracts' && <ContratosView onSelect={(id) => navigate('expediente', id)} />}
          {!['dash', 'empresas', 'empresa', 'contracts'].includes(view) && <div>Vista en construcción: {view}</div>}
        </div>
      </main>
    </div>
  );
};
