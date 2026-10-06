'use client';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';

// Registro completo de elementos, controladores, escalas y plugins de Chart.js
ChartJS.register(...registerables);

// Configuración de tipografía y colores institucionales por defecto
ChartJS.defaults.font.family = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#607284';
ChartJS.defaults.plugins.tooltip.backgroundColor = '#062F58';
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleFont = { size: 12, weight: 'bold' };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 11.5 };

interface ChartProps {
  type?: 'bar' | 'line' | 'doughnut' | 'pie';
  data?: any;
  options?: any;
  height?: number | string;
  /** Nombre accesible del gráfico; si falta se genera uno desde título y datos. */
  ariaLabel?: string;
  config?: {
    type: 'bar' | 'line' | 'doughnut' | 'pie';
    data: any;
    options?: any;
  };
}

const TIPOS: Record<string, string> = { bar: 'barras', line: 'líneas', doughnut: 'dona', pie: 'torta' };

// Resumen textual para lectores de pantalla: tipo, título y primeras categorías con su valor.
function describeChart(type: string, data: any, options: any): string {
  const title = options?.plugins?.title?.text;
  const labels: unknown[] = data?.labels ?? [];
  const ds = data?.datasets?.[0];
  const parts = labels.slice(0, 6).map((l, i) => `${String(l)}: ${ds?.data?.[i] ?? '—'}`);
  const more = labels.length > 6 ? ` y ${labels.length - 6} más` : '';
  return `Gráfico de ${TIPOS[type] ?? type}${title ? ` · ${Array.isArray(title) ? title.join(' ') : title}` : ''}${parts.length ? `. ${parts.join('; ')}${more}` : ''}`;
}

export const Chart = ({ type, data, options, height, config, ariaLabel }: ChartProps) => {
  if (typeof document !== 'undefined') ChartJS.defaults.font.family = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif';
  const chartType = config?.type || type || 'bar';
  const chartData = config?.data || data;
  const chartOptions = config?.options || options;

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: chartType === 'pie' || chartType === 'doughnut' || chartData?.datasets?.some((dataset: { label?: string }) => Boolean(dataset.label)),
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 14,
          font: { size: 11, weight: 'normal' as const },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    }
  };

  const mergedOptions = { ...defaultOptions, ...chartOptions, animation: false };

  const a11y = { role: 'img' as const, 'aria-label': ariaLabel || describeChart(chartType, chartData, chartOptions) };

  return (
    <div style={{ position: 'relative', width: '100%', height: height || '100%' }}>
      {chartType === 'bar' && <Bar data={chartData} options={mergedOptions} {...a11y} />}
      {chartType === 'line' && <Line data={chartData} options={mergedOptions} {...a11y} />}
      {chartType === 'doughnut' && <Doughnut data={chartData} options={mergedOptions} {...a11y} />}
      {chartType === 'pie' && <Pie data={chartData} options={mergedOptions} {...a11y} />}
    </div>
  );
};
