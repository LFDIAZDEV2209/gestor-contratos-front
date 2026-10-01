'use client';
import { Kpi } from '../ui/Kpi';

export const DashboardView = () => {
  return (
    <div>
      <div className="ph">
        <div>
          <h1>Panel de Control</h1>
          <p>Resumen general del portafolio</p>
        </div>
      </div>
      <div className="kpis mb">
        <Kpi label="Contratos Activos" value="12" sub="2 en riesgo" color="ok" />
        <Kpi label="Presupuesto" value="$1.5B" sub="Ejecutado: 45%" />
        <Kpi label="Alertas" value="5" color="crit" />
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Resumen</h3></div>
        <div className="panel-b">
          Gráficas y tablas aquí.
        </div>
      </div>
    </div>
  );
};
