'use client';

import './register';
import type { ChartData, ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartTheme } from '@/components/charts/use-chart-theme';

export interface BarDataset {
  label: string;
  data: number[];
  color: string;
  /** One colour per bar, e.g. green/red for positive/negative net values. */
  colorsPerBar?: string[];
}

export interface BarChartProps {
  labels: string[];
  datasets: BarDataset[];
  /** Width ÷ height. */
  aspectRatio?: number;
  ariaLabel?: string;
  className?: string;
}

export function BarChart({
  labels,
  datasets,
  aspectRatio = 2,
  ariaLabel = 'Bar chart',
  className,
}: BarChartProps) {
  const { baseOptions } = useChartTheme();

  const data: ChartData<'bar'> = {
    labels,
    datasets: datasets.map((ds) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.colorsPerBar ?? ds.color,
      borderColor: ds.colorsPerBar ?? ds.color,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 36,
    })),
  };

  const options: ChartOptions<'bar'> = {
    ...baseOptions,
    aspectRatio,
    interaction: { mode: 'index', intersect: false },
  };

  return (
    <div className={className}>
      <Bar data={data} options={options} aria-label={ariaLabel} role="img" />
    </div>
  );
}
