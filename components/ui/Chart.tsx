'use client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
        labels: { boxWidth: 12, font: { size: 11 } }
      }
    }
  };

  const mergedOptions = { ...defaultOptions, ...chartOptions };

  return (
    <div style={{ position: 'relative', width: '100%', height: height || '100%' }}>
      {chartType === 'bar' && <Bar data={chartData} options={mergedOptions} />}
      {chartType === 'line' && <Line data={chartData} options={mergedOptions} />}
      {chartType === 'doughnut' && <Doughnut data={chartData} options={mergedOptions} />}
      {chartType === 'pie' && <Pie data={chartData} options={mergedOptions} />}
    </div>
  );
};
