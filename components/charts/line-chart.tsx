'use client';

import './register';
import type { ChartData, ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChartTheme, withAlpha } from '@/components/charts/use-chart-theme';

export interface LineDataset {
  label: string;
  data: number[];
  color: string;
  fill?: boolean;
}

export interface LineChartProps {
  labels: string[];
  datasets: LineDataset[];
  /** Width ÷ height. */
  aspectRatio?: number;
  ariaLabel?: string;
  className?: string;
}

export function LineChart({
  labels,
  datasets,
  aspectRatio = 2,
  ariaLabel = 'Line chart',
  className,
}: LineChartProps) {
  const { baseOptions } = useChartTheme();

  const data: ChartData<'line'> = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.fill ? withAlpha(ds.color, 0.15) : ds.color,
      pointBackgroundColor: ds.color,
      fill: ds.fill ? 'origin' : false,
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
    })),
  };

  const options: ChartOptions<'line'> = {
    ...baseOptions,
    aspectRatio,
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div className={className}>
      <Line data={data} options={options} aria-label={ariaLabel} role="img" />
    </div>
  );
}
