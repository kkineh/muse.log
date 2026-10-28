'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const COLORS = ['#818cf8', '#a78bfa', '#38bdf8', '#34d399', '#fbbf24', '#f472b6'];

interface Props {
  data: { name: string; count: number }[];
}

export default function CategoryDistribution({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="adm-panel adm-section">
        <h3 className="adm-section-title">Posts by Category</h3>
        <div className="adm-sub flex items-center justify-center h-[200px]">
          No categories yet
        </div>
      </div>
    );
  }

  return (
    <div className="adm-panel adm-section">
      <h3 className="adm-section-title">Posts by Category</h3>
      <ResponsiveContainer width="100%" height={data.length * 40 + 20}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
          <XAxis type="number" allowDecimals={false} hide />
          <YAxis
            type="category"
            dataKey="name"
            width={100}
            tick={{ fill: 'var(--t-muted)', fontSize: 13 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--t-sunken)' }}
            contentStyle={{
              background: 'var(--t-surface)',
              border: 'none',
              borderRadius: 'calc(var(--t-radius) - 6px)',
              boxShadow: 'var(--t-shadow)',
              color: 'var(--t-text)',
            }}
            itemStyle={{ color: 'var(--t-text2)' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
