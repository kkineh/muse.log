'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type ViewMode = 'weekly' | 'monthly' | 'yearly';

interface Props {
  data: { date: string; count: number }[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getRange(mode: ViewMode): [Date, Date] {
  const now = new Date();
  if (mode === 'weekly') {
    const start = new Date(now);
    const day = start.getDay();
    // Monday as week start
    start.setDate(start.getDate() - ((day + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return [start, end];
  }
  if (mode === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [start, end];
  }
  // yearly
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return [start, end];
}

function generateAllDays(
  data: { date: string; count: number }[],
  mode: ViewMode,
) {
  const countMap = new Map(data.map((d) => [d.date, d.count]));
  const [start, end] = getRange(mode);
  const days: { date: string; count: number }[] = [];
  const current = new Date(start);
  while (current <= end) {
    const key = current.toISOString().split('T')[0];
    days.push({ date: key, count: countMap.get(key) || 0 });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function formatLabel(date: string, mode: ViewMode): string {
  const d = new Date(date);
  if (mode === 'weekly') {
    return `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;
  }
  if (mode === 'monthly') {
    return `${d.getDate()}`;
  }
  // yearly: show month label on 1st of each month, empty otherwise
  if (d.getDate() === 1) {
    return `${d.getMonth() + 1}月`;
  }
  return '';
}

function getXAxisInterval(mode: ViewMode): number {
  if (mode === 'weekly') return 0;
  if (mode === 'monthly') return 4;
  return 0; // yearly: show all ticks, but formatLabel hides non-1st days
}

export default function PostTimelineChart({ data }: Props) {
  const [mode, setMode] = useState<ViewMode>('monthly');

  const chartData = useMemo(() => {
    const allDays = generateAllDays(data, mode);
    return allDays.map((d) => ({
      label: formatLabel(d.date, mode),
      date: d.date,
      count: d.count,
    }));
  }, [data, mode]);

  const modes: { value: ViewMode; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  // For yearly mode, use custom tick to only show month labels
  const xAxisProps =
    mode === 'yearly'
      ? {
          dataKey: 'date',
          tick: { fill: 'var(--t-muted)', fontSize: 11 },
          tickLine: false,
          axisLine: { stroke: 'var(--t-border-soft)' },
          interval: 0 as const,
          tickFormatter: (value: string) => {
            const d = new Date(value);
            return d.getDate() === 1 ? `${d.getMonth() + 1}月` : '';
          },
        }
      : {
          dataKey: 'label',
          tick: { fill: 'var(--t-muted)', fontSize: 12 },
          tickLine: false,
          axisLine: { stroke: 'var(--t-border-soft)' },
          interval: getXAxisInterval(mode),
        };

  return (
    <div className="adm-panel adm-section">
      <div className="flex items-center justify-between mb-4">
        <h3 className="adm-section-title" style={{ marginBottom: 0 }}>
          Post Upload Timeline
        </h3>
        <div
          className="flex gap-0.5 p-0.5"
          style={{ background: 'var(--t-sunken)', borderRadius: 'calc(var(--t-radius) - 6px)' }}
        >
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className="px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                borderRadius: 'calc(var(--t-radius) - 8px)',
                background: mode === m.value ? 'var(--t-surface)' : 'transparent',
                boxShadow: mode === m.value ? 'var(--t-shadow)' : 'none',
                color: mode === m.value ? 'var(--t-accent)' : 'var(--t-muted)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="adm-sub flex items-center justify-center h-[250px]">
          No posts this year
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, bottom: 5, left: -10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--t-border-soft)"
            />
            <XAxis {...xAxisProps} />
            <YAxis
              allowDecimals={false}
              tick={{ fill: 'var(--t-muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--t-border-soft)' }}
            />
            <Tooltip
              cursor={{ fill: 'color-mix(in srgb, var(--t-accent) 15%, transparent)' }}
              contentStyle={{
                background: 'var(--t-surface)',
                border: 'none',
                borderRadius: 'calc(var(--t-radius) - 6px)',
                boxShadow: 'var(--t-shadow)',
                color: 'var(--t-text)',
              }}
              itemStyle={{ color: 'var(--t-text2)' }}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  const date = payload[0]?.payload?.date;
                  if (date) {
                    const d = new Date(date);
                    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
                  }
                }
                return '';
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--t-accent)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
