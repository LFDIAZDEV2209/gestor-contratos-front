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
import { GarantiasView } from '../views/GarantiasView';
import { AseguradorasView } from '../views/AseguradorasView';
import { DocumentosView } from '../views/DocumentosView';
import { ActasView } from '../views/ActasView';
import { ModificacionesView } from '../views/ModificacionesView';
import { AlertasView } from '../views/AlertasView';
import { RiesgosView } from '../views/RiesgosView';
import { IncumplimientosView } from '../views/IncumplimientosView';
import { AuditoriaView } from '../views/AuditoriaView';
import { ReportesView } from '../views/ReportesView';
import { ConfiguracionView } from '../views/ConfiguracionView';
import { Store } from '../../lib/store';
import { Seed } from '../../lib/demo';

export const AppShell = () => {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState('dash');
  const [selectedId, setSelectedId] = useState('');
  const [selectedTab, setSelectedTab] = useState<string | undefined>();
  const [userTick, setUserTick] = useState(0);

  useEffect(() => {
    Store.init(Seed.build());
    setMounted(true);

    // Hash routing sync
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('contrato/')) {
        const parts = hash.split('/');
        setView('contrato');
        setSelectedId(parts[1]);
        if (parts[2]) setSelectedTab(parts[2]);
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

  const navigate = (v: string, id?: string, tab?: string) => {
    setView(v);
    setSelectedTab(tab);
    if (id) {
      setSelectedId(id);
      if (v === 'contrato') {
        window.location.hash = tab ? `contrato/${id}/${tab}` : `contrato/${id}`;
      } else if (v === 'empresa') {
        window.location.hash = `empresa/${id}`;
      }
    } else {
      window.location.hash = v;
    }
  };

  return (
    <div className="app" key={`app-root-${userTick}`}>
      <Sidebar current={view} onNavigate={(v, id) => navigate(v, id)} />
      <main className="main">
        <Header
          onSelectContract={(cid, tab) => navigate('contrato', cid, tab)}
          onSelectCompany={(cid) => navigate('empresa', cid)}
          onNavigate={(v, filter) => navigate(v, filter)}
          onUserChanged={() => setUserTick((t) => t + 1)}
        />
        <div className="content">
          {view === 'dash' && (
            <DashboardView
              onSelectContract={(cid, tab) => navigate('contrato', cid, tab)}
              onNavigate={(v, filter) => navigate(v, filter)}
            />
          )}
          {view === 'gerencia' && (
            <GerenciaView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'agenda' && (
            <AgendaView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'calendario' && (
            <CalendarioView onSelectContract={(cid, tab) => navigate('contrato', cid, tab)} />
          )}

          {view === 'empresas' && (
            <EmpresasView onSelect={(id) => navigate('empresa', id)} />
          )}
          {view === 'empresa' && (
            <EmpresaView id={selectedId} onBack={() => navigate('empresas')} />
          )}
          {(view === 'contracts' || view === 'contratos') && (
            <ContratosView onSelect={(id) => navigate('contrato', id)} />
          )}
          {view === 'contrato' && (
            <ExpedienteView
              key={`${selectedId}-${selectedTab || 'resumen'}`}
              id={selectedId}
              initialTab={selectedTab}
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
          {view === 'garantias' && (
            <GarantiasView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'aseguradoras' && (
            <AseguradorasView
              onSelectContract={(cid) => navigate('contrato', cid)}
              onNavigateToGarantias={() => navigate('garantias')}
            />
          )}
          {view === 'documentos' && (
            <DocumentosView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'actas' && (
            <ActasView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}
          {view === 'modificaciones' && (
            <ModificacionesView onSelectContract={(cid) => navigate('contrato', cid)} />
          )}

          {view === 'alertas' && (
            <AlertasView onSelectContract={(cid, tab) => navigate('contrato', cid, tab)} />
          )}
          {view === 'riesgos' && (
            <RiesgosView onSelectContract={(cid, tab) => navigate('contrato', cid, tab)} />
          )}
          {view === 'incumplimientos' && (
            <IncumplimientosView onSelectContract={(cid, tab) => navigate('contrato', cid, tab)} />
          )}
          {view === 'auditoria' && (
            <AuditoriaView
              onSelectContract={(cid, tab) => navigate('contrato', cid, tab)}
              onOpenUserSwitcher={() => {}}
            />
          )}
          {view === 'reportes' && <ReportesView />}
          {(view === 'configuracion' || view === 'settings') && (
            <ConfiguracionView
              onNavigateToEmpresas={() => navigate('empresas')}
              onOpenCompany={(cid) => navigate('empresa', cid)}
            />
          )}
        </div>
      </main>
    </div>
  );
};
