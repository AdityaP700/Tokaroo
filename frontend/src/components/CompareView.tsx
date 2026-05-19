import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeDollarSign, Gauge, Trophy } from 'lucide-react';
import { apiRequest } from '../api/client';

const SAMPLE_TEXT = 'FastAPI powers an AI backend that chunks documents, retrieves semantically relevant passages, reranks candidates, and diagnoses context-window failures before the final prompt is sent to a model.';

export const CompareView: React.FC = () => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const compare = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await apiRequest('/compare', { text }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compare models.');
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => result ? Object.entries(result.models).map(([name, data]: any) => ({
    name,
    tokens: data.token_count,
    cost: data.est_input_cost,
    ctx: data.context_window,
    efficient: name === result.recommended_model,
  })) : [], [result]);

  return (
    <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <section className="workspace-hero">
        <div>
          <div className="label">Model Comparison</div>
          <h1 style={{ fontSize: '30px', margin: '8px 0 6px 0', letterSpacing: 0 }}>Token economics, side by side.</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '700px', lineHeight: 1.6 }}>
            Paste a prompt and compare token count, estimated input cost, context window, and the most efficient model for that text.
          </p>
        </div>
        <div className="workspace-hero-metric">
          <Trophy size={18} />
          <span>{result?.recommended_model ?? 'Awaiting text'}</span>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 0.8fr) minmax(560px, 1.3fr)', gap: '14px' }}>
        <div className="panel-elevated" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div className="label">Prompt text</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} style={{ height: '270px', marginTop: '8px' }} />
          </div>
          <button className="btn-primary" onClick={compare} disabled={loading || !text.trim()}>
            {loading ? 'Comparing' : 'Compare Models'}
          </button>
          {error && <div className="error-callout">{error}</div>}
        </div>

        <div className="panel-elevated" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="metric-grid">
            {[
              { icon: Trophy, label: 'Best model', value: result?.recommended_model ?? '-' },
              { icon: Gauge, label: 'Text length', value: result ? `${result.text_length_chars} chars` : '-' },
              { icon: BadgeDollarSign, label: 'Multiplier', value: result?.estimated_cost_multiplier ?? '-' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="metric-tile">
                <Icon size={16} />
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ height: '290px' }}>
            <div className="label" style={{ marginBottom: '8px' }}>Token count by model</div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal vertical={false} />
                <XAxis type="number" stroke="var(--text-muted)" />
                <YAxis dataKey="name" type="category" width={150} stroke="var(--text-muted)" />
                <Tooltip contentStyle={{ background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Bar dataKey="tokens" radius={[0, 6, 6, 0]}>
                  {rows.map((entry, index) => (
                    <Cell key={index} fill={entry.efficient ? '#FAFAFA' : 'rgba(255,255,255,0.28)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {rows.map((row) => (
              <div key={row.name} className="model-card">
                <strong>{row.name}</strong>
                <span>{row.tokens.toLocaleString()} tokens</span>
                <span>{row.ctx.toLocaleString()} context</span>
                <span>${row.cost.toFixed(6)} input</span>
              </div>
            ))}
            {!result && <div className="empty-state">Run a comparison to populate the model table.</div>}
          </div>
        </div>
      </section>
    </div>
  );
};
