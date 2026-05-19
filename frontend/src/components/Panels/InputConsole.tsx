import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { mockSimulation } from '../../api/mockSimulation';

const MODELS = [
  { id: 'gpt-4o',        label: 'GPT-4o',         ctx: '128k' },
  { id: 'gpt-4',         label: 'GPT-4',           ctx: '8k'   },
  { id: 'claude-3-opus', label: 'Claude 3 Opus',   ctx: '200k' },
  { id: 'llama-3-8b',    label: 'Llama 3 8B',      ctx: '8k'   },
];

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border)', margin: '0.25rem 0' }} />;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

function SliderField({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{min}{unit}</span>
        <span className="value-mono" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{value}{unit}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{max}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))} />
    </Field>
  );
}

export const InputConsole: React.FC = () => {
  const { input, simulation, setInput, setSimulation, setAnalysis } = useStore();

  const estimatedTokens = useMemo(() => Math.ceil(input.text.length / 4), [input.text]);
  const estimatedChunks = useMemo(() => {
    if (!input.text.length) return 0;
    const effective = Math.max(1, input.chunk_size - input.overlap);
    return Math.max(1, Math.ceil(estimatedTokens / effective));
  }, [estimatedTokens, input.chunk_size, input.overlap]);

  const handleSimulate = () => {
    setSimulation({ loading: true, chunks: [], edges: [], attention: [] });
    setTimeout(() => {
      const result = mockSimulation(input);
      const highRisk = result.chunks.filter((c: any) => c.risk_level === 'high').length;
      const avgRel   = result.chunks.reduce((s: number, c: any) => s + c.relevance, 0) / result.chunks.length;
      const health   = Math.round(Math.max(20, avgRel * 100 - highRisk * 10));
      const issues: any[] = [];
      if (highRisk > 0) issues.push({ type: 'high_risk_chunks', label: `${highRisk} high-risk chunks`, severity: 'warning' });
      if (avgRel < 0.55) issues.push({ type: 'weak_query_match', label: 'Low average relevance', severity: 'error' });
      setSimulation({ chunks: result.chunks, edges: result.edges, attention: result.attention, loading: false });
      setAnalysis({ health_score: health, issues, diagnosis: issues.length === 0 ? 'optimal' : issues[0].type });
    }, 1300);
  };

  const isLoading = simulation.loading;

  return (
    <div className="panel" style={{
      height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem',
    }}>
      {/* Header */}
      <div>
        <div className="label" style={{ marginBottom: '4px' }}>Control Console</div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Input Config</div>
      </div>

      <Divider />

      {/* Model */}
      <Field label="Model">
        <select value={input.model} onChange={(e) => setInput({ model: e.target.value })}>
          {MODELS.map(m => (
            <option key={m.id} value={m.id}>{m.label} · {m.ctx}</option>
          ))}
        </select>
      </Field>

      {/* Sliders */}
      <SliderField label="Chunk Size" value={input.chunk_size} min={50} max={1000} step={10} unit=" t" onChange={v => setInput({ chunk_size: v })} />
      <SliderField label="Overlap"    value={input.overlap}    min={0}  max={200} step={5}  unit=" t" onChange={v => setInput({ overlap: v })} />
      <SliderField label="Top K"      value={input.top_k}      min={1}  max={20}  step={1}  unit=""   onChange={v => setInput({ top_k: v })} />

      <Divider />

      {/* Text input */}
      <Field label="Context Text">
        <textarea
          value={input.text}
          onChange={(e) => setInput({ text: e.target.value })}
          placeholder="Paste a long document here…"
          style={{ height: '100px', flex: 'none' }}
        />
      </Field>

      {/* Live estimates */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '8px', padding: '10px 12px',
        background: 'var(--elevated)', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}>
        <div>
          <div className="label" style={{ marginBottom: '3px' }}>Est. Tokens</div>
          <div className="value-mono">{estimatedTokens > 0 ? estimatedTokens.toLocaleString() : '—'}</div>
        </div>
        <div>
          <div className="label" style={{ marginBottom: '3px' }}>Est. Chunks</div>
          <div className="value-mono">{estimatedChunks > 0 ? estimatedChunks : '—'}</div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* CTA button — pure white */}
      <button className="btn-primary" onClick={handleSimulate} disabled={isLoading}>
        {isLoading ? '· · ·' : '▶  Run Simulation'}
      </button>
    </div>
  );
};
