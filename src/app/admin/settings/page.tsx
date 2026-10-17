'use client';

import { NEURAL_PALETTES } from '@/lib/neural-palettes';
import { setNeuralPalette, useNeuralPalette } from '@/hooks/useNeuralPalette';

export default function SettingsPage() {
  const paletteIndex = useNeuralPalette();

  return (
    <div>
      <h1
        className="text-3xl font-bold mb-8"
        style={{ color: 'var(--text-primary)' }}
      >
        Blog Settings
      </h1>

      <div className="card p-6 mb-6">
        <h2
          className="text-xl font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Theme Color
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          선택한 색은 이 브라우저에 저장됩니다.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {NEURAL_PALETTES.map((p, i) => {
            const selected = i === paletteIndex;
            return (
              <button
                key={p.name}
                type="button"
                onClick={() => setNeuralPalette(i)}
                className="rounded-xl p-3 text-left transition-all"
                style={{
                  border: `1px solid ${selected ? p.cat : 'var(--border-color)'}`,
                  background: selected ? 'var(--bg-tertiary)' : 'transparent',
                  boxShadow: selected ? `0 0 0 1px ${p.cat}` : 'none',
                }}
              >
                <div className="mb-2 flex gap-1.5">
                  {[p.cat, p.sub, p.sub3, p.signal].map((c, k) => (
                    <span key={k} className="h-4 w-4 rounded-full" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  {i + 1}. {p.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card p-6">
        <h2
          className="text-xl font-semibold mb-6"
          style={{ color: 'var(--text-primary)' }}
        >
          Environment Variables
        </h2>

        <div
          className="space-y-4 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div>
            <strong>Supabase URL:</strong>
            <p
              className="mt-1 p-3 rounded-lg font-mono text-xs"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not configured'}
            </p>
          </div>

          <div>
            <strong>Admin Email:</strong>
            <p
              className="mt-1 p-3 rounded-lg font-mono text-xs"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'Not configured'}
            </p>
          </div>

          <div>
            <strong>OpenAI API Key:</strong>
            <p
              className="mt-1 p-3 rounded-lg font-mono text-xs"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              {process.env.OPENAI_API_KEY
                ? '***' + process.env.OPENAI_API_KEY.slice(-4)
                : 'Not configured'}
            </p>
          </div>
        </div>

        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--border-color)' }}>
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Quick Links
          </h2>

          <div className="space-y-2">
            <a
              href="https://app.supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg transition-all"
              style={{
                color: 'var(--color-primary)',
                border: '1px solid var(--border-color)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              📊 Supabase Dashboard
            </a>

            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg transition-all"
              style={{
                color: 'var(--color-primary)',
                border: '1px solid var(--border-color)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              💰 OpenAI Usage Dashboard
            </a>

            <a
              href="https://vercel.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-lg transition-all"
              style={{
                color: 'var(--color-primary)',
                border: '1px solid var(--border-color)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              🚀 Vercel Dashboard
            </a>
          </div>
        </div>

        <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--border-color)' }}>
          <h2
            className="text-xl font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Documentation
          </h2>

          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            For detailed setup instructions and documentation, see the{' '}
            <code
              className="px-2 py-1 rounded"
              style={{ background: 'var(--bg-tertiary)' }}
            >
              description.md
            </code>{' '}
            file in the project root.
          </p>
        </div>
      </div>
    </div>
  );
}
