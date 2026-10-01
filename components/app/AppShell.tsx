'use client';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../views/DashboardView';
import { EmpresasView } from '../views/EmpresasView';
import { EmpresaView } from '../views/EmpresaView';
import { ContratosView } from '../views/ContratosView';
import { ExpedienteView } from '../views/ExpedienteView';
import { Store } from '../../lib/store';
import { Seed } from '../../lib/demo';

export const AppShell = () => {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('dash');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    Store.init(Seed.build());
    setMounted(true);
    
    // Hash routing sync
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('contrato/')) {
        setView('contrato');
        setSelectedId(hash.split('/')[1]);
      }
    };
    window.addEventListener('hashchange', handleHash);
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (!mounted) return null;

  const navigate = (v: string, id?: string) => {
    setView(v);
    if (id) {
      setSelectedId(id);
      if (v === 'contrato') window.location.hash = `contrato/${id}`;
    }
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
          {view === 'contracts' && <ContratosView onSelect={(id) => navigate('contrato', id)} />}
          {view === 'contrato' && <ExpedienteView id={selectedId} onBack={() => navigate('contracts')} />}
        </div>
      </main>
    </div>
  );
};
