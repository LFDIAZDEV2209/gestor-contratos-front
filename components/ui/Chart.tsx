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
  type: 'bar' | 'line' | 'doughnut' | 'pie';
  data: any;
  options?: any;
  height?: number | string;
}

export const Chart = ({ type, data, options, height }: ChartProps) => {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, font: { size: 11 } }
      }
    },
    ...options
  };

  const style = height ? { height } : { height: '100%', minHeight: 220 };

  return (
    <div style={style} className="w-full relative">
      {type === 'bar' && <Bar data={data} options={defaultOptions} />}
      {type === 'line' && <Line data={data} options={defaultOptions} />}
      {type === 'doughnut' && <Doughnut data={data} options={defaultOptions} />}
      {type === 'pie' && <Pie data={data} options={defaultOptions} />}
    </div>
  );
};
