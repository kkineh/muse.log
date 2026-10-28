'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

const RANGE_CLASS = 'w-full accent-[var(--t-accent)]';

export default function RAGSettingsPage() {
  const [matchThreshold, setMatchThreshold] = useState(0.7);
  const [matchCount, setMatchCount] = useState(3);
  const [maxTokens, setMaxTokens] = useState(300);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerateAll = async () => {
    if (
      !confirm(
        'This will regenerate embeddings for all published posts. This may take a while and will consume OpenAI API credits. Continue?'
      )
    ) {
      return;
    }

    setRegenerating(true);
    try {
      const response = await fetch('/api/embeddings/bulk', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) {
        alert(`Error: ${result.error || 'Unknown error'}`);
        return;
      }
      alert(
        `Completed: ${result.success}/${result.total} posts processed, ${result.failed} failed`
      );
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="adm-h1">RAG Settings</h1>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Search Parameters</h2>

        <div className="space-y-5">
          <div className="adm-field">
            <label>Match Threshold: {matchThreshold.toFixed(2)}</label>
            <input
              type="range"
              min="0.5"
              max="0.9"
              step="0.05"
              value={matchThreshold}
              onChange={(e) => setMatchThreshold(parseFloat(e.target.value))}
              className={RANGE_CLASS}
            />
            <p className="adm-hint">Higher values return more relevant results</p>
          </div>

          <div className="adm-field">
            <label>Number of Results: {matchCount}</label>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={matchCount}
              onChange={(e) => setMatchCount(parseInt(e.target.value))}
              className={RANGE_CLASS}
            />
            <p className="adm-hint">Number of posts to use as context</p>
          </div>

          <div className="adm-field">
            <label>Max Response Tokens: {maxTokens}</label>
            <input
              type="range"
              min="100"
              max="500"
              step="50"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className={RANGE_CLASS}
            />
            <p className="adm-hint">Maximum length of chatbot responses</p>
          </div>
        </div>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Embeddings Management</h2>

        <p className="mb-4 text-sm" style={{ color: 'var(--t-text2)' }}>
          Embeddings are automatically generated when you create or update a
          published post. You can manually regenerate all embeddings if needed.
        </p>

        <button
          onClick={handleRegenerateAll}
          disabled={regenerating}
          className="adm-btn adm-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} className={regenerating ? 'animate-spin' : ''} />
          {regenerating ? 'Regenerating...' : 'Regenerate All Embeddings'}
        </button>
      </div>

      <div className="adm-panel adm-section">
        <h2 className="adm-section-title">Model Information</h2>

        <div
          className="space-y-2 text-sm"
          style={{ color: 'var(--t-text2)' }}
        >
          <p>
            <strong style={{ color: 'var(--t-text)' }}>Embedding Model:</strong>{' '}
            text-embedding-3-small
          </p>
          <p>
            <strong style={{ color: 'var(--t-text)' }}>Chat Model:</strong>{' '}
            gpt-4o-mini
          </p>
          <p>
            <strong style={{ color: 'var(--t-text)' }}>Cost per embedding:</strong>{' '}
            ~$0.00004 per post
          </p>
          <p>
            <strong style={{ color: 'var(--t-text)' }}>Cost per chat:</strong>{' '}
            ~$0.0007 per conversation
          </p>
        </div>
      </div>
    </div>
  );
}
