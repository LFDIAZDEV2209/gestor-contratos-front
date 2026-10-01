'use client';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';

// Registro completo de elementos, controladores, escalas y plugins de Chart.js
ChartJS.register(...registerables);

// Configuración de tipografía y colores institucionales por defecto
ChartJS.defaults.font.family = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = '#5E6E73';
ChartJS.defaults.plugins.tooltip.backgroundColor = '#0F1C20';
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
ChartJS.defaults.plugins.tooltip.titleFont = { size: 12, weight: 'bold' };
ChartJS.defaults.plugins.tooltip.bodyFont = { size: 11.5 };

interface ChartProps {
  type?: 'bar' | 'line' | 'doughnut' | 'pie';
  data?: any;
  options?: any;
  height?: number | string;
  config?: {
    type: 'bar' | 'line' | 'doughnut' | 'pie';
    data: any;
    options?: any;
  };
}

export const Chart = ({ type, data, options, height, config }: ChartProps) => {
  const chartType = config?.type || type || 'bar';
  const chartData = config?.data || data;
  const chartOptions = config?.options || options;

  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
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

  return (
    <div style={{ position: 'relative', width: '100%', height: height || '100%' }}>
      {chartType === 'bar' && <Bar data={chartData} options={mergedOptions} />}
      {chartType === 'line' && <Line data={chartData} options={mergedOptions} />}
      {chartType === 'doughnut' && <Doughnut data={chartData} options={mergedOptions} />}
      {chartType === 'pie' && <Pie data={chartData} options={mergedOptions} />}
    </div>
  );
};
