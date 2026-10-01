'use client';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { DashboardView } from '../views/DashboardView';
import { EmpresasView } from '../views/EmpresasView';
import { EmpresaView } from '../views/EmpresaView';
import { ContratosView } from '../views/ContratosView';
import { ExpedienteView } from '../views/ExpedienteView';
import { GerenciaView } from '../views/GerenciaView';
import { AgendaView } from '../views/AgendaView';
import { CalendarioView } from '../views/CalendarioView';
import { SubcontratosView } from '../views/SubcontratosView';
import { ObligacionesView } from '../views/ObligacionesView';
import { EjecucionView } from '../views/EjecucionView';
import { PagosView } from '../views/PagosView';
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
      } else if (hash.startsWith('empresa/')) {
        setView('empresa');
        setSelectedId(hash.split('/')[1]);
      } else if (hash) {
        setView(hash);
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
      if (v === 'empresa') window.location.hash = `empresa/${id}`;
    } else {
      window.location.hash = v;
    }
  };

  return (
    <div className="app">
      <Sidebar current={view} onNavigate={navigate} />
      <main className="main">
        <Header />
        <div className="content">
          {view === 'dash' && <DashboardView />}
          {view === 'gerencia' && <GerenciaView onSelectContract={(cid) => navigate('contrato', cid)} />}
          {view === 'agenda' && <AgendaView onSelectContract={(cid) => navigate('contrato', cid)} />}
          {view === 'calendario' && <CalendarioView onSelectContract={(cid) => navigate('contrato', cid)} />}

          {view === 'empresas' && <EmpresasView onSelect={(id) => navigate('empresa', id)} />}
          {view === 'empresa' && <EmpresaView id={selectedId} onBack={() => navigate('empresas')} />}
          {(view === 'contracts' || view === 'contratos') && (
            <ContratosView onSelect={(id) => navigate('contrato', id)} />
          )}
          {view === 'contrato' && (
            <ExpedienteView
              id={selectedId}
              onBack={() => navigate('contratos')}
              onOpenCompany={(cid) => navigate('empresa', cid)}
            />
          )}

          {view === 'subcontratos' && (
            <SubcontratosView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'obligaciones' && (
            <ObligacionesView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'ejecucion' && (
            <EjecucionView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'pagos' && (
            <PagosView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
        </div>
      </main>
    </div>
  );
};
