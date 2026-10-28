'use client';

import { Database, DollarSign, Rocket } from 'lucide-react';
import { NEURAL_PALETTES } from '@/lib/neural-palettes';
import { setNeuralPalette, useNeuralPalette } from '@/hooks/useNeuralPalette';

const ENV_VALUE_CLASS =
  'mt-1 rounded-[10px] bg-[var(--t-sunken)] p-3 font-mono text-xs';

export default function SettingsPage() {
  const paletteIndex = useNeuralPalette();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="adm-h1">Blog Settings</h1>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Theme Color</h2>
        <p className="adm-hint mb-4">선택한 색은 이 브라우저에 저장됩니다.</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {NEURAL_PALETTES.map((p, i) => {
            const selected = i === paletteIndex;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setNeuralPalette(i)}
                className="rounded-[12px] bg-[var(--t-sunken)] p-3 text-left transition-shadow"
                style={{ boxShadow: selected ? `0 0 0 2px ${p.cat}` : 'none' }}
              >
                <div className="mb-2 flex gap-1.5">
                  {[p.cat, p.sub, p.sub3, p.signal].map((c, k) => (
                    <span key={k} className="h-4 w-4 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-sm" style={{ color: 'var(--t-text)' }}>
                  {i + 1}. {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Environment Variables</h2>

        <div className="space-y-4 text-sm" style={{ color: 'var(--t-text2)' }}>
          <div>
            <strong style={{ color: 'var(--t-text)' }}>Supabase URL:</strong>
            <p className={ENV_VALUE_CLASS}>
              {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--t-text)' }}>Admin Email:</strong>
            <p className={ENV_VALUE_CLASS}>
              {process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'Not configured'}
            </p>
          </div>

          <div>
            <strong style={{ color: 'var(--t-text)' }}>OpenAI API Key:</strong>
            <p className={ENV_VALUE_CLASS}>
              {process.env.OPENAI_API_KEY
                ? '***' + process.env.OPENAI_API_KEY.slice(-4)
                : 'Not configured'}
            </p>
          </div>
        </div>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Quick Links</h2>

        <div className="flex flex-wrap gap-3">
          <a
            href="https://app.supabase.com"
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn"
          >
            <Database size={15} /> Supabase Dashboard
          </a>

          <a
            href="https://platform.openai.com/usage"
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn"
          >
            <DollarSign size={15} /> OpenAI Usage Dashboard
          </a>

          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn"
          >
            <Rocket size={15} /> Vercel Dashboard
          </a>
        </div>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Documentation</h2>

        <p className="text-sm" style={{ color: 'var(--t-text2)' }}>
          For detailed setup instructions and documentation, see the{' '}
          <code className="rounded-[8px] bg-[var(--t-sunken)] px-2 py-1">
            description.md
          </code>{' '}
          file in the project root.
        </p>
      </div>
    </div>
  );
}
